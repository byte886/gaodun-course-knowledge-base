#!/usr/bin/env node
/**
 * ep3_download_videos.js — 名师专业课（ep3/epiphany，saasCourseType=13）视频采集薄编排
 *
 * 链路（全部机制已端到端验证，见 ADR-018 / video-processing.md ep3 小节）：
 *   syllabus 树递归枚举讲次
 *     → getVideoInfo(resourceId) 拿 video_id / teacher / discriminator（非 video 跳过）
 *     → glive2-vod live/resource?res=FHD 拿 m3u8 + subtitle(VTT) + duration
 *     → capture_video_key.js（CDP 复用日常 Chrome 播放页，gp.play()+切1080P）拿 FHD keyAscii（按 videoId:res 缓存）
 *     → download_decrypt.js（HLS 分片下载 + AES-128-CBC 解密 + 合并 ts）
 *     → ffmpeg -c copy 转 mp4
 *     → 下载平台 VTT 原始稿 subtitle.vtt，并转 transcript.md（替代 FunASR；平台自带字幕）
 *
 * 设计原则：薄编排，不重复实现取 key / 下载解密（复用既有脚本）；断点续跑；单讲失败不中断批量。
 *
 * 用法：
 *   # 1) 枚举某 syllabus 下全部视频讲次（不下载）
 *   node ep3_download_videos.js --course 17244 --parent-grad 23408 --grad 62676 --syllabus 57580 --list
 *
 *   # 2) 下载单个讲次（直接给播放页 URL，最稳，用于试点）
 *   node ep3_download_videos.js --learning-url "<ep3 learning url>" --out data/_workspace/_account/ep3/downloads/17244
 *
 *   # 3) 批量下载整个 syllabus（递归枚举 + 逐个下载，断点续跑）
 *   node ep3_download_videos.js --course 17244 --parent-grad 23408 --grad 62676 --syllabus 57580 \
 *        --out <dir> [--res FHD] [--limit N] [--concurrency 16] [--dual-teacher]
 *
 * 注意：取 key 依赖日常 Chrome 已登录且可播放 ep3（CDP 复用登录态，绝不用自带浏览器）。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const core = require('./gaodun_paper_core');

const GATEWAY = 'https://apigateway.gaodun.com';
const TEACHER_NAME = { 22455: '姚远', 14178: '陈蓓蓓', 11138: '罗翔', 15038: '郁刚', 57023: '王潇粒' };
const SCRIPT_DIR = __dirname;
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');

// ---------- 参数 ----------
function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i += 1) {
    const k = argv[i];
    if (k.startsWith('--')) a[k.slice(2)] = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true;
  }
  a.res = a.res || 'FHD';           // 默认 1080P
  a.concurrency = parseInt(a.concurrency || '16', 10);
  return a;
}
const ARGS = parseArgs(process.argv);
if (!ARGS.out && !ARGS.list) { console.error('需要 --out <输出目录>（或 --list 仅枚举）'); process.exit(2); }

function ep3Headers() {
  const H = core.makeHeaders(core.findJwt());
  H.Referer = 'https://epiphany.gaodun.com/';
  return H;
}
async function apiGet(p) {
  const r = await fetch(GATEWAY + p, { headers: ep3Headers() });
  return r.json();
}
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
function log(...x) { console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...x); }

// ---------- 1. syllabus 树递归，收集视频讲次叶子 ----------
async function fetchSyllabus(cid, grad, syllabus) {
  const r = await apiGet(`/ep-study/front/course/${cid}/syllabus?gradation_id=${grad}&syllabus_id=${syllabus}`);
  if (r.status !== 0) throw new Error(`syllabus 接口失败 status=${r.status} ${r.info || r.message || ''}`);
  return r.result;
}

// 在某顶层阶段里找到 grad 节点（可能在顶层或其 children），返回它的章节树（g.syllabus 或递归 children）
function locateGradTree(result, gradId) {
  const stages = result.syllabus || [];
  for (const st of stages) {
    if (String(st.id) === String(gradId)) return st;
    if (Array.isArray(st.children)) {
      for (const c of st.children) if (String(c.id) === String(gradId)) return c;
    }
  }
  return null;
}

// 递归：把树里所有"带 resource_id 的讲次叶子"收集起来，同时记录章路径与顶层 chapterId
function collectLeaves(node, ctx, acc) {
  const myCtx = { ...ctx };
  // 顶层"章"节点：带 cs_item_ids / video_total，记录其 id 作为 learning URL 的 chapterId
  const isChapter = Array.isArray(node.cs_item_ids) || (node.video_total !== undefined && (!ctx.chapterId));
  if (isChapter && !ctx.chapterId) myCtx.chapterId = node.id;
  myCtx.path = ctx.path ? `${ctx.path}/${node.name}` : node.name;

  if (node.resource_id != null && (!Array.isArray(node.children) || node.children.length === 0)) {
    acc.push({
      csItemId: node.id,
      resourceId: node.resource_id,
      chapterId: myCtx.chapterId,
      name: node.name,
      chapterPath: myCtx.path,
    });
  }
  if (Array.isArray(node.children)) node.children.forEach((c) => collectLeaves(c, myCtx, acc));
  // g.syllabus 是另一种存章节树的字段
  if (Array.isArray(node.syllabus)) node.syllabus.forEach((c) => collectLeaves(c, myCtx, acc));
  return acc;
}

// grad 节点的章节树可能挂在 .syllabus（25/26 全面精讲）或 .children（基础必修）
function leavesOfGrad(gradNode) {
  const acc = [];
  const roots = Array.isArray(gradNode.syllabus) ? gradNode.syllabus
    : Array.isArray(gradNode.children) ? gradNode.children : [];
  roots.forEach((n) => collectLeaves(n, { chapterId: null, path: '' }, acc));
  return acc;
}

// ---------- 2. getVideoInfo：resourceId → video_id / teacher / 类型 ----------
async function getVideoInfo(cid, csItemId, syllabusId, resourceId) {
  const p = `/ep-study/api/v1/front/resource/${resourceId}`
    + `?courseId=${cid}&csItemId=${csItemId}&syllabusId=${syllabusId}&is_show_live=0&isRelatedResource=1`;
  const r = await apiGet(p);
  if (r.status !== 0) throw new Error(`getVideoInfo ${resourceId} status=${r.status}`);
  return r.result && r.result.resource;
}

// ---------- 3. live/resource：videoId → m3u8 / subtitle / duration ----------
async function getLiveResource(videoId, res) {
  const r = await apiGet(`/glive2-vod/api/v1/live/resource?code=${videoId}&res=${res}&lang=zh`);
  if (r.status !== 200 && r.status !== 0) throw new Error(`live/resource ${videoId} status=${r.status} ${r.message || ''}`);
  const item = r.result.list && r.result.list[res];
  if (!item || !item.available) throw new Error(`清晰度 ${res} 不可用: ${videoId}`);
  return { m3u8Url: item.path, subtitleUrl: r.result.subtitle || null, duration: r.result.duration || 0, transcodeId: item.transcode_id };
}

// ---------- 4. 取 key（复用 capture_video_key.js，带缓存） ----------
function captureKey(learningUrl, cache, cachePath) {
  const tmpOut = path.join(cache._work, `cap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.json`);
  execFileSync('node', [path.join(SCRIPT_DIR, 'capture_video_key.js'), learningUrl, tmpOut], { stdio: ['ignore', 'ignore', 'inherit'], timeout: 120000 });
  const arr = JSON.parse(fs.readFileSync(tmpOut, 'utf8'));
  fs.rmSync(tmpOut, { force: true });
  const byQ = {};
  for (const s of arr) byQ[s.quality.startsWith('FHD') ? 'FHD' : 'SD'] = s;
  return byQ;
}

// ---------- 5. 下载 m3u8 + 解密 + ffmpeg（复用 download_decrypt.js） ----------
function downloadHttp(url, outFile, headers) {
  // 用 curl 落盘（支持重定向、稳定）
  const args = ['-sL', '--fail', '-o', outFile];
  if (headers) Object.entries(headers).forEach(([k, v]) => { args.push('-H', `${k}: ${v}`); });
  args.push(url);
  execFileSync('curl', args, { timeout: 300000 });
}
function decryptToMp4(m3u8Url, keyAscii, outMp4, workDir, concurrency) {
  fs.mkdirSync(workDir, { recursive: true });
  const m3u8File = path.join(workDir, 'index.m3u8');
  const tsFile = path.join(workDir, 'out.ts');
  const segDir = path.join(workDir, 'segs');
  downloadHttp(m3u8Url, m3u8File);
  const m3u8 = fs.readFileSync(m3u8File, 'utf8');
  const ivM = m3u8.match(/IV=0x([0-9a-fA-F]+)/);
  if (!ivM) throw new Error('m3u8 中未找到 IV');
  const ivHex = ivM[1];
  fs.rmSync(segDir, { recursive: true, force: true });
  execFileSync('node', [path.join(REPO_ROOT, 'scripts', 'download_decrypt.js'), m3u8File, tsFile, segDir, keyAscii, ivHex, String(concurrency)], { stdio: ['ignore', 'inherit', 'inherit'], timeout: 1800000 });
  execFileSync('ffmpeg', ['-y', '-i', tsFile, '-c', 'copy', outMp4], { stdio: ['ignore', 'ignore', 'ignore'], timeout: 600000 });
  fs.rmSync(segDir, { recursive: true, force: true });
  fs.rmSync(tsFile, { force: true });
  fs.rmSync(m3u8File, { force: true });
  return ivHex;
}

// ---------- 6. VTT → transcript.md（对齐正课格式：# video / 元信息 / ## 第N段） ----------
function parseVtt(text) {
  const cues = [];
  const blocks = text.replace(/^WEBVTT.*\n/, '').split(/\n\s*\n/);
  for (const b of blocks) {
    const lines = b.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const tl = lines.findIndex((l) => l.includes('-->'));
    if (tl < 0) continue;
    const tm = lines[tl].match(/(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/);
    if (!tm) continue;
    const toSec = (h, m, s) => parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10);
    const start = toSec(tm[1], tm[2], tm[3]);
    const t = lines.slice(tl + 1).join('').replace(/<[^>]+>/g, '').trim();
    if (t) cues.push({ start, text: t });
  }
  return cues;
}
function vttToTranscript(vttText, durationSec, sourceLabel) {
  const cues = parseVtt(vttText);
  // 相邻去重（滚动字幕可能重复上一句）
  const uniq = [];
  for (const c of cues) {
    const prev = uniq[uniq.length - 1];
    if (prev && prev.text === c.text) continue;
    uniq.push(c);
  }
  // 聚合成饱满段落（对齐正课 FunASR 大段风格，目标 200–400 字/段）：
  //  - 达 200 字且当前 cue 以句末标点结尾 → 断段
  //  - 达 400 字 → 强制断段（即使无标点）
  //  - 停顿 >4s 且当前段已 ≥120 字 → 断段（话题切换）
  const paras = [];
  let buf = ''; let prevStart = null;
  const flush = () => { if (buf.trim()) paras.push(buf.trim()); buf = ''; };
  const SENT_END = /[。？!?；;]$/;
  for (const c of uniq) {
    const gap = prevStart == null ? 0 : c.start - prevStart;
    if (buf && gap > 4 && buf.length >= 120) flush();
    buf += c.text;
    if ((buf.length >= 200 && SENT_END.test(c.text)) || buf.length >= 400) flush();
    prevStart = c.start;
  }
  flush();
  const totalChars = uniq.reduce((n, c) => n + c.text.length, 0);
  const mm = Math.round((durationSec || 0) / 60);
  const durLabel = durationSec ? `${(durationSec / 3600).toFixed(1)}小时` : '未知时长';
  const head = `# video\n\n> ${sourceLabel || '平台字幕(VTT)'} | 时长${mm >= 60 ? durLabel : mm + '分钟'} | 约${totalChars}字\n`;
  const body = paras.map((p, i) => `## 第${i + 1}段\n\n${p}`).join('\n\n');
  return head + '\n' + body + '\n';
}

// ---------- 单讲完整下载 ----------
function safeName(s) { return String(s).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '').slice(0, 60); }

async function downloadOne(leaf, ctx) {
  const { cid, parentGrad, grad, syllabus, outDir, res, concurrency, dualTeacher, keyCache, keyCachePath } = ctx;
  // learning URL（capture 取 key 用）
  const learningUrl = `https://epiphany.gaodun.com/ep3/course/${cid}/learning/1/${parentGrad}/${grad}/${syllabus}/${leaf.chapterId}/${leaf.csItemId}/${leaf.resourceId}/0`;

  const info = await getVideoInfo(cid, leaf.csItemId, syllabus, leaf.resourceId);
  if (!info || info.discriminator !== 'video' || !info.video_id) {
    return { skipped: true, reason: `非视频(${info && info.discriminator})`, name: leaf.name };
  }
  const videoId = info.video_id;
  const teacher = TEACHER_NAME[info.teacher_id] || (info.teacher_id ? `T${info.teacher_id}` : '');
  const lr = await getLiveResource(videoId, res);

  const dirName = `${String(leaf.seq).padStart(2, '0')}_${safeName(leaf.name)}`;
  const lessonDir = path.join(outDir, dirName);
  fs.mkdirSync(lessonDir, { recursive: true });
  const pfx = dualTeacher && teacher ? `${teacher}_` : '';
  const mp4 = path.join(lessonDir, `${pfx}video.mp4`);
  const vtt = path.join(lessonDir, `${pfx}subtitle.vtt`);
  const md = path.join(lessonDir, `${pfx}transcript.md`);

  // 断点续跑：视频
  if (fs.existsSync(mp4) && fs.statSync(mp4).size > 0) {
    log(`  跳过视频(已存在 ${(fs.statSync(mp4).size / 1e6).toFixed(1)}MB): ${dirName}`);
  } else {
    const cacheKey = `${videoId}:${res}`;
    let streams = keyCache[cacheKey];
    if (!streams || !streams[res]) {
      log(`  取 key（CDP 播放）: ${dirName}`);
      streams = captureKey(learningUrl, keyCache, keyCachePath);
      keyCache[cacheKey] = streams;
      fs.writeFileSync(keyCachePath, JSON.stringify(keyCache, null, 2));
    }
    const wanted = streams[res];
    if (!wanted || !wanted.keyAscii) throw new Error(`capture 未取到 ${res} key（${dirName}）`);
    log(`  下载解密 ${res} key=${wanted.keyAscii}: ${dirName}`);
    decryptToMp4(wanted.m3u8, wanted.keyAscii, mp4, path.join(lessonDir, '_work'), concurrency);
    fs.rmSync(path.join(lessonDir, '_work'), { recursive: true, force: true });
    log(`  ✓ 视频完成: ${dirName} (${(fs.statSync(mp4).size / 1e6).toFixed(1)}MB)`);
  }

  // VTT 原始稿 + transcript（断点续跑）
  if (lr.subtitleUrl) {
    if (!fs.existsSync(vtt)) downloadHttp(lr.subtitleUrl, vtt);
    if (!fs.existsSync(md)) {
      const vttText = fs.readFileSync(vtt, 'utf8');
      fs.writeFileSync(md, vttToTranscript(vttText, lr.duration, '平台字幕(VTT，免转写)'));
    }
  } else {
    log(`  ⚠ 无字幕: ${dirName}`);
  }
  fs.writeFileSync(path.join(lessonDir, `${pfx}meta.json`), JSON.stringify({
    videoId, transcodeId: lr.transcodeId, teacherId: info.teacher_id, teacher, res,
    durationSec: lr.duration, csItemId: leaf.csItemId, resourceId: leaf.resourceId, chapterPath: leaf.chapterPath,
  }, null, 2));
  return { ok: true, name: dirName, teacher, durationSec: lr.duration };
}

function buildLearningUrlFromArg(u) {
  // /ep3/course/<cid>/learning/1/<parentGrad>/<grad>/<syllabus>/<chapter>/<csItem>/<resource>/0
  const m = u.match(/\/course\/(\d+)\/learning\/\d+\/(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)/);
  if (!m) throw new Error(`无法解析 learning URL: ${u}`);
  return { cid: m[1], parentGrad: m[2], grad: m[3], syllabus: m[4], chapterId: m[5], csItemId: m[6], resourceId: m[7] };
}

// ---------- main ----------
function initCache(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const cacheDir = path.join(outDir, '.ep3cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const keyCachePath = path.join(cacheDir, 'keycache.json');
  const keyCache = fs.existsSync(keyCachePath) ? JSON.parse(fs.readFileSync(keyCachePath, 'utf8')) : {};
  keyCache._work = cacheDir;
  return { cacheDir, keyCachePath, keyCache };
}

(async () => {
  // 模式 A：单讲（--learning-url）
  if (ARGS['learning-url']) {
    const outDir = ARGS.out;
    if (!outDir) { console.error('单讲模式需要 --out'); process.exit(2); }
    const { keyCache, keyCachePath } = initCache(outDir);
    const p = buildLearningUrlFromArg(ARGS['learning-url']);
    const leaf = { csItemId: Number(p.csItemId), resourceId: Number(p.resourceId), chapterId: Number(p.chapterId), name: ARGS.name || 'single', seq: 0 };
    const ctx = { cid: p.cid, parentGrad: p.parentGrad, grad: p.grad, syllabus: p.syllabus, outDir, res: ARGS.res, concurrency: ARGS.concurrency, dualTeacher: !!ARGS['dual-teacher'], keyCache, keyCachePath };
    const r = await downloadOne(leaf, ctx);
    log('单讲结果:', JSON.stringify(r));
    process.exit(0);
  }

  // 模式 B/C：枚举 syllabus
  const cid = ARGS.course, parentGrad = ARGS['parent-grad'], grad = ARGS.grad, syllabus = ARGS.syllabus;
  if (!cid || !grad || !syllabus) { console.error('批量/枚举需要 --course --parent-grad --grad --syllabus'); process.exit(2); }
  const result = await fetchSyllabus(cid, grad, syllabus);
  const gradNode = locateGradTree(result, grad);
  if (!gradNode) { console.error('未找到 gradation 节点', grad); process.exit(1); }
  const leaves = leavesOfGrad(gradNode);
  leaves.forEach((l, i) => { l.seq = i + 1; });
  log(`枚举到 ${leaves.length} 个讲次叶子`);

  if (ARGS.list) {
    for (const l of leaves) console.log(`${String(l.seq).padStart(3)} cs=${l.csItemId} rid=${l.resourceId} ch=${l.chapterId} | ${l.chapterPath}`);
    process.exit(0);
  }

  // 批量下载（--list 已在上面退出）
  const outDir = ARGS.out;
  if (!outDir) { console.error('批量下载需要 --out'); process.exit(2); }
  const { cacheDir, keyCache, keyCachePath } = initCache(outDir);
  const limit = ARGS.limit ? parseInt(ARGS.limit, 10) : leaves.length;
  let okN = 0, skipN = 0, failN = 0; const fails = [];
  for (let i = 0; i < Math.min(limit, leaves.length); i += 1) {
    const leaf = leaves[i];
    try {
      const r = await downloadOne(leaf, { cid, parentGrad: parentGrad || grad, grad, syllabus, outDir, res: ARGS.res, concurrency: ARGS.concurrency, dualTeacher: !!ARGS['dual-teacher'], keyCache, keyCachePath });
      if (r.skipped) { skipN += 1; log(`跳过(${r.reason}): ${r.name}`); } else { okN += 1; }
    } catch (e) {
      failN += 1; fails.push({ leaf: leaf.name, err: e.message });
      log(`✗ 失败: ${leaf.name} — ${e.message}`);
    }
  }
  log(`批量结束：成功/已下载 ${okN}，非视频跳过 ${skipN}，失败 ${failN}`);
  if (fails.length) { fs.writeFileSync(path.join(cacheDir, 'fails.json'), JSON.stringify(fails, null, 2)); log('失败明细 -> .ep3cache/fails.json'); process.exit(1); }
  process.exit(0);
})().catch((e) => { console.error('[FATAL]', e.stack || e.message); process.exit(1); });

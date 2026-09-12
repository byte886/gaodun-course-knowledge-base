/**
 * refresh_ep3_inventory.js — 刷新 ep3(epiphany/saasType=13) 名师课作业基线（只读，不交卷、不 redo）
 *
 * 与 refresh_inventory.js（glive 单 syllabus 模型）的区别：名师课没有 primaryCourse.syllabusId，
 * 做题 syllabus 按阶段挂在 profile.stages[].syllabusId；试卷是 ep-study syllabus 树里
 * discriminator==='paper' 的叶子（内嵌 resource.paper_id）。本脚本：
 *   1) 遍历 profile.stages（26 考季四阶段），逐阶段拉 ep-study/syllabus，递归收集全部 paper 叶子；
 *   2) 硬排除标题含「冲刺模考」的冲刺卷（最后单独做，落 papers_sprint.json，不进 audit）；
 *   3) 其余基础卷逐张只读 student/paper/record，已交卷再 paper/analysis 复核，分类口径与
 *      refresh_inventory 完全一致（满分 / 平台最优 / 非满分 / 未提交 / 未做）；
 *   4) 写出 manifest/papers_inventory.json（全量）、papers_audit.json（待做）、papers_sprint.json（冲刺）。
 *
 * 用法：node scripts/cdp/refresh_ep3_inventory.js --profile ep3-finance-2026 [--no-record]
 *   --no-record：只枚举 syllabus 全集、不逐张 record（快，cls 全置 Unknown），用于先看总量
 * 只读、低频（每张 record 间隔 250ms），不触发做题风控 10462221（不调 redo/submit）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { findJwt, makeHeaders, platformHeaders, MINERVA_BASE, SOURCE_FROM_TYPE: SFT,
  canonAnswer, htmlToTextKeepLayout, isPlaceholderAnswerText } = require('./gaodun_paper_core');
const { loadProfile, workspaceDirFor, argvProfileKey } = require('./load_profile');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOT = path.resolve(__dirname, '..', '..');
const GW = 'https://apigateway.gaodun.com';
const isSprint = (t) => /冲刺模考/.test(t || '');

// 递归 ep-study syllabus 树（子节点键可能是 children 或 syllabus），收集 paper 叶子并维护最近章节祖先
function collect(node, stage, ch, acc) {
  let c = ch;
  const kids = node.resource_id == null && !node.resource; // 中间章节节点
  if (kids && node.name && (!Array.isArray(node.children) || true)) c = node.name; // 章节名向下传
  const res = node.resource;
  if (res && res.discriminator === 'paper' && res.paper_id) {
    acc.push({
      paperId: res.paper_id, resourceId: node.resource_id != null ? node.resource_id : res.id,
      csItemId: node.id, chapter: ch, stage,
      title: res.title || node.name, num: res.num, progress: node.progress ?? null,
    });
  }
  if (Array.isArray(node.children)) node.children.forEach((x) => collect(x, stage, c, acc));
  if (Array.isArray(node.syllabus)) node.syllabus.forEach((x) => collect(x, stage, c, acc));
}

// 与 refresh_inventory.inspectSubmitted 同口径：已交卷但分低时，只读复核是否「平台最优」
async function inspectSubmitted(H, logId) {
  const z = await (await fetch(`${MINERVA_BASE}/paper/analysis`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ paperDataLogId: logId, openEnergyToEquity: 1 }),
  })).json();
  if (z.status !== 0) return { best: false, err: `${z.status} ${z.message}` };
  let configured = 0; let configuredFull = 0; let unsupported = 0; let ceiling = 0; const bad = [];
  const norm = (s) => String(s || '').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
  const answerMatchesCanon = (leaf) => {
    const qa = leaf.questionAnswer || {};
    const std = !isPlaceholderAnswerText(qa.answer) ? htmlToTextKeepLayout(qa.answer) : canonAnswer(qa.analysis);
    const canon = norm(std); const mine = norm((leaf.userAnswer || {}).userAnswer);
    if (!canon || mine.length < Math.min(20, canon.length * 0.5)) return false;
    return canon.includes(mine) || mine.includes(canon);
  };
  const judgeLeaf = (leaf) => {
    const t = leaf.questionType; const ai = leaf.aiCorrect; const ua = leaf.userAnswer || {};
    if (t === 6) {
      if (ai && ai.cpaBotType === 3) {
        configured += 1;
        if (ai.correctStatus === 2) configuredFull += 1;
        else if (ai.correctStatus === 6 && answerMatchesCanon(leaf)) ceiling += 1;
        else if (ai.correctStatus === 3) ceiling += 1;
        else if (ai.correctStatus === 1) ceiling += 1;
        else bad.push({ q: leaf.questionId, cs: ai.correctStatus });
      } else unsupported += 1;
    } else if (t !== 5) {
      if ((ua.userScore || 0) < (leaf.score || 0)) bad.push({ q: leaf.questionId, score: ua.userScore, full: leaf.score });
    }
  };
  for (const m of z.result.moduleList || []) for (const q of m.questionList || []) {
    if (q.questionType === 5 && Array.isArray(q.subQuestionList)) q.subQuestionList.forEach(judgeLeaf);
    else judgeLeaf(q);
  }
  return { best: bad.length === 0 && configured === configuredFull + ceiling, configured, configuredFull, unsupported, ceiling, bad };
}

(async () => {
  const profile = loadProfile(argvProfileKey());
  const cid = profile.primaryCourse.saasCourseId;
  const noRecord = process.argv.includes('--no-record');
  const manifestDir = workspaceDirFor(profile.key, 'manifest');
  fs.mkdirSync(manifestDir, { recursive: true });
  const H = { ...platformHeaders(findJwt(), 'ep3') };
  const jget = async (p) => (await fetch(GW + p, { headers: H })).json();

  // 1) 逐 stage 枚举 paper 叶子
  const all = [];
  for (let si = 0; si < profile.stages.length; si += 1) {
    const st = profile.stages[si];
    const sr = await jget(`/ep-study/front/course/${cid}/syllabus?gradation_id=${st.gradationId}&syllabus_id=${st.syllabusId}`);
    if (sr.status !== 0) throw new Error(`${st.label} syllabus status=${sr.status} ${sr.message}`);
    let gn = null;
    for (const s of (sr.result.syllabus || [])) {
      if (String(s.id) === String(st.gradationId)) { gn = s; break; }
      if (Array.isArray(s.children)) for (const c of s.children) if (String(c.id) === String(st.gradationId)) { gn = c; break; }
      if (gn) break;
    }
    const roots = gn ? (Array.isArray(gn.syllabus) ? gn.syllabus : gn.children || []) : [];
    const before = all.length;
    roots.forEach((n) => collect(n, st.label, null, all));
    console.log(`[${st.label}] paper 叶子 ${all.length - before}`);
    await sleep(200);
  }
  // 去重（同 paperId 可能跨阶段重复出现）
  const seen = new Set(); const uniq = [];
  for (const p of all) if (!seen.has(p.paperId)) { seen.add(p.paperId); uniq.push(p); }
  const sprint = uniq.filter((p) => isSprint(p.title));
  const base = uniq.filter((p) => !isSprint(p.title));
  console.log(`\nsyllabus 去重后 paper ${uniq.length}：基础卷 ${base.length} / 冲刺 ${sprint.length}（排除出 audit）`);

  // 2) 逐张只读 record 审计
  const inv = []; const audit = [];
  const stat = { 满分: 0, 平台最优: 0, 非满分: 0, 未提交: 0, 未做: 0, Unknown: 0 };
  for (let i = 0; i < base.length; i += 1) {
    const p = base[i]; let cls; let times = 0; let score = null; let pss = null; let detail = null;
    if (noRecord) cls = 'Unknown';
    else {
      const z = await (await fetch(`${MINERVA_BASE}/student/paper/record?paperId=${p.paperId}&sourceFromType=${SFT}&needAuth=1`, { headers: H })).json();
      const r = z.result;
      if (!r) cls = '未做';
      else {
        times = r.times; score = r.score; pss = r.paperSubmitStatus;
        if (r.paperSubmitStatus === 1) {
          detail = await inspectSubmitted(H, r.paperDataLogId); await sleep(250);
          if (detail.best && detail.unsupported === 0 && detail.ceiling === 0) cls = '满分';
          else if (detail.best) cls = '平台最优';
          else cls = '非满分';
        } else cls = '未提交';
      }
      await sleep(250);
    }
    stat[cls] += 1;
    inv.push({ ...p, times, score, paperSubmitStatus: pss, cls, detail });
    if (cls !== '满分' && cls !== '平台最优') audit.push({ paperId: p.paperId, title: p.title, num: p.num, score, cls, progress: p.progress, chapter: p.chapter, stage: p.stage, csItemId: p.csItemId, resourceId: p.resourceId });
    if ((i + 1) % 25 === 0) console.log(`  ...${i + 1}/${base.length} ${JSON.stringify(stat)}`);
  }

  fs.writeFileSync(path.join(manifestDir, 'papers_inventory.json'), JSON.stringify(inv, null, 1));
  fs.writeFileSync(path.join(manifestDir, 'papers_audit.json'), JSON.stringify(audit, null, 1));
  fs.writeFileSync(path.join(manifestDir, 'papers_sprint.json'), JSON.stringify(sprint, null, 1));
  console.log('\n===== 基线刷新完成 =====');
  console.log('分类:', JSON.stringify(stat));
  console.log(`已完成（满分+平台最优）: ${stat.满分 + stat.平台最优}；待做 audit: ${audit.length}`);
  console.log('冲刺（单独做）:', sprint.map((s) => `${s.paperId}(${s.stage}/${s.num}题)`).join(', '));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

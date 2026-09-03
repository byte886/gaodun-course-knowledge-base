/**
 * sniff_demo.js — 用裸 CDP 通道(Puppeteer)抓取指定标签的网络请求/响应，最小可运行示例
 *
 * 用法：
 *   node scripts/cdp/sniff_demo.js [URL关键词] [采集秒数] [--reload]
 * 示例：
 *   node scripts/cdp/sniff_demo.js baidu 8 --reload     # 演示：抓百度标签并刷新，采集 8 秒
 *   node scripts/cdp/sniff_demo.js gaodun 20            # 真实：抓当前高顿标签 20 秒（不刷新，避免误动作）
 *
 * 说明：
 *   - 默认不刷新页面（真实做题页不能误刷新）；加 --reload 才会 reload；
 *   - 结果落 data/cdp-sniff/sniff_<时间戳>.jsonl（data/ 已 gitignore，不入库）；
 *   - 默认过滤 font/image/css/媒体等静态噪音，只留 document/xhr/fetch/scripts/websocket 等；
 *   - 这是「录制」阶段的骨架：真实方案里将在此识别取题/交卷/解析/笔记接口，沉淀接口档案与题库。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  connectDailyChrome, findPage, safeDisconnect,
} = require('./connectBrowser');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SKIP_TYPES = new Set(['font', 'image', 'stylesheet', 'media']);

async function main() {
  const args = process.argv.slice(2);
  const reload = args.includes('--reload');
  const positional = args.filter((a) => !a.startsWith('--'));
  const keyword = positional[0] || 'baidu';
  const seconds = Number(positional[1]) || 8;

  const outDir = path.join(PROJECT_ROOT, 'data', 'cdp-sniff');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = path.join(outDir, `sniff_${stamp}.jsonl`);
  const ws = fs.createWriteStream(outFile, { flags: 'a' });
  const write = (obj) => ws.write(JSON.stringify({ t: new Date().toISOString(), ...obj }) + '\n');

  const browser = await connectDailyChrome();
  const page = await findPage(browser, keyword);
  if (!page) {
    await safeDisconnect(browser);
    throw new Error(`没有找到 URL 含「${keyword}」的标签，请先在日常 Chrome 打开对应页面。`);
  }
  console.log(`[sniff] 目标标签：${page.url()}，采集 ${seconds}s，reload=${reload}`);

  let reqCount = 0, keptCount = 0;
  page.on('request', (req) => {
    reqCount += 1;
    const type = req.resourceType();
    if (SKIP_TYPES.has(type)) return;
    keptCount += 1;
    write({ kind: 'request', method: req.method(), url: req.url(), type,
      postData: req.postData() || null });
  });
  page.on('response', async (res) => {
    const type = res.request().resourceType();
    if (SKIP_TYPES.has(type)) return;
    let body = null;
    // 只对 xhr/fetch 取 body，避免大文档；失败不影响主流程
    if (type === 'xhr' || type === 'fetch') {
      try { body = (await res.text()).slice(0, 20000); } catch { body = '[读取失败]'; }
    }
    write({ kind: 'response', status: res.status(), url: res.url(), type, body });
  });
  page.on('requestfailed', (req) => {
    write({ kind: 'requestfailed', url: req.url(),
      error: (req.failure() || {}).errorText || 'unknown' });
  });

  if (reload) await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await new Promise((r) => setTimeout(r, seconds * 1000));

  await safeDisconnect(browser);
  ws.end();
  console.log(`[sniff] 完成：共见请求 ${reqCount}，记录 ${keptCount}，输出 → ${outFile}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('[sniff FAIL]', e.message);
  process.exit(1);
});

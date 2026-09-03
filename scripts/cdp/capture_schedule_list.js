/**
 * capture_schedule_list.js — 只读抓取课程表“作业/资源列表”接口
 * 目标：找到能枚举全部作业入口（paperId/csItemId/resourceId/sourceFromType/title/题量/类型）的接口。
 * 动作：reload 课程表 + 缓慢滚动触发懒加载，只监听网络，不进入任何试卷、不交卷。
 * 落盘 data/cdp-sniff/schedule_<时间戳>.jsonl。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { connectDailyChrome, safeDisconnect } = require('./connectBrowser');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SCHEDULE_URL = 'https://glivepro.gaodun.com/course/42660/class-schedule';
const SKIP = new Set(['font', 'image', 'stylesheet', 'media']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const outDir = path.join(PROJECT_ROOT, 'data', 'cdp-sniff');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = path.join(outDir, `schedule_${stamp}.jsonl`);
  const ws = fs.createWriteStream(outFile, { flags: 'a' });
  const log = (o) => ws.write(JSON.stringify({ t: new Date().toISOString(), ...o }) + '\n');
  const apis = [];

  const browser = await connectDailyChrome();
  const attached = new WeakSet();
  function attach(page) {
    if (!page || attached.has(page)) return;
    attached.add(page);
    page.on('response', async (res) => {
      const type = res.request().resourceType();
      if (type !== 'xhr' && type !== 'fetch') return;
      try {
        const body = await res.text();
        log({ kind: 'response', src: page.url(), status: res.status(), url: res.url(), type, body: body.slice(0, 4000000) });
        const mark = { method: res.request().method(), status: res.status(), url: res.url(), len: body.length,
          hasPaper: body.includes('paperId'), hasResource: body.includes('resourceId'),
          hasRedo: body.includes('重新做题'), hasExam: body.includes('去考试') || body.includes('继续考') };
        apis.push(mark);
      } catch (e) { log({ kind: 'response', url: res.url(), body: '[读取失败] ' + e.message }); }
    });
  }
  (await browser.pages()).forEach(attach);
  browser.on('targetcreated', async (t) => { try { attach(await t.page()); } catch { /* */ } });

  let page = (await browser.pages()).find((p) => p.url().includes('class-schedule'));
  if (!page) {
    page = await browser.newPage();
    await page.goto(SCHEDULE_URL, { waitUntil: 'domcontentloaded' });
  } else {
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  console.log('[schedule]', page.url());

  // 缓慢滚动，触发可能的懒加载/分页
  for (let i = 0; i < 6; i += 1) {
    await sleep(1800);
    await page.evaluate((step) => {
      window.scrollTo(0, document.body.scrollHeight * (step + 1) / 6);
      // 同时滚动内部容器
      document.querySelectorAll('*').forEach((el) => {
        if (el.scrollHeight > el.clientHeight + 200 && getComputedStyle(el).overflowY !== 'visible') {
          el.scrollTop = el.scrollHeight;
        }
      });
    }, i).catch(() => {});
  }
  await sleep(2000);

  ws.end();
  await safeDisconnect(browser);

  console.log(`\n===== xhr/fetch 共 ${apis.length} 条，报文 → ${outFile} =====`);
  apis.forEach((a, i) => {
    const flag = a.hasPaper || a.hasResource || a.hasRedo || a.hasExam ? '  ★' : '';
    console.log(`#${i + 1} ${a.method} ${a.status} len=${a.len} paperId=${a.hasPaper} resourceId=${a.hasResource} 重做=${a.hasRedo} 考试=${a.hasExam}${flag} ${a.url.split('?')[0]}`);
  });
  process.exit(0);
})().catch((e) => { console.error('[schedule-list FAIL]', e.message); process.exit(1); });

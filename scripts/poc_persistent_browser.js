#!/usr/bin/env node
// 【PoC，可行性验证用】持久化专用 Chrome + 进程外网络监听（常驻 + 增量落盘版）
// 验证点：脚本自己开浏览器/导航/抓包，无需 Extension 授权、无需手动开标签、无 CLI 进程往返。
// - channel:'chrome' 用系统 Chrome；独立 profile 存 data/browser-profile/gaodun（首次登录一次，之后免登）
// - context.on 进程外抓业务请求，增量写入 data/exam-net-poc.jsonl（一行一条，实时可 tail，不怕进程中断）
// - 结束时写汇总 JSON 并 close 落 HAR；收到 SIGINT/SIGTERM 优雅退出
// 运行：node scripts/poc_persistent_browser.js   （POC_DURATION_MS 可改常驻时长，默认30分钟）

const fs = require('fs');
const path = require('path');

let chromium;
try {
  ({ chromium } = require('playwright-core'));
} catch (e) {
  const fallback = path.join(process.env.HOME,
    'Library/Application Support/Doubao/sandbox_runtime/.cache/node/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core');
  ({ chromium } = require(fallback));
}

const PROJECT = path.resolve(__dirname, '..');
const USER_DATA_DIR = path.join(PROJECT, 'data', 'browser-profile', 'gaodun');
const OUT_JSONL = path.join(PROJECT, 'data', 'exam-net-poc.jsonl');
const OUT_JSON = path.join(PROJECT, 'data', 'exam-net-poc.json');
const OUT_HAR = path.join(PROJECT, 'data', 'exam-net-poc.har');
const START_URL = 'https://glivepro.gaodun.com/course/42660/class-schedule';
const DURATION_MS = Number(process.env.POC_DURATION_MS || 30 * 60 * 1000);
fs.mkdirSync(USER_DATA_DIR, { recursive: true });
fs.writeFileSync(OUT_JSONL, ''); // 启动即清空，保证本次记录干净

const STATIC = /\.(css|png|jpe?g|gif|svg|webp|woff2?|ttf|ico|mp4|m3u8|ts|mp3|aac|map)(\?|$)/i;
const isBiz = (u) => {
  if (!u || u.startsWith('blob:')) return false;
  if (STATIC.test(u)) return false;
  if (/sentry\.gaodun\.com/i.test(u)) return false; // 监控上报，非业务
  return /gaodun\.com/i.test(u);
};

let ctx = null;
const net = [];
const append = (o) => {
  const rec = Object.assign({ t: Date.now() }, o);
  net.push(rec);
  try { fs.appendFileSync(OUT_JSONL, JSON.stringify(rec) + '\n'); } catch (e) {}
};

async function finish() {
  try {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ savedAt: new Date().toISOString(), count: net.length, net }, null, 2));
    if (ctx) await ctx.close(); // close 时落 HAR
  } catch (e) { console.log('finish 提示:', e.message); }
  process.exit(0);
}
process.on('SIGINT', finish);
process.on('SIGTERM', finish);

(async () => {
  ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: 'chrome',
    headless: false,
    viewport: null,
    args: ['--start-maximized'],
    recordHar: { path: OUT_HAR, mode: 'minimal' },
  });

  ctx.on('request', (r) => {
    try {
      const u = r.url();
      if (!isBiz(u)) return;
      append({ phase: 'req', method: r.method(), url: u });
      console.log('REQ ', r.method(), u.slice(0, 130));
    } catch (e) {}
  });
  ctx.on('response', async (r) => {
    try {
      const u = r.url();
      if (!isBiz(u)) return;
      let body = null;
      try {
        const ct = (r.headers()['content-type'] || '');
        if (/json|text/i.test(ct)) body = (await r.text()).slice(0, 20000);
      } catch (e) { body = '[body read err]'; }
      append({ phase: 'resp', status: r.status(), url: u, body });
      console.log('RESP', r.status(), u.slice(0, 120));
    } catch (e) {}
  });

  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
    .catch((e) => console.log('goto 提示:', e.message));

  console.log(`=== 专用 Chrome 已启动（常驻 ${DURATION_MS / 1000}s）。首次请在窗口扫码登录，之后点进试卷；增量记录到 ${OUT_JSONL} ===`);
  setTimeout(finish, DURATION_MS);
})().catch((e) => { console.error('PoC ERROR', e); process.exit(1); });

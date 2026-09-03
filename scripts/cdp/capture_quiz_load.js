/**
 * capture_quiz_load.js — 进入一张“可重做”知识点测试卷，抓取试卷加载阶段网络（取题接口）
 *
 * 安全边界（强制）：
 *   - 只点击 button.ant-btn-link 且文案为“重新做题”的真按钮；用“重新做题仅出现 1 次”的
 *     最小单卷容器文本匹配 --quiz 关键字，避免命中两张卷的共同祖先而点错卷；
 *   - 绝不点击“去考试 / 继续考”等正式/模考卷；
 *   - 只加载试卷抓“取题”请求与返回；不选选项、不交卷；二次确认弹窗只记录不点。
 *   - 同时监听当前页与点击后可能新开的标签。
 *
 * 用法：node scripts/cdp/capture_quiz_load.js [卡片关键字=计税依据] [等待秒数=14]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { connectDailyChrome, findPage, safeDisconnect } = require('./connectBrowser');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SKIP = new Set(['font', 'image', 'stylesheet', 'media']);
const quizKey = process.argv[2] || '计税依据';
const waitSec = Number(process.argv[3]) || 14;

(async () => {
  const outDir = path.join(PROJECT_ROOT, 'data', 'cdp-sniff');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = path.join(outDir, `quiz_load_${stamp}.jsonl`);
  const ws = fs.createWriteStream(outFile, { flags: 'a' });
  const log = (o) => ws.write(JSON.stringify({ t: new Date().toISOString(), ...o }) + '\n');
  const api = [];

  const browser = await connectDailyChrome();

  function attach(page) {
    page.on('request', (req) => {
      const type = req.resourceType();
      if (SKIP.has(type)) return;
      let headers = {};
      try { headers = req.headers(); } catch { /* 忽略 */ }
      log({ kind: 'request', src: page.url(), method: req.method(), url: req.url(), type, headers, postData: req.postData() || null });
    });
    page.on('response', async (res) => {
      const type = res.request().resourceType();
      if (SKIP.has(type)) return;
      if (type !== 'xhr' && type !== 'fetch') return;
      try {
        const body = (await res.text()).slice(0, 80000);
        log({ kind: 'response', src: page.url(), status: res.status(), url: res.url(), type, body });
        api.push({ method: res.request().method(), status: res.status(), url: res.url(), len: body.length, preview: body.slice(0, 400) });
      } catch (e) {
        log({ kind: 'response', url: res.url(), body: '[读取失败] ' + e.message });
      }
    });
  }
  (await browser.pages()).forEach(attach);
  browser.on('targetcreated', async (target) => {
    try { const np = await target.page(); if (np) attach(np); } catch { /* 非页面 target */ }
  });

  const page = await findPage(browser, /class-schedule/);
  if (!page) throw new Error('未找到高顿课程表标签。');

  // 精准定位：真按钮 + “重新做题仅出现一次”的最小单卷容器匹配关键字
  const clicked = await page.evaluate((key) => {
    const singleCard = (el) => {
      let p = el; let last = null;
      for (let i = 0; i < 9 && p; i += 1) {
        const hits = (p.innerText || '').match(/重新做题/g);
        if (hits && hits.length === 1) last = p;
        else if (hits && hits.length > 1) break; // 已到共同祖先，再往上会串卷
        p = p.parentElement;
      }
      return last;
    };
    const btns = Array.from(document.querySelectorAll('button.ant-btn-link'))
      .filter((b) => (b.innerText || '').includes('重新做题'));
    for (const b of btns) {
      const card = singleCard(b);
      const text = card ? (card.innerText || '').replace(/\s+/g, ' ').trim() : '';
      if (text.includes(key)) {
        if (/去考试|继续考/.test(text)) return { ok: false, reason: '命中的是正式/模考卷，已拒绝', card: text.slice(0, 160) };
        b.scrollIntoView({ block: 'center' });
        b.click();
        return { ok: true, card: text.slice(0, 160) };
      }
    }
    return { ok: false, reason: `没有单卷卡片含「${key}」`, redoButtons: btns.length };
  }, quizKey);
  console.log('[click]', JSON.stringify(clicked, null, 2));
  if (!clicked.ok) { await safeDisconnect(browser); ws.end(); throw new Error('定位失败，已中止，未点击：' + JSON.stringify(clicked)); }

  await new Promise((r) => setTimeout(r, waitSec * 1000));

  // 汇总所有标签状态（做题页可能在新标签）
  const tabs = await browser.pages();
  const tabInfo = [];
  for (const t of tabs) {
    let info = { url: t.url() };
    try {
      info = await t.evaluate(() => ({
        url: location.href,
        modals: Array.from(document.querySelectorAll('.ant-modal,[class*="modal"],[class*="dialog"]'))
          .map((m) => (m.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200)).filter(Boolean),
        bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300),
      }));
    } catch { /* 标签尚未就绪 */ }
    tabInfo.push(info);
  }

  ws.end();
  await safeDisconnect(browser);
  console.log('\n[所有标签]');
  tabInfo.forEach((t, i) => console.log(` Tab${i + 1} ${t.url}\n    modal=${JSON.stringify(t.modals || [])}\n    body=${t.bodyHead || ''}`));
  console.log(`\n[xhr/fetch 共 ${api.length} 条]（完整报文 → ${outFile}）`);
  api.forEach((p, i) => {
    console.log(`\n#${i + 1} ${p.method} ${p.status} len=${p.len} ${p.url}`);
    console.log('   ', p.preview.replace(/\s+/g, ' '));
  });
  process.exit(0);
})().catch((e) => {
  console.error('[capture FAIL]', e.message);
  process.exit(1);
});

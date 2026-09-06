#!/usr/bin/env node
/**
 * probe_user_notes3.js — 先注册监听器再导航，检查页面内容和iframe
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  connectDailyChrome, findPage, safeDisconnect,
} = require('./connectBrowser');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const OUTDIR = path.join(PROJECT_ROOT, 'data', 'cdp-sniff');
fs.mkdirSync(OUTDIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TARGET_URL = 'https://glivepro.gaodun.com/course/42660/tiku-resource/cs_item_id/2225061/resource_id/2550958/paper_id/86722/type/2/resState/1?title=26%E8%80%83%E5%AD%A3-%E5%86%B2%E5%88%BA%E6%A8%A1%E8%80%83-%E7%A8%8E%E6%B3%9501&homework=0&stageId=74658';

const NOTE_KEYWORDS = /note|comment|message|reply|discuss|留言|笔记|interaction|user.*(?:list|detail)|question.*(?:note|comment)/i;

async function main() {
  const browser = await connectDailyChrome();
  let page = await findPage(browser, 'gaodun');
  if (!page) page = await browser.newPage();

  // 先注册监听器
  const captured = [];
  const noteResponses = [];

  page.on('request', (req) => {
    const url = req.url();
    if (/gaodun/i.test(url) && !/\.(js|css|png|jpe?g|gif|svg|woff2?|ttf|ico|mp4|m3u8|ts|mp3|aac|map)(\?|$)/i.test(url)) {
      const entry = { t: new Date().toISOString(), method: req.method(), url, type: req.resourceType() };
      if (NOTE_KEYWORDS.test(url)) {
        console.log(`  ★ 笔记请求: ${req.method()} ${url.slice(0, 180)}`);
        entry.isNote = true;
      }
      captured.push(entry);
    }
  });

  page.on('response', async (resp) => {
    const url = resp.url();
    if (NOTE_KEYWORDS.test(url) && /gaodun/i.test(url)) {
      try {
        const body = await resp.text();
        noteResponses.push({ url, status: resp.status(), body: body.slice(0, 50000) });
        console.log(`  ★ 笔记响应: ${resp.status()} ${body.length}b ${url.slice(0, 120)}`);
      } catch (e) {}
    }
  });

  console.log('导航到试卷解析页...');
  await page.goto(TARGET_URL, { waitUntil: 'networkidle0', timeout: 45000 }).catch((e) => {
    console.log('导航警告:', e.message.slice(0, 100));
  });

  console.log('额外等待 8 秒...');
  await sleep(8000);

  // 检查页面内容
  const content = await page.evaluate(() => {
    return {
      url: location.href,
      title: document.title,
      bodyText: document.body ? document.body.innerText.slice(0, 2000) : '(no body)',
      iframeCount: document.querySelectorAll('iframe').length,
      iframeSrcs: Array.from(document.querySelectorAll('iframe')).map(f => f.src).slice(0, 5),
      buttons: Array.from(document.querySelectorAll('button, a, [role=tab]')).map(b => (b.textContent || '').trim()).filter(t => t && t.length < 30).slice(0, 30),
    };
  }).catch((e) => ({ error: e.message }));

  console.log('\n=== 页面内容 ===');
  console.log('URL:', content.url);
  console.log('Title:', content.title);
  console.log('iframe数:', content.iframeCount);
  if (content.iframeSrcs) console.log('iframe srcs:', content.iframeSrcs);
  console.log('按钮/标签:', content.buttons);
  console.log('正文前500字:', (content.bodyText || '').slice(0, 500));

  // 如果有iframe，切换进去
  if (content.iframeCount > 0) {
    console.log('\n=== 切换到第一个 iframe ===');
    const frames = page.frames();
    console.log('所有frames:', frames.map(f => f.url().slice(0, 100)));
    for (const frame of frames) {
      if (frame !== page.mainFrame() && /gaodun|tiku/i.test(frame.url())) {
        console.log('切换到:', frame.url().slice(0, 100));
        const frameContent = await frame.evaluate(() => {
          return {
            url: location.href,
            bodyText: document.body ? document.body.innerText.slice(0, 1000) : '(no body)',
            buttons: Array.from(document.querySelectorAll('button, a, [role=tab]')).map(b => (b.textContent || '').trim()).filter(t => t && t.length < 30).slice(0, 20),
          };
        }).catch((e) => ({ error: e.message }));
        console.log('iframe正文前300字:', (frameContent.bodyText || '').slice(0, 300));
        console.log('iframe按钮:', frameContent.buttons);
      }
    }
  }

  // 滚动主页面
  console.log('\n滚动 10 秒...');
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, 800)).catch(() => {});
    await sleep(1000);
  }

  // 输出API
  console.log('\n=== 捕获的 API 请求（去重）===');
  const apiPaths = new Set();
  for (const e of captured) {
    try {
      const u = new URL(e.url);
      apiPaths.add(`${e.method} ${u.pathname}`);
    } catch {}
  }
  for (const p of [...apiPaths].sort()) {
    const isNote = NOTE_KEYWORDS.test(p);
    console.log(`  ${isNote ? '★' : ' '} ${p.slice(0, 180)}`);
  }
  console.log(`\n总请求: ${captured.length}, 笔记响应: ${noteResponses.length}`);

  // 保存
  const outFile = path.join(OUTDIR, `probe_user_notes3_${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ targetUrl: TARGET_URL, content, captured, noteResponses }, null, 2));
  console.log(`记录: ${outFile}`);

  await safeDisconnect(browser);
}

main().catch((e) => {
  console.error('失败:', e);
  process.exit(1);
});

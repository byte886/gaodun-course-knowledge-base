#!/usr/bin/env node
/**
 * probe_user_notes2.js — 直接导航到试卷解析页，探查用户笔记 API
 *
 * 用法：node scripts/cdp/probe_user_notes2.js
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

// 86722 冲刺模考-税法01
const TARGET_URL = 'https://glivepro.gaodun.com/course/42660/tiku-resource/cs_item_id/2225061/resource_id/2550958/paper_id/86722/type/2/resState/1?title=26%E8%80%83%E5%AD%A3-%E5%86%B2%E5%88%BA%E6%A8%A1%E8%80%83-%E7%A8%8E%E6%B3%9501&homework=0&stageId=74658';

const NOTE_KEYWORDS = /note|comment|message|reply|discuss|留言|笔记|user.*(?:list|detail)|question.*(?:note|comment)|interaction/i;

async function main() {
  const browser = await connectDailyChrome();

  // 找高顿标签页，没有就新建
  let page = await findPage(browser, 'gaodun');
  if (!page) {
    console.log('没有找到高顿标签页，新建...');
    page = await browser.newPage();
  }

  console.log(`导航到: ${TARGET_URL}`);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => {
    console.log('导航警告:', e.message);
  });

  console.log('等待页面加载 12 秒...');
  await sleep(12000);
  console.log(`当前 URL: ${page.url()}`);
  console.log(`当前 Title: ${await page.title()}`);

  // 监听网络请求
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
        console.log(`  ★ 笔记响应: ${resp.status()} ${body.length} bytes ${url.slice(0, 120)}`);
      } catch (e) {
        console.log(`  ★ 笔记响应读取失败: ${e.message}`);
      }
    }
  });

  // 滚动加载笔记
  console.log('\n滚动页面 20 秒...');
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => window.scrollBy(0, 600)).catch(() => {});
    await sleep(1000);
    if (i % 5 === 4) {
      console.log(`  ${i + 1}s, 请求 ${captured.length} 条, 笔记响应 ${noteResponses.length} 条`);
    }
  }

  // 尝试点击"解析"或"笔记"标签
  console.log('\n尝试查找并点击笔记/解析相关按钮...');
  const clicked = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, a, [class*=tab], [class*=Tab]');
    for (const b of btns) {
      const text = (b.textContent || '').trim();
      if (/笔记|解析|留言|评论|note|analysis/i.test(text) && text.length < 20) {
        b.click();
        return text;
      }
    }
    return null;
  }).catch(() => null);
  console.log(`  点击结果: ${clicked || '未找到'}`);

  if (clicked) {
    console.log('等待 8 秒加载笔记内容...');
    await sleep(8000);
  }

  // 输出所有API路径
  console.log('\n=== 捕获的高顿 API 请求（去重）===');
  const apiPaths = new Set();
  for (const e of captured) {
    try {
      const u = new URL(e.url);
      apiPaths.add(`${e.method} ${u.pathname}${u.searchParams.toString() ? '?...' : ''}`);
    } catch {}
  }
  for (const p of [...apiPaths].sort()) {
    const isNote = NOTE_KEYWORDS.test(p);
    console.log(`  ${isNote ? '★' : ' '} ${p.slice(0, 180)}`);
  }

  // 保存
  const outFile = path.join(OUTDIR, `probe_user_notes2_${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    targetUrl: TARGET_URL,
    finalUrl: page.url(),
    captured,
    noteResponses,
  }, null, 2));
  console.log(`\n完整记录: ${outFile}`);
  console.log(`笔记响应数: ${noteResponses.length}`);

  await safeDisconnect(browser);
}

main().catch((e) => {
  console.error('探查失败:', e);
  process.exit(1);
});

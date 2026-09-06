#!/usr/bin/env node
/**
 * probe_user_notes.js — 探查高顿题库解析页的用户笔记 API
 *
 * 流程：
 *   1. 连接日常 Chrome
 *   2. 列出所有标签页，找高顿相关页面
 *   3. 如果有试卷解析页，监听网络请求并滚动加载笔记
 *   4. 捕获用户笔记相关的 API 请求/响应
 *
 * 用法：node scripts/cdp/probe_user_notes.js
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

async function main() {
  const browser = await connectDailyChrome();
  const pages = await browser.pages();

  console.log('=== 当前 Chrome 标签页 ===');
  for (let i = 0; i < pages.length; i++) {
    const url = pages[i].url();
    const title = await pages[i].title().catch(() => '');
    const isGaodun = /gaodun/i.test(url);
    console.log(`  [${i}] ${isGaodun ? '★' : ' '} ${title.slice(0, 50)} | ${url.slice(0, 100)}`);
  }

  // 找高顿试卷解析页
  let page = null;
  for (const p of pages) {
    const url = p.url();
    if (/gaodun/i.test(url) && /paper_id|tiku|analysis|解析/i.test(url)) {
      page = p;
      break;
    }
  }

  if (!page) {
    // 找任意高顿页面
    for (const p of pages) {
      if (/gaodun/i.test(p.url())) {
        page = p;
        break;
      }
    }
  }

  if (!page) {
    console.log('\n❌ 没有找到高顿相关标签页。请先在 Chrome 打开高顿题库试卷解析页。');
    await safeDisconnect(browser);
    return;
  }

  console.log(`\n=== 目标页面 ===`);
  console.log(`  URL: ${page.url()}`);
  console.log(`  Title: ${await page.title()}`);

  // 监听网络请求
  const captured = [];
  const NOTE_KEYWORDS = /note|comment|message|reply|discuss|留言|笔记|user.*(?:list|detail)|question.*(?:note|comment)/i;

  page.on('request', (req) => {
    const url = req.url();
    if (/gaodun/i.test(url) && !/\.(js|css|png|jpe?g|gif|svg|woff2?|ttf|ico|mp4|m3u8|ts|mp3|aac|map)(\?|$)/i.test(url)) {
      const entry = { t: new Date().toISOString(), method: req.method(), url, type: req.resourceType() };
      if (NOTE_KEYWORDS.test(url)) {
        console.log(`  ★ 笔记相关请求: ${req.method()} ${url.slice(0, 150)}`);
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
        const outFile = path.join(OUTDIR, `note_api_${Date.now()}.json`);
        fs.writeFileSync(outFile, JSON.stringify({ url, status: resp.status(), body: body.slice(0, 50000) }, null, 2));
        console.log(`  ★ 笔记响应已保存: ${outFile} (${body.length} bytes)`);
      } catch (e) {
        console.log(`  ★ 笔记响应读取失败: ${e.message}`);
      }
    }
  });

  // 滚动页面加载笔记
  console.log('\n=== 滚动页面加载用户笔记（15秒）===');
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => window.scrollBy(0, 800)).catch(() => {});
    await sleep(1000);
    if (i % 5 === 4) {
      console.log(`  已滚动 ${i + 1} 秒，捕获请求 ${captured.length} 条`);
    }
  }

  // 输出所有捕获的API路径
  console.log('\n=== 捕获的高顿 API 请求（去重）===');
  const apiPaths = new Set();
  for (const e of captured) {
    try {
      const u = new URL(e.url);
      apiPaths.add(`${e.method} ${u.pathname}${u.search ? '?...' : ''}`);
    } catch {}
  }
  for (const p of [...apiPaths].sort()) {
    const isNote = NOTE_KEYWORDS.test(p);
    console.log(`  ${isNote ? '★' : ' '} ${p.slice(0, 150)}`);
  }

  // 保存完整捕获记录
  const outFile = path.join(OUTDIR, `probe_user_notes_${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ pageUrl: page.url(), captured }, null, 2));
  console.log(`\n完整捕获记录已保存: ${outFile}`);

  await safeDisconnect(browser);
}

main().catch((e) => {
  console.error('探查失败:', e);
  process.exit(1);
});

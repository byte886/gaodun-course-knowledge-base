#!/usr/bin/env node
/**
 * probe_user_notes4.js — 点击题号进入解析页，捕获用户笔记 API
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

const NOTE_KEYWORDS = /note|comment|message|reply|discuss|留言|笔记|interaction|user.*(?:list|detail)|question.*(?:note|comment)|like|praise/i;

async function main() {
  const browser = await connectDailyChrome();
  let page = await findPage(browser, 'gaodun');
  if (!page) page = await browser.newPage();

  const captured = [];
  const noteResponses = [];
  const allResponses = [];

  page.on('request', (req) => {
    const url = req.url();
    if (/gaodun/i.test(url) && !/\.(js|css|png|jpe?g|gif|svg|woff2?|ttf|ico|mp4|m3u8|ts|mp3|aac|map)(\?|$)/i.test(url)) {
      const entry = { t: new Date().toISOString(), method: req.method(), url, type: req.resourceType() };
      if (NOTE_KEYWORDS.test(url)) {
        console.log(`  ★ 笔记请求: ${req.method()} ${url.slice(0, 200)}`);
        entry.isNote = true;
      }
      captured.push(entry);
    }
  });

  page.on('response', async (resp) => {
    const url = resp.url();
    if (/gaodun/i.test(url) && !/\.(js|css|png|jpe?g|gif|svg|woff2?|ttf|ico|mp4|m3u8|ts|mp3|aac|map)(\?|$)/i.test(url)) {
      try {
        const body = await resp.text();
        allResponses.push({ url, status: resp.status(), body: body.slice(0, 30000) });
        if (NOTE_KEYWORDS.test(url)) {
          noteResponses.push({ url, status: resp.status(), body: body.slice(0, 50000) });
          console.log(`  ★ 笔记响应: ${resp.status()} ${body.length}b ${url.slice(0, 150)}`);
        }
      } catch (e) {}
    }
  });

  console.log('导航到考试报告页...');
  await page.goto(TARGET_URL, { waitUntil: 'networkidle0', timeout: 45000 }).catch(() => {});
  await sleep(5000);

  // 点击题号1进入解析
  console.log('\n点击题号 1...');
  const clicked = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if ((b.textContent || '').trim() === '1') {
        b.click();
        return true;
      }
    }
    return false;
  });
  console.log('点击结果:', clicked);

  await sleep(8000);
  console.log('当前URL:', page.url());

  // 检查解析页内容
  const content = await page.evaluate(() => {
    return {
      url: location.href,
      bodyText: document.body ? document.body.innerText.slice(0, 3000) : '(no body)',
      buttons: Array.from(document.querySelectorAll('button, a, [role=tab], [class*=tab]')).map(b => (b.textContent || '').trim()).filter(t => t && t.length < 30).slice(0, 40),
      noteElements: Array.from(document.querySelectorAll('[class*=note], [class*=comment], [class*=message], [class*=Note], [class*=Comment]')).map(el => ({
        className: el.className,
        text: (el.textContent || '').slice(0, 200),
      })).slice(0, 10),
    };
  }).catch((e) => ({ error: e.message }));

  console.log('\n=== 解析页内容 ===');
  console.log('URL:', content.url);
  console.log('按钮/标签:', content.buttons);
  console.log('笔记元素数:', content.noteElements ? content.noteElements.length : 0);
  if (content.noteElements && content.noteElements.length > 0) {
    console.log('笔记元素:', JSON.stringify(content.noteElements, null, 2).slice(0, 1000));
  }
  console.log('正文前800字:', (content.bodyText || '').slice(0, 800));

  // 尝试点击"解析"或"笔记"标签
  console.log('\n尝试切换到解析/笔记标签...');
  const tabClicked = await page.evaluate(() => {
    const tabs = document.querySelectorAll('[role=tab], [class*=tab], button');
    for (const t of tabs) {
      const text = (t.textContent || '').trim();
      if (/^解析$|^笔记$|^留言$|^用户笔记$/.test(text)) {
        t.click();
        return text;
      }
    }
    return null;
  });
  console.log('切换结果:', tabClicked || '未找到');

  if (tabClicked) {
    await sleep(6000);
    // 再次检查笔记元素
    const content2 = await page.evaluate(() => {
      return {
        noteElements: Array.from(document.querySelectorAll('[class*=note], [class*=comment], [class*=message], [class*=Note], [class*=Comment]')).map(el => ({
          className: String(el.className).slice(0, 100),
          text: (el.textContent || '').slice(0, 300),
        })).slice(0, 15),
        bodyText: document.body ? document.body.innerText.slice(0, 2000) : '',
      };
    }).catch(() => ({}));
    console.log('切换后笔记元素数:', content2.noteElements ? content2.noteElements.length : 0);
    if (content2.noteElements && content2.noteElements.length > 0) {
      console.log('笔记元素:', JSON.stringify(content2.noteElements, null, 2).slice(0, 2000));
    }
  }

  // 滚动加载
  console.log('\n滚动 15 秒...');
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => window.scrollBy(0, 600)).catch(() => {});
    await sleep(1000);
  }

  // 输出所有API
  console.log('\n=== 所有 API 请求（去重）===');
  const apiPaths = new Set();
  for (const e of captured) {
    try {
      const u = new URL(e.url);
      apiPaths.add(`${e.method} ${u.pathname}`);
    } catch {}
  }
  for (const p of [...apiPaths].sort()) {
    const isNote = NOTE_KEYWORDS.test(p);
    console.log(`  ${isNote ? '★' : ' '} ${p.slice(0, 200)}`);
  }

  // 检查所有响应中是否有笔记相关内容
  console.log('\n=== 检查响应体中是否有笔记内容 ===');
  for (const r of allResponses) {
    if (/笔记|留言|评论|userNote|userComment|noteList|commentList/i.test(r.body)) {
      console.log(`  ★ 响应含笔记内容: ${r.url.slice(0, 150)} (${r.body.length}b)`);
      // 提取相关片段
      const match = r.body.match(/.{0,100}(笔记|留言|评论|userNote|userComment|noteList|commentList).{0,200}/i);
      if (match) console.log(`    片段: ${match[0].slice(0, 300)}`);
    }
  }

  console.log(`\n总请求: ${captured.length}, 笔记响应: ${noteResponses.length}, 总响应: ${allResponses.length}`);

  // 保存
  const outFile = path.join(OUTDIR, `probe_user_notes4_${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    targetUrl: TARGET_URL,
    finalUrl: page.url(),
    content,
    captured,
    noteResponses,
    allResponses: allResponses.filter(r => /minerva|tiku|question|paper/i.test(r.url)).slice(0, 20),
  }, null, 2));
  console.log(`记录: ${outFile}`);

  await safeDisconnect(browser);
}

main().catch((e) => {
  console.error('失败:', e);
  process.exit(1);
});

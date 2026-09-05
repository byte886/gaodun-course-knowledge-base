/**
 * probe_sprint_video.js — 冲刺「课后视频解析」(点播 UUID) 取流链路只读侦查
 * 直接打开播放页路由，监听 m3u8/媒体/取流 XHR，只看不下载。
 * 播放页路由（点击实证）：/course/42660/syllabus_id/75181/chapter_id/<ch>/item_id/<item>/resource_id/<res>/type/2
 * 用法: node scripts/cdp/probe_sprint_video.js [卷=1] [采集秒=22]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { connectDailyChrome } = require('./connectBrowser');

const seq = Number(process.argv[2] || 1);
const seconds = Number(process.argv[3]) || 22;
const OUT = path.resolve(__dirname, '..', '..', 'data', 'cdp-sniff');
// 三卷播放路由参数（chapter 都是冲刺分组 2225060；item/resource 侦查自 syllabus + 点击）
const ROUTE = {
  1: { item: 2225061, resource: 2574297 },
  2: { item: 2225062, resource: 2582355 },
  3: { item: 2225063, resource: 2582358 },
};
const { item, resource } = ROUTE[seq];
const playUrl = `https://glivepro.gaodun.com/course/42660/syllabus_id/75181/chapter_id/2225060/item_id/${item}/resource_id/${resource}/type/2?gradation_id=74658`;

(async () => {
  const browser = await connectDailyChrome();
  const page = await browser.newPage();
  const reqs = [];
  page.on('response', async (res) => {
    const t = res.request().resourceType();
    const u = res.url();
    const interesting = t === 'xhr' || t === 'fetch' || t === 'media' || t === 'websocket'
      || /m3u8|\.ts|\.mp4|\.m4s|playback|playInfo|play-info|video|hermes|sewise|authorize|getplay|vod/i.test(u);
    if (!interesting) return;
    let body = null;
    if (t === 'xhr' || t === 'fetch') { try { body = (await res.text()).slice(0, 3000); } catch { body = null; } }
    reqs.push({ t, status: res.status(), method: res.request().method(), url: u.slice(0, 500), body });
  });
  console.log('[vid] 打开播放页', playUrl);
  await page.goto(playUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => console.log('[vid] goto warn', e.message));
  // 尝试点播放按钮（若有）
  await new Promise((r) => setTimeout(r, 6000));
  await page.evaluate(() => {
    const b = document.querySelector('video,.vjs-big-play-button,[class*=play]');
    if (b && b.click) b.click(); const v = document.querySelector('video'); if (v && v.play) v.play().catch(() => {});
  }).catch(() => {});
  await new Promise((r) => setTimeout(r, seconds * 1000));
  console.log('[vid] 最终URL:', page.url());
  const videoInfo = await page.evaluate(() => { const v = document.querySelector('video'); return v ? { src: v.src, currentSrc: v.currentSrc, duration: v.duration } : null; }).catch(() => null);
  console.log('[vid] video标签:', JSON.stringify(videoInfo));
  console.log('[vid] 相关请求', reqs.length, '条：');
  reqs.forEach((r) => console.log(`  [${r.t}] ${r.status} ${r.method} ${r.url}` + (r.body ? `\n      BODY: ${r.body.slice(0, 600)}` : '')));
  const f = path.join(OUT, `sprint_video_probe_seq${seq}_${Date.now()}.json`);
  fs.writeFileSync(f, JSON.stringify({ playUrl, finalUrl: page.url(), videoInfo, reqs }, null, 2));
  console.log('[vid] 留档 →', f, '（标签保留）');
  await browser.disconnect();
  process.exit(0);
})().catch((e) => { console.error('[vid FAIL]', e.stack || e.message); process.exit(1); });

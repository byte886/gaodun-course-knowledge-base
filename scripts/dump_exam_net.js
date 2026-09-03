#!/usr/bin/env node
// Playwright run-code: 导出 capture_exam_net.js 记录在 window.__net 的全部网络数据。
// 用法：npx playwright cli -s=ga run-code scripts/dump_exam_net.js
// 输出为 JSON 字符串，建议在 Shell 侧重定向到 data/ 下保存（data/ 已 gitignore，不入库）。
// 可选清空：npx playwright cli -s=ga eval "window.__net.length=0"

async (page) => {
  const json = await page.evaluate(() => JSON.stringify({
    href: location.href,
    title: document.title,
    exportedAt: new Date().toISOString(),
    blockWrite: !!window.__netBlockWrite,
    count: (window.__net || []).length,
    net: window.__net || []
  }));
  return json;
}

/**
 * probe_exam_entry.js — 只读探查课程表上的做题/考试入口（不点击、不导航、不提交）
 *
 * 用法：node scripts/cdp/probe_exam_entry.js
 * 作用：连接当前高顿课程表标签，列出所有“做题/考试/继续/重新/练习…”短文案可点击元素，
 *       及其所在卡片（用于判断它属于哪一讲、是“可重做小卷”还是“正式/模考卷”）。
 * 安全：纯 page.evaluate 读取 DOM，不触发任何点击、请求或交卷。
 */
'use strict';
const { connectDailyChrome, findPage, safeDisconnect } = require('./connectBrowser');

(async () => {
  const browser = await connectDailyChrome();
  const page = await findPage(browser, /glivepro|gaodun/);
  if (!page) throw new Error('未找到高顿标签，请先在日常 Chrome 打开课程表。');

  const info = await page.evaluate(() => {
    const kw = /做题|考试|继续|开始|重新|练习|测试|测验|闯关|课后|评估/i;
    const nodes = Array.from(document.querySelectorAll(
      'a,button,[role="button"],[class*="btn"],[class*="button"],span,div'));
    const seen = new Set();
    const out = [];
    const compact = (s) => (s || '').replace(/\s+/g, ' ').trim();
    function cardText(el) {
      let p = el;
      for (let i = 0; i < 5 && p; i += 1) {
        const t = compact(p.innerText);
        if (t && t.length <= 160) return t;
        p = p.parentElement;
      }
      return compact(el.innerText).slice(0, 160);
    }
    for (const el of nodes) {
      const own = compact(el.innerText);
      if (!own || own.length > 20) continue; // 只看短文案，排除整张卡片
      if (!kw.test(own)) continue;
      const key = `${el.tagName}|${own}|${el.href || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        tag: el.tagName,
        text: own,
        href: el.href || null,
        cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 80) : null,
        card: cardText(el.parentElement),
      });
    }
    return { url: location.href, title: document.title, count: out.length, items: out };
  });

  console.log(JSON.stringify(info, null, 2));
  await safeDisconnect(browser);
  process.exit(0);
})().catch((e) => {
  console.error('[probe FAIL]', e.message);
  process.exit(1);
});

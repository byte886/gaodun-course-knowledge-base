/**
 * probe_quiz_dom.js — 只读探查做题页 DOM/iframe 结构（不点击、不提交）
 * 定位：哪个 frame 是题库、选项元素怎么组织、交卷/下一题/答题卡按钮、是否逐题分页。
 */
'use strict';
const { connectDailyChrome, safeDisconnect } = require('./connectBrowser');

(async () => {
  const browser = await connectDailyChrome();
  const pages = await browser.pages();
  const quizPages = pages.filter((p) => p.url().includes('tiku-resource'));
  if (!quizPages.length) throw new Error('没有打开的做题页(tiku-resource)。');
  const page = quizPages[quizPages.length - 1];
  console.log('[quiz page]', page.url());

  const frames = page.frames();
  console.log('[frames]', frames.map((f) => f.url()).join('\n         '));

  for (const f of frames) {
    let info;
    try {
      info = await f.evaluate(() => {
        const txt = (document.body.innerText || '').replace(/\s+/g, ' ');
        const btns = Array.from(document.querySelectorAll('button,[role="button"],[class*="btn"]'))
          .map((b) => ({ t: (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 12),
            c: (b.className || '').toString().slice(0, 60) }))
          .filter((b) => b.t);
        // 候选选项节点
        const optCands = Array.from(document.querySelectorAll('[class*="option"],[class*="item"],[class*="answer"],li'))
          .filter((e) => {
            const t = (e.innerText || '').trim();
            return t && t.length < 60 && /^[A-D]/.test(t.replace(/\s/, ''));
          })
          .slice(0, 12)
          .map((e) => ({ tag: e.tagName, c: (e.className || '').toString().slice(0, 70),
            data: Object.assign({}, e.dataset), t: (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40),
            html: e.outerHTML.slice(0, 260) }));
        return { len: txt.length, hasQuiz: txt.includes('交卷'), head: txt.slice(0, 260), btns, optCands };
      });
    } catch (e) {
      console.log('[frame eval fail]', f.url(), e.message);
      continue;
    }
    if (!info.len) continue;
    console.log('\n===== FRAME', f.url(), '=====');
    console.log('hasQuiz(含交卷)=', info.hasQuiz, ' textLen=', info.len);
    console.log('head:', info.head);
    console.log('\n按钮清单:');
    info.btns.forEach((b) => console.log('  -', JSON.stringify(b.t), '|', b.c));
    console.log('\n选项候选(前12):');
    info.optCands.forEach((o) => console.log('  *', o.tag, JSON.stringify(o.t), '|', o.c, '|data=', JSON.stringify(o.data), '\n     html=', o.html));
  }

  await safeDisconnect(browser);
  process.exit(0);
})().catch((e) => { console.error('[probe-dom FAIL]', e.message); process.exit(1); });

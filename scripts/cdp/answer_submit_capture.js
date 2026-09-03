/**
 * answer_submit_capture.js — 可重做知识点卷端到端测试：接口取答案 → UI 自动作答 → 交卷 → 抓提交/结果接口
 *
 * 安全边界（强制）：
 *   - 只操作 URL 含 paper_id/标题为“知识点测试”的可重做卷（默认“计税依据”），绝不碰 48 题模考/正式卷；
 *   - 答案实时来自本次 redo-paper 响应（不硬编码），验证“接口取题即得答案”闭环；
 *   - 会真实交一次卷（用户已授权，且该卷可重做 600 次、答案全对）；交卷后回查分数。
 *
 * 用法：node scripts/cdp/answer_submit_capture.js [卡片关键字=计税依据]
 * 报文落 data/cdp-sniff/submit_<时间戳>.jsonl（data 已 gitignore）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { connectDailyChrome, findPage, safeDisconnect } = require('./connectBrowser');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SKIP = new Set(['font', 'image', 'stylesheet', 'media']);
const quizKey = process.argv[2] || '计税依据';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const outDir = path.join(PROJECT_ROOT, 'data', 'cdp-sniff');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = path.join(outDir, `submit_${stamp}.jsonl`);
  const ws = fs.createWriteStream(outFile, { flags: 'a' });
  const log = (o) => ws.write(JSON.stringify({ t: new Date().toISOString(), ...o }) + '\n');
  const apis = [];
  let redoPayload = null;

  const browser = await connectDailyChrome();
  const attached = new WeakSet();
  function attach(page) {
    if (!page || attached.has(page)) return;
    attached.add(page);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (SKIP.has(type)) return;
      let headers = {}; try { headers = req.headers(); } catch { /* */ }
      log({ kind: 'request', src: page.url(), method: req.method(), url: req.url(), type, headers, postData: req.postData() || null });
    });
    page.on('response', async (res) => {
      const u = res.url();
      const type = res.request().resourceType();
      if (type !== 'xhr' && type !== 'fetch') return;
      try {
        const body = await res.text();
        log({ kind: 'response', src: page.url(), status: res.status(), url: u, type, body: body.slice(0, 80000) });
        apis.push({ method: res.request().method(), status: res.status(), url: u, len: body.length });
        if (u.includes('/redo-paper')) { try { redoPayload = JSON.parse(body); } catch { /* */ } }
      } catch (e) { log({ kind: 'response', url: u, body: '[读取失败] ' + e.message }); }
    });
  }
  (await browser.pages()).forEach(attach);
  browser.on('targetcreated', async (t) => { try { attach(await t.page()); } catch { /* */ } });

  // 0) 清理本脚本此前遗留、已超时的同卷做题标签（只关 tiku-resource，保留课程表）
  let pages = await browser.pages();
  for (const p of pages) { if (p.url().includes('tiku-resource')) { try { await p.close(); } catch { /* */ } } }

  // 1) 课程表点“重新做题”开新卷
  const schedule = await findPage(browser, /class-schedule/);
  if (!schedule) throw new Error('找不到课程表标签。');
  const clicked = await schedule.evaluate((key) => {
    const singleCard = (el) => {
      let p = el, last = null;
      for (let i = 0; i < 9 && p; i += 1) {
        const hits = (p.innerText || '').match(/重新做题/g);
        if (hits && hits.length === 1) last = p; else if (hits && hits.length > 1) break;
        p = p.parentElement;
      }
      return last;
    };
    const btns = Array.from(document.querySelectorAll('button.ant-btn-link')).filter((b) => (b.innerText || '').includes('重新做题'));
    for (const b of btns) {
      const card = singleCard(b);
      const text = card ? (card.innerText || '').replace(/\s+/g, ' ').trim() : '';
      if (text.includes(key)) {
        if (/去考试|继续考/.test(text)) return { ok: false, reason: '命中正式卷，拒绝' };
        b.scrollIntoView({ block: 'center' }); b.click();
        return { ok: true, card: text.slice(0, 140) };
      }
    }
    return { ok: false, reason: '未找到可重做卷' };
  }, quizKey);
  console.log('[open]', JSON.stringify(clicked));
  if (!clicked.ok) { await safeDisconnect(browser); ws.end(); throw new Error('开卷失败：' + JSON.stringify(clicked)); }

  // 2) 等新做题标签 + 等 redo-paper 返回
  await sleep(2500);
  pages = await browser.pages();
  const quiz = pages.filter((p) => p.url().includes('tiku-resource')).pop();
  if (!quiz) { await safeDisconnect(browser); ws.end(); throw new Error('新做题标签未出现'); }
  console.log('[quiz]', quiz.url());
  for (let i = 0; i < 20 && !redoPayload; i += 1) await sleep(500);
  if (!redoPayload) { await safeDisconnect(browser); ws.end(); throw new Error('未捕获 redo-paper 响应'); }

  // 3) 从 redo-paper 提取“题目顺序 → 正确字母”
  const answers = [];
  for (const m of redoPayload.result.moduleList) {
    for (const q of m.questionList) {
      answers.push({
        sort: q.displaySortNum, qid: q.questionId, type: q.questionType,
        letters: String(q.questionAnswer.answer || '').split(/[,\s]+/).filter(Boolean),
      });
    }
  }
  answers.sort((a, b) => a.sort - b.sort);
  console.log('[answers] 共', answers.length, '题：', answers.map((a) => `${a.sort}:${a.letters.join('')}`).join('  '));
  if (answers.length !== redoPayload.result.questionTotal) throw new Error('答案题数与整卷不符，中止');

  // DOM 工具
  const answerCurrent = (letters) => quiz.evaluate((wantArr) => {
    const want = new Set(wantArr);
    const items = Array.from(document.querySelectorAll('div.sub-tiku__question-select-item'));
    const clicked = [];
    for (const it of items) {
      const op = it.querySelector('span.sub-tiku__question-option');
      if (op && want.has(op.textContent.trim())) { it.click(); clicked.push(op.textContent.trim()); }
    }
    return { optionCount: items.length, clicked };
  }, letters);
  const clickBtn = (text, mode = 'exact') => quiz.evaluate((t, md) => {
    const c = Array.from(document.querySelectorAll('button,[class*="btn"],[role="button"]'));
    const norm = (e) => (e.innerText || '').replace(/\s+/g, '').trim();
    const hit = c.find((e) => (md === 'exact' ? norm(e) === t : norm(e).includes(t)));
    if (hit) { hit.click(); return norm(hit); }
    return null;
  }, text, mode);
  const currentHead = () => quiz.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 160));

  await quiz.waitForSelector('div.sub-tiku__question-select-item', { timeout: 15000 });

  // 4) 逐题作答
  for (let i = 0; i < answers.length; i += 1) {
    const a = answers[i];
    const r = await answerCurrent(a.letters);
    console.log(`[答] 第${a.sort}题 qid=${a.qid} 类型${a.type} 点选=${JSON.stringify(r.clicked)} 候选数=${r.optionCount}`);
    if (r.clicked.length !== a.letters.length) throw new Error(`第${a.sort}题期望选${a.letters.length}个、实际${r.clicked.length}，中止`);
    await sleep(450); // 让前端保存答案的请求发出
    if (i < answers.length - 1) {
      const nx = await clickBtn('下一题');
      console.log('   →下一题:', nx);
      await sleep(650);
    }
  }
  console.log('[state 末题]', await currentHead());

  // 5) 交卷 + 确认弹窗（兼容多种文案）
  const submit = await clickBtn('交卷', 'exact');
  console.log('[点交卷]', submit);
  await sleep(1200);
  let confirm = await clickBtn('立即交卷', 'exact');
  if (!confirm) confirm = await clickBtn('确认交卷', 'exact');
  if (!confirm) confirm = await clickBtn('确定', 'exact');
  console.log('[确认弹窗]', confirm);

  // 6) 等结果/回查接口
  await sleep(6000);
  const finalText = await quiz.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 600));
  ws.end();
  await safeDisconnect(browser);

  console.log('\n===== 交卷后页面文本 =====\n', finalText);
  console.log(`\n===== 全程 xhr/fetch（${apis.length}）完整报文 → ${outFile} =====`);
  const minerva = apis.filter((a) => a.url.includes('/minerva/'));
  minerva.forEach((a, i) => console.log(`#${i + 1} ${a.method} ${a.status} len=${a.len} ${a.url.split('?')[0]}`));
  process.exit(0);
})().catch((e) => { console.error('[submit-capture FAIL]', e.message); process.exit(1); });

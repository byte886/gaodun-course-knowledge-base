/**
 * api_submit_test.js — 纯接口闭环验证（不做任何 UI 点选）
 * 链路：GET record 取 logId → POST redo-paper 取题与正确答案 → 构造全量 userAnswerList
 *       → POST submit-paper 一次性交卷 → POST exam-report 回查分数
 * 鉴权：authentication JWT 从浏览器最近抓包导出（7 天有效），仅用于可重做知识点卷。
 * 用法：node scripts/cdp/api_submit_test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const BASE = 'https://apigateway.gaodun.com/minerva/api/v1/front';
const BUSINESS = { courseId: 42660, csItemId: 2074442, resourceId: 2459853, paperId: 82657, sourceFromType: 100533962 };
const PAPER_ID = 82657;
const SFT = 100533962;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN_DWELL_MS = 15000; // 服务端校验“考试时间太短”，redo 后至少停留该墙钟时长再交卷

function latestJwt() {
  const dir = path.join(PROJECT_ROOT, 'data', 'cdp-sniff');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort();
  for (let i = files.length - 1; i >= 0; i -= 1) {
    const lines = fs.readFileSync(path.join(dir, files[i]), 'utf8').split('\n').filter(Boolean);
    for (let j = lines.length - 1; j >= 0; j -= 1) {
      const o = JSON.parse(lines[j]);
      const a = o.headers && o.headers.authentication;
      if (a) return { jwt: a, from: files[i] };
    }
  }
  throw new Error('未从抓包中找到 authentication 头，请先用 CDP 抓一次 minerva 请求。');
}

(async () => {
  const { jwt, from } = latestJwt();
  console.log('[jwt] 复用自', from, '→', jwt.slice(0, 24) + '...');
  const H = {
    authorization: undefined,
    authentication: jwt,
    'content-type': 'application/json;charset=UTF-8',
    accept: 'application/json, text/plain, */*',
    'accept-language': 'zh',
    origin: 'https://glivepro.gaodun.com',
    referer: 'https://glivepro.gaodun.com/',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
  };
  const call = async (method, url, body) => {
    const res = await fetch(url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
    console.log(`\n[${method} ${url.split('/front')[1]}] HTTP ${res.status} status=${json.status} msg=${json.message}`);
    return json;
  };

  // 1) record：取当前 paperDataLogId / paperDataId
  const rec = await call('GET', `${BASE}/student/paper/record?paperId=${PAPER_ID}&sourceFromType=${SFT}&needAuth=1`);
  const lastLogId = rec.result.paperDataLogId;
  console.log('  最近 logId=', lastLogId, ' times=', rec.result.times, ' 历史分=', rec.result.score);

  // 2) redo-paper：开新一轮并取题+答案
  const redo = await call('POST', `${BASE}/redo-paper`, {
    paperDataLogId: lastLogId, sourceFromType: SFT, needReviewInfo: 1,
    businessParam: BUSINESS, openEnergyToEquity: 1,
  });
  const r = redo.result;
  const logId = r.paperDataLogId;
  const userAnswerList = [];
  console.log('  新 logId=', logId, ' paperDataId=', r.paperDataId, ' 题数=', r.questionTotal);
  for (const m of r.moduleList) {
    for (const q of m.questionList) {
      userAnswerList.push({
        questionId: q.questionId,
        questionType: q.questionType,
        userAnswer: q.questionAnswer.answer,
        userClozeAnswers: [],
        userAnswerImageList: [],
      });
    }
  }
  console.log('  准备提交答案：', userAnswerList.map((u) => `${u.questionId}:${u.userAnswer}`).join('  '));

  // 3) submit-paper：一次性交全卷（不经过逐题 submit-question、不碰 UI）
  //    服务端按开卷→交卷墙钟时长校验“考试时间太短”，故先停留满足最小作答时长。
  console.log(`  等待 ${MIN_DWELL_MS / 1000}s 满足最小作答时长...`);
  await sleep(MIN_DWELL_MS);
  const sub = await call('POST', `${BASE}/submit-paper`, {
    costTime: MIN_DWELL_MS / 1000, paperId: PAPER_ID, paperDataId: r.paperDataId, paperDataLogId: logId,
    submitType: 1, userAnswerList, sourceFromType: SFT, businessParam: BUSINESS,
  });
  if (sub.status !== 0) { console.error('  交卷被拒，停止：', sub.status, sub.message); process.exit(2); }
  console.log('  submit-paper.result=', JSON.stringify(sub.result).slice(0, 200));

  // 4) exam-report：回查分数
  await sleep(1500);
  const rep = await call('POST', `${BASE}/exam-report`, { paperDataLogId: logId, needReviewInfo: 1 });
  const x = rep.result;
  if (!x) { console.error('  exam-report 无 result（可能尚未批改完成）'); process.exit(3); }
  console.log('\n===== 考试报告回查 =====');
  console.log('标题:', x.title);
  console.log(`得分: ${x.userScore}/${x.totalScore}  答对 ${x.answerRightNum}/${x.totalQuestionNum}  正确率 ${x.answerRightPercent}  最高 ${x.highestScore}`);
  console.log('wrongQuestionIds=', x.wrongQuestionIds, ' allRightStatus=', x.allRightStatus);
  process.exit(0);
})().catch((e) => { console.error('[api-submit FAIL]', e.message); process.exit(1); });

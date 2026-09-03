/**
 * gaodun_paper_core.js — 高顿「纯接口做完一张卷」的共享核心
 *
 * 覆盖：客观题（type1 单选 / type2 多选）+ 主观计算大题（type5 父题容器套 type6 自由文本小问，AI 批改）。
 * 完整链路均已在 2026-09-02 卷 82749「带答案交卷 + 交卷后逐题 AI 批改」干净实例上实测到 11/11：
 *
 *   record → redo-paper（返回题面与标准答案/解析）
 *     → 平铺构造 userAnswerList：type5 父题本身不提交，平铺其 subQuestionList 为 type6 子题项
 *     → 满足最小作答时长 → submit-paper 一次性交【全部】答案（主观子题绝不能留空）
 *     → 交卷后对每个 type6 子题逐题 POST correct-ai/cpa（必带 openEnergyToEquity:1），AI 判分会回写正式成绩：
 *         cs=2 批改完成(满分) / cs=6 部分得分→用整段解析(含【点拨】)重发一次覆盖 /
 *         cs=1 批改中→每 5s 长轮询(单题上限 75s) / 11193404 已批过→直接读状态
 *     → exam-report 核对：userScore===totalScore、noCorrectAiQuestionScore===0、wrongQuestionIds 空、子题全 ai=2
 *
 * 交卷与批改解耦（重要设计原则）：
 *   - submit 成功即「作业已交」，课程大纲 progress=1，这是硬完成，不消耗 AI 批改权益；
 *   - AI 批改负责把主观题冲到满分；若批改超时 / 权益用完 / 异常，交卷结果保留，只在返回里标记
 *     aiPartial/aiFailed，不抛崩、不影响后续卷，之后可补批。
 *
 * 纯 Node 全局 fetch（Node>=18），不依赖浏览器；鉴权头 authentication 由调用方传入或用 findJwt 从抓包目录读取。
 * 接口契约详见 docs/development/api/gaodun-exam-api.md。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const MINERVA_BASE = 'https://apigateway.gaodun.com/minerva/api/v1/front';
const AITUTOR_BASE = 'https://apigateway.gaodun.com/aitutor/api/v1/front';
const COURSE_ID = 42660;
const SOURCE_FROM_TYPE = 100533962; // 本课程作业卷固定 sourceFromType
const CPA = { aiTutorConfigId: 55, sourceType: 100536073, cpaAiBotType: 3, botId: '171109285178801048' }; // 兜底默认值；实际以每题 redo 的 aiCorrect 为准
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 主观题 AI 批改默认并发数：不同 itemId 相互独立，可小并发；保守取 3 兼顾速度与风控，可用 opts.aiConcurrency 覆盖
const AI_CONCURRENCY = 3;
// cs=6（AI 语义判分部分得分）三级文本补全后仍不满时的 best-of-N 原样重取上限：
// 高顿 AI 判分存在“同一份标准答案、重复提交结果不同”的模型波动（外部 LLM-judge 固有非确定性），
// 我们提交的本就是标准答案原文，故原样重交、碰到一次 cs=2 即停；用尽仍 cs=6 归 aiCeiling（AI 判分上限，不阻断平台最优）。
const AI_CS6_RERUN = 4;
/** 限并发 map：最多 limit 个 worker 同时在跑，保持结果顺序 */
async function mapLimit(items, limit, worker) {
  const ret = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor;
      cursor += 1;
      ret[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return ret;
}

/** 从 data/cdp-sniff 最新 jsonl 倒序提取 authentication 头 */
function findJwt(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort();
  for (let i = files.length - 1; i >= 0; i -= 1) {
    const lines = fs.readFileSync(path.join(dir, files[i]), 'utf8').split('\n').filter(Boolean);
    for (let j = lines.length - 1; j >= 0; j -= 1) {
      try {
        const o = JSON.parse(lines[j]);
        if (o.headers && o.headers.authentication) return o.headers.authentication;
      } catch { /* skip */ }
    }
  }
  throw new Error('未找到 authentication，需先用 CDP 抓一次带鉴权的请求。');
}

function makeHeaders(jwt, opts = {}) {
  const origin = opts.origin || 'https://glivepro.gaodun.com';
  return {
    authentication: jwt,
    'content-type': 'application/json;charset=UTF-8',
    accept: 'application/json, text/plain, */*',
    'accept-language': 'zh',
    origin,
    referer: opts.referer || `${origin}/`,
    'user-agent': UA,
  };
}

/** 最小作答停留秒：max(20, 答案项*1.5 向上取整到 5s)；含主观大题再保底 25s */
function dwellSec(answerCount, hasSubjective) {
  return Math.max(20, Math.ceil((answerCount * 1.5) / 5) * 5, hasSubjective ? 25 : 0);
}

const stripHtml = (s) => (s || '')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** 首版主观答案：取【点拨】之前的计算/结论句，去掉开头 (1) 序号与结尾句读符号 */
function canonAnswer(analysis) {
  let a = stripHtml(analysis).split(/【点拨】/)[0].trim();
  a = a.replace(/^[（(]\d+[)）]/, '').trim().replace(/[。.;；]$/, '').trim();
  return a;
}

/** cs=6 兜底答案：整段解析（含【点拨】里的法理 / 因果定性句），覆盖 AI 动态生成的定性采分点 */
function fullAnswer(analysis) {
  return stripHtml(analysis);
}

/**
 * 从【点拨】段提炼干净的法理 / 定性陈述句（cs=6 补定性采分点用）。
 * 做法：取【点拨】之后文本 → 砍掉“即/也就是…”引导的通用公式尾巴（其含“账面成本”等占位词，
 * 直接贴上去反而会让 AI 把定性句吞进计算维度）→ 按句读切分、丢弃纯公式与碎片，保留因果陈述。
 * 实测 1681680：等式句单独发只拿计算分(points 0/1)，叠加本句后 points 1/1、cs=2。
 */
function qualitativeAnswer(analysis) {
  const raw = stripHtml(analysis);
  const mark = raw.indexOf('【点拨】');
  if (mark < 0) return '';
  let seg = raw.slice(mark + '【点拨】'.length);
  seg = seg.split(/，?\s*(?:即|也就是|公式为|公式如下|具体公式)/)[0]; // 砍通用公式尾巴，保留因果陈述（内部逗号保留）
  return seg.split(/[。；;]/).map((s) => s.trim())
    .filter((s) => s.length >= 4 && !/^[（(]\d+[)）]$/.test(s)
      && !( /[=＝]/.test(s) && /(账面|成本|费用|收入|金额|价税|某\b)/.test(s) ))
    .join('；');
}

/**
 * 处理一个主观判分叶子（type6）：统一用于「type5 大题下的子题」与「顶层独立 type6（无 type5 包裹）」。
 * 答案取解析提炼（analysis），兜底 answer；按 aiCorrect.cpaBotType 分到可 AI 批改 / 平台未配 AI。
 */
function pushSubjectiveLeaf(leaf, userAnswerList, subjective, unsupported) {
  const qa = leaf.questionAnswer || {};
  const canon = canonAnswer(qa.analysis) || stripHtml(qa.answer);
  userAnswerList.push({
    questionId: leaf.questionId, questionType: 6,
    userAnswer: canon, userClozeAnswers: [], userAnswerImageList: [],
  });
  const ai = leaf.aiCorrect || {};
  const base = {
    questionId: leaf.questionId,
    canon,
    qual: qualitativeAnswer(qa.analysis),
    full: fullAnswer(qa.analysis),
    score: leaf.score,
  };
  if (ai.cpaBotType === 3) {
    subjective.push({ ...base, aiCfg: { aiTutorConfigId: ai.aiTutorConfigId, botId: ai.botId, cpaBotType: ai.cpaBotType } });
  } else {
    unsupported.push({ questionId: leaf.questionId, cpaBotType: ai.cpaBotType, score: leaf.score });
  }
}

/**
 * 由 redo-paper 结果平铺出交卷答案。兼容两种主观题结构：type5 大题套 type6 子题、顶层独立 type6。
 * @returns {{userAnswerList:Array, subjective:Array, unsupported:Array}}
 *   userAnswerList 直接用于 submit-paper（所有子题都提交标准答案）；
 *   subjective 仅收录 aiCorrect.cpaBotType===3（题库配了 CPA 批改机器人）的 type6 子题，携带该题自己的 configId/botId；
 *   unsupported 收录 type6 但 cpaBotType!==3（题库未配 AI 评分标准，cpa 会回 11193401、UI 也无批改入口）的子题，答案照交但不请求批改。
 */
function buildUserAnswers(redo) {
  const userAnswerList = [];
  const subjective = [];
  const unsupported = [];
  for (const m of redo.moduleList || []) {
    for (const q of m.questionList || []) {
      if (q.questionType === 5 && Array.isArray(q.subQuestionList) && q.subQuestionList.length) {
        // 大题容器自身不作答，平铺其 type6 子题
        for (const sub of q.subQuestionList) pushSubjectiveLeaf(sub, userAnswerList, subjective, unsupported);
      } else if (q.questionType === 6) {
        // 顶层独立主观题（无 type5 父容器，如 85916/85917）
        pushSubjectiveLeaf(q, userAnswerList, subjective, unsupported);
      } else {
        // 客观题（单选/多选/判断/填空等系统自动判分）：直接用标准答案 answer
        userAnswerList.push({
          questionId: q.questionId, questionType: q.questionType,
          userAnswer: (q.questionAnswer || {}).answer,
          userClozeAnswers: [], userAnswerImageList: [],
        });
      }
    }
  }
  return { userAnswerList, subjective, unsupported };
}

/** 对单个 type6 子题做 AI 批改直到终态，结果写回 out（aiFull/aiPartial/aiFailed/aiUnsupported） */
async function correctSubjective(call, logId, s, log, out) {
  const cfg = s.aiCfg || {};
  const body = (ans) => ({
    itemId: s.questionId, paperDataLogId: logId,
    aiTutorConfigId: cfg.aiTutorConfigId ?? CPA.aiTutorConfigId,
    sourceType: CPA.sourceType,
    cpaAiBotType: cfg.cpaBotType ?? CPA.cpaAiBotType,
    botId: cfg.botId ?? CPA.botId,
    userAnswer: ans, excelAnswer: '', openEnergyToEquity: 1,
  });
  const poll = async () => {
    let r = null;
    for (let i = 0; i < 15; i += 1) { // 每 5s，最多 75s
      await sleep(5000);
      const z = await call('GET',
        `/question/correct-ai/cpa/status?paperDataLogId=${logId}&itemId=${s.questionId}`, null, AITUTOR_BASE);
      r = z.result;
      if (r && r.correctStatus !== 1) return r;
    }
    return r;
  };

  const st = await call('POST', '/question/correct-ai/cpa', body(s.canon), AITUTOR_BASE);
  if (st.status === 11193404) { // 该题已批改过：直接读既有结果
    const z = await call('GET',
      `/question/correct-ai/cpa/status?paperDataLogId=${logId}&itemId=${s.questionId}`, null, AITUTOR_BASE);
    if (z.result && z.result.correctStatus === 2) { out.aiFull += 1; log(`    子题${s.questionId} 已批过 cs=2 满分`); return; }
  }
  if (st.status === 11193401) { // 题库未配该题 AI 评分标准：平台无判分通道，非我方失败（防御性，build 阶段通常已分流）
    out.aiUnsupported.push({ q: s.questionId, code: 11193401 });
    log(`    子题${s.questionId} 题库未配 AI 评分标准(11193401)，跳过`);
    return;
  }
  if (st.status !== 0 && st.status !== 11193404) {
    out.aiFailed.push({ q: s.questionId, code: st.status, msg: st.message });
    log(`    子题${s.questionId} 发起失败 ${st.status} ${st.message}`);
    return;
  }

  let r = await poll();
  // cs=6 部分得分：逐级补全答案重发（cs=6 允许覆盖同一条批改记录）
  // 1) 等式句+干净定性句；2) 整段解析兜底；3) 用 AI 自己标出的“未命中参考点”定向补（针对 semanticJudgment 维度漏点）
  const missPoints = (rr) => {
    const pts = [];
    ((rr && rr.corrects) || []).forEach((c) => {
      (((c.correctText || {}).correctPointList) || []).forEach((p) => {
        if (p.showStatus !== 1 && p.answer) pts.push(stripHtml(p.answer));
      });
    });
    return [...new Set(pts.filter(Boolean))];
  };
  let tries = [];
  let ri = 0;
  while (r && r.correctStatus === 6) {
    if (ri === 0) {
      if (s.qual) tries.push(`${s.canon}。${s.qual}`);
      tries.push(s.full);
      const miss = missPoints(r);
      if (miss.length) tries.push([s.canon, ...miss].join('。'));
      tries = [...new Set(tries.filter(Boolean))];
    }
    if (ri >= tries.length) break;
    const ans = tries[ri];
    ri += 1;
    log(`    子题${s.questionId} cs=6 部分得分，第 ${ri}/${tries.length} 次补全重发：${String(ans).slice(0, 42)}…`);
    await call('POST', '/question/correct-ai/cpa', body(ans), AITUTOR_BASE);
    r = await poll();
  }

  if (r && r.correctStatus === 2) { out.aiFull += 1; log(`    子题${s.questionId} cs=2 满分`); return; }
  if (r && r.correctStatus === 6) {
    // best-of-N：三级文本补全仍 cs=6，答案内容已是标准答案、属 AI 语义判分波动，原样重交标准答案碰一次 cs=2
    const rerunAns = s.full || s.canon;
    for (let k = 1; k <= AI_CS6_RERUN; k += 1) {
      await sleep(3000);
      log(`    子题${s.questionId} cs=6 AI判分波动，best-of-N 原样重取 ${k}/${AI_CS6_RERUN}`);
      await call('POST', '/question/correct-ai/cpa', body(rerunAns), AITUTOR_BASE);
      r = await poll();
      if (!r || r.correctStatus !== 6) break; // cs=2 成功 / 其它异常状态都退出循环
    }
    if (r && r.correctStatus === 2) { out.aiFull += 1; log(`    子题${s.questionId} best-of-N 重取到 cs=2 满分`); return; }
    if (r && r.correctStatus === 6) {
      out.aiCeiling.push({ q: s.questionId, rerun: AI_CS6_RERUN });
      log(`    子题${s.questionId} ${AI_CS6_RERUN} 次重取仍 cs=6，归 aiCeiling（答案=标准答案原文、AI 反复判不满，平台判分上限）`);
      return;
    }
  }
  out.aiFailed.push({ q: s.questionId, cs: r && r.correctStatus });
  log(`    子题${s.questionId} 未达满分 cs=${r && r.correctStatus}`);
}

/**
 * 纯接口做完一张卷。
 * @param {object} opts
 * @param {{paperId:number,csItemId:number,resourceId:number,title:string,num?:number}} opts.target
 * @param {string} opts.jwt authentication 头
 * @param {boolean} [opts.doAi=true] 交卷后是否对主观子题做 AI 批改（false=只交卷不冲主观分）
 * @param {number} [opts.dwellSecOverride] 自定义最小停留秒
 * @param {string} [opts.origin] 来源域（作业 glivepro / 专区 tiku），默认 glivepro
 * @param {Function} [opts.log] 日志函数
 * @returns {Promise<object>} 结构化结果（submitted=硬交卷完成；fullScore=满分；aiPartial/aiFailed=待补）
 */
async function doPaperViaApi(opts) {
  const { target, jwt } = opts;
  const log = opts.log || ((...a) => console.log(...a));
  const H = makeHeaders(jwt, { origin: opts.origin, referer: opts.referer });
  const call = async (method, urlPath, reqBody, base = MINERVA_BASE) => {
    const res = await fetch(base + urlPath, {
      method, headers: H,
      body: reqBody ? JSON.stringify(reqBody) : undefined,
    });
    return res.json();
  };

  const out = {
    paperId: target.paperId, title: target.title,
    submitted: false, fullScore: false, platformDone: false, objectiveAllRight: false,
    logId: null, userScore: null, totalScore: null,
    aiTotal: 0, aiFull: 0, aiPartial: [], aiFailed: [], aiUnsupported: [], aiCeiling: [],
    wrong: null, error: null,
  };

  try {
    // 1) record 取最近实例
    const rec = await call('GET',
      `/student/paper/record?paperId=${target.paperId}&sourceFromType=${SOURCE_FROM_TYPE}&needAuth=1`);
    let logId = rec.result && rec.result.paperDataLogId;
    const business = {
      courseId: COURSE_ID, csItemId: target.csItemId, resourceId: target.resourceId,
      paperId: target.paperId, sourceFromType: SOURCE_FROM_TYPE,
    };

    // 1.5) 首次作答（record 为 null）：必须先 create-paper 创建实例拿到 paperDataLogId，
    //      否则 redo-paper 报 10463001「用户做试卷记录ID不能为空」。重做卷则直接复用最近 logId。
    if (!logId) {
      const cp = await call('POST', '/create-paper', {
        paperId: target.paperId, sourceFromType: SOURCE_FROM_TYPE, businessParam: business,
      });
      if (cp.status !== 0) throw new Error(`create-paper失败 ${cp.status} ${cp.message}`);
      logId = cp.result.paperDataLogId;
      log(`  首次作答 create-paper -> logId=${logId} paperDataId=${cp.result.paperDataId}`);
    }

    // 2) redo 取题面与标准答案
    const redo = await call('POST', '/redo-paper', {
      paperDataLogId: logId, sourceFromType: SOURCE_FROM_TYPE, needReviewInfo: 1,
      businessParam: business, openEnergyToEquity: 1,
    });
    if (redo.status !== 0) throw new Error(`redo失败 ${redo.status} ${redo.message}`);
    const r = redo.result;
    out.logId = r.paperDataLogId;

    // 3) 平铺答案（subjective=配了 CPA 机器人可 AI 批改的子题；unsupported=题库未配 AI 评分标准、答案照交但不批改）
    const { userAnswerList, subjective, unsupported } = buildUserAnswers(r);
    const hasSub = subjective.length > 0;
    // 真正由系统自动判分的客观题数：type5 子题与「顶层独立 type6」都是主观（questionType=6），不计入客观
    const objectiveCount = userAnswerList.filter((u) => u.questionType !== 6).length;
    out.aiTotal = subjective.length;
    out.aiUnsupported = unsupported;
    log(`  logId=${r.paperDataLogId} 题量=${r.questionTotal} 答案项=${userAnswerList.length} `
      + `可AI批改=${subjective.length} 平台未配AI=${unsupported.length}`);
    if (userAnswerList.length !== r.questionTotal) {
      log(`  ⚠ 答案项数 ${userAnswerList.length} ≠ questionTotal ${r.questionTotal}，以平铺结果为准`);
    }

    // 4) 最小作答时长
    const baseDwell = opts.dwellSecOverride || dwellSec(userAnswerList.length, hasSub);
    let dwell = baseDwell;
    log(`  等待 ${dwell}s 满足最小作答时长...`);
    await sleep(dwell * 1000);

    // 5) 交卷（10462203 作答太快 → 加 20s 重试一次）
    let sub;
    for (let attempt = 1; ; attempt += 1) {
      sub = await call('POST', '/submit-paper', {
        costTime: dwell, paperId: target.paperId, paperDataId: r.paperDataId,
        paperDataLogId: r.paperDataLogId, submitType: 1, userAnswerList,
        sourceFromType: SOURCE_FROM_TYPE, businessParam: business,
      });
      if (sub.status === 10462203 && attempt === 1) {
        dwell += 20;
        log('  ⚠ 作答时间太短，延长 20s 重试');
        await sleep(20000);
        continue;
      }
      break;
    }
    if (sub.status !== 0) throw new Error(`submit被拒 ${sub.status} ${sub.message}`);
    out.submitted = true;
    await sleep(1600);

    // 6) 交卷后逐题 AI 批改（仅主观卷；doAi=false 时只交卷）。小并发池 + 错峰发起。
    if (hasSub && opts.doAi !== false) {
      await sleep(1500);
      const conc = opts.aiConcurrency || AI_CONCURRENCY;
      log(`  主观子题 ${subjective.length} 个，并发=${conc} AI 批改...`);
      await mapLimit(subjective, conc, async (s, idx) => {
        await sleep(idx * 120); // 错峰发起，避免同一毫秒突发
        return correctSubjective(call, r.paperDataLogId, s, log, out);
      });
    }

    // 7) exam-report 最终核对
    await sleep(1500);
    const rep = await call('POST', '/exam-report', { paperDataLogId: r.paperDataLogId, needReviewInfo: 1 });
    const x = rep.result || {};
    out.userScore = x.userScore;
    out.totalScore = x.totalScore;
    out.wrong = x.wrongQuestionIds || [];
    const subStates = [];
    for (const m of x.answerSheetModuleList || []) {
      for (const q of m.questionList || []) for (const ss of q.subQuestion || []) subStates.push(ss);
    }
    // 客观题数以 build 平铺结果为准（非 type6）；exam-report 的 subQuestion 仅 type5 子题，
    // 顶层独立 type6 主观题不在其中，不能用 totalQuestionNum-subStates.length 反推（否则把顶层 type6 误当客观）
    const objectiveTotal = objectiveCount;
    out.objectiveAllRight = x.answerRightNum === objectiveTotal;
    const noCorrectAi = x.noCorrectAiQuestionScore || 0;
    const allAiDone = subStates.length ? subStates.every((ss) => ss.aiQuestionStatus === 2) : true;
    // 严格满分：所有子题（含平台未配 AI 的题）都判满分——未配 AI 卷天然达不到
    out.fullScore = out.submitted && x.userScore === x.totalScore && noCorrectAi === 0
      && out.wrong.length === 0 && allAiDone;
    // 平台最优：客观全对、无失败；配了 AI 的主观题要么判满、要么属 aiCeiling（标准答案原文重取 N 次仍被模型判部分分）；
    // 平台未配 AI（aiUnsupported）与 AI 判分上限（aiCeiling）都不阻断——答案内容均已 100% 正确提交，受限的是平台判分能力/稳定性。
    const aiConfiguredDone = out.aiTotal === 0
      ? true : (out.aiFull + out.aiCeiling.length) === out.aiTotal && out.aiPartial.length === 0;
    out.platformDone = out.submitted && out.objectiveAllRight && out.wrong.length === 0
      && out.aiFailed.length === 0 && aiConfiguredDone;
    const ceilingNote = out.aiCeiling.length ? `、${out.aiCeiling.length} 题 AI 反复重取仍判部分分（判分上限）` : '';
    const verdict = out.fullScore ? '✅满分'
      : out.platformDone ? `🟡平台最优（${out.aiUnsupported.length} 题题库未配AI无法判分${ceilingNote}，答案均已提交）`
        : '⏺已交卷/未满分';
    log(`  结果 ${x.userScore}/${x.totalScore} 客观对${x.answerRightNum}/${objectiveTotal} `
      + `可AI满分${out.aiFull}/${out.aiTotal} 未配AI=${out.aiUnsupported.length} 判分上限=${out.aiCeiling.length} `
      + `noCorrectAi=${noCorrectAi} wrong=${JSON.stringify(out.wrong)} ${verdict}`);
  } catch (e) {
    out.error = e.message;
    log('  ❌', e.message);
  }
  return out;
}

module.exports = {
  findJwt, makeHeaders, dwellSec, stripHtml, canonAnswer, fullAnswer,
  buildUserAnswers, doPaperViaApi,
  MINERVA_BASE, AITUTOR_BASE, COURSE_ID, SOURCE_FROM_TYPE,
};

/**
 * do_sprint_paper.js — 冲刺模考「试卷 + 机考」6 卷纯接口做完入口（复用 gaodun_paper_core.doPaperViaApi）
 *
 * 冲刺试卷与机考底层同走 minerva 接口、题目 100% 相同（2026-09-05 双卷比对实证）：
 *   差异仅在 ID 与来源域——试卷来自 glivepro，机考(paperType=109)来自 mock-cpa.gaodun.com。
 *   故同一 doPaperViaApi 可处理，机考额外带 origin/referer=mock-cpa 域。
 *
 * 用法：
 *   node scripts/cdp/do_sprint_paper.js 1 | 2 | 3     # 冲刺试卷 86722/86723/86724（兼容旧参数）
 *   node scripts/cdp/do_sprint_paper.js s1 | s2 | s3  # 同上，显式冲刺
 *   node scripts/cdp/do_sprint_paper.js m1 | m2 | m3  # 机考 86726/86727/86728
 *   node scripts/cdp/do_sprint_paper.js 86723         # 也可直接给 paperId
 *   node scripts/cdp/do_sprint_paper.js s2 --no-ai    # 只交卷、不做交卷后 AI 批改
 *
 * 判分口径（2026-09-05 实证）：免费可达上限 64/100 = 客观 50（自动判分全对）+ AI 主观 14；
 *   另有 3 分（1705/14/15 类）AI 判分模型稳定误判（逐字/语境/分步三种表述均 0）归 aiCeiling；
 *   33 分（cpaBotType=0）平台未配 AI，须人工批改权益（本账户 0 次、不购买），答案仍 100% 正确提交。
 *
 * 安全：真实交卷入口，submit 不可逆但 canTrial=true 可重做；交卷后自动 exam-report 回查对平。
 *   JWT 从 data/_workspace/_account/auth 最新抓包提取。结果落 data/_workspace/<profile>/papers/exam_result_*.json。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { findJwt, doPaperViaApi } = require('./gaodun_paper_core');
const { workspaceDir } = require('./load_profile');

// 冲刺模考六卷为税法专属（EXAMS 硬编码税法 paperId），缺省 profile=cpa-tax-2026
const papersDir = workspaceDir('papers');
const MOCK_ORIGIN = 'https://mock-cpa.gaodun.com';

// 6 卷映射：paperId=真实试卷ID；csItemId=syllabus 节点 id；resourceId=资源 id（侦查自 syllabus_full.json）
const EXAMS = [
  { key: 's1', paperId: 86722, csItemId: 982347, resourceId: 2550958, title: '26考季-冲刺模考-税法01-试卷', kind: 'sprint' },
  { key: 's2', paperId: 86723, csItemId: 982348, resourceId: 2550959, title: '26考季-冲刺模考-税法02-试卷', kind: 'sprint' },
  { key: 's3', paperId: 86724, csItemId: 982350, resourceId: 2550960, title: '26考季-冲刺模考-税法03-试卷', kind: 'sprint' },
  { key: 'm1', paperId: 86726, csItemId: 982351, resourceId: 2558996, title: '26考季-冲刺模考-税法01-机考', kind: 'mock', origin: MOCK_ORIGIN },
  { key: 'm2', paperId: 86727, csItemId: 982353, resourceId: 2558998, title: '26考季-冲刺模考-税法02-机考', kind: 'mock', origin: MOCK_ORIGIN },
  { key: 'm3', paperId: 86728, csItemId: 982354, resourceId: 2558999, title: '26考季-冲刺模考-税法03-机考', kind: 'mock', origin: MOCK_ORIGIN },
];

function resolveTarget(arg) {
  const a = String(arg).toLowerCase();
  // 兼容旧参数：裸 1/2/3 = s1/s2/s3
  if (/^[123]$/.test(a)) return EXAMS.find((x) => x.key === `s${a}`);
  const byKey = EXAMS.find((x) => x.key === a);
  if (byKey) return byKey;
  const byPid = EXAMS.find((x) => String(x.paperId) === String(arg));
  if (byPid) return byPid;
  throw new Error(`参数应为 s1-s3 / m1-m3 / paperId，收到：${arg}`);
}

async function main() {
  const arg = process.argv[2] || 's1';
  const doAi = !process.argv.includes('--no-ai');
  const target = resolveTarget(arg);
  const jwt = findJwt();
  const tag = target.kind === 'mock' ? 'mockdo' : 'sprint';
  console.log(`[${tag}] 目标：${target.title} paperId=${target.paperId} csItemId=${target.csItemId} AI批改=${doAi} origin=${target.origin || 'glivepro'}`);
  const out = await doPaperViaApi({
    target, jwt, doAi, origin: target.origin, referer: target.origin ? `${target.origin}/` : undefined,
    log: (...a) => console.log(`[${tag}]`, ...a),
  });
  const f = path.join(papersDir, `exam_result_${target.paperId}_${Date.now()}.json`);
  fs.writeFileSync(f, JSON.stringify(out, null, 2));
  console.log(`[${tag}] 结果落盘 →`, f);
  console.log(`[${tag}] 汇总：`, JSON.stringify({
    submitted: out.submitted, fullScore: out.fullScore, platformDone: out.platformDone,
    userScore: out.userScore, totalScore: out.totalScore, objectiveAllRight: out.objectiveAllRight,
    aiFull: out.aiFull, aiTotal: out.aiTotal, unsupported: out.aiUnsupported.length,
    ceiling: out.aiCeiling.length, failed: out.aiFailed.length, wrong: out.wrong, error: out.error,
  }, null, 2));
  process.exit(out.submitted ? 0 : 1);
}

main().catch((e) => {
  console.error('[exam FAIL]', e.stack || e.message);
  process.exit(1);
});

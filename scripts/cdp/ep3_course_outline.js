#!/usr/bin/env node
/**
 * ep3_course_outline.js — 拉取 ep3（epiphany 名师专业课, saasCourseType=13）单课的
 * 「26 考季梯度 → 章节树 → 讲义清单」基线 manifest（纯只读 GET，复用同一套 JWT）。
 *
 * 与正课（glive/saasType=16）区别：ep3 多「梯度(gradation)×多老师」两层，
 * 章节树走 student-learning/analysis/chapter，讲义清单走 ep-course/.../gradation/handout。
 *
 * 用法：
 *   node scripts/cdp/ep3_course_outline.js <courseId> [--all-season]
 *   默认只取「26 考季」梯度；--all-season 保留全部（含 25）。
 * 输出（账号级跨课过程件，不入库）：
 *   data/_workspace/_account/ep3/manifest/<courseId>.outline.json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { findJwt, makeHeaders } = require('./gaodun_paper_core');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'data/_workspace/_account/ep3/manifest');
const GW = 'https://apigateway.gaodun.com';

const slimChapter = (n) => ({
  id: n.id, name: n.name, itemId: n.itemId,
  totalResource: n.totalResource, videoTotal: n.videoTotal,
  paperTotal: n.paperTotal, lectureNoteTotal: n.lectureNoteTotal,
  csItemIds: Array.isArray(n.csItemIds) ? n.csItemIds : undefined,
  children: Array.isArray(n.children) ? n.children.map(slimChapter) : undefined,
});
const count = (node, key) => {
  let s = Number(node[key] || 0);
  (node.children || []).forEach((c) => { s += count(c, key); });
  return s;
};
// csItemIds 挂在中间章节点（非叶子），需递归所有层汇总
const countCs = (n) => (Array.isArray(n.csItemIds) ? n.csItemIds.length : 0)
  + (n.children || []).reduce((s, c) => s + countCs(c), 0);
const flattenLeaves = (n, acc = []) => {
  if (!n.children || !n.children.length) acc.push(n);
  else n.children.forEach((c) => flattenLeaves(c, acc));
  return acc;
};

(async () => {
  const cid = process.argv[2];
  if (!cid) { console.error('用法: node ep3_course_outline.js <courseId> [--all-season]'); process.exit(1); }
  const allSeason = process.argv.includes('--all-season');
  const H = makeHeaders(findJwt()); H.Referer = 'https://epiphany.gaodun.com/';
  const get = async (p) => (await fetch(GW + p, { headers: H })).json();

  const course = await get(`/ep-course/api/v1/front/course/${cid}`);
  const courseName = course.result && course.result.courseName;
  const chapter = await get(`/student-learning/api/v1/analysis/chapter?courseId=${cid}`);
  const handout = await get(`/ep-course/api/v1/course/${cid}/gradation/handout`);

  const wantSeason = (name) => allSeason || /26\s*考季/.test(name || '');
  // 章节树：gradationSyllabuses
  const grads = (chapter.result.gradationSyllabuses || [])
    .filter((g) => wantSeason(g.name))
    .map((g) => {
      const tree = (g.syllabus || []).map(slimChapter);
      const leaves = tree.flatMap((t) => flattenLeaves(t));
      return {
        gradationId: Number(g.id), syllabusId: Number(g.syllabusId), name: g.name,
        syllabusName: g.syllabusName, attribute: g.attribute,
        chapterTree: tree,
        stats: {
          chapters: tree.length,
          leafSections: leaves.length,
          csItems: tree.reduce((s, t) => s + countCs(t), 0),
          videoTotal: tree.reduce((s, t) => s + count(t, 'videoTotal'), 0),
          paperTotal: tree.reduce((s, t) => s + count(t, 'paperTotal'), 0),
          lectureNoteTotal: tree.reduce((s, t) => s + count(t, 'lectureNoteTotal'), 0),
        },
      };
    });

  // 讲义清单：handoutCategories[].courseHandouts[] 扁平化，只留选中梯度
  const sylSet = new Set(grads.map((g) => g.syllabusId));
  const handouts = [];
  (handout.result || [])
    .filter((g) => wantSeason(g.gradationName))
    .forEach((g) => {
      (g.handoutCategories || []).forEach((cat) => {
        (cat.courseHandouts || []).forEach((h) => {
          handouts.push({
            id: h.id, gradationId: g.gradationId, syllabusId: g.syllabusId,
            gradationName: g.gradationName, category: cat.name, teacherCategory: cat.name,
            name: h.fileName || h.name, format: h.format, fileSize: h.fileSize,
            sizeText: h.size, symlink: h.symlink,
          });
        });
      });
    });

  const manifest = {
    platform: 'ep3', saasCourseType: 13, courseId: Number(cid), courseName,
    fetchedAt: new Date().toISOString(), seasonFilter: allSeason ? 'all' : '26考季',
    gradations: grads, handouts,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `${cid}.outline.json`);
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2));

  console.log(`课程: ${courseName} (${cid})，梯度${grads.length}个，讲义文件${handouts.length}个`);
  grads.forEach((g) => {
    const ho = handouts.filter((h) => h.syllabusId === g.syllabusId).length;
    console.log(`  ${g.name} grad=${g.gradationId} syl=${g.syllabusId} | 章${g.stats.chapters} 叶节${g.stats.leafSections} csItem${g.stats.csItems} 视频${g.stats.videoTotal} 题${g.stats.paperTotal} 讲义节点${g.stats.lectureNoteTotal} 讲义文件${ho}`);
  });
  const byFmt = {}; handouts.forEach((h) => { byFmt[h.format] = (byFmt[h.format] || 0) + 1; });
  console.log('讲义格式分布:', byFmt);
  console.log('已写:', path.relative(ROOT, out));
})().catch((e) => { console.error('[OUTLINE-FAIL]', e.stack || e.message); process.exit(1); });

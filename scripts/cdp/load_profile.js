#!/usr/bin/env node
/**
 * load_profile.js — 课程档案卡(profile)读取器（Node 侧）
 *
 * 作用：所有 cdp 脚本不再硬编码 courseId/syllabusId/课程路径，统一从
 *   config/courses/<key>.json 读取。换一门课只换 --profile / GAODUN_COURSE_PROFILE，
 *   不改代码。设计见 docs/development/guides/parallel-toolkit-design.md 三。
 *
 * 用法：
 *   const { loadProfile } = require('./load_profile');
 *   const p = loadProfile();                          // 默认环境变量 GAODUN_COURSE_PROFILE，再否则 cpa-tax-2026
 *   const p2 = loadProfile('cpa-accounting-2026');    // 指定 key
 *   p.primaryCourse.saasCourseId / p.structure.groups / p.paths.localRoot ...
 *
 *   命令行自检（打印关键 ID，人工核对）：
 *   node scripts/cdp/load_profile.js cpa-tax-2026
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PROFILE_DIR = path.join(PROJECT_ROOT, 'config', 'courses');
const DEFAULT_KEY = 'cpa-tax-2026';

function resolvePath(keyOrPath) {
  if (!keyOrPath) {
    keyOrPath = process.env.GAODUN_COURSE_PROFILE || DEFAULT_KEY;
  }
  if (keyOrPath.endsWith('.json') && fs.existsSync(keyOrPath)) return path.resolve(keyOrPath);
  const p = path.join(PROFILE_DIR, `${keyOrPath}.json`);
  if (!fs.existsSync(p)) {
    throw new Error(`课程 profile 不存在: ${p}（可用：${listProfiles().join(', ') || '无'}）`);
  }
  return p;
}

function listProfiles() {
  if (!fs.existsSync(PROFILE_DIR)) return [];
  return fs.readdirSync(PROFILE_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
}

/** 读取并做最小必填校验，返回 profile 对象 */
function loadProfile(keyOrPath) {
  const file = resolvePath(keyOrPath);
  let p;
  try {
    p = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`profile JSON 解析失败 ${file}: ${e.message}`);
  }
  const errs = [];
  if (!p.key) errs.push('缺 key');
  if (!p.primaryCourse || !p.primaryCourse.saasCourseId) errs.push('缺 primaryCourse.saasCourseId');
  if (!p.subject || p.subject.id == null) errs.push('缺 subject.id');
  if (!p.paths || !p.paths.localRoot) errs.push('缺 paths.localRoot');
  if (errs.length) throw new Error(`profile 校验失败(${path.basename(file)}): ${errs.join('; ')}`);
  p._file = file;
  return p;
}

/** 便捷：取主采集源的做题/内容接口参数（等价旧脚本里散落的常量） */
function primaryIds(p) {
  const c = p.primaryCourse;
  return {
    courseId: c.saasCourseId,       // 做题/syllabus/内容接口用的 courseId
    vcourseId: c.vcourseId,         // 购课实例
    syllabusId: c.syllabusId || null,
    gradationId: c.gradationId || null,
    platform: c.platform,
    subjectId: p.subject.id,
  };
}

/**
 * 按 profile 隔离的过程件文件名：默认税法保持历史原名（零变化回归），其它课程在扩展名前
 * 插 `__<key>`，避免多门课共用同一个全局单文件（inventory/audit/index）互相覆盖。
 *   scopedName('papers_inventory.json','cpa-tax-2026')       -> 'papers_inventory.json'
 *   scopedName('paper_index.json','cpa-accounting-2026')     -> 'paper_index__cpa-accounting-2026.json'
 */
function scopedName(file, key) {
  const k = key || process.env.GAODUN_COURSE_PROFILE || DEFAULT_KEY;
  if (k === DEFAULT_KEY) return file;
  return file.replace(/(\.[^.]+)$/, `__${k}$1`);
}
function scopedPath(dir, file, key) { return path.join(dir, scopedName(file, key)); }

/** 从命令行参数解析 --profile <key> / --profile=<key>；未给返回 undefined（交由 loadProfile 走 env/缺省） */
function argvProfileKey(argv) {
  const a = argv || process.argv;
  const i = a.indexOf('--profile');
  if (i >= 0 && a[i + 1]) return a[i + 1];
  const eq = a.find((x) => x.startsWith('--profile='));
  return eq ? eq.slice('--profile='.length) : undefined;
}

module.exports = { loadProfile, primaryIds, listProfiles, scopedName, scopedPath, argvProfileKey, PROFILE_DIR };

// 命令行自检
if (require.main === module) {
  const key = process.argv[2];
  const p = loadProfile(key);
  const ids = primaryIds(p);
  console.log(`profile   : ${p.key}  (${path.relative(PROJECT_ROOT, p._file)})`);
  console.log(`科目      : ${p.subject.name}(${p.subject.id})  老师=${p.teacher || '-'}  考季=${p.season || '-'}`);
  console.log(`主采集源  : ${p.primaryCourse.name}`);
  console.log(`IDs       : courseId(saas)=${ids.courseId} vcourse=${ids.vcourseId} syllabus=${ids.syllabusId} platform=${ids.platform} 状态=${p.primaryCourse.learnStatusDesc}`);
  const g = p.structure && p.structure.groups;
  console.log(`章组结构  : ${p.structure ? `${p.structure.officialGroupCount} 组 / ${p.structure.pointCount} 知识点，已列 ${g ? g.length : 0} 组名` : '(无)'}`);
  console.log(`本地路径  : ${p.paths.localRoot}`);
  (p.companionCourses || []).forEach((c) => {
    console.log(`配套课    : [${c.platform}] ${c.name} collect=${c.collect !== false} 状态=${c.learnStatusDesc || '-'}`);
  });
}

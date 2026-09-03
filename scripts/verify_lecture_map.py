#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_lecture_map.py — 讲次课件资源映射（knowledge-base/lecture-resource-map.json）校验 / 重建

背景（ADR-011）：官方课件按税种模块覆盖连续多讲、统一放在模块起始讲目录，因此 39 讲中部分讲
自身 docs/ 为空、需跨讲取料。lecture-resource-map.json 是 S2 生成知识库时的「课件/转写取料路由表」，
其权威源是课程库磁盘现状 + 每讲「课件来源讲次」（人工按 ADR-011 核定）。本脚本保证该路由表与磁盘一致。

两种模式：
  python3 scripts/verify_lecture_map.py                # 只校验，不改动；不一致退出码 1
  python3 scripts/verify_lecture_map.py --rebuild      # 保留各讲「课件来源讲次」，按磁盘重建文件清单并写回

校验内容：
  1. 结构完整：课程库每讲在 map 中都有条目，且含 课件来源讲次/课件PDF/OCR文本/转写；
  2. 存在性：map 列出的每个逻辑路径（讲NN/...）在对应真实目录（NN_讲名/...）下确实存在 → 否则 missing；
  3. 反向覆盖：磁盘每个「标准件」至少被 map 收录；
  4. 遗留旧件：磁盘上 讲义_*/课件_* 旧命名重复件单独列为 legacy（提示可清理，不算失败）。

路径约定：map 内统一用逻辑前缀「讲NN/」，与真实目录名「NN_讲名/」按两位讲号对应，保证可移植。
可选参数：
  --course-root PATH   课程库某课程根目录（默认自动取 data/高顿/CPA/课程库/ 下第一个课程）
  --map PATH           映射文件路径（默认 knowledge-base/lecture-resource-map.json）
"""
import argparse, glob, json, os, re, sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEGACY_RE = re.compile(r'^(讲义_|课件_)')          # 早期旧命名重复件前缀
PREFIX_RE = re.compile(r'^(\d{2})_')               # 真实目录 NN_讲名
LOGIC_RE  = re.compile(r'^讲(\d{2})/')             # map 逻辑路径 讲NN/


def find_default_course_root():
    hits = sorted(glob.glob(os.path.join(PROJECT_ROOT, 'data/高顿/CPA/课程库/*/')))
    if not hits:
        sys.exit('✗ 未找到默认课程根，请用 --course-root 指定')
    # 课程库下可能并存多个课程目录（含空占位目录，如未开课的下一课程），
    # 不能盲取排序第一个；选真正含 NN_讲名 目录、且讲数最多的那个。
    scored = [(len(build_real_dirs(h)), h) for h in hits]
    scored = [x for x in scored if x[0] > 0]
    if not scored:
        sys.exit('✗ 候选课程根下都没有 NN_讲目录，请用 --course-root 指定')
    return max(scored, key=lambda x: x[0])[1]


def build_real_dirs(course_root):
    """讲号('00') -> 真实目录绝对路径"""
    m = {}
    for d in sorted(glob.glob(os.path.join(course_root, '*/'))):
        mm = PREFIX_RE.match(os.path.basename(d.rstrip('/')))
        if mm:
            m[mm.group(1)] = d.rstrip('/')
    return m


def logic_to_real(rel, real_dirs):
    """讲NN/docs/x.pdf -> /abs/NN_讲名/docs/x.pdf"""
    mm = LOGIC_RE.match(rel)
    if not mm:
        return None
    base = real_dirs.get(mm.group(1))
    return os.path.join(base, rel[mm.end():]) if base else None


def list_standard(folder):
    """目录下标准件（排除旧命名重复件），返回文件名排序列表"""
    if not os.path.isdir(folder):
        return []
    return sorted(f for f in os.listdir(folder)
                  if not f.startswith('.') and not LEGACY_RE.match(f))


def list_legacy(folder):
    if not os.path.isdir(folder):
        return []
    return sorted(x for x in os.listdir(folder) if LEGACY_RE.match(x))


def load_map(path):
    with open(path, encoding='utf-8') as fh:
        return json.load(fh)


def verify(m, real_dirs):
    missing, unlisted, legacy, problems = [], [], [], []
    # 1/2 结构完整 + 存在性
    for num in sorted(real_dirs):
        if num not in m:
            problems.append(f'讲{num}：map 缺条目')
            continue
        e = m[num]
        for key in ('课件来源讲次', '课件PDF', 'OCR文本', '转写'):
            if key not in e:
                problems.append(f'讲{num}：缺字段 {key}')
        if not e.get('课件来源讲次'):
            problems.append(f'讲{num}：课件来源讲次为空')
        for rel in e.get('课件PDF', []) + e.get('OCR文本', []):
            real = logic_to_real(rel, real_dirs)
            if real is None:
                problems.append(f'讲{num}：路径非「讲NN/」前缀 {rel}')
            elif not os.path.exists(real):
                missing.append(rel)
        tx = e.get('转写')
        if tx:
            real = logic_to_real(tx, real_dirs)
            if real is None or not os.path.exists(real):
                missing.append(tx)
    # 3 反向覆盖：磁盘标准件至少被 map 某处引用
    referenced = set()
    for e in m.values():
        for rel in e.get('课件PDF', []) + e.get('OCR文本', []):
            referenced.add(rel)
    for num, rd in real_dirs.items():
        for sub in ('docs', 'docs_text'):
            for f in list_standard(os.path.join(rd, sub)):
                logic = f'讲{num}/{sub}/{f}'
                if logic not in referenced:
                    unlisted.append(logic)
        for f in list_legacy(os.path.join(rd, 'docs')) + list_legacy(os.path.join(rd, 'docs_text')):
            sub = 'docs' if os.path.exists(os.path.join(rd, 'docs', f)) else 'docs_text'
            legacy.append(f'讲{num}/{sub}/{f}')
    return problems, missing, unlisted, legacy


def rebuild(m, real_dirs):
    """保留各讲『课件来源讲次』，按磁盘重建文件清单"""
    out = {}
    for num in sorted(real_dirs):
        srcs = (m.get(num, {}) or {}).get('课件来源讲次', [num])
        pdfs, ocrs = [], []
        for s in srcs:
            sdir = real_dirs.get(s)
            if not sdir:
                continue
            for f in list_standard(os.path.join(sdir, 'docs')):
                if f.lower().endswith('.pdf'):
                    pdfs.append(f'讲{s}/docs/{f}')
            for f in list_standard(os.path.join(sdir, 'docs_text')):
                if f.endswith('.md'):
                    ocrs.append(f'讲{s}/docs_text/{f}')
        # 去重保序
        pdfs = sorted(set(pdfs)); ocrs = sorted(set(ocrs))
        tx = f'讲{num}/transcript.md'
        out[num] = {
            '课件来源讲次': srcs,
            '课件PDF': pdfs,
            'OCR文本': ocrs,
            '转写': tx if os.path.exists(logic_to_real(tx, real_dirs) or '') else (m.get(num, {}).get('转写', tx)),
        }
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rebuild', action='store_true', help='按磁盘重建并写回 map')
    ap.add_argument('--course-root', default=None)
    ap.add_argument('--map', default=os.path.join(PROJECT_ROOT, 'knowledge-base/lecture-resource-map.json'))
    args = ap.parse_args()

    course_root = args.course_root or find_default_course_root()
    course_root = course_root.rstrip('/') + '/'
    real_dirs = build_real_dirs(course_root)
    if not real_dirs:
        # 安全保护：讲目录为空时禁止校验空跑、更禁止 rebuild 写空 map
        sys.exit(f'✗ 课程根下没有 NN_讲目录，拒绝继续（避免写空 map）: {course_root}')
    m = load_map(args.map)
    print(f'课程根: {course_root}')
    print(f'讲目录 {len(real_dirs)} 个，map 条目 {len(m)} 个')

    if args.rebuild:
        new = rebuild(m, real_dirs)
        with open(args.map, 'w', encoding='utf-8') as fh:
            json.dump(new, fh, ensure_ascii=False, indent=4)
            fh.write('\n')
        print(f'✓ 已按磁盘重建写回 {os.path.relpath(args.map, PROJECT_ROOT)}')
        m = new

    problems, missing, unlisted, legacy = verify(m, real_dirs)
    print('\n===== 校验结果 =====')
    if problems:
        print(f'[结构问题 {len(problems)}]');  [print('  -', x) for x in problems]
    if missing:
        print(f'[map 指向但磁盘缺失 {len(missing)}]'); [print('  -', x) for x in missing]
    if unlisted:
        print(f'[磁盘标准件未登记进 map {len(unlisted)}]'); [print('  -', x) for x in unlisted]
    if legacy:
        print(f'[遗留旧命名重复件（可清理，不判失败）{len(legacy)}]'); [print('  -', x) for x in legacy]
    ok = not (problems or missing or unlisted)
    print('———————————————————————')
    print('✓ 映射与磁盘一致' if ok else '✗ 存在不一致，见上方清单（legacy 旧件除外）')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()

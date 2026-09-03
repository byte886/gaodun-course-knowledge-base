#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check_course_lib.py — 课程库「逐讲标准构成 + 污染/重复件」本地只读体检

与 verify_lecture_map.py 分工互补（standards 2.2 落地检查）：
  - verify_lecture_map：课件「跨讲取料路由表」vs 磁盘是否一致（哪些讲自身 docs 为空是正常跨讲）
  - 本脚本：逐讲自身的标准构成完整性，以及过程文件污染、旧命名重复件

检查项（每讲 NN_讲名/）：
  A 线三件套   video.mp4 / transcript.md / transcript.json 缺一报 [A线缺失]
  C 线配对     docs/*.pdf 数 与 docs_text/*_OCR.md 数；两者皆空=跨讲来源(由map裁定,不报)，
               数量不等报 [PDF/OCR不成对]
  旧命名重复件 docs/docs_text 内 讲义_*/课件_* 报 [legacy旧件]（按 standards 2.2.6 md5/diff 取证后清）
  过程污染     讲目录直接文件只允许 A线三件 + 旧线A初始知识成品(知识拆解.md/考试指导.md/README.md)；
               *.log/*.tmp/*.done/.DS_Store/merged.ts/VERIFICATION*/SYNC*/验证* 等报 [过程文件误入]
  目录白名单   讲内子目录只允许 docs / docs_text / .vfetch(L3续跑,允许)，其余报 [未知子目录]
  内容纯度     docs 内仅 .pdf；docs_text 内仅 *_OCR.md，否则报 [目录内杂项]
  空讲目录     讲目录下没有任何标准构成，报 [空讲目录]

退出码：发现任一问题=1；全部干净=0。
可选：--course-root PATH 指定课程根（默认自动取含 NN_讲目录最多的课程，避开空占位课程）。
"""
import argparse
import glob
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from verify_lecture_map import (  # noqa: E402
    find_default_course_root, build_real_dirs, list_legacy,
)

# A 线三件套（每讲必备）
A_LINE = ['video.mp4', 'transcript.md', 'transcript.json']
# 讲目录直接允许的成品/原料文件（A线三件之外）：旧线A初始知识库（S2复用骨架原料）
ALLOWED_TOP_FILES = set(A_LINE) | {'知识拆解.md', '考试指导.md', 'README.md'}
# 讲内允许的子目录（.vfetch 为 L3 断点续跑凭证，阶段中保留）
ALLOWED_SUBDIRS = {'docs', 'docs_text', '.vfetch'}
# 过程/临时污染文件名特征（子串匹配，小写）
POLLUTION_HINTS = ('.log', '.tmp', '.done', '.ds_store', 'merged.ts',
                   'verification', 'sync_report', '同步报告', '验证报告', '验证_', '.ts')


def is_pollution(name):
    low = name.lower()
    return any(h in low for h in POLLUTION_HINTS)


def check_one(num, path):
    issues = []
    entries = os.listdir(path)
    files = [e for e in entries if os.path.isfile(os.path.join(path, e))]
    subdirs = [e for e in entries if os.path.isdir(os.path.join(path, e))]

    # A 线三件套
    for a in A_LINE:
        if not os.path.exists(os.path.join(path, a)):
            issues.append(f'[A线缺失] {a}')

    # 子目录白名单
    for s in subdirs:
        if s not in ALLOWED_SUBDIRS:
            issues.append(f'[未知子目录] {s}/')

    # 直接文件：白名单之外，若是过程文件报污染，否则也报（未登记类型）
    for f in files:
        if f in ALLOWED_TOP_FILES:
            continue
        tag = '过程文件误入' if is_pollution(f) else '未登记直接文件'
        issues.append(f'[{tag}] {f}')

    # C 线配对 + legacy + 目录内纯度
    docs = os.path.join(path, 'docs')
    text = os.path.join(path, 'docs_text')
    pdfs = [f for f in glob.glob(os.path.join(docs, '*')) if os.path.isfile(f)]
    ocrs = [f for f in glob.glob(os.path.join(text, '*')) if os.path.isfile(f)]
    for folder, label, ok_ext in ((docs, 'docs', '.pdf'), (text, 'docs_text', '_ocr.md')):
        for f in glob.glob(os.path.join(folder, '*')):
            if os.path.isfile(f) and not os.path.basename(f).lower().endswith(ok_ext):
                issues.append(f'[目录内杂项] {label}/{os.path.basename(f)}')
        for legacy in list_legacy(folder):
            issues.append(f'[legacy旧件] {label}/{legacy}')
    n_pdf = len(pdfs)
    n_ocr = len(ocrs)
    if (n_pdf or n_ocr) and n_pdf != n_ocr:
        issues.append(f'[PDF/OCR不成对] PDF={n_pdf} OCR={n_ocr}')

    # 空讲目录：三件套全无、无任何子目录
    if not any(os.path.exists(os.path.join(path, a)) for a in A_LINE) and not subdirs:
        issues.append('[空讲目录]')

    return issues


def main():
    ap = argparse.ArgumentParser(description='课程库逐讲体检（只读）')
    ap.add_argument('--course-root', help='课程根目录（默认自动选择）')
    args = ap.parse_args()

    root = args.course_root or find_default_course_root()
    real_dirs = build_real_dirs(root)
    if not real_dirs:
        sys.exit('✗ 课程根下没有 NN_讲目录')

    print(f'课程根: {root}')
    print(f'讲目录 {len(real_dirs)} 个\n' + '=' * 50)

    total_issues = 0
    clean_cnt = 0
    for num in sorted(real_dirs):
        path = real_dirs[num]
        name = os.path.basename(path)
        issues = check_one(num, path)
        if issues:
            total_issues += len(issues)
            print(f'\n✗ {name}')
            for i in issues:
                print(f'    {i}')
        else:
            clean_cnt += 1

    print('\n' + '=' * 50)
    print(f'体检结果：干净 {clean_cnt}/{len(real_dirs)} 讲，问题 {total_issues} 项')
    if total_issues:
        print('结论：✗ 存在需处理项（跨讲空 docs 不在此脚本判定，另见 verify_lecture_map）')
        sys.exit(1)
    print('结论：✓ 课程库逐讲构成完整、无污染/旧件')


if __name__ == '__main__':
    main()

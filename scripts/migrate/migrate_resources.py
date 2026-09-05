#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
M2/M3/M4 按 course-manifest 把旧按讲存量搬进三层结构（move，可回滚）。
  --phase resources : M2 视频/转写/讲义/OCR -> 原始资源/{videos,notes}
  --phase papers    : M3 knowledge-source/papers -> _workspace/papers；cdp-sniff 台账 -> manifest/sniff
  --phase notesraw  : M4 source-materials 留言原件 -> _workspace/user-notes-raw
  --dry-run         只打印移动清单不执行
实搬写 _workspace/manifest/movement-log.json，可逐条回滚（dst->src）。
用法:
  python3 scripts/migrate/migrate_resources.py --phase resources --dry-run
"""
import json, os, glob, re, sys, shutil, unicodedata
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
COURSE = os.path.join(ROOT, "data/高顿/CPA/课程库/【26考季】VIPCPA系列-税法（蔡俊峻老师）")
WS = os.path.join(COURSE, "_workspace")
MANIFEST = os.path.join(WS, "manifest/course-manifest.json")
RAW = os.path.join(COURSE, "原始资源")
SNIFF = os.path.join(ROOT, "data/cdp-sniff")
KSRC = os.path.join(ROOT, "data/knowledge-source")
SRC_MAT = os.path.join(ROOT, "knowledge-base/source-materials")
ORG = os.path.join(ROOT, "knowledge-base/organized-content")
LOG = os.path.join(WS, "manifest/movement-log.json")


def clean(name):
    return re.sub(r'[/\\:*?"<>|&]', "·", name.strip())


def norm(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"\s+", "", s).replace("（", "(").replace("）", ")")
    return re.sub(r"^【[^】]*】", "", s)


def load_lec_dirs():
    out = {}
    for d in sorted(glob.glob(os.path.join(COURSE, "[0-9]*/"))):
        m = re.match(r"^(\d+)_", os.path.basename(d.rstrip("/")))
        if m:
            out[int(m.group(1))] = d
    return out


def plan_resources(m, lec_dirs):
    """M2: 返回 [(src,dst,kind)]。"""
    plan = []
    for s in m["sequence"]:
        idx = s["idx"]
        prefix = idx - 1
        src_dir = lec_dirs.get(prefix)
        nn = f"{idx:02d}"
        vname = clean(s["name"])
        if not src_dir:
            print(f"  [缺] 本地讲目录前缀{prefix} 不存在")
            continue
        # 视频三件
        vdst = os.path.join(RAW, "videos", f"{nn}_{vname}")
        for fn in ["video.mp4", "transcript.md", "transcript.json"]:
            sp = os.path.join(src_dir, fn)
            if os.path.exists(sp):
                plan.append((sp, os.path.join(vdst, fn), "video"))
        # 讲义：本地 docs PDF 与 catalog notes 归一化对应；OCR 从 docs_text 同名
        docs_dir = os.path.join(src_dir, "docs")
        text_dir = os.path.join(src_dir, "docs_text")
        ndst = os.path.join(RAW, "notes", f"{nn}_{vname}")
        web_titles = {norm(nt["title"]): nt for nt in s["notes"]}
        if os.path.isdir(docs_dir):
            for pdf in sorted(os.listdir(docs_dir)):
                if pdf.startswith("."):
                    continue
                stem = os.path.splitext(pdf)[0]
                key = norm(stem)
                if key not in web_titles:
                    print(f"  [警告] 讲义无法对应catalog: {prefix}/{pdf}")
                plan.append((os.path.join(docs_dir, pdf), os.path.join(ndst, pdf), "note-pdf"))
                ocr = stem + "_OCR.md"
                sp_ocr = os.path.join(text_dir, ocr)
                if os.path.exists(sp_ocr):
                    plan.append((sp_ocr, os.path.join(ndst, ocr), "note-ocr"))
                else:
                    print(f"  [警告] 缺OCR: {prefix}/{ocr}")
    return plan


def plan_papers(m):
    plan = []
    for f in sorted(glob.glob(os.path.join(KSRC, "papers", "*.json"))):
        fn = os.path.basename(f)
        plan.append((f, os.path.join(WS, "papers", fn), "paper"))
    # cdp-sniff: schedule jsonl -> sniff；catalog/inventory 已在 M1 复制进 manifest，原件移废纸篓由收尾处理
    for f in sorted(glob.glob(os.path.join(SNIFF, "*.jsonl"))):
        plan.append((f, os.path.join(WS, "sniff", os.path.basename(f)), "sniff"))
    return plan


def plan_notesraw(m):
    plan = []
    for f in sorted(glob.glob(os.path.join(SRC_MAT, "**", "*.md"), recursive=True)):
        if os.path.basename(f).upper() == "README.MD":
            continue
        rel = os.path.relpath(f, SRC_MAT)
        plan.append((f, os.path.join(WS, "user-notes-raw", rel), "note-raw"))
    return plan


def main():
    args = sys.argv[1:]
    dry = "--dry-run" in args
    phase = "resources"
    if "--phase" in args:
        phase = args[args.index("--phase") + 1]
    m = json.load(open(MANIFEST, encoding="utf-8"))
    lec_dirs = load_lec_dirs()

    if phase == "resources":
        plan = plan_resources(m, lec_dirs)
    elif phase == "papers":
        plan = plan_papers(m)
    elif phase == "notesraw":
        plan = plan_notesraw(m)
    else:
        raise SystemExit(f"未知 phase {phase}")

    # 分类统计
    from collections import Counter
    c = Counter(k for _, _, k in plan)
    print(f"=== phase={phase} {'DRY-RUN' if dry else 'EXEC'} 共 {len(plan)} 个文件 ===")
    for k, v in c.items():
        print(f"  {k}: {v}")
    for src, dst, k in plan[:12]:
        print(f"  [{k}] {os.path.relpath(src, COURSE)}  ->  {os.path.relpath(dst, COURSE)}")
    if len(plan) > 12:
        print(f"  … 其余 {len(plan)-12} 条结构相同")

    if dry:
        return

    # 执行
    log = json.load(open(LOG, encoding="utf-8")) if os.path.exists(LOG) else []
    done = 0
    for src, dst, k in plan:
        if os.path.exists(src):
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if os.path.exists(dst):
                print(f"  [跳过] 目标已存在 {dst}")
                continue
            shutil.move(src, dst)
            log.append({"phase": phase, "src": src, "dst": dst, "kind": k,
                        "at": datetime.now(timezone.utc).isoformat()})
            done += 1
        elif os.path.exists(dst):
            pass  # 已搬过，幂等
        else:
            print(f"  [错误] 源与目标都不存在 {src}")
    json.dump(log, open(LOG, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"实搬 {done} 个文件，movement-log 累计 {len(log)} 条")


if __name__ == "__main__":
    main()

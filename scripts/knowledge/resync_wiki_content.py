#!/usr/bin/env python3
"""把本地知识详解 Markdown 重新覆盖写入对应飞书文档（只更新内容，绝不创建/删除节点）。

适用：链接格式、正文清理等"内容层"批量修订后的重同步（如相对链接改为 <cite> 内部引用）。
- 标题→obj_token 取自 logs/wiki_node_map.tsv（已去重，108 个标题全局唯一）；
- 本地相对链接经 scripts/wiki_link_resolve.py 转为 <cite>（飞书内当前窗口打开）；
- 章 README 以"章目录名"为标题，知识点篇以文件名（去 .md）为标题，全局篇在知识详解根目录；
- 找不到 obj、或 docs +update 失败均计入失败清单，失败自动重试 3 次；
- 不写 done_flag、不追加 map，避免映射表重复膨胀。

用法：
  python3 scripts/knowledge/resync_wiki_content.py            # 全量重同步
  python3 scripts/knowledge/resync_wiki_content.py --only 01  # 只重跑路径含 01 的文件（dry 过滤）
  python3 scripts/knowledge/resync_wiki_content.py --dry-run  # 只列出将同步的文件，不写飞书
"""
import argparse
import glob
import os
import subprocess
import sys
import time

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MAP_FILE = os.path.join(REPO, "logs", "wiki_node_map.tsv")
RESOLVER = os.path.join(REPO, "scripts", "wiki_link_resolve.py")
COURSE_DIR = os.path.join(
    REPO, "data", "高顿", "CPA", "课程库",
    "【26考季】VIPCPA系列-税法（蔡俊峻老师）", "知识详解",
)


def load_title2obj():
    m = {}
    with open(MAP_FILE, encoding="utf-8") as f:
        for line in f:
            c = line.rstrip("\n").split("\t")
            if len(c) >= 3 and c[0]:
                m[c[0]] = c[2]
    return m


def collect_files():
    """返回 [(标题, 本地路径)]，覆盖 2 全局篇 + 14 章 README + 92 知识点篇。"""
    items = []
    for path in sorted(glob.glob(os.path.join(COURSE_DIR, "*.md"))):  # 全局篇
        items.append((os.path.basename(path)[:-3], path))
    for group in sorted(glob.glob(os.path.join(COURSE_DIR, "[0-9]*/"))):
        gname = os.path.basename(group.rstrip(os.sep))
        readme = os.path.join(group, "README.md")
        if os.path.isfile(readme):
            items.append((gname, readme))
        for p in sorted(glob.glob(os.path.join(group, "*.md"))):
            if os.path.basename(p) == "README.md":
                continue
            items.append((os.path.basename(p)[:-3], p))
    return items


def update_one(title, path, obj):
    raw = open(path, encoding="utf-8").read()
    resolved = subprocess.run(
        ["python3", RESOLVER], input=raw, capture_output=True, text=True, cwd=REPO
    ).stdout
    last = ""
    for attempt in range(3):
        proc = subprocess.run(
            ["lark-cli", "docs", "+update", "--doc", obj, "--command", "overwrite",
             "--doc-format", "markdown", "--content", "-", "--as", "user", "--format", "json"],
            input=resolved, capture_output=True, text=True, cwd=REPO,
        )
        last = proc.stdout + proc.stderr
        if '"ok":true' in last.replace(" ", "") or '"ok": true' in last:
            return True, ""
        time.sleep(2)
    return False, last[:300]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="只同步路径中包含该片段的文件")
    ap.add_argument("--dry-run", action="store_true", help="只列文件，不写飞书")
    args = ap.parse_args()

    title2obj = load_title2obj()
    items = collect_files()
    if args.only:
        items = [it for it in items if args.only in it[1]]

    missing, failed, ok = [], [], 0
    print(f"待处理文件 {len(items)} 个（map 共 {len(title2obj)} 个标题）")
    for i, (title, path) in enumerate(items, 1):
        obj = title2obj.get(title)
        rel = os.path.relpath(path, REPO)
        if not obj:
            missing.append((title, rel))
            print(f"[{i}/{len(items)}] ✗ 无obj映射: {title}")
            continue
        if args.dry_run:
            print(f"[{i}/{len(items)}] (dry) {title} -> {obj[:10]}")
            continue
        success, err = update_one(title, path, obj)
        if success:
            ok += 1
            print(f"[{i}/{len(items)}] ✓ {title}")
        else:
            failed.append((title, rel, err))
            print(f"[{i}/{len(items)}] ✗ 写入失败: {title}")
        time.sleep(float(os.environ.get("RESYNC_INTERVAL", "1.5")))

    print("\n========== 汇总 ==========")
    print(f"成功 {ok}，无映射 {len(missing)}，失败 {len(failed)}")
    for t, p in missing:
        print(f"  [无映射] {t} ({p})")
    for t, p, e in failed:
        print(f"  [失败] {t} ({p}): {e}")
    sys.exit(1 if (missing or failed) else 0)


if __name__ == "__main__":
    main()

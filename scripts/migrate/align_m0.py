#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
M0 只读对齐：本地按讲存量 ↔ 官网 course_catalog / paper_index。
不修改任何文件，仅输出对齐表与差异清单。
用法: python3 scripts/migrate/align_m0.py
"""
import json, os, glob, re, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TAX = os.path.join(ROOT, "data/高顿/CPA/课程库/【26考季】VIPCPA系列-税法（蔡俊峻老师）")
CAT = os.path.join(ROOT, "data/cdp-sniff/course_catalog.json")
PI = os.path.join(ROOT, "data/knowledge-source/paper_index.json")


def norm(s: str) -> str:
    """归一化：全角转半角、去空白、统一括号、去【...】前缀。"""
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"\s+", "", s)
    s = s.replace("（", "(").replace("）", ")").replace("，", ",")
    s = re.sub(r"^【[^】]*】", "", s)  # 去【全面精讲-讲义/课件】前缀
    return s


def main():
    cat = json.load(open(CAT, encoding="utf-8"))
    pi = json.load(open(PI, encoding="utf-8"))

    # paper_index 按归一化 chapter 分组
    pi_by_chapter = {}
    for p in pi:
        key = norm(p.get("chapter", ""))
        pi_by_chapter.setdefault(key, []).append(p)

    lec_dirs = sorted(glob.glob(os.path.join(TAX, "[0-9]*/")))
    # 本地前缀号 -> 目录
    loc_by_prefix = {}
    for d in lec_dirs:
        base = os.path.basename(d.rstrip("/"))
        m = re.match(r"^(\d+)_", base)
        if m:
            loc_by_prefix[int(m.group(1))] = d

    print("=" * 100)
    print("M0 逐讲对齐表（本地前缀号 = catalog idx - 1）")
    print("=" * 100)
    print(f"{'idx':>3} {'本地':>3}  {'讲名':<34} | {'官网v':>3}{'本地v':>3} | {'官网n':>3}{'本地n':>3} | {'官网p':>3}{'本地p':>3} | 状态")
    print("-" * 100)

    diffs = []
    notes_unmatched_local = []
    notes_unmatched_web = []
    papers_unmatched = []

    for item in cat:
        idx = item["idx"]
        if idx == 0:
            # 冲刺模考卷，单独处理
            continue
        name = item["name"]
        prefix = idx - 1
        d = loc_by_prefix.get(prefix)
        web_v = len(item.get("videos") or [])
        web_n = len(item.get("notes") or [])
        web_p = len(item.get("papers") or [])

        loc_v = loc_n = loc_p = 0
        loc_pdfs = []
        if d and os.path.isdir(d):
            loc_v = 1 if os.path.exists(os.path.join(d, "video.mp4")) else 0
            docs_dir = os.path.join(d, "docs")
            if os.path.isdir(docs_dir):
                loc_pdfs = [f for f in os.listdir(docs_dir) if not f.startswith(".")]
                loc_n = len(loc_pdfs)
            # papers 按 chapter 名匹配
            key = norm(name)
            matched = pi_by_chapter.get(key, [])
            loc_p = len(matched)
            if not matched:
                # 宽松：catalog name 去掉前缀"税法全面精讲NN-"后匹配
                short = re.sub(r"^税法(全面精讲|强化冲刺)\d*-?", "", name)
                for k, v in pi_by_chapter.items():
                    if short and short in k:
                        matched = v
                        loc_p = len(v)
                        break

        status = "OK"
        if web_v != loc_v:
            status = "视频不等"
        if web_n != loc_n:
            status = "讲义不等" if status == "OK" else status + "+讲义不等"
        if web_p != loc_p:
            status = "试卷不等" if status == "OK" else status + "+试卷不等"
        if not d:
            status = "本地目录缺失"

        print(f"{idx:>3} {prefix:>3}  {name[:34]:<34} | {web_v:>3}{loc_v:>3} | {web_n:>3}{loc_n:>3} | {web_p:>3}{loc_p:>3} | {status}")

        if status != "OK":
            diffs.append((idx, prefix, name, status, web_v, loc_v, web_n, loc_n, web_p, loc_p))

        # notes 归一化匹配
        if d and os.path.isdir(os.path.join(d, "docs")):
            web_notes_norm = {norm(n["title"]): n for n in (item.get("notes") or [])}
            for pdf in loc_pdfs:
                key = norm(os.path.splitext(pdf)[0])
                if key not in web_notes_norm:
                    notes_unmatched_local.append((prefix, name, pdf))
            for wn in (item.get("notes") or []):
                key = norm(wn["title"])
                # 本地是否有对应
                found = any(norm(os.path.splitext(p)[0]) == key for p in loc_pdfs)
                if not found:
                    notes_unmatched_web.append((idx, name, wn["title"]))

    # 冲刺模考 idx0
    mock = [x for x in cat if x["idx"] == 0][0]
    print("-" * 100)
    print(f"冲刺模考(idx0): 官网 {len(mock['papers'])} 卷(48题/张)，paper_index 中 0 卷 → 末期采集，M0 不处理")

    # paper_index 中未匹配到任何 catalog 讲的卷
    matched_pids = set()
    for item in cat:
        if item["idx"] == 0:
            continue
        key = norm(item["name"])
        for p in pi_by_chapter.get(key, []):
            matched_pids.add(p["paperId"])
    for p in pi:
        if p["paperId"] not in matched_pids:
            papers_unmatched.append((p["paperId"], p.get("chapter", ""), p.get("title", "")[:40]))

    print("\n" + "=" * 100)
    print("差异汇总")
    print("=" * 100)
    print(f"逐讲状态非OK: {len(diffs)} 讲")
    for idx, prefix, name, st, *_ in diffs:
        print(f"  idx{idx}(本地{prefix}) {name[:30]} → {st}")
    print(f"\n本地讲义PDF未匹配到官网notes: {len(notes_unmatched_local)} 份")
    for prefix, name, pdf in notes_unmatched_local[:20]:
        print(f"  本地{prefix} {name[:24]} → {pdf[:60]}")
    print(f"\n官网notes未匹配到本地PDF: {len(notes_unmatched_web)} 份")
    for idx, name, title in notes_unmatched_web[:20]:
        print(f"  idx{idx} {name[:24]} → {title[:60]}")
    print(f"\npaper_index 未匹配到任何catalog讲: {len(papers_unmatched)} 卷")
    for pid, ch, t in papers_unmatched[:20]:
        print(f"  paperId={pid} chapter='{ch.strip()[:30]}' title='{t}'")

    # 总数核对
    total_web_p = sum(len(x.get("papers") or []) for x in cat if x["idx"] != 0)
    print("\n" + "=" * 100)
    print("总数核对")
    print("=" * 100)
    print(f"官网基础卷(不含冲刺): {total_web_p}  paper_index: {len(pi)}  差: {total_web_p - len(pi)}")
    print(f"官网视频: {sum(len(x.get('videos') or []) for x in cat if x['idx']!=0)}  本地video: {sum(1 for d in lec_dirs if os.path.exists(os.path.join(d,'video.mp4')))}")
    print(f"官网notes: {sum(len(x.get('notes') or []) for x in cat if x['idx']!=0)}  本地PDF: {sum(len([f for f in os.listdir(os.path.join(d,'docs')) if not f.startswith('.')]) for d in lec_dirs if os.path.isdir(os.path.join(d,'docs')))}")


if __name__ == "__main__":
    main()

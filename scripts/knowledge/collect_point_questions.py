#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
阶段③步骤1：按官方知识点聚合 papers 题/答/解析（质量门：篇内题数以此为准）。
用法:
  python3 scripts/knowledge/collect_point_questions.py --group 1            # 只聚合某组
  python3 scripts/knowledge/collect_point_questions.py --all --out _workspace/tmp/point-questions
客观题(type1/2/3)按顶层 knowledgePointList 归点；主观大题(type5)下钻 subQuestionList，
按小问标签归点、保留大题题干上下文。
"""
import json, re, html, glob, os, argparse, collections

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# 课程路径：优先读环境变量 COURSE_LOCAL_ROOT，默认税法课（保持向后兼容）
DEFAULT_COURSE = os.path.join(ROOT, "data/高顿/CPA/课程库/【26考季】VIPCPA系列-税法（蔡俊峻老师）")
COURSE = os.environ.get("COURSE_LOCAL_ROOT", DEFAULT_COURSE)
if not os.path.isabs(COURSE):
    COURSE = os.path.join(ROOT, COURSE)
WS = os.path.join(COURSE, "_workspace")
QT = {1: "单选", 2: "多选", 3: "判断", 5: "大题", 6: "小问"}


def clean(s):
    s = re.sub(r"<[^>]+>", " ", str(s or ""))
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def load_paper_titles():
    idx = json.load(open(os.path.join(WS, "manifest/paper_index.json"), encoding="utf-8"))
    out = {}
    rows = idx if isinstance(idx, list) else idx.get("papers", idx.get("list", []))
    for r in rows:
        out[r.get("paperId")] = r.get("title") or r.get("chapter") or ""
    return out


def question_brief(q):
    """抽取一道题的可生成字段。"""
    opts = []
    for o in q.get("selectList", []) or []:
        lab = o.get("optionLabel") or o.get("label") or ""
        opts.append(f"{lab}. {clean(o.get('optionContent'))}".strip(". ").strip())
    return {
        "type": q.get("questionType"),
        "typeName": QT.get(q.get("questionType"), str(q.get("questionType"))),
        "stem": clean(q.get("title")),
        "options": opts,
        "answer": clean(q.get("answer")),
        "analysis": clean(q.get("analysisText")) or clean(q.get("analysis")),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--group", type=int)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--out", default=os.path.join(WS, "tmp/point-questions"))
    a = ap.parse_args()

    m = json.load(open(os.path.join(WS, "manifest/course-manifest.json"), encoding="utf-8"))
    k = m["knowledge"]
    pi = {int(x): y for x, y in k["pointIndex"].items()}
    titles = load_paper_titles()

    # 目标点 id->(title,group)
    targets = {}
    for g in k["groups"]:
        if a.all or (a.group is not None and g["code"] == a.group):
            for pid in g["pointIds"]:
                targets[int(pid)] = (pi[int(pid)]["title"], g["code"], g["name"])
    if not targets:
        raise SystemExit("no target points")

    # 别名/泛名标签归一：genericPoint(单对象，历史)+aliasPoints(数组)，归点前替换为目标id
    ALIAS = {}
    gp = k.get("genericPoint")
    if isinstance(gp, dict) and gp.get("id") and gp.get("mergedInto"):
        ALIAS[int(gp["id"])] = int(gp["mergedInto"])
    for ap in k.get("aliasPoints", []) or []:
        if ap.get("id") and ap.get("mergedInto"):
            ALIAS[int(ap["id"])] = int(ap["mergedInto"])
    def norm(ids):
        return {ALIAS.get(x, x) for x in ids}

    bucket = {pid: [] for pid in targets}
    for fp in sorted(glob.glob(os.path.join(WS, "papers", "*.json"))):
        paper_id = int(os.path.splitext(os.path.basename(fp))[0])
        d = json.load(open(fp, encoding="utf-8"))
        ptitle = titles.get(paper_id, "")
        for mod in d.get("moduleList", []):
            for q in mod.get("questionList", []):
                top_ids = norm({int(x["id"]) for x in q.get("knowledgePointList", []) or []})
                qt = q.get("questionType")
                if qt in (1, 2, 3):
                    for pid in top_ids & set(targets):
                        rec = question_brief(q)
                        rec.update({"paperId": paper_id, "paperTitle": ptitle})
                        bucket[pid].append(rec)
                elif qt == 5:
                    for sq in q.get("subQuestionList", []) or []:
                        s_ids = norm({int(x["id"]) for x in sq.get("knowledgePointList", []) or []})
                        for pid in s_ids & set(targets):
                            rec = question_brief(sq)
                            rec["bigStem"] = clean(q.get("title"))   # 保留大题题干
                            rec.update({"paperId": paper_id, "paperTitle": ptitle})
                            bucket[pid].append(rec)

    os.makedirs(a.out, exist_ok=True)
    grand = 0
    for pid, recs in bucket.items():
        title, gc, gn = targets[pid]
        tc = collections.Counter(r["typeName"] for r in recs)
        grand += len(recs)
        fn = os.path.join(a.out, f"G{gc:02d}_{pid}_{re.sub(r'[/\\\\:*?\"<>|]', '', title)}.json")
        json.dump({"pointId": pid, "title": title, "groupCode": gc, "groupName": gn,
                   "count": len(recs), "typeDist": dict(tc), "questions": recs},
                  open(fn, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(f"G{gc:02d} {pid} {title}: {len(recs)}题 {dict(tc)} -> {os.path.basename(fn)}")
    print(f"合计 {grand} 题（注意：一题带多点标签会在多个点各计一次）")


if __name__ == "__main__":
    main()

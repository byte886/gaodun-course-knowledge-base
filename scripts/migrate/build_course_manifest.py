#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
M1 生成 course-manifest 四件套 + _workspace 骨架（不搬数据）。
输入（只读旧位置）：
  data/cdp-sniff/course_catalog.json        官网课程表快照（40 条）
  data/cdp-sniff/papers_inventory.json      官网试卷台账
  data/knowledge-source/paper_index.json    本地试卷索引
  data/knowledge-source/papers/*.json       116 套试卷题答
输出（课程目录 _workspace/）：
  manifest/{course-manifest,course_catalog,papers_inventory,paper_index}.json
  以及 papers/ sniff/ user-notes-raw/ logs/ tmp/ 骨架 + README
用法: python3 scripts/migrate/build_course_manifest.py [--dry-run]
"""
import json, os, glob, re, sys, unicodedata, shutil
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
COURSE = os.path.join(ROOT, "data/高顿/CPA/课程库/【26考季】VIPCPA系列-税法（蔡俊峻老师）")
WS = os.path.join(COURSE, "_workspace")
SNIFF = os.path.join(ROOT, "data/cdp-sniff")
KSRC = os.path.join(ROOT, "data/knowledge-source")
COURSE_ID = 42660

# 14 模块组（目录名 = 官方模块序 + 官方组名）
GROUP_NAMES = {
    1: "税法总论", 2: "增值税法", 3: "消费税法", 4: "企业所得税法", 5: "个人所得税法",
    6: "城建税·烟叶税·教育费附加", 7: "关税法·船舶吨税法", 8: "资源税·环境保护税",
    9: "城镇土地使用税·耕地占用税", 10: "房产税·契税·土地增值税",
    11: "车辆购置税·车船税·印花税", 12: "国际税收", 13: "税收征收管理法", 14: "税务行政法制",
}
BASE_POINT_COUNT = [6, 14, 7, 12, 10, 3, 5, 2, 2, 7, 3, 6, 8, 7]
GENERIC_POINT_ID = 112376          # 主观小问泛标签"应纳税额的计算"
GENERIC_MERGE_INTO = 144734        # 并入"增值税一般计税方法应纳税额的计算"

# 显式归组（子串包含，优先级最高）
EX = {
    2: ["进口货物的计税价格", "出口货物的计税价格"],
    5: ["个人综合所得", "个人经营所得", "个人其他分类所得"],
    13: ["概述及税务管理", "税收执法", "纳税信用", "纳税担保", "涉税信息报送", "文书电子送达"],
    14: ["法律责任", "涉税专业服务", "违法行为处分", "检举管理"],
}
# 关键词归组（命中即停，顺序敏感：土地增值税须在增值税之前）
KW = [
    (10, ["土地增值税", "房产税", "契税"]),
    (2, ["增值税", "进口货物", "出口货物"]),
    (3, ["消费税", "应税消费品", "委托加工"]),
    (5, ["个人所得税", "非居民个人"]),
    (4, ["企业所得税", "非居民企业"]),
    (6, ["城市维护建设", "城建", "烟叶", "教育费附加"]),
    (7, ["关税", "吨税"]),
    (8, ["资源税", "环境保护"]),
    (9, ["城镇土地", "耕地占用"]),
    (11, ["车辆购置税", "车船税", "印花税"]),
    (12, ["国际", "转让定价", "反避税", "税收协定", "抵免", "受控外国", "资本弱化", "常设机构", "避税", "境外所得"]),
    (14, ["行政", "复议", "诉讼", "赔偿", "处罚"]),
    (13, ["征收管理", "征管", "税务登记", "发票", "纳税申报", "税款", "税务检查", "滞纳金", "纳税评估", "稽查"]),
]


def norm(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"\s+", "", s).replace("（", "(").replace("）", ")").replace("，", ",")
    return re.sub(r"^【[^】]*】", "", s)


def group_of(pid, title):
    if pid == GENERIC_POINT_ID:
        return 2
    for g, frags in EX.items():
        if any(fr in title for fr in frags):
            return g
    if title.startswith("个人"):
        return 5
    for g, kws in KW:
        if any(k in title for k in kws):
            return g
    return 1


def iter_questions(paper):
    for m in paper.get("moduleList", []):
        for q in m.get("questionList", []):
            if q.get("questionType") == 5:
                for sq in q.get("subQuestionList", []) or []:
                    yield sq, True
            else:
                yield q, False


def collect_points():
    """返回 points[id]={title,papers:set,sub} 与每卷知识点。"""
    points = {}
    paper_kps = {}
    for f in sorted(glob.glob(os.path.join(KSRC, "papers", "*.json"))):
        paper = json.load(open(f, encoding="utf-8"))
        pid = paper.get("paperId")
        ids_here = set()
        for q, is_sub in iter_questions(paper):
            for kp in q.get("knowledgePointList", []) or []:
                kid, kt = kp.get("id"), kp.get("title", "")
                if kid is None:
                    continue
                p = points.setdefault(kid, {"title": kt, "papers": set(), "sub": 0})
                p["papers"].add(pid)
                if is_sub:
                    p["sub"] += 1
                ids_here.add(kid)
        paper_kps[pid] = sorted(ids_here)
    return points, paper_kps


def main():
    dry = "--dry-run" in sys.argv
    cat = json.load(open(os.path.join(SNIFF, "course_catalog.json"), encoding="utf-8"))
    inv = json.load(open(os.path.join(SNIFF, "papers_inventory.json"), encoding="utf-8"))
    pidx = json.load(open(os.path.join(KSRC, "paper_index.json"), encoding="utf-8"))

    points, paper_kps = collect_points()

    # chapter 名 -> catalog idx
    name2idx = {norm(x["name"]): x["idx"] for x in cat if x["idx"] != 0}
    # catalog notes id -> 出现的 idx 列表（跨讲复用）
    notes_used = {}
    for x in cat:
        for nt in x.get("notes") or []:
            notes_used.setdefault(nt["id"], []).append(x["idx"])

    # ---- sequence（idx1..39）----
    sequence = []
    for x in sorted([c for c in cat if c["idx"] != 0], key=lambda c: c["idx"]):
        idx, name = x["idx"], x["name"]
        nn = f"{idx:02d}"
        video = None
        for v in x.get("videos") or []:
            video = {"nn": nn, "dir": f"原始资源/videos/{nn}_{clean(name)}", "catalogId": v.get("id"), "title": v.get("title")}
        notes = []
        for nt in x.get("notes") or []:
            notes.append({
                "nn": nn, "catalogId": nt.get("id"), "title": nt.get("title"),
                "url": nt.get("url"), "usedByLectures": sorted(notes_used.get(nt.get("id"), [])),
            })
        key = norm(name)
        matched = [p for p in pidx if norm(p.get("chapter", "")) == key]
        paper_ids = [p["paperId"] for p in matched]
        sequence.append({"idx": idx, "name": name, "kind": kind_of(name),
                         "video": video, "notes": notes, "paperIds": paper_ids})

    # ---- resources ----
    res_videos, res_notes, res_papers = {}, {}, {}
    for s in sequence:
        if s["video"]:
            res_videos[s["video"]["nn"]] = s["video"]
        for nt in s["notes"]:
            res_notes.setdefault(nt["nn"], [])
            # 同一 nn 多份
            if not any(r["catalogId"] == nt["catalogId"] for r in res_notes[nt["nn"]]):
                res_notes[nt["nn"]].append(nt)
    for p in pidx:
        pid = p["paperId"]
        key = norm(p.get("chapter", ""))
        lx = name2idx.get(key)
        res_papers[str(pid)] = {
            "file": f"_workspace/papers/{pid}.json", "title": p.get("title"),
            "qCount": p.get("qCount"), "cls": p.get("cls"), "lectureIdx": lx,
            "knowledgePointIds": paper_kps.get(pid, []),
        }
        if lx is None:
            raise SystemExit(f"paper {pid} chapter 无法路由到 catalog: {p.get('chapter')}")

    # ---- knowledge：泛标签并入 ----
    merged = {}
    if GENERIC_POINT_ID in points:
        merged[GENERIC_POINT_ID] = GENERIC_MERGE_INTO
        # 把泛标签的 papers 并入目标点
        tgt = points.setdefault(GENERIC_MERGE_INTO, {"title": "增值税一般计税方法应纳税额的计算", "papers": set(), "sub": 0})
        g = points[GENERIC_POINT_ID]
        tgt["papers"] |= g["papers"]; tgt["sub"] += g["sub"]

    groups = {}
    for g in range(1, 15):
        members = []
        for pid_, v in points.items():
            if pid_ == GENERIC_POINT_ID:
                continue
            if group_of(pid_, v["title"]) == g:
                members.append(pid_)
        members.sort()
        groups[g] = {"code": g, "name": GROUP_NAMES[g], "pointCount": len(members), "pointIds": members}

    point_index = {}
    for pid_, v in points.items():
        if pid_ == GENERIC_POINT_ID:
            continue
        point_index[str(pid_)] = {
            "title": v["title"], "groupCode": group_of(pid_, v["title"]),
            "mergedInto": merged.get(pid_), "paperIds": sorted(v["papers"]),
            "subQuestionCount": v["sub"],
        }

    # ---- assert 基线 ----
    counts = [groups[g]["pointCount"] for g in range(1, 15)]
    assert counts == BASE_POINT_COUNT, f"组点数不符: {counts} != {BASE_POINT_COUNT}"
    total_points = sum(counts)
    assert total_points == 92, total_points
    assert len(res_papers) == 116, len(res_papers)
    total_q = sum(p.get("qCount", 0) for p in pidx)
    assert total_q == 1296, total_q
    assert len(res_videos) == 39, len(res_videos)
    n_notes = sum(len(v) for v in res_notes.values())
    assert n_notes == 26, n_notes

    manifest = {
        "course": {"courseId": COURSE_ID,
                   "name": "【26考季】VIPCPA系列-税法（蔡俊峻老师）", "season": "2026",
                   "generatedAt": datetime.now(timezone.utc).isoformat()},
        "sequence": sequence,
        "resources": {"videos": res_videos, "notes": res_notes, "papers": res_papers},
        "knowledge": {"groups": [groups[g] for g in range(1, 15)], "pointIndex": point_index,
                      "genericPoint": {"id": GENERIC_POINT_ID, "mergedInto": GENERIC_MERGE_INTO}},
        "stats": {"videos": 39, "notes": 26, "basePapers": 116, "questions": 1296,
                  "mockPapers": 3, "mockStatus": "末期待采(982347/982348/982350)",
                  "groups": 14, "points": 92, "pointCountByGroup": counts},
    }

    print("=== M1 assert 全过 ===")
    print("组点数:", counts, "合计", total_points)
    print("视频", len(res_videos), "讲义", n_notes, "基础卷", len(res_papers), "题", total_q)

    if dry:
        print("[dry-run] 不写文件")
        return

    # 建骨架
    for sub in ["manifest", "papers", "sniff", "user-notes-raw", "logs", "tmp"]:
        os.makedirs(os.path.join(WS, sub), exist_ok=True)
    md = os.path.join(WS, "manifest")
    json.dump(manifest, open(os.path.join(md, "course-manifest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    shutil.copy(os.path.join(SNIFF, "course_catalog.json"), os.path.join(md, "course_catalog.json"))
    shutil.copy(os.path.join(SNIFF, "papers_inventory.json"), os.path.join(md, "papers_inventory.json"))
    shutil.copy(os.path.join(KSRC, "paper_index.json"), os.path.join(md, "paper_index.json"))
    write_ws_readme(WS)
    print("已写入 _workspace/manifest 四件套 + 六子目录骨架 + README")


def clean(name):
    return re.sub(r'[/\\:*?"<>|&]', "·", name.strip())


def kind_of(name):
    if "强化冲刺" in name:
        return "sprint"
    if name.startswith("开班"):
        return "opening"
    return "live"


WS_README = """# _workspace（运行过程件，gitignore，可整体重建）

本目录只放"运行后可再生成"的课程过程件，**不是成品、不传 Git、不传网盘**；
成品在 `../知识详解/`，原始资料在 `../原始资源/`。双门禁（92 篇校验过 + 原始资源传完网盘，
且飞书同步回读一致）满足后，由阶段④收尾 SOP 整体清理。

| 子目录 | 放什么 | 何时清 |
|---|---|---|
| `manifest/` | course-manifest（总路由）、course_catalog（官网快照）、papers_inventory、paper_index | 重跑可重建，收尾清 |
| `papers/` | 116 套试卷题答 JSON（接口采集） | 知识详解生成并校验后可清 |
| `sniff/` | CDP 抓包原始报文（jsonl） | 结论沉淀进 manifest/文档后即删 |
| `user-notes-raw/` | 用户留言/笔记原件 | 100% 提炼进"学员补充"后删 |
| `logs/` | 各阶段运行日志 | 单任务成功即清 |
| `tmp/` | download/transcribe 等临时件，按讲再分子目录 | 单任务成功即清 |
"""


def write_ws_readme(ws):
    p = os.path.join(ws, "README.md")
    if not os.path.exists(p):
        open(p, "w", encoding="utf-8").write(WS_README)


if __name__ == "__main__":
    main()

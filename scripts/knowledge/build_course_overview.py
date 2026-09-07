#!/usr/bin/env python3
"""生成课程总览页：飞书 XML（--format xml，默认）与本地 Markdown 源文件（--format markdown）。

设计要点（2026-09-07 修订）：
- 飞书侧章节入口统一用 <cite type="doc" doc-id="obj_token"/> 内部文档引用。
  实测 cite 会渲染为文档标题且生成 target="_self"，在当前窗口导航，不新开标签页；
  普通完整 URL（含 /wiki/<token> 与 citation 组件）均为 target="_blank" 新窗口，故弃用。
- 每章只保留一个入口（章 README）：章内"知识点目录"即知识拆解入口，"重点内容"即该章考试指导，
  不再让 14 行"考试指导"都指向同一个全局速查手册；全局横向汇总以 cite 单列于表格下方。
- 本地 Markdown 源文件用相对链接，供 git/网盘归档，与飞书 XML 同源生成，避免两处不一致。

数据来源：
- logs/wiki_node_map.tsv（标题 node_token obj_token parent，取 14 章与 2 篇全局资料的 obj_token）
- 本地知识详解目录（统计每章知识点 .md 篇数）
"""
import argparse
import glob
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MAP_FILE = os.path.join(REPO, "logs", "wiki_node_map.tsv")
COURSE_DIR = os.path.join(
    REPO, "data", "高顿", "CPA", "课程库",
    "【26考季】VIPCPA系列-税法（蔡俊峻老师）", "知识详解",
)

# 14 章官方显示名（总览面向读者，用完整教材章名，不带 NN_ 前缀）
CHAPTER_DISPLAY = {
    "01": "税法总论",
    "02": "增值税法",
    "03": "消费税法",
    "04": "企业所得税法",
    "05": "个人所得税法",
    "06": "城市维护建设税法和烟叶税法",
    "07": "关税法和船舶吨税法",
    "08": "资源税法和环境保护税法",
    "09": "城镇土地使用税法和耕地占用税法",
    "10": "房产税法、契税法和土地增值税法",
    "11": "车辆购置税法、车船税法和印花税法",
    "12": "国际税收税务管理实务",
    "13": "税收征收管理法",
    "14": "税务行政法制",
}
GLOBAL_DOCS = [
    ("考试指导速查手册", "跨章横向汇总：易混税率、征税范围、优惠政策对比"),
    ("课程做题思路解析", "通用做题方法与主观题答题框架"),
]

COURSE_INFO = [
    ("考季", "2026年"),
    ("科目", "税法"),
    ("主讲老师", "蔡俊峻"),
    ("课程类型", "VIPCPA系列-全面精讲"),
    ("考试时间", "2026年8月29日 下午13:00-15:00"),
]

IMPORTANCE_LEVELS = [
    ("第一层级（综合题，15-18分/章）", "增值税法、企业所得税法"),
    ("第二层级（主观题高频，6-10分/章）", "个人所得税法、资源税和环保税、房产税/契税/土地增值税、国际税收"),
    ("第三层级（会考主观题，2-5分/章）", "车辆购置税/车船税/印花税、消费税、关税、城镇土地使用税/耕地占用税、城建税/烟叶税"),
    ("第四层级（弯道超车，只考客观题，2-5分/章）", "税法总论、税收征收管理法、税务行政法制"),
]
STUDY_METHODS = [
    "不用背不用记，通过逻辑推导",
    "基本功扎实，避免“烂苹果”效应",
    "一定要答完题（答完比没答完过关概率高15-20%）",
    "配合三套资料：讲义 + 精粹 + 题目",
    "不要放弃弯道超车章节（国际税收、征管法、行政法制）",
]

LIST_NOTE = (
    "点击章节名在当前窗口进入该章目录，不新开页面。章内“知识点目录”是知识拆解入口，"
    "“重点内容”是该章考试指导；每篇知识点详解统一含“知识拆解 / 考试指导 / 题答解析 / 学员补充”四节。"
    "跨章横向汇总与通用做题方法见表格下方两篇全局资料。"
)


def load_obj_tokens():
    """从 node_map 取每个章目录名（NN_xxx）与全局资料的 obj_token。"""
    chapter_obj, global_obj = {}, {}
    with open(MAP_FILE, encoding="utf-8") as f:
        for line in f:
            cols = line.rstrip("\n").split("\t")
            if len(cols) < 3:
                continue
            title, _node, obj = cols[0], cols[1], cols[2]
            if len(title) >= 3 and title[:2].isdigit() and title[2] == "_":
                chapter_obj[title[:2]] = obj  # 同名章只此一条，后写覆盖无妨
            if title in ("考试指导速查手册", "课程做题思路解析"):
                global_obj[title] = obj
    return chapter_obj, global_obj


def count_points():
    """统计每章知识点 .md 篇数（排除 README），并返回 {序号: (篇数, 章目录名)}。"""
    counts, dirname = {}, {}
    for path in sorted(glob.glob(os.path.join(COURSE_DIR, "[0-9]*/"))):
        name = os.path.basename(path.rstrip(os.sep))
        num = name[:2]
        n = len([
            p for p in glob.glob(os.path.join(path, "*.md"))
            if os.path.basename(p) != "README.md"
        ])
        counts[num] = n
        dirname[num] = name
    return counts, dirname


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build_rows(chapter_obj, counts, dirname):
    rows = []
    for num in sorted(CHAPTER_DISPLAY):
        obj = chapter_obj.get(num)
        if not obj:
            sys.exit(f"[ERROR] wiki_node_map.tsv 缺少 {num} 章 obj_token")
        rows.append((num, obj, counts.get(num, 0), dirname.get(num, "")))
    return rows


# ---------- 飞书 XML ----------

def build_xml(chapter_obj, global_obj, counts, dirname):
    rows = build_rows(chapter_obj, counts, dirname)
    total = sum(r[2] for r in rows)
    p = []
    p.append("<title>【26考季】VIPCPA系列-税法（蔡俊峻老师）</title>")
    # 课程信息
    p.append("<h2>课程信息</h2>")
    p.append("<ul>" + "".join(f"<li>{esc(k)}：{esc(v)}</li>" for k, v in COURSE_INFO) + "</ul>")
    # 章节列表
    p.append("<h2>章节列表</h2>")
    p.append(f"<blockquote><p>{esc(LIST_NOTE)}</p></blockquote>")
    head = "".join(
        f'<th background-color="light-gray"><p>{h}</p></th>'
        for h in ("序号", "章节（当前窗口进入）", "知识点", "状态")
    )
    body = []
    for num, obj, n, _dn in rows:
        body.append(
            "<tr>"
            f"<td><p>{num}</p></td>"
            f'<td><p><cite type="doc" doc-id="{obj}"/></p></td>'
            f"<td><p>{n} 篇</p></td>"
            f"<td><p>✅ 已完成</p></td>"
            "</tr>"
        )
    p.append(
        "<table><colgroup><col width=\"60\"/><col width=\"320\"/>"
        "<col width=\"90\"/><col width=\"110\"/></colgroup>"
        f"<thead><tr>{head}</tr></thead><tbody>{''.join(body)}</tbody></table>"
    )
    p.append(f"<p>合计 {len(rows)} 章、{total} 篇知识点详解。</p>")
    # 全局资料
    p.append("<h3>全局资料</h3>")
    p.append("<ul>")
    for title, desc in GLOBAL_DOCS:
        obj = global_obj.get(title)
        if not obj:
            sys.exit(f"[ERROR] wiki_node_map.tsv 缺少全局资料 {title} obj_token")
        p.append(f"<li><cite type=\"doc\" doc-id=\"{obj}\"/> — {esc(desc)}</li>")
    p.append("</ul>")
    # 课程概述
    p.append("<h2>课程概述</h2>")
    p.append("<p>本课程为2026年CPA税法全面精讲课程，由蔡俊峻老师主讲。课程强调“不用背、不用记”，通过逻辑和原理理解税法知识，框架先行、骨肉后填。</p>")
    p.append("<h3>各章节重要性层级</h3>")
    p.append("<ul>" + "".join(f"<li><b>{esc(lv)}</b>：{esc(txt)}</li>" for lv, txt in IMPORTANCE_LEVELS) + "</ul>")
    p.append("<h3>学习方法</h3>")
    p.append("<ol>" + "".join(f"<li>{esc(m)}</li>" for m in STUDY_METHODS) + "</ol>")
    return "".join(p)


# ---------- 本地 Markdown ----------

def build_markdown(chapter_obj, counts, dirname):
    rows = build_rows(chapter_obj, counts, dirname)
    total = sum(r[2] for r in rows)
    L = []
    L.append("# 【26考季】VIPCPA系列-税法（蔡俊峻老师）\n")
    L.append("> 本文件为飞书课程根节点（总览页）的本地源文件，与飞书版本同源生成。")
    L.append("> 飞书侧章节入口为内部文档引用（当前窗口打开）；本地用相对路径链接。\n")
    L.append("## 课程信息\n")
    for k, v in COURSE_INFO:
        L.append(f"- {k}：{v}")
    L.append("")
    L.append("## 章节列表\n")
    L.append(f"> {LIST_NOTE}\n")
    L.append("| 序号 | 章节 | 知识点 | 状态 |")
    L.append("|-|-|-|-|")
    for num, _obj, n, dn in rows:
        L.append(f"| {num} | [{CHAPTER_DISPLAY[num]}](./知识详解/{dn}/README.md) | {n} 篇 | ✅ 已完成 |")
    L.append(f"\n合计 {len(rows)} 章、{total} 篇知识点详解。\n")
    L.append("### 全局资料\n")
    for title, desc in GLOBAL_DOCS:
        L.append(f"- **[{title}](./知识详解/{title}.md)** — {desc}")
    L.append("")
    L.append("## 课程概述\n")
    L.append("本课程为2026年CPA税法全面精讲课程，由蔡俊峻老师主讲。课程强调“不用背、不用记”，通过逻辑和原理理解税法知识，框架先行、骨肉后填。\n")
    L.append("### 各章节重要性层级\n")
    for lv, txt in IMPORTANCE_LEVELS:
        L.append(f"- **{lv}**：{txt}")
    L.append("")
    L.append("### 学习方法\n")
    for i, m in enumerate(STUDY_METHODS, 1):
        L.append(f"{i}. {m}")
    L.append("")
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--format", choices=["xml", "markdown"], default="xml")
    args = ap.parse_args()
    chapter_obj, global_obj = load_obj_tokens()
    counts, dirname = count_points()
    if args.format == "xml":
        sys.stdout.write(build_xml(chapter_obj, global_obj, counts, dirname))
    else:
        sys.stdout.write(build_markdown(chapter_obj, counts, dirname))


if __name__ == "__main__":
    main()

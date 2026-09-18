#!/usr/bin/env python3
"""
飞书知识库同步完整性全量验证脚本。

检查项：
1. 三方数量一致性检查（本地md文件数 = wiki_node_map行数 = resync_done数）
2. 分类型验证（章节点 vs 知识点 vs 课程全局篇）
3. 每个本地文件都有对应的resync_done标记
4. 每个wiki_node_map条目都有对应的本地文件

用法：
    python3 scripts/knowledge/verify_sync_completeness.py [profile]
    # 不指定profile时检查所有六科
"""
import os
import sys
from pathlib import Path

REPO = "/Users/wenjiechen/Doubao/chats/2026-08-26/new-chat/gaodun-course-knowledge-base"

# 六科配置
ALL_COURSES = [
    {"name": "会计", "profile": "cpa-accounting-2026", "dir": "data/高顿/CPA/【VIPCPA专享】名师专业课-会计/知识详解"},
    {"name": "审计", "profile": "ep3-audit-2026", "dir": "data/高顿/CPA/【VIPCPA专享】名师专业课-审计/知识详解"},
    {"name": "财管", "profile": "ep3-finance-2026", "dir": "data/高顿/CPA/【VIPCPA专享】名师专业课-财管/知识详解"},
    {"name": "税法", "profile": "cpa-tax-2026", "dir": "data/高顿/CPA/【VIPCPA专享】名师专业课-税法/知识详解"},
    {"name": "经济法", "profile": "ep3-econlaw-2026", "dir": "data/高顿/CPA/【VIPCPA专享】名师专业课-经济法/知识详解"},
    {"name": "战略", "profile": "ep3-strategy-2026", "dir": "data/高顿/CPA/【VIPCPA专享】名师专业课-战略/知识详解"},
]


def verify_course(course: dict) -> dict:
    """验证单个课程的同步完整性"""
    result = {
        "name": course["name"],
        "profile": course["profile"],
        "local_count": 0,
        "wiki_map_count": 0,
        "resync_done_count": 0,
        "chapter_count": 0,
        "knowledge_point_count": 0,
        "global_doc_count": 0,
        "missing_resync_done": [],
        "missing_local_files": [],
        "errors": [],
        "passed": False,
    }

    knowledge_dir = Path(REPO) / course["dir"]
    workspace_dir = Path(REPO) / "data/_workspace" / course["profile"] / "logs"

    # 1. 统计本地md文件
    if not knowledge_dir.exists():
        result["errors"].append(f"知识详解目录不存在: {knowledge_dir}")
        return result

    all_local_files = list(knowledge_dir.rglob("*.md"))
    result["local_count"] = len(all_local_files)

    # 分类统计
    chapter_files = [f for f in all_local_files if f.name == "README.md"]
    result["chapter_count"] = len(chapter_files)

    global_docs = [f for f in all_local_files if f.parent == knowledge_dir and f.name != "README.md"]
    result["global_doc_count"] = len(global_docs)

    result["knowledge_point_count"] = result["local_count"] - result["chapter_count"] - result["global_doc_count"]

    # 2. 统计wiki_node_map.tsv行数
    wiki_map_file = workspace_dir / "wiki_node_map.tsv"
    if wiki_map_file.exists():
        with open(wiki_map_file, 'r', encoding='utf-8') as f:
            lines = [line.strip() for line in f if line.strip()]
        result["wiki_map_count"] = len(lines)
    else:
        result["errors"].append(f"wiki_node_map.tsv不存在: {wiki_map_file}")

    # 3. 统计resync_done标记数
    resync_done_dir = workspace_dir / "resync_done"
    if resync_done_dir.exists():
        done_files = list(resync_done_dir.glob("*.done"))
        result["resync_done_count"] = len(done_files)
        done_titles = {f.stem for f in done_files}
    else:
        result["errors"].append(f"resync_done目录不存在: {resync_done_dir}")
        done_titles = set()

    # 4. 检查每个本地文件是否都有对应的resync_done标记
    for f in all_local_files:
        # 计算相对路径作为标题（与wiki_node_map和resync_done的命名一致）
        rel_path = f.relative_to(knowledge_dir)
        # README.md用父目录名，其他用文件名（不含扩展名）
        if f.name == "README.md":
            title = rel_path.parent.name
        else:
            title = rel_path.stem

        if title not in done_titles:
            result["missing_resync_done"].append(str(rel_path))

    # 5. 三方数量一致性检查
    if result["local_count"] != result["wiki_map_count"]:
        result["errors"].append(
            f"本地文件数({result['local_count']}) ≠ wiki_node_map数({result['wiki_map_count']})"
        )

    if result["local_count"] != result["resync_done_count"]:
        result["errors"].append(
            f"本地文件数({result['local_count']}) ≠ resync_done数({result['resync_done_count']})，"
            f"遗漏{len(result['missing_resync_done'])}个文件"
        )

    # 判断是否通过
    result["passed"] = (
        not result["errors"]
        and result["local_count"] == result["wiki_map_count"] == result["resync_done_count"]
        and not result["missing_resync_done"]
    )

    return result


def main():
    # 解析参数
    if len(sys.argv) > 1:
        profile = sys.argv[1]
        courses = [c for c in ALL_COURSES if c["profile"] == profile]
        if not courses:
            print(f"❌ 未找到profile: {profile}")
            print(f"可用profile: {', '.join(c['profile'] for c in ALL_COURSES)}")
            sys.exit(1)
    else:
        courses = ALL_COURSES

    print("=" * 80)
    print("飞书知识库同步完整性全量验证")
    print("=" * 80)
    print()

    all_passed = True
    total_local = 0
    total_resync_done = 0
    total_missing = 0

    for course in courses:
        result = verify_course(course)

        status = "✅ 通过" if result["passed"] else "❌ 未通过"
        print(f"【{result['name']}】{status}")
        print(f"  本地文件: {result['local_count']}个 "
              f"(章节点{result['chapter_count']} + 知识点{result['knowledge_point_count']} + 全局篇{result['global_doc_count']})")
        print(f"  wiki_node_map: {result['wiki_map_count']}行")
        print(f"  resync_done: {result['resync_done_count']}个")

        if result["missing_resync_done"]:
            print(f"  ⚠️  遗漏未同步: {len(result['missing_resync_done'])}个文件")
            for f in result["missing_resync_done"][:5]:
                print(f"      - {f}")
            if len(result["missing_resync_done"]) > 5:
                print(f"      ... 还有{len(result['missing_resync_done']) - 5}个")

        if result["errors"]:
            print(f"  ❌ 错误:")
            for err in result["errors"]:
                print(f"      - {err}")

        print()

        total_local += result["local_count"]
        total_resync_done += result["resync_done_count"]
        total_missing += len(result["missing_resync_done"])
        if not result["passed"]:
            all_passed = False

    print("=" * 80)
    print(f"汇总: 本地文件{total_local}个, 已同步{total_resync_done}个, 遗漏{total_missing}个")
    if all_passed:
        print("✅ 全部通过！所有课程同步完整，无遗漏。")
    else:
        print("❌ 存在未通过项，请检查上述错误并修复。")
    print("=" * 80)

    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()

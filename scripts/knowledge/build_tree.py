#!/usr/bin/env python3
"""可靠的飞书知识库建树脚本（Python版，避免bash编码问题）"""
import os
import subprocess
import sys
import time
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parents[2]
os.chdir(PROJECT_DIR)

SPACE_ID = "7678261729456852192"


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def run_lark(args):
    """运行lark-cli命令，返回解析后的JSON"""
    cmd = ["lark-cli"] + args + ["--as", "user", "--format", "json"]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    try:
        import json
        return json.loads(result.stdout)
    except Exception:
        return {"ok": False, "error": result.stdout[:200] + result.stderr[:200]}


def get_children(parent_token):
    """获取父节点下的所有子节点"""
    result = run_lark([
        "wiki", "+node-list",
        "--space-id", SPACE_ID,
        "--parent-node-token", parent_token
    ])
    if result.get("ok"):
        return {n["title"]: n for n in result.get("data", {}).get("nodes", [])}
    return {}


def create_node(parent_token, title, content_file=None):
    """创建节点，返回node_token和obj_token"""
    # 先检查是否已存在
    children = get_children(parent_token)
    if title in children:
        node = children[title]
        log(f"  [复用] {title}")
        return node["node_token"], node["obj_token"]

    # 创建节点
    for attempt in range(3):
        result = run_lark([
            "wiki", "+node-create",
            "--parent-node-token", parent_token,
            "--title", title,
            "--space-id", SPACE_ID
        ])
        if result.get("ok"):
            data = result.get("data", {})
            node_token = data.get("node_token")
            obj_token = data.get("obj_token")
            log(f"  [创建] {title}")
            time.sleep(0.5)
            return node_token, obj_token
        log(f"  [重试{attempt+1}] {title}: {result.get('error', '未知错误')[:100]}")
        time.sleep((attempt + 1) * 4)

    log(f"  [失败] {title}")
    return None, None


def build_course(profile, parent_token, course_dir):
    """为一门课建树：全局篇 → 章README → 知识点"""
    log(f"========== 开始建树: {profile} ==========")

    map_file = PROJECT_DIR / f"data/_workspace/{profile}/logs/wiki_node_map.tsv"
    map_file.parent.mkdir(parents=True, exist_ok=True)

    # 读取已有映射
    existing_map = {}
    if map_file.exists():
        with open(map_file, encoding="utf-8") as f:
            for line in f:
                parts = line.rstrip("\n").split("\t")
                if len(parts) >= 3:
                    existing_map[parts[0]] = (parts[1], parts[2])

    def save_map(title, node_token, obj_token, parent):
        existing_map[title] = (node_token, obj_token)
        with open(map_file, "a", encoding="utf-8") as f:
            f.write(f"{title}\t{node_token}\t{obj_token}\t{parent}\n")

    knowledge_dir = course_dir / "知识详解"
    if not knowledge_dir.exists():
        log(f"  [错误] 知识详解目录不存在: {knowledge_dir}")
        return False

    # 1. 先创建章节点和知识点（这样全局篇会在最下面）
    log("--- 章节点 ---")
    for group_dir in sorted(knowledge_dir.iterdir()):
        if not group_dir.is_dir():
            continue
        group_name = group_dir.name
        log(f"--- 组: {group_name} ---")

        # 创建章节点（README）
        readme = group_dir / "README.md"
        if group_name in existing_map:
            group_node = existing_map[group_name]
            log(f"  [跳过组] {group_name}")
        else:
            group_node = create_node(parent_token, group_name, readme if readme.exists() else None)
            if group_node[0]:
                save_map(group_name, group_node[0], group_node[1], parent_token)
            else:
                log(f"  [错误] 无法创建组节点: {group_name}")
                continue

        # 创建知识点
        for md_file in sorted(group_dir.glob("*.md")):
            if md_file.name == "README.md":
                continue
            title = md_file.stem
            if title in existing_map:
                continue
            point_node = create_node(group_node[0], title, md_file)
            if point_node[0]:
                save_map(title, point_node[0], point_node[1], group_node[0])

    # 2. 最后创建全局篇（知识详解根目录下的.md文件），这样会在最下面
    log("--- 全局篇（放在最下面）---")
    for md_file in sorted(knowledge_dir.glob("*.md")):
        title = md_file.stem
        if title in existing_map:
            log(f"  [跳过] {title}")
            continue
        node_token, obj_token = create_node(parent_token, title, md_file)
        if node_token:
            save_map(title, node_token, obj_token, parent_token)

    log(f"========== 建树完成: {profile}，共 {len(existing_map)} 个节点 ==========")
    return True


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("用法: python3 build_tree.py <profile> <parent_token> <course_dir>")
        sys.exit(1)

    profile = sys.argv[1]
    parent_token = sys.argv[2]
    course_dir = Path(sys.argv[3])

    build_course(profile, parent_token, course_dir)

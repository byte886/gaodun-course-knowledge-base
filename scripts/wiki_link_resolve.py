#!/usr/bin/env python3
"""同步飞书前的内部链接解析过滤器（stdin markdown → stdout markdown）。

把本地同目录相对链接 [文字](./知识点标题.md) 解析为飞书知识库可点击链接
[文字](https://<租户域名>/wiki/<node_token>)。node_token 从 logs/wiki_node_map.tsv 按标题查。
- 本地源文件保留 ./ 相对链接不动，仅在写入飞书的管道里做转换；
- 找不到映射的链接保持原样并向 stderr 告警，绝不臆造 token；
- 租户域名由环境变量 WIKI_BASE 提供，默认本课程租户。
"""
import os
import re
import sys

MAP_FILE = os.environ.get("WIKI_MAP", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs", "wiki_node_map.tsv"))
WIKI_BASE = os.environ.get("WIKI_BASE", "https://zcnjheoajxng.feishu.cn").rstrip("/")

title2node = {}
if os.path.isfile(MAP_FILE):
    for line in open(MAP_FILE, encoding="utf-8"):
        cols = line.rstrip("\n").split("\t")
        if len(cols) >= 2 and cols[0]:
            title2node[cols[0]] = cols[1]

text = sys.stdin.read()
_missing = set()


def _resolve(m):
    target = m.group(1).strip()
    node = title2node.get(target)
    if node:
        return f"]({WIKI_BASE}/wiki/{node})"
    _missing.add(target)
    return m.group(0)


# 仅替换同目录相对链接 ./xxx.md（跨组 ../ 与外链不动）
out = re.sub(r"\]\(\./([^)]+?)\.md\)", _resolve, text)

for t in sorted(_missing):
    print(f"[wiki_link_resolve] 未找到节点映射，保留原链接: {t}", file=sys.stderr)

sys.stdout.write(out)

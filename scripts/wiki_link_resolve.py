#!/usr/bin/env python3
"""同步飞书前的内部链接解析过滤器（stdin markdown → stdout markdown，内嵌 XML cite）。

把本地同目录相对链接 [标题](./标题.md) 解析为飞书内部文档引用
<cite type="doc" doc-id="obj_token"/>：飞书渲染为文档标题且生成 target="_self"，
在当前窗口导航，不新开标签页。

历史：早期版本输出完整 wiki URL（https://<域名>/wiki/<node_token>），实测在飞书内
渲染为 target="_blank"，逐层点击会不断新开窗口、容易迷失，2026-09-07 起改为 cite。
- 本地源文件保留 ./ 相对链接不动，仅在写入飞书的管道里做转换；
- cite 渲染文字固定为目标文档标题，故要求链接文字等于目标文件名（已全量核验一致）；
- 找不到映射的链接保持原样并向 stderr 告警，绝不臆造 token；
- obj_token 取自 logs/wiki_node_map.tsv 第 3 列（该表已去重，标题唯一）。
"""
import os
import re
import sys

MAP_FILE = os.environ.get(
    "WIKI_MAP",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "logs", "wiki_node_map.tsv"),
)

# 标题 -> obj_token（第 3 列）
title2obj = {}
if os.path.isfile(MAP_FILE):
    for line in open(MAP_FILE, encoding="utf-8"):
        cols = line.rstrip("\n").split("\t")
        if len(cols) >= 3 and cols[0]:
            title2obj[cols[0]] = cols[2]

text = sys.stdin.read()
_missing = set()
_link_pat = re.compile(r"\[([^\]]+)\]\(\./([^)]+?)\.md\)")


def _resolve(m):
    label, target = m.group(1).strip(), m.group(2).strip()
    obj = title2obj.get(target)
    if obj:
        return f'<cite type="doc" doc-id="{obj}"/>'
    _missing.add(target)
    return m.group(0)


# 仅替换同目录相对链接 ./xxx.md（跨组 ../ 与外链不动）
out = _link_pat.sub(_resolve, text)

for t in sorted(_missing):
    print(f"[wiki_link_resolve] 未找到节点映射，保留原链接: {t}", file=sys.stderr)

sys.stdout.write(out)

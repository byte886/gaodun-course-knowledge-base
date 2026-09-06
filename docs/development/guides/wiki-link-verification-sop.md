# 飞书知识库链接验证 SOP

> **文档类型**：Active（操作规范）
> **更新频率**：流程变更时
> **维护者**：AI自动维护 + 用户审核
> **读者**：AI代理

## 目的

确保飞书知识库中所有内部链接指向正确的节点，无死链、无错链、无占位符坏链。每次知识详解同步飞书后、或知识库结构调整后，必须执行本 SOP 验证。

## 验证范围（三层）

| 层级 | 位置 | 链接数量（税法课参考值） | 说明 |
|------|------|--------------------------|------|
| 第一层 | 课程总览页（课程根节点 obj） | 28 | 14 行 × 2 列（知识拆解[进入] + 考试指导[速查]） |
| 第二层 | 14 章 README | 92 | 每章 README 中指向该章各知识点详解的链接 |
| 第三层 | 92 篇知识点详解 | 654 | 知识点详解中「关联知识点」节指向其他知识点的链接 |
| **合计** | | **774** | |

## 前置条件

1. **节点台账**：`logs/wiki_node_map.tsv` 存在且完整，格式为 `标题\tnode_token\tobj_token\tparent_node_token`，每行一个节点；
2. **lark-cli 可用**：已登录，`--as user` 身份可访问目标知识空间；
3. **本地知识详解已生成并校验**：本地 md 文件中的相对链接全部能匹配 `wiki_node_map.tsv` 中的标题。

## 验证步骤

### 第一步：本地链接预检（同步飞书前）

在同步飞书之前，先验证本地 md 文件中的相对链接是否都能匹配台账：

```bash
# 提取所有本地相对链接，与 wiki_node_map.tsv 的标题列比对
# 预期：0 个无法匹配的链接
grep -rhoE '\]\([^)]+\.md\)' "data/课程库/<课程>/知识详解/" | \
  sed 's/](//;s/)//' | sort -u > /tmp/local_links.txt
cut -f1 logs/wiki_node_map.tsv | sort -u > /tmp/map_titles.txt
comm -23 /tmp/local_links.txt /tmp/map_titles.txt
```

如果输出非空，说明有本地链接指向台账中不存在的标题，需先修复再同步。

### 第二步：飞书回读验证（同步飞书后）

逐篇从飞书回读文档内容，提取所有链接，验证链接中的 `node_token` 与台账一致。

#### 2.1 课程总览页

```bash
# 回读课程总览页
lark-cli docs +fetch --doc-token <课程根obj_token> --doc-format markdown --as user --format json > /tmp/overview.json

# 提取所有飞书 wiki 链接的 node_token
# 格式：https://<domain>.feishu.cn/wiki/<node_token>
python3 -c "
import json, re
d = json.load(open('/tmp/overview.json'))
content = d['data']['document']['content']
links = re.findall(r'feishu\.cn/wiki/([A-Za-z0-9]+)', content)
print(f'总览页链接数: {len(links)}')
for t in links: print(t)
"

# 与台账比对：每个 node_token 应存在于 wiki_node_map.tsv
```

#### 2.2 章 README + 知识点详解

```bash
# 遍历 wiki_node_map.tsv 中的每个节点，回读并提取链接
while IFS=$'\t' read -r title node obj parent; do
  # 跳过课程根节点（已在 2.1 验证）
  [ "$parent" = "<课程根node>" ] || continue
  
  # 回读
  lark-cli docs +fetch --doc-token "$obj" --doc-format markdown --as user --format json 2>/dev/null > /tmp/node_${node}.json
  
  # 提取链接并验证
  python3 -c "
import json, re, sys
try:
    d = json.load(open('/tmp/node_${node}.json'))
    content = d['data']['document']['content']
    links = re.findall(r'feishu\.cn/wiki/([A-Za-z0-9]+)', content)
    # 验证每个链接的 node_token 在台账中
    map_nodes = set(line.split('\t')[1] for line in open('logs/wiki_node_map.tsv'))
    bad = [t for t in links if t not in map_nodes]
    if bad:
        print(f'FAIL ${title}: {len(bad)} 个坏链: {bad}')
    else:
        print(f'OK ${title}: {len(links)} 链接')
except Exception as e:
    print(f'ERROR ${title}: {e}')
"
done < logs/wiki_node_map.tsv
```

### 第三步：汇总报告

统计三层验证结果：

```
=== 飞书链接验证报告 ===
第一层 总览页:   28 链接, 0 错误, 0 警告
第二层 章README:  92 链接, 0 错误, 0 警告
第三层 知识点:   654 链接, 0 错误, 0 警告
合计:           774 链接, 0 错误, 0 警告
结论: 全部通过
```

## 常见问题与修复

| 问题 | 原因 | 修复 |
|------|------|------|
| 链接文字为 `[链接]` 或 `[点击查看]` | 同步时未转换链接文字 | 修改本地 md 中的链接文字为有意义的名称（如 `[进入]`、`[速查]`），重新同步 |
| 链接指向已删除的旧节点 | 旧版归档删除后未更新总览页 | 更新总览页表格，删除旧行或修正链接，重新同步 |
| node_token 在台账中不存在 | 同步时新建了节点但台账未更新，或链接指向了错误的节点 | 重新运行同步脚本（会更新台账），或手动修正链接 |
| 相对链接未转换为飞书 wiki 链接 | 同步脚本的链接解析逻辑未覆盖该链接格式 | 检查 `wiki_link_resolve.py` 的链接匹配规则，补充后重新同步 |

## 验收标准

- 三层合计 0 错误、0 警告；
- 所有链接文字有意义（非 `[链接]`、`[点击查看]` 等占位符）；
- 所有链接指向的节点在 `wiki_node_map.tsv` 中存在；
- 课程总览页表格行数与章数一致（税法课 14 行）。

## 参考

- 节点台账：`logs/wiki_node_map.tsv`
- 同步脚本：`scripts/sync_wiki_new.sh`（含 `wiki_link_resolve.py` 链接解析）
- 飞书 API：`lark-cli docs +fetch`（回读）、`lark-cli docs +update`（覆盖更新）
- 相关 ADR：[ADR-012](../../project-management/decisions/ADR-012-三层解耦与按知识点聚合.md)（飞书与本地同构）

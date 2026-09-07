# 飞书知识库链接验证 SOP

> **文档类型**：Active（操作规范）
> **更新频率**：流程变更时
> **维护者**：AI自动维护 + 用户审核
> **读者**：AI代理

## 目的

确保飞书知识库中所有内部链接①指向正确节点（无死链、错链、占位符坏链），②在**当前窗口**导航（`target="_self"`），不新开标签页。每次知识详解同步飞书后、或知识库结构调整后，必须执行本 SOP 验证。

## 核心约定：内部链接一律用 `<cite>` 文档引用

飞书文档内的站内跳转有两种写法，窗口行为不同（2026-09-07 实测）：

| 写法 | 飞书渲染 | target | 是否采用 |
|------|---------|--------|---------|
| `<cite type="doc" doc-id="obj_token"/>` | 文档标题（蓝色内部引用） | **`_self`（当前窗口）** | ✅ 唯一采用 |
| 完整 URL `[文字](https://<域名>/wiki/<node>)` | 普通超链接 | `_blank`（新标签页） | ❌ 已弃用 |
| `<cite type="citation">` 参考文献组件 | JS 弹层组件 | 弹层内链接仍 `_blank` | ❌ 不用于导航 |

- cite 渲染文字固定为**目标文档标题**，因此本地相对链接的链接文字必须等于目标文件名（标题），税法课已全量核验 746 处一致；
- cite 的 `doc-id` 填 **obj_token（docx token，台账第 3 列）**，不是 node_token；
- 本地 Markdown 源文件保留 `./标题.md` 相对链接不动，仅在写入飞书的管道里由 `wiki_link_resolve.py` 转成 cite；Markdown 流中可直接内嵌该 XML 标签，飞书可识别。

## 验证范围（三层）

| 层级 | 位置 | 链接数量（税法课参考值） | 形态 |
|------|------|--------------------------|------|
| 第一层 | 课程总览页（课程根节点） | 16 | 14 章入口 cite + 2 篇全局资料 cite |
| 第二层 | 14 章 README「知识点目录」 | 92 | 每章指向该章各知识点详解的 cite |
| 第三层 | 92 篇知识点详解「关联知识点」 | 654 | 知识点之间互相跳转的 cite |
| **合计** | | **762** | 全部应为 cite、全部 `_self` |

> 总览页不再设"知识拆解 / 考试指导"两列：每章只保留一个章入口 cite，章内"知识点目录"即知识拆解、"重点内容"即该章考试指导；跨章横向汇总由全局两篇 cite 承担。

## 前置条件

1. **节点台账**：`logs/wiki_node_map.tsv` 存在、**已去重**（每标题唯一一行），格式 `标题\tnode_token\tobj_token\tparent_node_token`；
2. **lark-cli 可用**：已登录，`--as user` 身份可访问目标知识空间；
3. **本地链接预检通过**：本地 md 相对链接全部能匹配台账标题，且链接文字等于目标文件名。

## 验证步骤

### 第一步：本地链接预检（同步飞书前）

```bash
# 1) 相对链接目标必须都能在台账标题列找到；预期 0 未匹配
# 2) 链接文字必须等于目标文件名（决定 cite 渲染文字是否与原文一致）
python3 - << 'PY'
import glob, os, re
TITLE_COL = set(l.split('\t')[0] for l in open('logs/wiki_node_map.tsv', encoding='utf-8'))
bad_target, bad_label = [], []
for md in glob.glob('data/**/知识详解/**/*.md', recursive=True):
    for m in re.finditer(r'\[([^\]]+)\]\(\./([^)]+?)\.md\)', open(md, encoding='utf-8').read()):
        label, target = m.group(1), m.group(2)
        if target not in TITLE_COL: bad_target.append((os.path.basename(md), target))
        if label != target: bad_label.append((os.path.basename(md), label, target))
print('目标无映射:', len(bad_target), bad_target[:5])
print('文字≠标题:', len(bad_label), bad_label[:5])
PY
```

任一非 0 都需先修复本地文件，再同步。

### 第二步：转换管道本地验证（不写飞书）

```bash
# 任意一篇经 wiki_link_resolve.py 转换后，应只剩 cite、无残留相对链接
cat "data/.../知识详解/01_税法总论/README.md" | python3 scripts/wiki_link_resolve.py
# 预期：[标题](./标题.md) 全部变为 <cite type="doc" doc-id="obj_token"/>
# stderr 不应出现"未找到节点映射"
```

### 第三步：飞书回读验证（同步后）

cite 回读形态为 `<cite doc-id="obj_token" file-type="docx" title="标题" type="doc"></cite>`，按 **doc-id 与台账 obj_token 比对**（不再是提取 wiki URL）。

```bash
# 回读一篇（以课程根总览页为例）
lark-cli docs +fetch --doc <obj_token> --doc-format xml --as user --format json > /tmp/doc.json

python3 - << 'PY'
import json, re
x = json.load(open('/tmp/doc.json'))['data']['document']['content']
cites = re.findall(r'<cite doc-id="([^"]+)"[^>]*title="([^"]*)"', x)
obj_col = set(l.split('\t')[2] for l in open('logs/wiki_node_map.tsv', encoding='utf-8'))
bad = [(t, o) for o, t in cites if o not in obj_col]
# 完整 URL 普通链接应清零（这些是 _blank 的根源）
plain = re.findall(r'<a href="https://[^"]*feishu[^"]*"', x)
print(f'cite 数: {len(cites)}, 指向台账外: {len(bad)}, 残留完整URL链接: {len(plain)}')
PY
```

批量回读可复用 `scripts/knowledge/resync_wiki_content.py` 的对应遍历逻辑，对 108 篇逐篇统计 cite 数与坏链。

### 第四步：浏览器 target=_self 抽检（渲染层）

回读只能证明 doc-id 正确，`target` 是前端渲染属性，需在内置浏览器（plane=bu）抽检：

```javascript
// 在打开的飞书文档控制台执行：
// mention-doc 即 cite 渲染结果；页面内不应再有 target=_blank 的站内链接
JSON.stringify({
  cite_self: document.querySelectorAll('a.mention-doc[target="_self"]').length,
  blank:      document.querySelectorAll('a[target="_blank"]').length
})
```

- 总览页：cite_self=16、blank=0；
- 章 README / 知识点篇：站内链接全部计入 cite_self，blank=0（外链除外）。

### 第五步：汇总报告

```
=== 飞书链接验证报告 ===
第一层 总览页:    16 cite, 0 坏链, 0 _blank
第二层 章README:  92 cite, 0 坏链, 0 _blank
第三层 知识点:   654 cite, 0 坏链, 0 _blank
合计:            762 cite, 0 错误
结论: 全部通过
```

## 常见问题与修复

| 问题 | 原因 | 修复 |
|------|------|------|
| 回读出现完整 URL `<a href=.../wiki/...>`（新窗口） | 旧版同步产物，或误用 markdown 链接 | 用 `resync_wiki_content.py` 以新版 `wiki_link_resolve.py`（输出 cite）重同步 |
| cite 整块变空 | doc-id 误填 node_token，或拼了不存在的 obj_token | 改用台账第 3 列 obj_token；`wiki +node-get` 可反查 |
| 转换时 stderr 报"未找到节点映射" | 本地链接目标与台账标题不一致，或台账缺该节点 | 先补/修台账或本地文件名，禁止臆造 token |
| cite 渲染文字与原文链接文字不符 | 链接文字≠目标文档标题 | 修改本地链接文字等于文件名（标题）后重同步 |
| 总览页多行指向同一篇全局手册 | 误把"考试指导"列统一指向全局速查 | 每章入口 cite 必须指向该章 README 的 obj_token，全局手册只在"全局资料"出现一次 |
| 台账出现同标题多行 | 历史同步重复追加（节点未必重复） | 先按整行去重；若同标题对应不同 obj_token，才说明飞书有重复节点需人工核对删除 |

## 验收标准

- 三层合计 0 坏链、0 台账外 doc-id、0 残留完整 URL 站内链接；
- 浏览器抽检站内链接全部 `target="_self"`，无 `_blank` 站内跳转；
- cite 渲染标题均为有意义的文档名（无 `[链接]`、`[点击查看]` 等占位符）；
- 课程总览页章入口行数与章数一致（税法课 14 行 + 全局 2 篇）。

## 参考

- 节点台账：`logs/wiki_node_map.tsv`（标题 / node / obj / parent，已去重）
- 链接解析：`scripts/wiki_link_resolve.py`（相对链接 → cite，stdin/stdout 过滤器）
- 总览页生成：`scripts/knowledge/build_course_overview.py`（`--format xml` 飞书 / `--format markdown` 本地源）
- 内容重同步：`scripts/knowledge/resync_wiki_content.py`（只覆盖内容、不建节点，`--dry-run` 预检）
- 首次建节点同步：`scripts/sync_wiki_new.sh`
- 飞书 API：`lark-cli docs +fetch`（回读）、`lark-cli docs +update --command overwrite`（覆盖）
- 相关 ADR：[ADR-012](../../project-management/decisions/ADR-012-三层解耦与按知识点聚合.md)（飞书与本地同构）

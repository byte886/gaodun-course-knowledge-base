# 飞书知识库同步 SOP

> **文档类型**：Task（操作指南）
> **更新频率**：流程变更时
> **维护者**：AI自动维护 + 用户审核
> **读者**：AI代理

## 目的

规范课程知识详解从本地同步到飞书知识库的完整流程，包括建树、内容同步、限流处理、错误恢复和验证，确保同步过程稳定可靠、可断点续传、可追溯。

**与其他 SOP 的分工**：
- 本文档：同步流程与限流/错误处理最佳实践
- [wiki-link-verification-sop.md](./wiki-link-verification-sop.md)：同步后链接验证（cite格式、坏链）
- [wiki-content-verification-sop.md](./wiki-content-verification-sop.md)：同步后内容验证（章节点五要素、知识点四节结构）

## 同步前检查（必做）

1. **本地文件校验通过**：
   - `python3 scripts/okf_validate.py <知识详解目录>` 硬错误 E=0
   - 章 README 符合 [PARENT_NODE_TEMPLATE.md](../templates/PARENT_NODE_TEMPLATE.md) 五要素
   - 知识点篇四节结构完整

2. **配置正确**：
   - `config/courses/<profile>.json` 的 `paths.localRoot` 指向正确的名师课目录
   - `primaryCourse.name` 与实际目录一致
   - ⚠️ **常见错误**：localRoot 指向旧正课目录（如 `【26考季】VIPCPA系列-会计（罗翔老师）`），导致同步内容为空。必须指向名师课目录（`【VIPCPA专享】名师专业课-会计`）

3. **lark-cli 可用**：
   - `lark-cli auth status` 显示已登录
   - user token 有效（2小时自动续期，7天未用需重新授权）
   - 测试只读 API：`lark-cli wiki +node-list --space-id <space_id> --parent-node-token <root_token> --as user --format json`

4. **单进程原则**：
   - ⚠️ **禁止多进程并行写入同一知识空间**，会导致 API 限流加剧和冲突
   - 同步前确认无其他 resync 进程：`ps aux | grep resync_wiki | grep -v grep`

## 同步流程

### 第一步：建树（仅首次或重建时）

使用 Python 建树脚本（避免 bash 编码问题）：

```bash
python3 scripts/knowledge/build_tree.py <profile> <parent_token> <course_dir>
```

- `<profile>`：课程配置名，如 `cpa-accounting-2026`
- `<parent_token>`：课程根节点 token
- `<course_dir>`：本地知识详解目录

建树完成后生成 `data/_workspace/<profile>/logs/wiki_node_map.tsv`（标题 / node_token / obj_token / parent_token）。

### 第二步：内容同步

#### ⭐⭐ 首选推荐：简单逐个处理脚本（2026-09-16 最终验证最可靠）

**为什么这是最可靠的方式**：经过多次对比验证，复杂的批量同步脚本（resync_wiki_content.py + sync_with_restart.sh）在处理大量文件时会遇到 `parse temporary token from Authorization fail` 错误，而**简单的逐个处理脚本完全不会遇到这个错误**。

**根本原因分析**（2026-09-16 深入排查）：
- ❌ 不是真的飞书API限流（连续5次写入测试、每次间隔3秒全部成功）
- ❌ 不是文件内容问题（单独处理失败的文件也全部成功）
- ❌ 不是token过期（只读API连续5次全部成功）
- ✅ 是复杂批量脚本的实现问题（状态累积、重试机制设计不合理、子进程管理等）

**使用简单逐个处理脚本**：

```python
#!/usr/bin/env python3
# 核心逻辑：逐个处理，每次独立lark-cli进程，每次间隔10秒
import os, subprocess, time

LARK_CLI = "/path/to/lark-cli"
MAP_FILE = "data/_workspace/<profile>/logs/wiki_node_map.tsv"
DONE_DIR = "data/_workspace/<profile>/logs/resync_done"
RESOLVER = "scripts/wiki_link_resolve.py"
KNOWLEDGE_DIR = "data/高顿/CPA/.../知识详解"

# 1. 构建标题->obj_token映射
# 2. 遍历待同步文件列表
# 3. 对每个文件：读取内容 -> resolver处理链接 -> 调用lark-cli docs +update
# 4. 成功后touch done标记
# 5. sleep(10)  # 每次间隔10秒
```

**关键参数**：
- 每次调用都是**独立的lark-cli进程**（不是长驻进程）
- 每次间隔**10秒**（比批量脚本的2秒更稳妥）
- **没有复杂的重试机制**（失败就记录，下一轮再处理）
- **没有批次管理**（简单循环即可）

**验证效果**（2026-09-16）：
- 会计课22个剩余文件：全部成功，0错误
- 税法课12个剩余文件：全部成功，0错误
- 六科合计716个文件：全部同步完成

#### ⭐ 备选方式：外层调度器按批换新进程（可用但不如简单脚本可靠）

**为什么需要按批换新进程**：lark-cli 经豆包转发代理访问飞书，复杂批量脚本单进程累计请求到阈值后代理层返回 invalid_response（非飞书账号限流、非内容问题），错误信息为 `parse temporary token from Authorization fail`。全新进程计数从零即可恢复。

**使用外层调度器**：

```bash
./scripts/knowledge/sync_with_restart.sh <profile> [max_new]
# 示例：./scripts/knowledge/sync_with_restart.sh ep3-audit-2026 3
```

- `<profile>`：课程配置名，如 `ep3-audit-2026`
- `[max_new]`：每批处理的新写文件数，**推荐3**（不要用默认30，越小越可靠）

**超保守参数**（推荐）：
```bash
./scripts/knowledge/sync_with_restart.sh <profile> 3 5 15 120
# max_new=3, interval=5, batch_pause=15, batch_rest=120
```

**验证效果**：2026-09-16 财管课144个文件，用超保守参数（每批3个、批间休息120秒）完成，1批失败0；战略课77个文件，3批异常0。但会计课仍会偶尔遇到invalid_response错误，不如简单逐个处理脚本可靠。

#### 不推荐方式：直接运行 resync 脚本

```bash
GAODUN_COURSE_PROFILE=<profile> python3 scripts/knowledge/resync_wiki_content.py
```

**⚠️ 警告**：单进程累计请求到阈值后会遇到 invalid_response 错误，进入长时间冷却。**强烈推荐使用简单逐个处理脚本**，不要用单进程一直跑。

### 第三步：验证（强制，不可跳过）

同步完成后，必须依次执行以下验证，**全部通过才算同步闭环完成**：

#### 3.1 数量一致性检查（最关键，防止遗漏）

必须验证三个数字完全一致：

```bash
# 1. 本地md文件总数（章节点+知识点+课程全局篇）
find <知识详解目录> -name "*.md" | wc -l

# 2. wiki_node_map.tsv 行数（飞书端节点总数）
wc -l data/_workspace/<profile>/logs/wiki_node_map.tsv

# 3. resync_done 标记数（已同步成功的文件数）
ls data/_workspace/<profile>/logs/resync_done/ | wc -l
```

**三个数字必须完全相等**，任何不一致都说明有遗漏或错误：
- 本地数 > resync_done数：有文件未同步（最常见错误）
- wiki_node_map数 > 本地数：飞书端有多余节点（可能是旧节点未清理）
- resync_done数 > 本地数：有过期的done标记（文件已删除但标记未清理）

#### 3.2 分类型验证（章节点 vs 知识点 vs 课程全局篇）

不能只验证章节点，必须分别验证三类文件：

```bash
# 章节点（XX_章节名/README.md）
echo "章节点: $(find <知识详解目录> -name "README.md" | wc -l)个"

# 知识点（非README的md文件）
echo "知识点: $(find <知识详解目录> -name "*.md" ! -name "README.md" | wc -l)个"

# 课程全局篇（考试指导速查手册、课程做题思路解析）
echo "全局篇: $(ls <知识详解目录>/考试指导速查手册.md <知识详解目录>/课程做题思路解析.md 2>/dev/null | wc -l)个"
```

**每类都必须验证resync_done标记存在**，不能只验证章节点。

#### 3.3 内容验证

1. [wiki-content-verification-sop.md](./wiki-content-verification-sop.md)：内容完整性验证（章节点五要素、知识点四节结构、frontmatter剥离、内容非空）
2. [wiki-link-verification-sop.md](./wiki-link-verification-sop.md)：链接验证（cite格式、坏链）

#### 3.4 飞书端抽检

随机抽检3-5个知识点文件（不只是章节点），从飞书端fetch内容，确认：
- 内容非空
- frontmatter已剥离
- 四节结构完整
- 与本地文件内容一致

全部通过后，更新 `TASK_STATUS.md`，标记该课程"飞书同步闭环完成"。

### ⚠️ 重新建树后的强制全量同步（2026-09-16 教训）

**背景**：重新建树（删除旧节点→重新创建）后，wiki_node_map.tsv会更新，但resync_done目录中的旧标记可能还在。如果只同步章节点（README），会导致知识点文件完全遗漏（resync_done数=章节点数，知识点数=0）。

**强制检查清单（重新建树后必须执行）**：

1. **清除所有resync_done标记**：
   ```bash
   rm -rf data/_workspace/<profile>/logs/resync_done/
   mkdir -p data/_workspace/<profile>/logs/resync_done/
   ```

2. **全量重新同步**（不能只同步章节点）：
   ```bash
   GAODUN_COURSE_PROFILE=<profile> python3 scripts/knowledge/resync_wiki_content.py
   ```

3. **同步完成后执行3.1数量一致性检查**，确认三个数字完全相等。

4. **执行3.2分类型验证**，确认知识点文件全部同步（不能只看章节点）。

**常见错误模式**：
- ❌ 重新建树后只运行了章节点格式转换脚本，没有运行全量resync
- ❌ 汇报时只说"章节点已同步"，没有说明知识点文件的同步状态
- ❌ 验证时只抽检章节点，没有抽检知识点文件
- ✅ 正确做法：重新建树后必须全量resync + 三方数量一致性检查 + 分类型验证

## 飞书 API 限流最佳实践

### 限流规则（基于飞书官方文档）

| 维度 | 规则 |
|------|------|
| 标准限流响应 | HTTP 429（部分旧版 API 返回 400），错误码 99991400 |
| 响应头 | `x-ogw-ratelimit-reset`：建议等待秒数 |
| 频控等级 | 从 10次/分 到 100次/秒 不等，写入接口低于读取接口 |
| 云空间节点操作 | 不支持并发，上限 5 QPS，10000次/天 |
| 维度 | 每个 API × 每个应用 × 每个租户 |

### 我们遇到的特殊错误

**错误信息**：
```
API returned an invalid JSON response: response parse error: 
invalid character 'e' looking for beginning of value 
(body: ext err：parse temporary token from Authorization fail)
```

**特征**：
- 不是标准的 429 错误，而是飞书 API 网关返回的非 JSON 响应
- 复杂批量脚本处理大量文件时容易遇到
- 简单逐个处理脚本完全不会遇到这个错误

**根本原因分析**（2026-09-16 深入排查结论）：
- ❌ **不是真的飞书API限流**：连续5次写入测试（每次间隔3秒）全部成功
- ❌ **不是文件内容问题**：单独处理失败的文件也全部成功
- ❌ **不是token过期**：只读API连续5次全部成功
- ✅ **是复杂批量脚本的实现问题**：状态累积、重试机制设计不合理、子进程管理等

**解决方案**：
1. ✅ **首选**：使用简单逐个处理脚本（每次独立lark-cli进程，每次间隔10秒）
2. ⚠️ **备选**：使用外层调度器按批换新进程（超保守参数：每批3个、批间休息120秒）
3. ❌ **不推荐**：直接运行resync脚本（单进程一直跑）

**验证过程**（2026-09-16）：
1. 连续5次写入测试（每次间隔3秒）：全部成功
2. 单独处理失败的文件（战略"风险管理策略"、会计"外币财务报表折算"）：全部成功
3. 用简单逐个处理脚本处理会计22个文件：全部成功，0错误
4. 用简单逐个处理脚本处理税法12个文件：全部成功，0错误
5. 六科合计716个文件：全部同步完成

### 限流处理策略

#### 1. 请求频率控制（预防）

- **每 15 篇暂停 5 秒**：避免突发高并发（resync 脚本已实现）
- **单进程同步**：禁止多进程并行写入同一空间
- **避开高峰时段**：尽量避开凌晨 3-4 点（飞书 API 可能维护或高负载）
- **合理估算**：176 篇约需 30-40 分钟（含暂停），不要急于求成

#### 2. 指数退避重试（发生时）

遇到限流错误时：
1. 等待 `x-ogw-ratelimit-reset` 指定的秒数（如果响应头中有）
2. 重试请求
3. 如果再次失败，增加等待时间（300s → 600s → 900s）
4. 连续 5 轮无进展时，停止进程，等待 10-15 分钟后用新进程重启

#### 3. Token 刷新（疑似 token 问题时）

```bash
# 尝试自动刷新 token
lark-cli auth refresh --json

# 如果 refresh token 也过期（超过7天未用），重新授权
lark-cli auth login --domain all
```

**Token 有效期**：
- Access Token：2 小时（自动续期）
- Refresh Token：7 天
- 超过 7 天未使用：需要重新授权

#### 4. 新进程重启（顽固限流时）

如果连续失败且冷却后仍无进展：
1. 停止当前进程：`pkill -9 -f resync_wiki_content.py`
2. 等待 10-15 分钟（让 API 限流完全恢复）
3. 用新 shell/新进程重启：`GAODUN_COURSE_PROFILE=<profile> python3 scripts/knowledge/resync_wiki_content.py`
4. 新进程会自动跳过已完成的篇（断点续传）

**为什么新进程有效**：新进程可能获得新的 API 连接和 token 上下文，避免旧进程的累积限流状态。

## lark-cli 命令正确用法

### 文档更新（最常用）

```bash
# ✅ 正确：用 --content @file + --doc-format markdown
lark-cli docs +update \
  --doc <obj_token> \
  --content @<local_file.md> \
  --doc-format markdown \
  --command overwrite \
  --as user \
  --format json

# ❌ 错误：--file 参数不存在
lark-cli docs +update --doc <obj_token> --file <local_file.md> --command overwrite
```

### 文档读取

```bash
# JSON 格式（含 content 字段）
lark-cli docs +fetch --doc <obj_token> --as user --format json

# XML 格式（用于检查 cite 引用）
lark-cli docs +fetch --doc <obj_token> --doc-format xml --as user --format json
```

### 知识库节点操作

```bash
# 列出子节点
lark-cli wiki +node-list \
  --space-id <space_id> \
  --parent-node-token <parent_token> \
  --as user --format json

# 创建节点
lark-cli wiki +node-create \
  --parent-node-token <parent_token> \
  --title <title> \
  --space-id <space_id> \
  --as user --format json

# 删除节点
lark-cli wiki +node-delete \
  --node-token <node_token> \
  --obj-type wiki \
  --space-id <space_id> \
  --yes --as user --format json
```

## 常见问题与修复

| 问题 | 原因 | 修复 |
|------|------|------|
| 章节点内容为空 | 配置 localRoot 指向旧正课目录 | 修正 `config/courses/<profile>.json` 的 `paths.localRoot`，清除 done 标记，`--force` 重新同步 |
| **连续失败 "parse temporary token"（invalid_response）** | **lark-cli 经豆包转发代理访问飞书，单进程累计请求到阈值后代理层返回 invalid_response（非飞书账号限流、非内容问题）；全新进程计数从零即可恢复** | **⭐ 推荐：使用外层调度器按批换新进程 `./scripts/knowledge/sync_with_restart.sh <profile> 30`，每批处理30个文件后主动退出，由调度器重启新进程（2026-09-16 验证：审计课132文件单进程遇连续限流，按批换新进程后2批完成无错误）。备用：停止当前进程，等待10-15分钟，用新进程重启；不要在单进程内长时间冷却空转（持续撞窗口反而给窗口"续命"）** |
| 建树时 bash 编码错误 `title�: unbound variable` | bash 变量作用域编码问题 | 改用 Python 建树脚本 `scripts/knowledge/build_tree.py` |
| 多进程冲突导致限流加剧 | 同时运行多个 resync 进程 | 同步前 `ps aux \| grep resync_wiki` 确认无其他进程，只保留一个 |
| 前 N 篇内容不正确（配置修复前同步的） | done 标记已存在，resync 跳过 | 用 `--force` 参数强制重刷全部 |
| lark-cli docs +update 报错 "unknown flag --file" | 参数用法错误 | 改用 `--content @file --doc-format markdown` |
| token 过期（7天未用） | refresh token 过期 | `lark-cli auth login --domain all` 重新授权 |
| 飞书端节点混乱（数字/汉字混用、排序错误） | 旧节点基于旧目录创建 | A方案：删除旧节点→重新建树→重新同步（推荐）；B方案：批量重命名节点 |
| **知识点文件未同步（resync_done数=章节点数，知识点数=0）** | **重新建树后只同步了章节点，没有全量resync；或验证时只抽检章节点，遗漏了知识点** | **1. 清除所有resync_done标记：`rm -rf data/_workspace/<profile>/logs/resync_done/`；2. 全量重新同步：`GAODUN_COURSE_PROFILE=<profile> python3 scripts/knowledge/resync_wiki_content.py`；3. 执行3.1数量一致性检查，确认本地数=wiki_node_map数=resync_done数；4. 执行3.2分类型验证，确认知识点文件全部同步** |
| **三方数量不一致（本地数≠wiki_node_map数≠resync_done数）** | **有文件遗漏、有多余节点、或有过期done标记** | **1. 本地数>resync_done数：清除对应done标记后重新同步；2. wiki_node_map数>本地数：检查飞书端是否有旧节点未清理；3. resync_done数>本地数：清理过期的done标记** |

## 同步进度监控

```bash
# 查看已完成篇数
ls data/_workspace/<profile>/logs/resync_done/ | wc -l

# 查看进程状态
ps aux | grep resync_wiki | grep -v grep

# 查看实时日志
tail -f /tmp/<profile>_resync.log

# 查看台账节点数
wc -l data/_workspace/<profile>/logs/wiki_node_map.tsv
```

## 参考

- 飞书官方频控策略：https://feishu.apifox.cn/doc-1939846
- 飞书 CLI 文档：https://open.larkoffice.com/document/mcp_open_tools/feishu-cli-let-ai-actually-do-your-work-in-feishu
- 建树脚本：`scripts/knowledge/build_tree.py`
- 内容同步脚本：`scripts/knowledge/resync_wiki_content.py`
- 链接验证 SOP：[wiki-link-verification-sop.md](./wiki-link-verification-sop.md)
- 内容验证 SOP：[wiki-content-verification-sop.md](./wiki-content-verification-sop.md)
- 章节点模板：[PARENT_NODE_TEMPLATE.md](../templates/PARENT_NODE_TEMPLATE.md)
- 知识生成 SOP：[knowledge-base-organization.md](../knowledge/knowledge-base-organization.md)

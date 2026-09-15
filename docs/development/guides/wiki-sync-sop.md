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

使用 resync 脚本（断点续传、自动限流处理）：

```bash
GAODUN_COURSE_PROFILE=<profile> python3 scripts/knowledge/resync_wiki_content.py
```

**关键参数**：
- `--force`：强制重刷全部（忽略 done 标记），用于配置修复后重新同步
- `--dry-run`：预检模式，不实际写入

**同步机制**：
- 每篇同步成功后在 `logs/resync_done/<标题>.done` 标记
- 重启后自动跳过已完成的篇（断点续传）
- 每 15 篇暂停 5 秒（避免突发高并发）
- 连续 2 篇失败进入分层冷却（300s → 600s → 900s）

### 第三步：验证

同步完成后，依次执行：
1. [wiki-content-verification-sop.md](./wiki-content-verification-sop.md)：内容完整性验证
2. [wiki-link-verification-sop.md](./wiki-link-verification-sop.md)：链接验证

全部通过后，更新 `TASK_STATUS.md`，标记该课程"飞书同步闭环完成"。

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
- 通常发生在凌晨 3-4 点（可能是飞书 API 网关维护或高负载时段）
- 连续失败后会加剧，需要较长时间冷却

**可能原因**：
1. 飞书 API 网关的临时 token 解析服务临时故障
2. user token 过期或刷新失败
3. API 限流的另一种表现形式

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
| 连续失败 "parse temporary token" | API 网关限流或 token 问题 | 停止进程，等待 10-15 分钟，新进程重启；必要时 `lark-cli auth refresh` |
| 建树时 bash 编码错误 `title�: unbound variable` | bash 变量作用域编码问题 | 改用 Python 建树脚本 `scripts/knowledge/build_tree.py` |
| 多进程冲突导致限流加剧 | 同时运行多个 resync 进程 | 同步前 `ps aux \| grep resync_wiki` 确认无其他进程，只保留一个 |
| 前 N 篇内容不正确（配置修复前同步的） | done 标记已存在，resync 跳过 | 用 `--force` 参数强制重刷全部 |
| lark-cli docs +update 报错 "unknown flag --file" | 参数用法错误 | 改用 `--content @file --doc-format markdown` |
| token 过期（7天未用） | refresh token 过期 | `lark-cli auth login --domain all` 重新授权 |
| 飞书端节点混乱（数字/汉字混用、排序错误） | 旧节点基于旧目录创建 | A方案：删除旧节点→重新建树→重新同步（推荐）；B方案：批量重命名节点 |

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

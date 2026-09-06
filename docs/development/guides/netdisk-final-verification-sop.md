# 网盘终态验证 SOP

> **目的**：课程知识系统 finalize 后，验证百度网盘上的课程目录与本地完全一致，确保无遗漏、无冗余、无损坏。
> **适用场景**：每门课程 finalize 后、大规模同步后、定期巡检。
> **工具**：`scripts/verify_netdisk_final.py`（自动化递归对比）。

## 一、验证时机

| 时机 | 说明 |
|------|------|
| 课程 finalize 后 | 知识详解生成 + 三地同步完成后，必须执行 |
| 大规模同步后 | 批量上传/删除/覆盖后，执行验证 |
| 定期巡检 | 每月一次，确认网盘状态未被意外修改 |

## 二、验证方法

### 2.1 自动化验证（推荐）

```bash
cd <仓库根>
export BAIDU_ENC_PASS=<密码>
python3 scripts/verify_netdisk_final.py <本地课程根> <网盘课程根>
```

**示例（税法课）**：
```bash
export BAIDU_ENC_PASS=lover123
python3 scripts/verify_netdisk_final.py \
    "data/高顿/CPA/课程库/【26考季】VIPCPA系列-税法（蔡俊峻老师）" \
    "/apps/CPA课程归档/高顿/CPA/课程库/【26考季】VIPCPA系列-税法（蔡俊峻老师）"
```

**脚本功能**：
- 递归扫描本地和网盘目录
- 对比目录结构（是否有缺失/多余目录）
- 对比文件集合（是否有缺失/多余文件）
- 对比文件大小（共同文件的大小是否一致）
- 输出差异清单和修复建议

**退出码**：
- `0` = 验证通过，完全一致
- `1` = 发现差异
- `2` = 参数或环境错误

### 2.2 手动验证（脚本不可用时）

逐层执行 `python3 scripts/baidu_upload.py list <目录>`，与本地 `find`/`ls` 结果对比：

| 检查项 | 本地命令 | 网盘命令 |
|--------|----------|----------|
| 顶层目录结构 | `ls <课程根>` | `list <网盘课程根>` |
| 原始资源四类 | `find 原始资源 -type d` | 逐层 list |
| 知识详解篇数 | `find 知识详解 -name "*.md" \| wc -l` | 逐层 list 计数 |
| 文件大小抽样 | `ls -l <文件>` | list 输出中的大小 |

## 三、常见差异与修复

| 差异类型 | 原因 | 修复方法 |
|----------|------|----------|
| 文件缺失-网盘 | 同步时遗漏（如 transcript.json） | 补上传：`baidu_upload.py upload <本地> <网盘>` |
| 文件多余-网盘 | 早期 rtype=1 重命名产生的旧文件（带时间戳） | 删除：`baidu_upload.py delete <网盘路径>`（进回收站） |
| 大小不一致 | 上传不完整或换行符差异 | 重新覆盖上传（rtype=3） |
| 目录缺失/多余 | 目录结构约定变更 | 按约定创建/删除目录 |

### 3.1 批量补上传示例

```bash
# 批量上传所有 transcript.json
find <本地videos> -name "transcript.json" | while read f; do
    rel="${f#<本地videos>/}"
    python3 scripts/baidu_upload.py upload "$f" "<网盘videos>/$rel"
done
```

### 3.2 批量删除旧冗余文件示例

```bash
# 删除所有带时间戳的旧文件（_YYYYMMDD_HHMMSS 格式）
# 先用 list 确认，再逐个 delete
python3 scripts/baidu_upload.py list <目录> | grep "_2026"
```

## 四、回收站说明

- 百度网盘 `delete` 操作**进回收站**，可恢复，非硬删除。
- **回收站清空**：当前 OAuth 沙箱 token 无法调用 `recyclelist`/`cleanrecycle` API（返回 500/31296），需账号主人在网盘客户端手动清空，或等 10 天自动到期。
- **不要**用 API 重试清空回收站（已验证死路）。

## 五、验证通过标准

1. `verify_netdisk_final.py` 退出码为 0
2. 输出 `✅ 验证通过：本地与网盘完全一致`
3. 目录数、文件数本地 = 网盘
4. 无大小不一致的文件

## 六、验证留痕

- 验证结论体现在任务输出或《任务报告》中，**默认不单独成文**。
- 若发现差异并修复，修复过程记录在任务报告中。
- 验证脚本本身（`verify_netdisk_final.py`）入库，作为可复用工具。

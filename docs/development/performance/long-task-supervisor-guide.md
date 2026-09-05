# 长任务守护与主动通知指南

> 适用场景：网盘批量上传、视频转写、OCR、批量下载等**单次运行超过 8 分钟**的长任务。
> 核心原则：**不让 AI 轮询等待，用系统级守护进程自动续跑，完成时主动通知。**

## 一、问题背景：为什么不能直接用后台任务

AI 工具的 `Bash(run_in_background=true)` 后台任务存在约 **8 分钟超时限制**，到时间会被系统杀掉。对于需要数小时的任务（如 12G 视频上传），直接后台跑会被反复终止，AI 只能定期检查并手动重启——这是"轮询"，消耗轮次且依赖 AI 在线。

## 二、守护器范式（推荐）

```text
nohup 守护器（PPID=1，系统 init 接管，AI 会话结束也不影响）
  └─ while 循环：
       1. 执行任务脚本（断点续传，done 标记跳过已完成项）
       2. 执行完成检测命令
          ├─ 全部完成 → macOS 系统通知 → exit 0
          ├─ 连续 N 轮进度无变化 → 异常通知 → exit 1
          └─ 否则 sleep 5 秒，进入下一轮
```

### 三个关键机制

| 机制 | 实现 | 作用 |
|------|------|------|
| 系统级脱离 | `nohup ... & disown`，PPID 变为 1 | 不受 AI 会话 8 分钟超时影响 |
| 断点续传 | 任务脚本对每个完成项写 `.done` 标记，重跑自动跳过 | 被终止后从断点继续，不重复劳动 |
| 主动通知 | `osascript display notification` | 完成/异常时 macOS 弹窗，无需 AI 轮询 |

## 三、使用方法

### 3.1 任务脚本必须支持断点续传

任务脚本对每个工作单元（如一个讲目录）完成后写标记文件：

```bash
DONE_DIR="logs/xxx_done"
if [ -f "$DONE_DIR/单元名.done" ]; then
  echo "[跳过] 已完成"
  return 0
fi
# ... 执行工作 ...
echo "OK 单元名" > "$DONE_DIR/单元名.done"
```

### 3.2 用守护器启动

```bash
nohup bash scripts/run_supervised.sh <任务名> \
  "<单次执行命令>" \
  "<完成检测命令>" \
  > logs/supervisor_<任务名>.log 2>&1 &
disown
```

**示例（网盘视频上传，39 个讲）**：

```bash
nohup bash scripts/run_supervised.sh videos \
  "bash scripts/sync_raw_resources.sh videos 2" \
  "test \$(find logs/raw_done -name 'videos_*.done' | wc -l | tr -d ' ') -ge 39" \
  > logs/supervisor_videos.log 2>&1 &
disown
```

### 3.3 验证守护器已脱离 AI 会话

```bash
ps -o pid,ppid,command -p <守护器PID>
# PPID 应为 1（系统 init 接管）
```

## 四、注意事项

1. **完成检测用 `find` 不用 `ls glob`**：文件名含中文/特殊字符时，`ls dir/prefix_*.done` 在某些 shell 环境下可能匹配失败返回 0；`find dir -name 'prefix_*.done'` 更稳定。
2. **stall 检测**：守护器连续 3 轮（默认）进度无变化会判定异常并通知，避免任务卡死却无人知晓。
3. **并发任务也可守护**：任务脚本内部用 `xargs -P N` 并发（见 [parallel-processing-guide.md](parallel-processing-guide.md)），守护器只管"整批是否全部完成"。
4. **通知声音**：`sound name "Glass"`，可在系统设置中更换。
5. **AI 会话恢复后查进度**：`tail logs/supervisor_<任务名>.log` + `find logs/xxx_done -name '*.done' | wc -l`，不需要等待。

## 五、适用场景清单

| 场景 | 单次耗时 | 工作单元 | done 标记 |
|------|---------|---------|-----------|
| 网盘批量上传 | 数小时 | 每个讲目录 | `logs/raw_done/` |
| FunASR 批量转写 | 数十分钟 | 每个视频 | 转写完成的 `.md` |
| OCR 批量识别 | 数十分钟 | 每个 PDF | OCR 输出文件 |
| 批量 API 同步（飞书） | 数分钟 | 每个节点 | `logs/wiki_done/` |
| 视频批量下载/压缩 | 数小时 | 每个视频 | 输出文件存在即完成 |

## 六、与"子任务主动上报"的关系

- **守护器**：解决"AI 会话超时导致任务被杀"的问题，是**进程级**保障。
- **子任务主动上报**：解决"总调度及时安排新任务"的问题，是**调度级**设计。
- 两者互补：守护器保证任务不中断，主动上报保证调度不等待。定期检查仅作为异常兜底（最大 5 分钟一次），不是主要进度来源。

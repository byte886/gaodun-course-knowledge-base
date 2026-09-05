#!/bin/bash
# 长任务守护器：自动续跑断点任务，全部完成或异常时发 macOS 通知
#
# 用法:
#   nohup bash scripts/run_supervised.sh <任务名> <单次执行命令> <完成检测命令> > logs/supervisor_<任务名>.log 2>&1 &
#
# 示例:
#   nohup bash scripts/run_supervised.sh videos \
#     "bash scripts/sync_raw_resources.sh videos 2" \
#     "test $(ls logs/raw_done/videos_*.done 2>/dev/null | wc -l) -ge 39" \
#     > logs/supervisor_videos.log 2>&1 &
#
# 机制:
#   - 循环执行 <单次执行命令>，每次结束后用 <完成检测命令> 判断是否全部完成
#   - 全部完成：发成功通知并退出
#   - 连续 3 次执行后进度无变化：判定异常，发失败通知并退出
#   - 每轮之间 sleep 5 秒，避免空转

set -u

TASK_NAME="$1"
RUN_CMD="$2"
DONE_TEST="$3"
MAX_STALL=3          # 连续多少轮进度无变化则判定异常
SLEEP_SEC=5

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

notify() {
  local title="$1" msg="$2"
  osascript -e "display notification \"$msg\" with title \"$title\" sound name \"Glass\"" 2>/dev/null || true
}

progress_count() {
  find logs/raw_done -name "${TASK_NAME}_*.done" 2>/dev/null | wc -l | tr -d ' '
}

echo "[$(date '+%H:%M:%S')] 守护器启动: $TASK_NAME"
echo "  执行命令: $RUN_CMD"
echo "  完成检测: $DONE_TEST"

stall=0
round=0
last_progress=""

while true; do
  round=$((round+1))
  echo "[$(date '+%H:%M:%S')] === 第 $round 轮 ==="

  eval "$RUN_CMD"
  rc=$?

  # 检查是否全部完成
  if eval "$DONE_TEST" 2>/dev/null; then
    echo "[$(date '+%H:%M:%S')] ✅ 全部完成"
    notify "✅ $TASK_NAME 完成" "全部任务已成功结束（第 $round 轮）"
    exit 0
  fi

  # 检测进度是否变化
  cur=$(progress_count)
  if [ "$cur" = "$last_progress" ]; then
    stall=$((stall+1))
    echo "[$(date '+%H:%M:%S')] ⚠️ 进度无变化 ($cur), 连续 $stall/$MAX_STALL 轮"
  else
    stall=0
    last_progress="$cur"
    echo "[$(date '+%H:%M:%S')] 进度: $cur"
  fi

  if [ $stall -ge $MAX_STALL ]; then
    echo "[$(date '+%H:%M:%S')] ❌ 连续 $MAX_STALL 轮无进展，判定异常（rc=$rc, 进度=$cur）"
    notify "❌ $TASK_NAME 异常" "连续 $MAX_STALL 轮无进展，当前 $cur，请检查"
    exit 1
  fi

  sleep $SLEEP_SEC
done

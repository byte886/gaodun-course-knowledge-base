#!/bin/bash
# 多生产者并行启动脚本
# 用法：bash scripts/cdp/start_multi_producers.sh [--with-monitor]
# 默认3个生产者，每个负责2个科目

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$PROJECT_DIR/data/_workspace/_account/ep3/logs"

mkdir -p "$LOG_DIR"

# 科目分组（3组，每组2个科目）
GROUPS=(
  "accounting tax"
  "strategy econlaw"
  "audit finance"
)

echo "============================================"
echo " 多生产者并行启动"
echo "============================================"
echo "生产者数量: ${#GROUPS[@]}"
echo "日志目录: $LOG_DIR"
echo ""

# 停止现有生产者
echo "--- 停止现有生产者 ---"
for pid in $(ps aux | grep "round_robin_prefetch" | grep -v grep | awk '{print $2}'); do
  kill -9 $pid 2>/dev/null && echo "  已停止 (PID: $pid)"
done
sleep 2
echo "  剩余生产者数: $(ps aux | grep 'round_robin_prefetch' | grep -v grep | wc -l | tr -d ' ')"
echo ""

# 启动新生产者
echo "--- 启动新生产者 ---"
for i in "${!GROUPS[@]}"; do
  PRODUCER_NUM=$((i + 1))
  SUBJECTS="${GROUPS[$i]}"
  LOG_FILE="$LOG_DIR/round_robin_producer${PRODUCER_NUM}.log"
  
  nohup bash "$SCRIPT_DIR/round_robin_prefetch.sh" $SUBJECTS >> "$LOG_FILE" 2>&1 &
  PID=$!
  echo "  生产者${PRODUCER_NUM} (PID: $PID): $SUBJECTS"
  echo "    日志: $LOG_FILE"
done

echo ""
echo "--- 等待5秒确认进程启动 ---"
sleep 5

echo ""
echo "--- 进程状态 ---"
ps aux | grep "round_robin_prefetch" | grep -v grep | awk '{print "  PID:", $2, "| 命令:", $11, $12, $13, $14, $15}'

echo ""
echo "============================================"
echo " 多生产者并行启动完成"
echo "============================================"
echo ""
echo "查看各生产者日志："
for i in "${!GROUPS[@]}"; do
  PRODUCER_NUM=$((i + 1))
  echo "  tail -f $LOG_DIR/round_robin_producer${PRODUCER_NUM}.log"
done

# 可选：启动动态调整监控脚本
if [ "${1:-}" = "--with-monitor" ]; then
  echo ""
  echo "--- 启动动态调整监控脚本 ---"
  nohup bash "$SCRIPT_DIR/monitor_and_adjust_producers.sh" 60 >> "$LOG_DIR/monitor_producers.log" 2>&1 &
  echo "  监控脚本PID: $!"
  echo "  日志: $LOG_DIR/monitor_producers.log"
  echo ""
  echo "使用方法：bash scripts/cdp/start_multi_producers.sh --with-monitor"
fi

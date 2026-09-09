#!/bin/bash
# 动态调整生产者数量的监控脚本
# 根据缓存数量和消费者等待情况自动调整生产者数量
#
# 用法：bash scripts/cdp/monitor_and_adjust_producers.sh [检查间隔(秒)]
# 默认检查间隔：60秒

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
WS="$PROJECT_DIR/data/_workspace/_account/ep3"
CACHE_DIR="$WS/keycache"
LOG_DIR="$WS/logs"
CONFIG_FILE="$PROJECT_DIR/config/ep3_subjects.json"

CHECK_INTERVAL="${1:-60}"
MIN_PRODUCERS=1
MAX_PRODUCERS=4
LOW_CACHE_THRESHOLD=10  # 低于此值认为缓存不足
HIGH_CACHE_THRESHOLD=50  # 高于此值认为缓存充足

mkdir -p "$LOG_DIR"

echo "============================================"
echo " 动态调整生产者数量监控"
echo "============================================"
echo "检查间隔: ${CHECK_INTERVAL}秒"
echo "生产者数量范围: $MIN_PRODUCERS-$MAX_PRODUCERS"
echo "低缓存阈值: $LOW_CACHE_THRESHOLD"
echo "高缓存阈值: $HIGH_CACHE_THRESHOLD"
echo "日志: $LOG_DIR/monitor_producers.log"
echo ""

# 函数：获取当前生产者数量
get_producer_count() {
  ps aux | grep "round_robin_prefetch" | grep -v grep | wc -l | tr -d ' '
}

# 函数：获取所有科目缓存数量的最小值
get_min_cache_count() {
  local min=999999
  for cache_file in "$CACHE_DIR"/*.json; do
    if [ -f "$cache_file" ]; then
      count=$(python3 -c "
import json
try:
    with open('$cache_file') as f:
        c = json.load(f)
    keys = [k for k in c if k != '_work']
    print(len(keys))
except:
    print(0)
" 2>/dev/null || echo "0")
      if [ "$count" -lt "$min" ]; then
        min=$count
      fi
    fi
  done
  echo "$min"
}

# 函数：获取所有科目缓存数量的平均值
get_avg_cache_count() {
  local total=0
  local count=0
  for cache_file in "$CACHE_DIR"/*.json; do
    if [ -f "$cache_file" ]; then
      c=$(python3 -c "
import json
try:
    with open('$cache_file') as f:
        c = json.load(f)
    keys = [k for k in c if k != '_work']
    print(len(keys))
except:
    print(0)
" 2>/dev/null || echo "0")
      total=$((total + c))
      count=$((count + 1))
    fi
  done
  if [ "$count" -gt 0 ]; then
    echo $((total / count))
  else
    echo "0"
  fi
}

# 函数：启动指定数量的生产者
start_producers() {
  local target_count=$1
  local current_count=$(get_producer_count)
  
  if [ "$current_count" -lt "$target_count" ]; then
    local need_to_start=$((target_count - current_count))
    echo "  需要启动 $need_to_start 个生产者"
    
    # 使用start_multi_producers.sh的逻辑
    # 科目分组
    GROUPS=(
      "accounting tax"
      "strategy econlaw"
      "audit finance"
    )
    
    for i in $(seq 0 $((need_to_start - 1))); do
      local producer_idx=$((current_count + i))
      if [ "$producer_idx" -lt "${#GROUPS[@]}" ]; then
        local SUBJECTS="${GROUPS[$producer_idx]}"
        local PRODUCER_NUM=$((producer_idx + 1))
        local LOG_FILE="$LOG_DIR/round_robin_producer${PRODUCER_NUM}.log"
        
        nohup bash "$SCRIPT_DIR/round_robin_prefetch.sh" $SUBJECTS >> "$LOG_FILE" 2>&1 &
        echo "  ✅ 已启动生产者$PRODUCER_NUM (PID: $!): $SUBJECTS"
      fi
    done
  fi
}

# 函数：停止指定数量的生产者（保留最少MIN_PRODUCERS个）
stop_producers() {
  local target_count=$1
  local current_count=$(get_producer_count)
  
  if [ "$current_count" -gt "$target_count" ] && [ "$target_count" -ge "$MIN_PRODUCERS" ]; then
    local need_to_stop=$((current_count - target_count))
    echo "  需要停止 $need_to_stop 个生产者"
    
    # 获取所有生产者PID，停止最后need_to_stop个
    local pids=$(ps aux | grep "round_robin_prefetch" | grep -v grep | awk '{print $2}' | tail -n "$need_to_stop")
    for pid in $pids; do
      kill -9 "$pid" 2>/dev/null && echo "  ✅ 已停止生产者 (PID: $pid)"
    done
  fi
}

# 主循环
while true; do
  echo ""
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') 检查 ==="
  
  current_producers=$(get_producer_count)
  min_cache=$(get_min_cache_count)
  avg_cache=$(get_avg_cache_count)
  
  echo "  当前生产者数量: $current_producers"
  echo "  最小缓存数量: $min_cache"
  echo "  平均缓存数量: $avg_cache"
  
  # 决策逻辑
  if [ "$min_cache" -lt "$LOW_CACHE_THRESHOLD" ] && [ "$current_producers" -lt "$MAX_PRODUCERS" ]; then
    # 缓存不足，增加生产者
    new_count=$((current_producers + 1))
    if [ "$new_count" -gt "$MAX_PRODUCERS" ]; then
      new_count=$MAX_PRODUCERS
    fi
    echo "  → 缓存不足（$min_cache < $LOW_CACHE_THRESHOLD），增加生产者到 $new_count"
    start_producers "$new_count"
  elif [ "$avg_cache" -gt "$HIGH_CACHE_THRESHOLD" ] && [ "$current_producers" -gt "$MIN_PRODUCERS" ]; then
    # 缓存充足，减少生产者
    new_count=$((current_producers - 1))
    if [ "$new_count" -lt "$MIN_PRODUCERS" ]; then
      new_count=$MIN_PRODUCERS
    fi
    echo "  → 缓存充足（$avg_cache > $HIGH_CACHE_THRESHOLD），减少生产者到 $new_count"
    stop_producers "$new_count"
  else
    echo "  → 缓存状态正常，保持当前生产者数量 $current_producers"
  fi
  
  echo "  等待 ${CHECK_INTERVAL}秒后下次检查..."
  sleep "$CHECK_INTERVAL"
done

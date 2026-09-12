#!/bin/bash
# run_parallel_download.sh — 生产者-消费者模型并行下载启动脚本
#
# 用法：
#   bash scripts/cdp/run_parallel_download.sh [科目列表]
#   示例：bash scripts/cdp/run_parallel_download.sh accounting tax strategy econlaw
#   默认：全部4个科目（会计、税法、战略、经济法）
#
# 工作流程：
#   1. 启动key生产者（预取所有科目的key，写入全局缓存）
#   2. 等待生产者预取20个key
#   3. 启动多个下载消费者（每个科目一个，从全局缓存读key下载）
#   4. 监控进度，全部完成后退出
#
# 注意：
#   - 生产者只控制Chrome取key，消费者只负责下载，互不干扰
#   - 全局key缓存：data/_workspace/_account/ep3/global_keycache.json
#   - 日志目录：data/_workspace/_account/ep3/logs/

set -eo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

WS="data/_workspace/_account/ep3"
GLOBAL_CACHE="$WS/global_keycache.json"
LOG_DIR="$WS/logs"
mkdir -p "$LOG_DIR"

# 科目配置：使用普通数组（兼容bash 3.2）
# 格式："科目名:profile名:梯度列表（空格分隔）"
SUBJECT_CONFIG=(
  "accounting:ep3-accounting-2026:基础必修 全面精讲"
  "tax:ep3-tax-2026:全面精讲"
  "strategy:ep3-strategy-2026:全面精讲"
  "econlaw:ep3-econlaw-2026:全面精讲"
)

# 解析参数
SELECTED_SUBJECTS=("$@")
if [ ${#SELECTED_SUBJECTS[@]} -eq 0 ]; then
  SELECTED_SUBJECTS=(accounting tax strategy econlaw)
fi

echo "=========================================="
echo "生产者-消费者模型并行下载"
echo "=========================================="
echo "科目: ${SELECTED_SUBJECTS[*]}"
echo "全局key缓存: $GLOBAL_CACHE"
echo "日志目录: $LOG_DIR"
echo ""

# 根据选中的科目筛选配置
SELECTED_CONFIG=()
for subject in "${SELECTED_SUBJECTS[@]}"; do
  for config in "${SUBJECT_CONFIG[@]}"; do
    config_subject=$(echo "$config" | cut -d: -f1)
    if [ "$config_subject" = "$subject" ]; then
      SELECTED_CONFIG+=("$config")
      break
    fi
  done
done

# ---------- 步骤1：启动key生产者 ----------
echo "[步骤1] 启动key生产者（预取所有科目的key）..."

# 构建生产者命令（遍历所有选中科目的所有梯度）
PRODUCER_CMD=""
for config in "${SELECTED_CONFIG[@]}"; do
  profile=$(echo "$config" | cut -d: -f2)
  stages=$(echo "$config" | cut -d: -f3)
  for stage in $stages; do
    PRODUCER_CMD="$PRODUCER_CMD node scripts/cdp/ep3_download_videos.js --profile $profile --stage $stage --dual-teacher --global-key-cache $GLOBAL_CACHE --prefetch-only >> $LOG_DIR/producer_${profile}_${stage}.log 2>&1;"
  done
done

# 生产者在后台运行（串行预取所有科目的key，避免Chrome冲突）
nohup bash -c "$PRODUCER_CMD" > "$LOG_DIR/producer_master.log" 2>&1 &
PRODUCER_PID=$!
echo "生产者PID: $PRODUCER_PID"
echo "生产者日志: $LOG_DIR/producer_master.log"
echo ""

# ---------- 步骤2：等待生产者预取20个key ----------
echo "[步骤2] 等待生产者预取20个key..."
PREFETCH_COUNT=0
WAIT_TIME=0
MAX_WAIT=600  # 最多等待10分钟

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
  if [ -f "$GLOBAL_CACHE" ]; then
    # 统计缓存中的key数量（排除_work字段）
    PREFETCH_COUNT=$(python3 -c "
import json
try:
    with open('$GLOBAL_CACHE') as f:
        cache = json.load(f)
    count = len([k for k in cache.keys() if k != '_work'])
    print(count)
except:
    print(0)
")
  fi
  
  echo "  已预取key: $PREFETCH_COUNT 个（等待20个，已等待 ${WAIT_TIME}s）"
  
  if [ "$PREFETCH_COUNT" -ge 20 ]; then
    echo "  ✓ 已预取20个key，可以启动消费者"
    break
  fi
  
  sleep 10
  WAIT_TIME=$((WAIT_TIME + 10))
done

if [ "$PREFETCH_COUNT" -lt 20 ]; then
  echo "  ⚠ 等待超时，当前只有 $PREFETCH_COUNT 个key，仍然启动消费者（会等待key）"
fi
echo ""

# ---------- 步骤3：启动下载消费者 ----------
echo "[步骤3] 启动下载消费者..."

CONSUMER_PIDS=()
for config in "${SELECTED_CONFIG[@]}"; do
  subject=$(echo "$config" | cut -d: -f1)
  profile=$(echo "$config" | cut -d: -f2)
  stages=$(echo "$config" | cut -d: -f3)
  
  # 每个科目启动一个消费者进程（串行处理该科目的所有梯度）
  CONSUMER_CMD=""
  for stage in $stages; do
    CONSUMER_CMD="$CONSUMER_CMD node scripts/cdp/ep3_download_videos.js --profile $profile --stage $stage --dual-teacher --global-key-cache $GLOBAL_CACHE --consumer >> $LOG_DIR/consumer_${profile}_${stage}.log 2>&1;"
  done
  
  nohup bash -c "$CONSUMER_CMD" > "$LOG_DIR/consumer_${subject}_master.log" 2>&1 &
  CONSUMER_PID=$!
  CONSUMER_PIDS+=($CONSUMER_PID)
  echo "  消费者[$subject] PID: $CONSUMER_PID"
  echo "  消费者[$subject] 日志: $LOG_DIR/consumer_${subject}_master.log"
done

echo ""
echo "=========================================="
echo "所有进程已启动"
echo "=========================================="
echo "生产者PID: $PRODUCER_PID"
echo "消费者PIDs: ${CONSUMER_PIDS[*]}"
echo ""
echo "监控命令："
echo "  tail -f $LOG_DIR/producer_master.log"
echo "  tail -f $LOG_DIR/consumer_accounting_master.log"
echo "  tail -f $LOG_DIR/consumer_tax_master.log"
echo ""
echo "查看进度："
echo "  全局key缓存: python3 -c \"import json; c=json.load(open('$GLOBAL_CACHE')); print('key数量:', len([k for k in c if k!='_work']))\""
echo "  会计视频数: find data/高顿/CPA/【VIPCPA专享】名师专业课-会计/原始资源/videos/ -name '*_video.mp4' | wc -l"
echo "  税法视频数: find data/高顿/CPA/【VIPCPA专享】名师专业课-税法/原始资源/videos/ -name '*_video.mp4' | wc -l"
echo ""
echo "停止所有进程："
echo "  kill $PRODUCER_PID ${CONSUMER_PIDS[*]}"
echo "=========================================="

# 等待所有消费者完成
echo ""
echo "[监控] 等待所有消费者完成..."
for pid in "${CONSUMER_PIDS[@]}"; do
  wait $pid
  echo "  消费者PID $pid 已完成"
done

# 等待生产者完成
echo "[监控] 等待生产者完成..."
wait $PRODUCER_PID
echo "  生产者PID $PRODUCER_PID 已完成"

echo ""
echo "=========================================="
echo "所有任务完成！"
echo "=========================================="

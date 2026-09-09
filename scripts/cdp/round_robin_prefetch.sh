#!/bin/bash
# round_robin_prefetch.sh — 轮询预取key生产者（支持n个科目，独立key缓存，动态轮询策略）
#
# 工作原理：
#   按轮询方式从每个科目预取key，然后切换到下一个科目
#   支持每个科目独立的key缓存，避免科目间竞争
#   支持动态轮询策略，优先为key缓存不足的科目预取
#
# 用法：
#   bash scripts/cdp/round_robin_prefetch.sh [科目列表]
#   示例：bash scripts/cdp/round_robin_prefetch.sh accounting tax strategy econlaw
#   默认：使用配置文件中的所有科目
#
# 配置文件：
#   config/ep3_subjects.json - 定义科目列表，支持n个科目
#   添加新科目时，只需在配置文件中添加，不需要修改本脚本
#
# 注意：
#   - 生产者只控制Chrome取key，消费者只负责下载，互不干扰
#   - 每个科目有独立的key缓存：data/_workspace/_account/ep3/keycache/<profile>.json
#   - 全局key缓存作为后备：data/_workspace/_account/ep3/global_keycache.json
#   - 日志目录：data/_workspace/_account/ep3/logs/
#   - 支持有老师信息（--dual-teacher）和无老师信息（单老师）的科目
#   - 动态轮询策略：优先为key缓存不足的科目预取，跳过key缓存充足的科目

set -eo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

WS="data/_workspace/_account/ep3"
CONFIG_FILE="config/ep3_subjects.json"
GLOBAL_CACHE="$WS/global_keycache.json"
CACHE_DIR="$WS/keycache"
LOG_DIR="$WS/logs"
mkdir -p "$LOG_DIR" "$CACHE_DIR"

# 从配置文件读取默认配置
PREFETCH_COUNT=$(jq -r '.prefetch_count // 8' "$CONFIG_FILE" 2>/dev/null || echo "8")
GLOBAL_CACHE=$(jq -r '.global_cache // "'"$GLOBAL_CACHE"'"' "$CONFIG_FILE" 2>/dev/null || echo "$GLOBAL_CACHE")
CACHE_DIR=$(jq -r '.cache_dir // "'"$CACHE_DIR"'"' "$CONFIG_FILE" 2>/dev/null || echo "$CACHE_DIR")
LOG_DIR=$(jq -r '.log_dir // "'"$LOG_DIR"'"' "$CONFIG_FILE" 2>/dev/null || echo "$LOG_DIR")
MIN_CACHE_THRESHOLD=$(jq -r '.min_cache_threshold // 20' "$CONFIG_FILE" 2>/dev/null || echo "20")
MAX_CACHE_THRESHOLD=$(jq -r '.max_cache_threshold // 100' "$CONFIG_FILE" 2>/dev/null || echo "100")

# 科目配置：从配置文件读取（支持n个科目）
# 格式："科目名:profile名:梯度列表（空格分隔）:是否双老师(1/0):独立缓存路径"
SUBJECT_CONFIG=()
if [ -f "$CONFIG_FILE" ]; then
  # 使用jq解析配置文件，生成科目配置数组
  while IFS= read -r config; do
    SUBJECT_CONFIG+=("$config")
  done < <(jq -r '.subjects[] | "\(.name):\(.profile):\(.stages | join(" ")):\(if (.teachers | length) > 0 then 1 else 0 end):\(.key_cache)"' "$CONFIG_FILE" 2>/dev/null)
  echo "✅ 从配置文件读取科目配置: ${#SUBJECT_CONFIG[@]}个科目"
else
  # 配置文件不存在时，使用默认配置（向后兼容）
  echo "⚠️ 配置文件不存在，使用默认配置"
  SUBJECT_CONFIG=(
    "accounting:ep3-accounting-2026:基础必修 全面精讲:1:$CACHE_DIR/ep3-accounting-2026.json"
    "tax:ep3-tax-2026:全面精讲:1:$CACHE_DIR/ep3-tax-2026.json"
    "strategy:ep3-strategy-2026:全面精讲:1:$CACHE_DIR/ep3-strategy-2026.json"
    "econlaw:ep3-econlaw-2026:全面精讲:1:$CACHE_DIR/ep3-econlaw-2026.json"
  )
fi

# 解析参数
SELECTED_SUBJECTS=("$@")
if [ ${#SELECTED_SUBJECTS[@]} -eq 0 ]; then
  # 默认使用配置文件中的所有科目
  SELECTED_SUBJECTS=($(jq -r '.subjects[].name' "$CONFIG_FILE" 2>/dev/null || echo "accounting tax strategy econlaw"))
fi

echo "=========================================="
echo "轮询预取key生产者（支持n个科目，独立缓存，动态轮询）"
echo "=========================================="
echo "科目: ${SELECTED_SUBJECTS[*]}"
echo "每轮预取key数量: $PREFETCH_COUNT"
echo "最低缓存阈值: $MIN_CACHE_THRESHOLD"
echo "最高缓存阈值: $MAX_CACHE_THRESHOLD"
echo "独立缓存目录: $CACHE_DIR"
echo "全局key缓存: $GLOBAL_CACHE"
echo "日志目录: $LOG_DIR"
echo "配置文件: $CONFIG_FILE"
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

# 函数：获取某个科目的key缓存数量
get_cache_count() {
  local cache_file="$1"
  if [ -f "$cache_file" ]; then
    python3 -c "
import json
try:
    with open('$cache_file') as f:
        c = json.load(f)
    keys = [k for k in c if k != '_work']
    print(len(keys))
except:
    print(0)
" 2>/dev/null || echo "0"
  else
    echo "0"
  fi
}

# 构建任务列表：每个科目+梯度组合为一个任务
# 格式："科目名:profile名:梯度名:总视频数:当前offset:是否双老师(1/0):独立缓存路径"
TASKS=()
for config in "${SELECTED_CONFIG[@]}"; do
  subject=$(echo "$config" | cut -d: -f1)
  profile=$(echo "$config" | cut -d: -f2)
  stages=$(echo "$config" | cut -d: -f3)
  dual_teacher=$(echo "$config" | cut -d: -f4)
  key_cache=$(echo "$config" | cut -d: -f5)
  
  # 构建--dual-teacher参数
  DUAL_TEACHER_FLAG=""
  if [ "$dual_teacher" = "1" ]; then
    DUAL_TEACHER_FLAG="--dual-teacher"
  fi
  
  for stage in $stages; do
    # 使用--list获取总视频数（根据是否双老师选择参数）
    total=$(node scripts/cdp/ep3_download_videos.js --profile "$profile" --stage "$stage" $DUAL_TEACHER_FLAG --list 2>/dev/null | grep -c "^\s*[0-9]" || echo "0")
    cache_count=$(get_cache_count "$key_cache")
    echo "[$subject/$stage] 总视频数: $total (双老师: $dual_teacher, 缓存: $cache_count)"
    TASKS+=("$subject:$profile:$stage:$total:0:$dual_teacher:$key_cache")
  done
done

echo ""
echo "=========================================="
echo "开始轮询预取key（动态轮询策略）"
echo "=========================================="

# 轮询循环
ROUND=0
while true; do
  ROUND=$((ROUND + 1))
  ALL_DONE=1
  PROGRESS_MSG=""
  SKIPPED_MSG=""
  
  # 动态轮询策略：先检查每个任务的缓存数量，按缓存数量排序（缓存少的优先）
  # 构建优先级列表
  PRIORITY_TASKS=()
  for i in "${!TASKS[@]}"; do
    IFS=':' read -r subject profile stage total offset dual_teacher key_cache <<< "${TASKS[$i]}"
    
    # 检查是否已完成
    if [ "$offset" -ge "$total" ]; then
      continue
    fi
    
    # 获取缓存数量
    cache_count=$(get_cache_count "$key_cache")
    
    # 按缓存数量排序（缓存少的优先）
    PRIORITY_TASKS+=("$cache_count:$i")
  done
  
  # 排序（缓存少的优先）
  IFS=$'\n' PRIORITY_TASKS=($(sort -t: -k1 -n <<<"${PRIORITY_TASKS[*]}"))
  unset IFS
  
  # 按优先级处理任务
  for priority_item in "${PRIORITY_TASKS[@]}"; do
    i=$(echo "$priority_item" | cut -d: -f2)
    IFS=':' read -r subject profile stage total offset dual_teacher key_cache <<< "${TASKS[$i]}"
    
    # 检查是否已完成
    if [ "$offset" -ge "$total" ]; then
      PROGRESS_MSG="$PROGRESS_MSG [$subject/$stage: 完成]"
      continue
    fi
    
    ALL_DONE=0
    
    # 动态轮询策略：检查缓存数量
    cache_count=$(get_cache_count "$key_cache")
    
    # 如果缓存数量已经超过最高阈值，暂时跳过（避免缓存过多）
    if [ "$cache_count" -ge "$MAX_CACHE_THRESHOLD" ]; then
      SKIPPED_MSG="$SKIPPED_MSG [$subject/$stage: 跳过(缓存$cache_count)]"
      continue
    fi
    
    # 预取key（数量从配置文件读取）
    # 计算实际预取数量（不超过剩余数量）
    REMAINING=$((total - offset))
    if [ "$REMAINING" -lt "$PREFETCH_COUNT" ]; then
      ACTUAL_PREFETCH=$REMAINING
    else
      ACTUAL_PREFETCH=$PREFETCH_COUNT
    fi
    
    # 构建--dual-teacher参数
    DUAL_TEACHER_FLAG=""
    if [ "$dual_teacher" = "1" ]; then
      DUAL_TEACHER_FLAG="--dual-teacher"
    fi
    
    echo ""
    echo "--- 第${ROUND}轮: $subject/$stage (第$((offset + 1))-$((offset + ACTUAL_PREFETCH))/$total个，共$ACTUAL_PREFETCH个，当前缓存:$cache_count) ---"
    
    # CDP连接重试机制（最多重试3次，每次间隔5秒）
    PREFETCH_SUCCESS=0
    for RETRY in 1 2 3; do
      if node scripts/cdp/ep3_download_videos.js \
        --profile "$profile" \
        --stage "$stage" \
        $DUAL_TEACHER_FLAG \
        --global-key-cache "$key_cache" \
        --prefetch-only \
        --offset "$offset" \
        --limit "$ACTUAL_PREFETCH" \
        >> "$LOG_DIR/round_robin_${subject}_${stage}.log" 2>&1; then
        PREFETCH_SUCCESS=1
        break
      else
        echo "  ✗ 预取失败（第$RETRY次），5秒后重试..."
        sleep 5
      fi
    done
    
    if [ "$PREFETCH_SUCCESS" -eq 1 ]; then
      echo "  ✓ 预取成功 ($ACTUAL_PREFETCH个)"
      # 更新offset
      new_offset=$((offset + ACTUAL_PREFETCH))
      TASKS[$i]="$subject:$profile:$stage:$total:$new_offset:$dual_teacher:$key_cache"
      new_cache_count=$(get_cache_count "$key_cache")
      PROGRESS_MSG="$PROGRESS_MSG [$subject/$stage: $new_offset/$total (缓存:$new_cache_count)]"
    else
      echo "  ✗ 预取失败（已重试3次），下一轮重试..."
      # 失败时不更新offset，下一轮重试
      PROGRESS_MSG="$PROGRESS_MSG [$subject/$stage: $offset/$total (失败)]"
    fi
  done

  echo ""
  echo "=== 第${ROUND}轮完成 ==="
  echo "进度:$PROGRESS_MSG"
  if [ -n "$SKIPPED_MSG" ]; then
    echo "跳过:$SKIPPED_MSG"
  fi

  # 检查是否全部完成
  if [ "$ALL_DONE" -eq 1 ]; then
    echo ""
    echo "=========================================="
    echo "所有科目的key已全部预取完成！"
    echo "总轮数: $ROUND"
    echo "=========================================="
    break
  fi

  # 短暂休息，避免Chrome过载
  sleep 1
done

echo ""
echo "轮询预取生产者退出"

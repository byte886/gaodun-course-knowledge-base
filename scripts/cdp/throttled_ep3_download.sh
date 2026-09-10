#!/usr/bin/env bash
# throttled_ep3_download.sh — EP3 名师课视频「节流下载」调度器（白天防风控 + 给前台/豆包留资源余量）
#
# 设计动机：
#   - 6 路消费者齐发 × 每路 64 分片并发会把网络/磁盘打满，挤掉豆包与后端的通信，表现为豆包卡死；
#     且业务网关取 key 接口密度过高有风控风险（视频分片本身走 CDN，带宽大小不是风控点）。
#   - 本脚本：只起 1 个生产者「串行」预取 key（全进程只有它操作 Chrome，避免多进程抢播放页），
#     消费者纯 --consumer 模式只从缓存读 key 下载、不碰 Chrome；消费者同时在跑的路数受 MAX_PARALLEL 限制；
#     所有子进程统一 nice -n 20 + taskpolicy -c utility 降到后台调度类，前台 App（豆包/Chrome）需要资源时立即让出。
#   - 分片并发的分时段自适应在 ep3_download_videos.js 内（白天 12 / 夜间 64），本脚本不重复控制。
#
# 用法：
#   bash scripts/cdp/throttled_ep3_download.sh                # 跑下方默认队列（未完成的科目/阶段）
#   MAX_PARALLEL=2 bash scripts/cdp/throttled_ep3_download.sh # 覆盖同时在跑的消费者路数
#
# 断点续跑：消费者对已存在的视频会跳过，可随时中断重跑。

set -o pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

WS="data/_workspace/_account/ep3"
LOG_DIR="$WS/logs"
KC_DIR="$WS/keycache"
mkdir -p "$LOG_DIR" "$KC_DIR"

# 同时在跑的消费者路数（白天默认 3，给网络/磁盘/豆包留余量；夜间想提速可 MAX_PARALLEL=6 重跑）
MAX_PARALLEL="${MAX_PARALLEL:-3}"

# 防 Mac 空闲睡眠导致下载「零报错静默停摆」（与 run_ep3_videos_supervised 同源教训：曾停摆 8h 仅落 36/261）。
# caffeinate -i -w $$：本调度器进程存活期间阻止空闲睡眠，脚本退出后 caffeinate 自动结束，无需手工清理。
if command -v caffeinate >/dev/null 2>&1; then
  caffeinate -i -w $$ &
fi

# 消费者任务队列：profile|阶段|日志后缀（全面精讲 485 已下完故不入队；需要完整性自检时可加回）
# 顺序即优先级：会计正课三阶段优先，其后税/战略/经济法
TASKS=(
  "ep3-accounting-2026|基础必修|accounting_基础必修"
  "ep3-accounting-2026|重点强化|accounting_重点强化"
  "ep3-accounting-2026|考前冲刺|accounting_考前冲刺"
  "ep3-tax-2026|全面精讲|tax"
  "ep3-strategy-2026|全面精讲|strategy"
  "ep3-econlaw-2026|全面精讲|econlaw"
)

# 后台降级包装：CPU nice 最低 + macOS utility 调度类（IO/CPU 均让位于前台）
low() { nice -n 20 taskpolicy -c utility "$@"; }

echo "=========================================="
echo "EP3 节流下载调度器  启动 $(date '+%F %T')"
echo "同时在跑消费者上限: $MAX_PARALLEL"
echo "=========================================="

# 1) 启动唯一生产者：轮询四科全部阶段、串行预取 key（只有它操作 Chrome）
low bash scripts/cdp/round_robin_prefetch.sh accounting tax strategy econlaw \
  >> "$LOG_DIR/round_robin_all.log" 2>&1 &
PRODUCER_PID=$!
echo "生产者已启动 PID=${PRODUCER_PID}（轮询预取 key）"

# 2) 限流消费者：在跑数达到上限就等待，结束一个补一个
run_consumer() {
  local profile="$1" stage="$2" tag="$3"
  # 缓存按「profile×阶段」独立：与生产者 round_robin_prefetch.sh 的 stage_cache 命名一致，
  # 避免同一 profile 多阶段共享一个缓存、被先跑阶段的缓存总条数连带饿死。
  local cache="$KC_DIR/${profile}__${stage}.json"
  local log="$LOG_DIR/consumer_${tag}.log"
  echo "[$(date '+%T')] 启动消费者 $profile/$stage"
  low node scripts/cdp/ep3_download_videos.js \
    --profile "$profile" --stage "$stage" --dual-teacher \
    --consumer --global-key-cache "$cache" >> "$log" 2>&1
  echo "[$(date '+%T')] 消费者结束 $profile/$stage"
}

# 只统计「消费者」存活数（绝不能把生产者后台 job 算进去，否则会误顶满上限卡死）
CONSUMER_PIDS=()
consumer_running() {
  local n=0 pid
  for pid in "${CONSUMER_PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then n=$((n + 1)); fi
  done
  echo "$n"
}

for t in "${TASKS[@]}"; do
  IFS='|' read -r profile stage tag <<< "$t"
  # 在跑消费者达到上限就等，某路结束（kill -0 失效）后补下一路
  while [ "$(consumer_running)" -ge "$MAX_PARALLEL" ]; do sleep 5; done
  run_consumer "$profile" "$stage" "$tag" &
  CONSUMER_PIDS+=($!)
  sleep 8   # 错峰启动，避免同时初始化抢资源/抢 Chrome
done

# 3) 只等所有「消费者」收尾（生产者不在此列）
for pid in "${CONSUMER_PIDS[@]}"; do wait "$pid" 2>/dev/null || true; done
echo "[$(date '+%T')] 全部消费者结束"

# 4) 消费者全部完成后停掉生产者（它是 while-true 轮询）
kill "$PRODUCER_PID" 2>/dev/null || true
pkill -f round_robin_prefetch 2>/dev/null || true
echo "=========================================="
echo "EP3 节流下载调度器  全部完成 $(date '+%F %T')"
echo "=========================================="

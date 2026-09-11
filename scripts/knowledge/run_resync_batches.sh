#!/usr/bin/env bash
# 分批换新进程跑 resync_wiki_content.py，规避豆包转发代理层（DOUBAO_OFFICE_FORWARD_PROXY）
# 的两层限流（2026-09-12 会计 169 篇终查）：
#   第一层 单进程累计请求：累计到阈值时代理返回 invalid_response（非 JSON、以 e 开头），
#       全新 python 进程计数从零、立即恢复。故每轮新进程只新写 MAX_NEW 篇就主动退出、换新进程。
#   第二层 外层 shell 凭证老化 / 代理累计：一个 nohup【外层 shell】持续跑，其 fork 的子进程会
#       继承逐渐老化的代理会话，实测健康窗口约 3 轮（24 篇、6~7 分钟），之后换新 python 进程也
#       零新增；必须由【全新登录 shell】重开整个外层才立即恢复。故加 MAX_ROUNDS：单个外层最多
#       跑 N 轮（实测建议 3）就主动退出，由上层（人/AI 用新 Bash、或 cron）用全新 shell 重拉，
#       done 断点无缝续跑。会计 169 篇第三遍即按"每外层 3 轮→换新 shell"约 6 分钟一个外层收敛。
# 断点：每篇成功落 resync_done/<safe>.done，换新进程/新外层秒跳过已完成，可任意中断/重入。
#
# 用法: bash run_resync_batches.sh [profile] [每轮新写上限] [轮间基础休眠秒] [总篇数] [零新增退避封顶秒] [单外层最多轮数]
set -u
PROFILE=${1:-cpa-accounting-2026}
MAX_NEW=${2:-8}
PAUSE=${3:-90}
TOTAL=${4:-169}

WS="data/_workspace/$PROFILE"
DONE_DIR="$WS/logs/resync_done"
LOG="$WS/logs/resync_wiki.log"
export GAODUN_COURSE_PROFILE="$PROFILE"

round=0
empty=0  # 连续零新增轮数：深限流时休眠指数递增，有任意新增即归零
EMPTY_CAP=${5:-900}  # 零新增退避封顶秒
MAX_ROUNDS=${6:-3}  # 单个外层最多跑几轮后主动退出（0=不限）；防外层 shell 凭证老化，实测建议 3
while :; do
  d=$(ls "$DONE_DIR" 2>/dev/null | wc -l | tr -d ' ')
  round=$((round + 1))
  echo "" >> "$LOG"
  echo "######### 批次轮次 $round 起 done=$d/$TOTAL $(date '+%T') #########" >> "$LOG"
  if [ "$d" -ge "$TOTAL" ]; then
    echo "######### 全部 $TOTAL 篇完成，批次循环结束 $(date '+%T') #########" >> "$LOG"
    break
  fi
  # 进程内不再分批（BATCH 大、PAUSE 0），由 RESYNC_MAX_NEW 控制新进程写多少；
  # 进程内连续 2 败的递增冷却只作兜底（120s 起、300s 封顶），换新进程才是主手段。
  RESYNC_MAX_NEW="$MAX_NEW" \
  RESYNC_INTERVAL=5 \
  RESYNC_BATCH_SIZE=10000 RESYNC_BATCH_PAUSE=0 \
  RESYNC_WINDOW_COOLDOWN=120 RESYNC_WINDOW_CAP=300 \
    python3 scripts/knowledge/resync_wiki_content.py >> "$LOG" 2>&1
  nd=$(ls "$DONE_DIR" 2>/dev/null | wc -l | tr -d ' ')
  gain=$((nd - d))
  echo "--------- 轮次 $round 止 done=$nd/$TOTAL 本轮新增$gain $(date '+%T') ---------" >> "$LOG"
  if [ "$nd" -ge "$TOTAL" ]; then
    echo "######### 全部 $TOTAL 篇完成，批次循环结束 $(date '+%T') #########" >> "$LOG"
    break
  fi
  # 外层寿命：达到 MAX_ROUNDS 主动退出，交全新登录 shell 重开（规避第二层凭证老化）
  if [ "$MAX_ROUNDS" -gt 0 ] && [ "$round" -ge "$MAX_ROUNDS" ]; then
    echo "######### 外层达寿命 ${MAX_ROUNDS} 轮主动退出，请用全新 shell 重开本脚本续跑 $(date '+%T') #########" >> "$LOG"
    break
  fi
  # 按本轮新增量决定休眠：写满=健康短休；没写满=中途限流加倍休；
  # 连续零新增=深限流，休眠指数递增(PAUSE*2^empty)封顶 EMPTY_CAP，有任意新增即归零
  if [ "$gain" -ge "$MAX_NEW" ]; then
    empty=0
    sleep "$PAUSE"
  elif [ "$gain" -le 0 ]; then
    empty=$((empty + 1))
    w=$((PAUSE * (2 ** empty)))
    [ "$w" -gt "$EMPTY_CAP" ] && w=$EMPTY_CAP
    echo "  连续${empty}轮零新增(深限流)，递增休眠 ${w}s" >> "$LOG"
    sleep "$w"
  else
    empty=0
    echo "  本轮未写满(代理中途限流)，加倍休眠 $((PAUSE * 2))s" >> "$LOG"
    sleep $((PAUSE * 2))
  fi
done

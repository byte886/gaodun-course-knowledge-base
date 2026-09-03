#!/bin/bash
# transcribe_parallel.sh — FunASR 多进程并发转写，任务队列式动态调度。
# 原理：把待转写讲列表写入队列文件，N 个 worker 用 flock 互斥取第一个空闲任务，
# 处理完再取下一个（哪个 worker 快就多处理，天然负载均衡）；失败的讲自动写回队列尾部重试。
# 单进程实测约占 2 核 / 3.3GB，本机 20 线程 128GB，默认并发 6（约 12 核，留余量给 IO/系统）。
# 用法: bash scripts/transcribe_parallel.sh [并发数N]   # 默认 6
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY="$ROOT/transcription/venv/bin/python"
PIPE="$ROOT/scripts/transcribe_pipeline.py"
COURSE="$HOME/Desktop/高顿/CPA/课程库/【26考季】VIPCPA系列-税法（蔡俊峻老师）"
WORK="$ROOT/transcription/.parallel_work"
QUEUE="$WORK/pending.txt"; QLOCK="$WORK/pending.lock"
LOGDIR="$WORK/logs"; MAINLOG="$WORK/parallel.log"
mkdir -p "$WORK" "$LOGDIR"
N="${1:-6}"

# 生成待转写队列：有 video.mp4 且无 >1000 字 transcript 的讲
: > "$QUEUE"
shopt -s nullglob
for d in "$COURSE"/[0-9][0-9]_*; do
  [ -f "$d/video.mp4" ] || continue
  if [ -f "$d/transcript.md" ] && [ "$(wc -m < "$d/transcript.md")" -gt 1000 ]; then continue; fi
  echo "$d" >> "$QUEUE"
done
TOTAL=$(wc -l < "$QUEUE")
echo "==== 并发转写开始 $(date '+%F %T') 待转写 $TOTAL 讲 并发 $N ====" | tee "$MAINLOG"

take_task() {  # flock 取队列首行，空则返回空
  local line=""
  exec 9<>"$QLOCK"; flock -x 9
  line=$(head -1 "$QUEUE" 2>/dev/null || true)
  if [ -n "$line" ]; then tail -n +2 "$QUEUE" > "${QUEUE}.tmp" 2>/dev/null && mv "${QUEUE}.tmp" "$QUEUE"; fi
  flock -u 9; exec 9>&-
  printf '%s' "$line"
}
requeue() {  # 失败写回队列尾部
  exec 9<>"$QLOCK"; flock -x 9; echo "$1" >> "$QUEUE"; flock -u 9; exec 9>&-
}
process_one() {
  local d="$1" wid="$2"; local prefix; prefix=$(basename "$d" | cut -c1-2)
  local tmp="$WORK/w${wid}_${prefix}"; rm -rf "$tmp"; mkdir -p "$tmp"
  if "$PY" "$PIPE" "$d/video.mp4" "$tmp" > "$LOGDIR/w${wid}_${prefix}.log" 2>&1 \
     && [ -f "$tmp/video/transcript.md" ]; then
    cp "$tmp/video/transcript.md" "$d/transcript.md"
    cp "$tmp/video/transcript.json" "$d/transcript.json" 2>/dev/null || true
    rm -rf "$tmp"
    echo "[$wid] ✓ $(basename "$d") ($(wc -m < "$d/transcript.md")字)" | tee -a "$MAINLOG"; return 0
  fi
  rm -rf "$tmp"
  echo "[$wid] ✗ $(basename "$d")" | tee -a "$MAINLOG"; return 1
}
worker() {
  local wid="$1"
  while true; do
    local d; d=$(take_task)
    [ -z "$d" ] && break
    process_one "$d" "$wid" || requeue "$d"
  done
}
for i in $(seq 1 "$N"); do worker "$i" & done
wait
DONE=$(find "$COURSE" -maxdepth 2 -name transcript.md -size +1000c 2>/dev/null | wc -l)
echo "==== 并发转写结束 $(date '+%F %T') 课程库成品 $DONE 份 ====" | tee -a "$MAINLOG"

#!/bin/bash
# transcribe_qvideos.sh — 题目级讲解视频并发转写（FunASR，队列动态调度）
# 与 transcribe_parallel.sh 的区别：对象是 data/sprint-videos/题目级讲解/qvideo_*/video.mp4，
# 临时目录用 vid8 唯一化（transcribe_one.sh 取首段前缀会都变成 qvideo 而撞车）。
# 用法: bash scripts/transcribe_qvideos.sh [并发数N]   # 默认 6（本机20逻辑核/128G，单进程约2核3.3G）
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY="$ROOT/transcription/venv/bin/python"
PIPE="$ROOT/scripts/transcribe_pipeline.py"
SRC="$ROOT/data/sprint-videos/题目级讲解"
WORK="$ROOT/transcription/.qv_work"
QUEUE="$WORK/pending.txt"; LOCKDIR="$WORK/pending.lock.d"
LOGDIR="$WORK/logs"; MAINLOG="$WORK/parallel.log"
mkdir -p "$WORK" "$LOGDIR"
N="${1:-6}"
rm -rf "$LOCKDIR"   # 启动时清残留锁

: > "$QUEUE"
shopt -s nullglob
for d in "$SRC"/qvideo_*/; do
  [ -f "$d/video.mp4" ] || continue
  if [ -f "$d/transcript.md" ] && [ "$(wc -m < "$d/transcript.md")" -gt 1000 ]; then continue; fi
  echo "$d" >> "$QUEUE"
done
TOTAL=$(wc -l < "$QUEUE" | tr -d ' ')
echo "==== 题目级并发转写开始 $(date '+%F %T') 待转 $TOTAL 并发 $N ====" | tee "$MAINLOG"

# macOS 无 flock，用 mkdir 原子性实现互斥锁（同一时刻仅一个 mkdir 成功）
lock_acquire(){ while ! mkdir "$LOCKDIR" 2>/dev/null; do sleep 0.05; done; }
lock_release(){ rmdir "$LOCKDIR" 2>/dev/null||true; }
take_task(){ local line=""; lock_acquire
  line=$(head -1 "$QUEUE" 2>/dev/null||true)
  if [ -n "$line" ]; then tail -n +2 "$QUEUE">"${QUEUE}.tmp" 2>/dev/null && mv "${QUEUE}.tmp" "$QUEUE"; fi
  lock_release; printf '%s' "$line"; }
requeue(){ lock_acquire; echo "$1">>"$QUEUE"; lock_release; }

process_one(){
  local d="$1" wid="$2"; local tag; tag=$(basename "$d")
  local tmp="$WORK/w${wid}_${tag}"; rm -rf "$tmp"; mkdir -p "$tmp"
  if "$PY" "$PIPE" "$d/video.mp4" "$tmp" > "$LOGDIR/${tag}.log" 2>&1 \
     && [ -f "$tmp/video/transcript.md" ]; then
    cp "$tmp/video/transcript.md" "$d/transcript.md"
    cp "$tmp/video/transcript.json" "$d/transcript.json" 2>/dev/null||true
    rm -rf "$tmp"
    echo "[$wid] ✓ $tag ($(wc -m < "$d/transcript.md")字)" | tee -a "$MAINLOG"; return 0
  fi
  rm -rf "$tmp"; echo "[$wid] ✗ $tag (见 $LOGDIR/${tag}.log)" | tee -a "$MAINLOG"; return 1
}
worker(){ local wid="$1"; while true; do local d; d=$(take_task); [ -z "$d" ]&&break
  process_one "$d" "$wid"||requeue "$d"; done; }
for i in $(seq 1 "$N"); do worker "$i"& done
wait
echo "==== 结束 $(date '+%F %T') ====" | tee -a "$MAINLOG"
ls "$SRC"/qvideo_*/transcript.md 2>/dev/null | wc -l | xargs echo "已生成 transcript 数:"

#!/bin/bash
# transcribe_all_gguf.sh — 用 funasr-llama-cpp (GGUF q8) 批量转写课程视频
# 替代 transcribe_all.sh (PyTorch版)，提速约30-100%，rtf更稳定，零Python依赖
#
# 用法: bash scripts/transcribe_all_gguf.sh
# 断点续传：讲目录已有 transcript.md 且 >1000 字自动跳过
# 输出：每讲目录下 transcript.md (纯文本) + transcript.json (简单结构化)
#
# 依赖：ffmpeg, llama-funasr-sensevoice (已编译在 transcription/.gguf_test/)
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COURSE="$HOME/Desktop/高顿/CPA/课程库/【26考季】VIPCPA系列-税法（蔡俊峻老师）"

# GGUF 运行时和模型路径
GGUF_DIR="$ROOT/transcription/.gguf_test"
BIN="$GGUF_DIR/FunASR/runtime/llama.cpp/build/bin/llama-funasr-sensevoice"
MODEL="$GGUF_DIR/gguf/sensevoice-small-q8.gguf"
VAD="$GGUF_DIR/gguf/fsmn-vad.gguf"

TMPROOT="$ROOT/transcription/.tmp_gguf"
LOG=/tmp/transcribe_all_gguf.log

# 前置检查
if [ ! -x "$BIN" ]; then
  echo "ERROR: llama-funasr-sensevoice 不存在: $BIN"
  echo "请先编译: cd $GGUF_DIR/FunASR/runtime/llama.cpp && cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j"
  exit 1
fi
if [ ! -f "$MODEL" ]; then
  echo "ERROR: 模型不存在: $MODEL"
  exit 1
fi

mkdir -p "$TMPROOT"
echo "==== GGUF批量转写开始 $(date '+%F %T') ====" | tee "$LOG"
echo "二进制: $BIN" | tee -a "$LOG"
echo "模型: $MODEL" | tee -a "$LOG"

ok=0; skip=0; fail=0
failed_list=()

shopt -s nullglob
for d in "$COURSE"/[0-9][0-9]_*; do
  name="$(basename "$d")"
  v="$d/video.mp4"
  out="$d/transcript.md"

  # 断点续传：已有合格转写跳过
  if [ -f "$out" ] && [ "$(wc -m < "$out")" -gt 1000 ]; then
    echo "[$name] 已有转写，跳过"
    skip=$((skip+1))
    continue
  fi

  # 无视频跳过
  if [ ! -f "$v" ]; then
    echo "[$name] 无 video.mp4，跳过"
    fail=$((fail+1))
    failed_list+=("$name")
    continue
  fi

  tmp="$TMPROOT/${name:0:2}"
  rm -rf "$tmp"
  mkdir -p "$tmp"

  echo "------ [$name] 转写 $(date '+%T') ------" | tee -a "$LOG"

  # 1. 提取 16kHz 单声道 WAV
  if ! ffmpeg -y -i "$v" -vn -acodec pcm_s16le -ar 16000 -ac 1 "$tmp/audio.wav" 2>/dev/null; then
    echo "[$name] ✗ 音频提取失败" | tee -a "$LOG"
    fail=$((fail+1))
    failed_list+=("$name")
    continue
  fi
  if [ ! -s "$tmp/audio.wav" ]; then
    echo "[$name] ✗ 音频文件为空" | tee -a "$LOG"
    fail=$((fail+1))
    failed_list+=("$name")
    continue
  fi

  # 获取音频时长
  duration=$(ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$tmp/audio.wav" 2>/dev/null)
  duration_int=${duration%.*}

  # 2. GGUF 转写（stdout=文本, stderr=日志）
  t0=$(date +%s)
  "$BIN" -m "$MODEL" --vad "$VAD" -a "$tmp/audio.wav" \
    > "$tmp/transcript_raw.txt" \
    2>"$tmp/transcribe_stderr.log"
  t1=$(date +%s)
  elapsed=$((t1-t0))

  # 3. 后处理：清理文本（去除可能的日志行、空行、合并）
  if [ -s "$tmp/transcript_raw.txt" ]; then
    # 过滤掉 [sensevoice] 开头的日志行（保险起见，虽然应该都在stderr）
    grep -v '^\[sensevoice\]' "$tmp/transcript_raw.txt" | \
      tr -d '\r' | \
      sed '/^[[:space:]]*$/d' | \
      tr '\n' ' ' | \
      sed 's/  */ /g; s/^ //; s/ $//' \
      > "$tmp/transcript.md"

    char_count=$(wc -m < "$tmp/transcript.md" | tr -d ' ')

    if [ "$char_count" -lt 100 ]; then
      echo "[$name] ✗ 转写文本过短(${char_count}字)，可能失败" | tee -a "$LOG"
      echo "  stderr 末尾:" | tee -a "$LOG"
      tail -5 "$tmp/transcribe_stderr.log" | tee -a "$LOG"
      fail=$((fail+1))
      failed_list+=("$name")
      continue
    fi

    # 4. 生成简单 JSON（兼容现有 transcript.json 格式）
    # 用 python 生成安全的 JSON（避免 sed 转义问题）
    /usr/bin/python3 -c "
import json, sys
text = open('$tmp/transcript.md', 'r').read()
data = {'text': text, 'engine': 'funasr-llama-cpp-gguf-q8', 'duration_seconds': $duration_int, 'elapsed_seconds': $elapsed}
print(json.dumps(data, ensure_ascii=False, indent=2))
" > "$tmp/transcript.json" 2>/dev/null

    # 5. 拷回讲目录
    cp "$tmp/transcript.md" "$d/transcript.md"
    cp "$tmp/transcript.json" "$d/transcript.json"

    # 计算 rtf
    if [ "$duration_int" -gt 0 ] 2>/dev/null; then
      rtf=$(echo "scale=3; $elapsed / $duration_int" | bc 2>/dev/null || echo "?")
      speed=$(echo "scale=1; $duration_int / $elapsed" | bc 2>/dev/null || echo "?")
      echo "[$name] ✓ 完成 耗时${elapsed}s 音频${duration_int}s rtf=${rtf} ${speed}x实时 ${char_count}字" | tee -a "$LOG"
    else
      echo "[$name] ✓ 完成 耗时${elapsed}s ${char_count}字" | tee -a "$LOG"
    fi
    ok=$((ok+1))
  else
    echo "[$name] ✗ 转写输出为空 耗时${elapsed}s" | tee -a "$LOG"
    echo "  stderr 末尾:" | tee -a "$LOG"
    tail -5 "$tmp/transcribe_stderr.log" | tee -a "$LOG"
    fail=$((fail+1))
    failed_list+=("$name")
  fi

  # 清理临时目录（释放空间）
  rm -rf "$tmp"
done

echo "" | tee -a "$LOG"
echo "==== GGUF批量转写完成 $(date '+%T') ====" | tee -a "$LOG"
echo "成功: $ok  跳过: $skip  失败: $fail" | tee -a "$LOG"
if [ ${#failed_list[@]} -gt 0 ]; then
  echo "失败列表:" | tee -a "$LOG"
  for f in "${failed_list[@]}"; do echo "  - $f" | tee -a "$LOG"; done
fi
echo "日志: $LOG"

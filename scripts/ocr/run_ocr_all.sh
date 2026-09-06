#!/bin/bash
# run_ocr_all.sh — 批量 OCR 课程库全部讲义 PDF（串行，逐个调 batch_ocr.sh）
# 每处理一个 PDF 前清空 /tmp/gaodun_ocr_pages，避免不同 PDF 的分页断点缓存串用。
# 输出：每讲 docs/<x>.pdf -> docs_text/<x>_OCR.md；已存在且非空则跳过。
# 用法：bash scripts/ocr/run_ocr_all.sh [--dry]
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# 加载课程配置（环境变量可覆盖默认值）
source "$ROOT/scripts/course_config.sh"
COURSE="$COURSE_DESKTOP_ROOT"
DRY=0; [ "${1:-}" = "--dry" ] && DRY=1
TODO=0; SKIP=0
find "$COURSE" -path "*/docs/*.pdf" -print0 | while IFS= read -r -d '' pdf; do
  lecture="$(dirname "$(dirname "$pdf")")"
  base="$(basename "$pdf" .pdf)"
  txdir="$lecture/docs_text"
  out="$txdir/${base}_OCR.md"
  if [ -s "$out" ]; then echo "[已有] $base"; SKIP=$((SKIP+1)); continue; fi
  # 跳过早期手动命名的重复件（课件_* 均有对应的 catalog 标准件）
  if [[ "$base" == 课件_* ]]; then echo "[跳过重复旧件] $base"; continue; fi
  echo "[待OCR] $(basename "$lecture")/docs/$base.pdf"
  TODO=$((TODO+1))
  if [ "$DRY" -eq 0 ]; then
    rm -rf /tmp/gaodun_ocr_pages
    mkdir -p "$txdir"
    echo "==== OCR 开始：$base $(date '+%H:%M:%S') ===="
    bash "$ROOT/scripts/batch_ocr.sh" "$pdf" "$txdir"
    echo "==== OCR 结束：$base -> $out $(date '+%H:%M:%S') ===="
  fi
done
if [ "$DRY" -eq 1 ]; then echo "（--dry 仅列出计划，未实际 OCR）"; fi

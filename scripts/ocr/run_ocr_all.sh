#!/bin/bash
# run_ocr_all.sh — 批量 OCR 一门课「原始资源/notes」下全部讲义 PDF（串行、单实例，逐个调 batch_ocr.sh）
#
# 现行范式（会计/税法一致）：
#   PDF：原始资源/notes/<NN_讲名>/<title>.pdf
#   输出：同目录 <title>_OCR.md（batch_ocr.sh 不传输出目录即默认同目录）；已存在且非空则跳过。
#
# 单实例约束：batch_ocr.sh 使用固定临时目录 /tmp/gaodun_ocr_pages，禁止两本同时 OCR（会串分页缓存）。
# 错峰：以 nice -n19 低优先级运行，把 CPU 优先让给视频压缩/转写；视频动态调度器采样会把 ocr_vision 计入占用。
# 课程选择走 profile（见 course_config.sh），默认税法：
#   COURSE_PROFILE=cpa-accounting-2026 bash scripts/ocr/run_ocr_all.sh [--dry]
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=/dev/null
source "$ROOT/scripts/course_config.sh"
COURSE="$COURSE_LOCAL_ROOT"
NOTES="$COURSE/原始资源/notes"
DRY=0; [ "${1:-}" = "--dry" ] && DRY=1

if [ ! -d "$NOTES" ]; then echo "[run_ocr] notes 目录不存在: $NOTES" >&2; exit 1; fi
if [ ! -x /tmp/ocr_vision ]; then
  echo "[run_ocr] /tmp/ocr_vision 不存在，请先编译一次：" >&2
  echo "  swiftc -framework Vision -framework AppKit -framework CoreGraphics $ROOT/scripts/ocr/ocr_vision.swift -o /tmp/ocr_vision" >&2
  exit 1
fi
TODO=0; SKIP=0
# -print0 / sort -z 兼容中文与特殊字符，并按讲次前缀顺序处理
find "$NOTES" -name '*.pdf' -print0 | sort -z | while IFS= read -r -d '' pdf; do
  out="${pdf%.pdf}_OCR.md"
  if [ -s "$out" ]; then echo "[已有] ${pdf#"$NOTES"/}"; SKIP=$((SKIP+1)); continue; fi
  TODO=$((TODO+1))
  echo "[待OCR] ${pdf#"$NOTES"/}"
  if [ "$DRY" -eq 0 ]; then
    rm -rf /tmp/gaodun_ocr_pages   # 每本清空分页断点缓存，避免跨 PDF 串用
    echo "==== OCR 开始：$(basename "$pdf") $(date '+%H:%M:%S') ===="
    if nice -n 19 bash "$ROOT/scripts/batch_ocr.sh" "$pdf"; then
      echo "==== OCR 完成：$(basename "$pdf") -> $(basename "$out") $(date '+%H:%M:%S') ===="
    else
      echo "[失败] $pdf（继续下一本）"
    fi
  fi
done
if [ "$DRY" -eq 1 ]; then echo "（--dry 仅列出计划，未实际 OCR）"; fi

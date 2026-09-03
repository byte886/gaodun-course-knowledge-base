#!/bin/bash
# 高顿课程视频批量转写脚本
# 在iTerm中运行，自动依次处理13个视频，显示进度，支持断点续传

set -e

# 动态获取项目目录（脚本所在目录的上一级）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 配置
TRANSCRIBE_SCRIPT="$PROJECT_DIR/scripts/transcribe_pipeline.py"
VENV_PYTHON="$PROJECT_DIR/transcription/venv/bin/python"
BASE_DIR="$HOME/Desktop/高顿/CPA"

# 视频列表（按顺序）
VIDEO_LIST=(
  # 税法01
  "$BASE_DIR/课程库/【26考季】VIPCPA系列-税法（蔡俊峻老师）/01_税法全面精讲01-税法总论/video.mp4"
  # 基础必修12个
  "$BASE_DIR/待整理/【26考季】VIPCPA-基础必修-会计（罗翔老师）/01_会计总论(一)/video.mp4"
  "$BASE_DIR/待整理/【26考季】VIPCPA-基础必修-会计（罗翔老师）/02_会计总论(二)/video.mp4"
  "$BASE_DIR/待整理/【26考季】VIPCPA-基础必修-会计（罗翔老师）/03_会计总论(三)/video.mp4"
  "$BASE_DIR/待整理/【26考季】VIPCPA-基础必修-会计（罗翔老师）/04_会计总论(四)、资产(一)/video.mp4"
  "$BASE_DIR/待整理/【26考季】VIPCPA-基础必修-会计（罗翔老师）/05_资产(二)/video.mp4"
  "$BASE_DIR/待整理/【26考季】VIPCPA-基础必修-会计（罗翔老师）/06_资产(三)/video.mp4"
  "$BASE_DIR/待整理/【26考季】VIPCPA-基础必修-会计（罗翔老师）/07_资产(四)/video.mp4"
  "$BASE_DIR/待整理/【26考季】VIPCPA-基础必修-会计（罗翔老师）/08_资产(五)/video.mp4"
  "$BASE_DIR/待整理/【26考季】VIPCPA-基础必修-会计（罗翔老师）/09_资产(六)、负债(一)/video.mp4"
  "$BASE_DIR/待整理/【26考季】VIPCPA-基础必修-会计（罗翔老师）/10_负债(二)、所有者权益(一)/video.mp4"
  "$BASE_DIR/待整理/【26考季】VIPCPA-基础必修-会计（罗翔老师）/11_所有者权益(二)、动态要素(一)/video.mp4"
  "$BASE_DIR/待整理/【26考季】VIPCPA-基础必修-会计（罗翔老师）/12_动态要素(二)、财务报告/video.mp4"
)

TOTAL=${#VIDEO_LIST[@]}
SUCCESS=0
SKIPPED=0
FAILED=0
START_TIME=$(date +%s)

# 退出兜底：正常结束/报错/Ctrl-C 都清掉当前讲的临时输出目录（成品已 cp 回课程目录）
cleanup() { local t="${TEMP_OUTPUT:-}"; [ -n "$t" ] && rm -rf "$t"; }
trap cleanup EXIT

echo "============================================"
echo "  高顿课程视频批量转写"
echo "  共 $TOTAL 个视频"
echo "  开始时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""

for i in "${!VIDEO_LIST[@]}"; do
  VIDEO="${VIDEO_LIST[$i]}"
  NUM=$((i + 1))
  
  # 获取视频所在目录和课次名称
  VIDEO_DIR=$(dirname "$VIDEO")
  LESSON_NAME=$(basename "$VIDEO_DIR")
  COURSE_NAME=$(basename "$(dirname "$VIDEO_DIR")")
  
  # 输出目录：视频所在目录下的transcript.md
  OUTPUT_MD="$VIDEO_DIR/transcript.md"
  
  echo "--------------------------------------------"
  echo "[$NUM/$TOTAL] $COURSE_NAME / $LESSON_NAME"
  echo "  视频: $VIDEO"
  echo "  输出: $OUTPUT_MD"
  
  # 断点续传：检查是否已转写完成
  if [ -f "$OUTPUT_MD" ] && [ -s "$OUTPUT_MD" ]; then
    # 检查文件是否包含转写内容（至少1000字）
    WORD_COUNT=$(wc -m < "$OUTPUT_MD" 2>/dev/null || echo "0")
    if [ "$WORD_COUNT" -gt 1000 ]; then
      echo "  [跳过] 已存在转写结果（约 $WORD_COUNT 字）"
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
  fi
  
  # 检查视频文件是否存在
  if [ ! -f "$VIDEO" ]; then
    echo "  [失败] 视频文件不存在"
    FAILED=$((FAILED + 1))
    continue
  fi
  
  # 执行转写
  echo "  [转写中] 开始..."
  VIDEO_START=$(date +%s)
  
  # 临时输出目录
  TEMP_OUTPUT="$PROJECT_DIR/transcription/transcripts_full/lesson_$NUM"
  mkdir -p "$TEMP_OUTPUT"
  
  # 调用转写脚本
  if $VENV_PYTHON "$TRANSCRIBE_SCRIPT" "$VIDEO" "$TEMP_OUTPUT" 2>&1; then
    # transcribe_pipeline.py输出到 output_dir/video_name/transcript.md
    TEMP_MD="$TEMP_OUTPUT/video/transcript.md"
    if [ -f "$TEMP_MD" ]; then
      cp "$TEMP_MD" "$OUTPUT_MD"
      WORD_COUNT=$(wc -m < "$OUTPUT_MD" 2>/dev/null || echo "0")
      VIDEO_END=$(date +%s)
      DURATION=$((VIDEO_END - VIDEO_START))
      echo "  [完成] 约 $WORD_COUNT 字，耗时 $((DURATION / 60))分$((DURATION % 60))秒"
      SUCCESS=$((SUCCESS + 1))
    else
      echo "  [失败] 未生成transcript.md（查找路径: $TEMP_MD）"
      # 列出临时目录内容便于调试
      find "$TEMP_OUTPUT" -type f 2>/dev/null | head -10
      FAILED=$((FAILED + 1))
    fi
  else
    echo "  [失败] 转写脚本执行出错"
    FAILED=$((FAILED + 1))
  fi
  
  # 清理临时文件
  rm -rf "$TEMP_OUTPUT"
  
  # 显示总体进度
  ELAPSED=$(( $(date +%s) - START_TIME ))
  PROCESSED=$((SUCCESS + SKIPPED + FAILED))
  if [ $PROCESSED -gt 0 ]; then
    AVG_TIME=$((ELAPSED / PROCESSED))
    REMAINING=$(( (TOTAL - PROCESSED) * AVG_TIME ))
    echo "  [进度] 已处理 $PROCESSED/$TOTAL，已用 $((ELAPSED / 60))分，预计剩余 $((REMAINING / 60))分"
  fi
  echo ""
done

# 汇总报告
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo "============================================"
echo "  批量转写完成"
echo "  完成时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "  总耗时: $((TOTAL_DURATION / 60))分$((TOTAL_DURATION % 60))秒"
echo "  ----------------------------------------"
echo "  成功: $SUCCESS"
echo "  跳过: $SKIPPED"
echo "  失败: $FAILED"
echo "  总计: $TOTAL"
echo "============================================"

# 如果有失败，退出码为1
if [ $FAILED -gt 0 ]; then
  exit 1
fi

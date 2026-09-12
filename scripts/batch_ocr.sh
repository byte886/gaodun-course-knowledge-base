#!/bin/bash
# 高顿课程PDF批量OCR脚本
# 使用macOS Vision框架，将PDF每页转图片后OCR，输出合并的Markdown
# 在iTerm中运行，显示进度，支持断点续传
#
# 用法:
#   bash scripts/batch_ocr.sh <PDF路径> [输出目录]
#   示例: bash scripts/batch_ocr.sh "课程/docs/讲义.pdf" "课程/docs"
#
# 如果不提供参数，使用默认配置（需手动修改下方DEFAULT_*变量）

set -euo pipefail
# 兜底 UTF-8 locale：nohup/后台环境可能是 C locale，导致 $VAR 紧跟中文时
# bash 把中文首字节并入变量名而报 unbound variable
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

# 动态获取项目目录（脚本所在目录的上一级）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"


# 不用set -e，避免iTerm环境下某个命令失败导致整个脚本退出

# 默认配置（不提供参数时使用）
DEFAULT_PDF_PATH="$HOME/Desktop/高顿/CPA/【26考季】VIPCPA系列-税法（蔡俊峻老师）/01_税法全面精讲01-税法总论/docs/01-课件_税法总论.pdf"
DEFAULT_OUTPUT_DIR="$HOME/Desktop/高顿/CPA/【26考季】VIPCPA系列-税法（蔡俊峻老师）/01_税法全面精讲01-税法总论/docs"

# 参数处理
if [ $# -ge 1 ]; then
  PDF_PATH="$1"
else
  PDF_PATH="$DEFAULT_PDF_PATH"
fi

if [ $# -ge 2 ]; then
  OUTPUT_DIR="$2"
else
  OUTPUT_DIR="$(dirname "$PDF_PATH")"
fi

# 自动生成输出文件名
PDF_BASENAME=$(basename "$PDF_PATH" .pdf)
OUTPUT_MD="$OUTPUT_DIR/${PDF_BASENAME}_OCR.md"

# 自动检测Python路径（优先使用项目venv）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_PYTHON="$PROJECT_DIR/transcription/venv/bin/python"
if [ -x "$VENV_PYTHON" ]; then
  PYTHON="$VENV_PYTHON"
else
  PYTHON="python3"
fi

TEMP_DIR="/tmp/gaodun_ocr_pages"
OCR_BIN="/tmp/ocr_vision"
DPI=200

# 检查OCR二进制是否存在
if [ ! -f "$OCR_BIN" ]; then
  echo "[错误] OCR工具不存在: $OCR_BIN"
  echo "请先编译: swiftc -framework Vision -framework AppKit -framework CoreGraphics /tmp/ocr_vision.swift -o /tmp/ocr_vision"
  exit 1
fi

# 检查PDF文件是否存在
if [ ! -f "$PDF_PATH" ]; then
  echo "[错误] PDF文件不存在: $PDF_PATH"
  echo "用法: bash scripts/batch_ocr.sh <PDF路径> [输出目录]"
  exit 1
fi

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 创建临时目录
mkdir -p "$TEMP_DIR"

# 获取PDF页数
TOTAL_PAGES=$("$PYTHON" -c "
import pymupdf
doc = pymupdf.open('$PDF_PATH')
print(len(doc))
doc.close()
")

if [ -z "$TOTAL_PAGES" ] || [ "$TOTAL_PAGES" -eq 0 ]; then
  echo "[错误] 无法获取PDF页数，可能是pymupdf未安装或PDF文件损坏"
  exit 1
fi

echo "============================================"
echo "  高顿课程PDF批量OCR"
echo "  PDF: $(basename "$PDF_PATH")"
echo "  总页数: $TOTAL_PAGES"
echo "  输出: $OUTPUT_MD"
echo "  Python: $PYTHON"
echo "  开始时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""

START_TIME=$(date +%s)
SUCCESS=0
SKIPPED=0
FAILED=0

# 初始化输出文件
echo "# ${PDF_BASENAME}（OCR文字稿）" > "$OUTPUT_MD"
echo "" >> "$OUTPUT_MD"
echo "> 自动OCR识别 | 共${TOTAL_PAGES}页 | 使用macOS Vision框架" >> "$OUTPUT_MD"
echo "" >> "$OUTPUT_MD"

for ((page=1; page<=TOTAL_PAGES; page++)); do
  IMG_PATH="$TEMP_DIR/page_$(printf '%03d' $page).png"
  TXT_PATH="$TEMP_DIR/page_$(printf '%03d' $page).txt"
  
  echo "[$page/$TOTAL_PAGES] 第${page}页..."
  
  # 断点续传：检查是否已有OCR结果
  if [ -f "$TXT_PATH" ] && [ -s "$TXT_PATH" ]; then
    echo "  [跳过] 已存在OCR结果"
    SKIPPED=$((SKIPPED + 1))
    # 仍然写入输出文件
    echo "---" >> "$OUTPUT_MD"
    echo "## 第${page}页" >> "$OUTPUT_MD"
    echo "" >> "$OUTPUT_MD"
    cat "$TXT_PATH" >> "$OUTPUT_MD"
    echo "" >> "$OUTPUT_MD"
    continue
  fi
  
  # 步骤1：PDF转图片
  if [ ! -f "$IMG_PATH" ]; then
    "$PYTHON" -c "
import pymupdf
doc = pymupdf.open('$PDF_PATH')
page = doc[$page-1]
mat = pymupdf.Matrix($DPI/72, $DPI/72)
pix = page.get_pixmap(matrix=mat)
pix.save('$IMG_PATH')
doc.close()
" 2>/dev/null
  fi
  
  if [ ! -f "$IMG_PATH" ]; then
    echo "  [失败] PDF转图片失败"
    FAILED=$((FAILED + 1))
    continue
  fi
  
  # 步骤2：OCR识别
  OCR_RESULT=$("$OCR_BIN" "$IMG_PATH" 2>/dev/null)
  
  if [ -z "$OCR_RESULT" ] || [ "$OCR_RESULT" = "未识别到文字" ]; then
    echo "  [警告] 未识别到文字"
    echo "（本页无文字或为纯图片）" > "$TXT_PATH"
  else
    echo "$OCR_RESULT" > "$TXT_PATH"
  fi
  
  SUCCESS=$((SUCCESS + 1))
  
  # 写入输出文件
  echo "---" >> "$OUTPUT_MD"
  echo "## 第${page}页" >> "$OUTPUT_MD"
  echo "" >> "$OUTPUT_MD"
  cat "$TXT_PATH" >> "$OUTPUT_MD"
  echo "" >> "$OUTPUT_MD"
  
  # 显示进度
  ELAPSED=$(( $(date +%s) - START_TIME ))
  PROCESSED=$((SUCCESS + SKIPPED + FAILED))
  if [ $PROCESSED -gt 0 ]; then
    AVG_TIME=$((ELAPSED / PROCESSED))
    REMAINING=$(( (TOTAL_PAGES - PROCESSED) * AVG_TIME ))
    echo "  [进度] 已处理 ${PROCESSED}/${TOTAL_PAGES}，已用 $((ELAPSED / 60))分$((ELAPSED % 60))秒，预计剩余 $((REMAINING / 60))分$((REMAINING % 60))秒"
  fi
done

# 后处理：修正常见OCR错误
echo ""
echo "[后处理] 修正常见OCR错误..."
sed -i '' 's/高顿教意/高顿教育/g; s/高顿教肓/高顿教育/g' "$OUTPUT_MD"

# 清理临时图片（保留txt用于断点续传）
echo "[清理] 删除临时图片..."
rm -f "$TEMP_DIR"/*.png

# 汇总报告
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo ""
echo "============================================"
echo "  批量OCR完成"
echo "  完成时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "  总耗时: $((TOTAL_DURATION / 60))分$((TOTAL_DURATION % 60))秒"
echo "  ----------------------------------------"
echo "  成功: $SUCCESS"
echo "  跳过: $SKIPPED"
echo "  失败: $FAILED"
echo "  总计: $TOTAL_PAGES"
echo "  输出: $OUTPUT_MD"
echo "  字数: $(wc -m < "$OUTPUT_MD" | tr -d ' ')"
echo "============================================"

if [ $FAILED -gt 0 ]; then
  exit 1
fi

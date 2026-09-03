#!/bin/bash
# 课程目录并发同步到百度网盘（通用，可复用于会计等其他课程）
#
# 用法:
#   bash sync_course_netdisk.sh <本地课程根> <网盘课程根> [并发数=3] [编号正则过滤]
#
# 示例:
#   bash scripts/sync_course_netdisk.sh \
#     "data/高顿/CPA/课程库/【26考季】VIPCPA系列-税法（蔡俊峻老师）" \
#     "/apps/CPA课程归档/高顿/CPA/课程库/【26考季】VIPCPA系列-税法（蔡俊峻老师）" \
#     3 '^(0[4-9]|[12][0-9]|3[0-8])_'
#
# 特性:
#   - xargs -P 并发（网盘IO建议2-3，禁用flock）；单讲失败不影响其他讲
#   - 断点续传：成功的讲在 logs/netdisk_done/ 写标记，重跑自动跳过
#   - 每讲独立日志 logs/netdisk_<讲名>.log；百度侧已存在文件走MD5秒传
#   - 只传面向使用者的内容，技术过程文件由 upload_course.sh 过滤

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

LOCAL_BASE="$1"
REMOTE_BASE="$2"
PARALLEL="${3:-3}"
FILTER="${4:-.*}"
export BAIDU_ENC_PASS="lover123"

DONE_DIR="$PROJECT_DIR/logs/netdisk_done"
mkdir -p "$DONE_DIR" logs

upload_one() {
  local name="$1" local_base="$2" remote_base="$3"
  local done_flag="$DONE_DIR/$(echo "$name" | tr '/' '_').done"
  if [ -f "$done_flag" ]; then
    echo "[跳过] $name（已完成）"
    return 0
  fi
  local logf="$PROJECT_DIR/logs/netdisk_$(echo "$name" | tr '/' '_').log"
  echo "[开始] $name $(date '+%H:%M:%S')"
  if bash "$PROJECT_DIR/scripts/upload_course.sh" "$local_base/$name" "$remote_base/$name" > "$logf" 2>&1; then
    echo "OK $name $(date '+%H:%M:%S')" > "$done_flag"
    echo "[完成] $name"
  else
    echo "[失败] $name（见 $logf）"
    return 1
  fi
}
export -f upload_one
export DONE_DIR PROJECT_DIR

echo "============================================"
echo " 课程并发同步网盘"
echo " 本地根: $LOCAL_BASE"
echo " 网盘根: $REMOTE_BASE"
echo " 并发: $PARALLEL  过滤: $FILTER"
echo " 开始: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# 列出匹配讲目录，并发上传
ls "$LOCAL_BASE" | grep -E "$FILTER" | \
  xargs -P "$PARALLEL" -I{} bash -c 'upload_one "$@"' _ {} "$LOCAL_BASE" "$REMOTE_BASE"

RC=$?
echo ""
echo "============================================"
echo " 批次结束: $(date '+%Y-%m-%d %H:%M:%S')"
DONE_CNT=$(ls "$DONE_DIR" 2>/dev/null | wc -l | tr -d ' ')
echo " 累计完成标记: $DONE_CNT 讲"
echo " 失败讲（无done标记且本次匹配）:"
for d in $(ls "$LOCAL_BASE" | grep -E "$FILTER"); do
  flag="$DONE_DIR/$(echo "$d" | tr '/' '_').done"
  [ -f "$flag" ] || echo "   - $d"
done
echo "============================================"
exit $RC

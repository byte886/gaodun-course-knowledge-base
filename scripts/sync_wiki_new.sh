#!/bin/bash
# 新知识结构同步到飞书：课程根 → 14组(README) → 92知识点文档 + 课程全局篇
# 断点续传：logs/wiki_done/<标题>.done 记录 node_token obj_token
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# shellcheck source=course_config.sh
source "$SCRIPT_DIR/course_config.sh"
TAX="$COURSE_LOCAL_ROOT"
# TODO 跨课：下列飞书空间/根节点为税法空间真实值，会计建空间后迁入 profile.feishu，暂不臆造
PARENT="UM6bwW23tiYkCVk3nXtc3TpBnGe"
SPACE_ID="7678261729456852192"
DONE_DIR="$PROJECT_DIR/logs/wiki_done"
MAP_FILE="$PROJECT_DIR/data/_workspace/cpa-tax-2026/logs/wiki_node_map.tsv"
mkdir -p "$DONE_DIR"
touch "$MAP_FILE"

# 创建节点并写入内容，返回 node_token（通过stdout最后一行）
create_and_fill() {
  local parent="$1" title="$2" file="$3"
  local safe=$(echo "$title" | tr '/' '_' | tr ' ' '_')
  local done_flag="$DONE_DIR/${safe}.done"

  if [ -f "$done_flag" ]; then
    local nt=$(head -1 "$done_flag" | awk '{print $1}')
    echo "[跳过] $title (node=$nt)" >&2
    echo "$nt"
    return 0
  fi
  [ -f "$file" ] || { echo "[FAIL无文件] $title: $file" >&2; return 1; }

  local node_token="" obj_token=""

  # 先查找 parent 下是否已存在同名节点（复用之前创建的空节点，避免重复）
  # 限流/内部错误时 node-list 可能返回空，必须重试，确认"查询成功且确无同名"后才允许新建
  local existing="" qrc=1 q
  for q in 1 2 3 4; do
    existing=$(lark-cli wiki +node-list --space-id "$SPACE_ID" --parent-node-token "$parent" --as user --format json 2>/dev/null | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
except Exception:
    sys.exit(3)
if d.get('ok') is False:
    sys.exit(3)
target=sys.argv[1]
for n in d.get('data',{}).get('nodes',[]):
    if n.get('title')==target:
        print(n.get('node_token',''), n.get('obj_token',''))
        break
" "$title" 2>/dev/null)
    qrc=$?
    [ $qrc -eq 0 ] && break
    echo "[查询重试${q}] ${title}（疑似限流）" >&2
    sleep $((q*2))
  done
  if [ $qrc -ne 0 ]; then
    echo "[FAIL查询] $title: 多次查询仍失败，为避免误建重复节点已跳过，请重跑" >&2
    return 1
  fi

  if [ -n "$existing" ]; then
    node_token=$(echo "$existing" | awk '{print $1}')
    obj_token=$(echo "$existing" | awk '{print $2}')
    echo "[复用] $title (node=$node_token)" >&2
  else
    # 创建节点
    local result=$(lark-cli wiki +node-create --parent-node-token "$parent" --title "$title" --as user --format json 2>&1)
    obj_token=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('obj_token',''))" 2>/dev/null)
    node_token=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('node_token',''))" 2>/dev/null)
    if [ -z "$obj_token" ] || [ -z "$node_token" ]; then
      echo "[FAIL创建] $title: $(echo "$result" | head -3)" >&2
      return 1
    fi
  fi

  # 写入 markdown 内容（通过 stdin 管道，避免 @file allowlist 限制），失败重试 3 次
  local upd=""
  for attempt in 1 2 3; do
    upd=$(cat "$file" | python3 "$SCRIPT_DIR/wiki_link_resolve.py" | lark-cli docs +update --doc "$obj_token" --command overwrite --doc-format markdown --content - --as user --format json 2>&1)
    if echo "$upd" | python3 -c "import sys,json; sys.exit(0 if json.load(sys.stdin).get('ok') else 1)" 2>/dev/null; then
      break
    fi
    echo "[重试$attempt] $title" >&2
    sleep 2
  done
  if ! echo "$upd" | python3 -c "import sys,json; sys.exit(0 if json.load(sys.stdin).get('ok') else 1)" 2>/dev/null; then
    echo "[FAIL写入] $title: $(echo "$upd" | head -5)" >&2
    return 1
  fi

  echo "$node_token $obj_token" > "$done_flag"
  echo -e "$title\t$node_token\t$obj_token\t$parent" >> "$MAP_FILE"
  echo "[OK] $title (node=$node_token)" >&2
  echo "$node_token"
}
export -f create_and_fill
export DONE_DIR MAP_FILE TAX PARENT PROJECT_DIR SPACE_ID

echo "============================================"
echo " 飞书新知识结构同步"
echo " 课程根: $PARENT"
echo " 开始: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# 1. 课程全局篇（课程根下）
echo "--- 课程全局篇 ---"
create_and_fill "$PARENT" "课程做题思路解析" "$TAX/知识详解/课程做题思路解析.md"
sleep 0.8
create_and_fill "$PARENT" "考试指导速查手册" "$TAX/知识详解/考试指导速查手册.md"
sleep 0.8

# 2. 14个组
TOTAL_GROUPS=0; TOTAL_POINTS=0
for group_dir in "$TAX/知识详解"/*/; do
  group_name=$(basename "$group_dir")
  readme="$group_dir/README.md"
  [ -f "$readme" ] || { echo "[跳过组无README] $group_name"; continue; }

  echo "--- 组: $group_name ---"
  group_node=$(create_and_fill "$PARENT" "$group_name" "$readme")
  TOTAL_GROUPS=$((TOTAL_GROUPS+1))
  sleep 0.8

  # 组下知识点文档（排除README）
  for md in "$group_dir"/*.md; do
    [ -f "$md" ] || continue
    fname=$(basename "$md")
    [ "$fname" = "README.md" ] && continue
    point_title="${fname%.md}"
    create_and_fill "$group_node" "$point_title" "$md" > /dev/null
    TOTAL_POINTS=$((TOTAL_POINTS+1))
    sleep 0.7
  done
done

echo ""
echo "============================================"
echo " 同步完成: $(date '+%Y-%m-%d %H:%M:%S')"
echo " 组节点: $TOTAL_GROUPS"
echo " 知识点节点: $TOTAL_POINTS"
echo " 映射文件: $MAP_FILE"
echo "============================================"

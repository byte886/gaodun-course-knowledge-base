#!/bin/bash
# 新知识结构同步到飞书：课程根 → 14组(README) → 92知识点文档 + 课程全局篇
# 断点续传：data/_workspace/<profile>/logs/wiki_done/<标题>.done 记录 node_token obj_token
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# shellcheck source=course_config.sh
source "$SCRIPT_DIR/course_config.sh"
TAX="$COURSE_LOCAL_ROOT"
# 飞书空间/课程根节点：默认税法真实值，跨课时用环境变量 WIKI_SPACE_ID / WIKI_PARENT 覆盖
# （课程目录由 COURSE_PROFILE/GAODUN_COURSE_PROFILE 经 course_config.sh 切换，勿写死）
#   会计：COURSE_PROFILE=cpa-accounting-2026 WIKI_PARENT=TazhwSJ4mi58StkDT2ccahMGnlb bash scripts/sync_wiki_new.sh
SPACE_ID="${WIKI_SPACE_ID:-7678261729456852192}"
PARENT="${WIKI_PARENT:-UM6bwW23tiYkCVk3nXtc3TpBnGe}"
# 节点创建步进间隔（秒）：默认沿用历史值；遇飞书限流（internal error/查询4次失败）时调大，如 WIKI_STEP_PAUSE=2.2 WIKI_GROUP_PAUSE=2.5
STEP_PAUSE="${WIKI_STEP_PAUSE:-0.7}"
GROUP_PAUSE="${WIKI_GROUP_PAUSE:-0.8}"
_WP="${COURSE_PROFILE:-${GAODUN_COURSE_PROFILE:-cpa-tax-2026}}"
WS="$PROJECT_DIR/data/_workspace/$_WP"
DONE_DIR="$WS/logs/wiki_done"
MAP_FILE="$WS/logs/wiki_node_map.tsv"
mkdir -p "$DONE_DIR"
touch "$MAP_FILE"
CREATED_COUNT=0

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

  # 查重两路：①组级缓存模式（EXISTING_CACHE 指向预取的父节点子节点清单 TSV，每组只网络 list 一次，
  #   组内知识点查缓存，把 node-list 调用从"每节点一次"降到"每组一次"，规避查询接口滑动限流）；
  # ②网络模式（无缓存时逐节点 list，带限流重试）。
  local existing=""
  if [ -n "${EXISTING_CACHE:-}" ] && [ -f "$EXISTING_CACHE" ]; then
    existing=$(awk -F'\t' -v t="$title" '$1==t{print $2" "$3; exit}' "$EXISTING_CACHE")
  else
    local qrc=1 q
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
      sleep $((q*3))
    done
    if [ $qrc -ne 0 ]; then
      echo "[FAIL查询] $title: 多次查询仍失败，为避免误建重复节点已跳过，请重跑" >&2
      return 1
    fi
  fi

  if [ -n "$existing" ]; then
    node_token=$(echo "$existing" | awk '{print $1}')
    obj_token=$(echo "$existing" | awk '{print $2}')
    echo "[复用] $title (node=$node_token)" >&2
  else
    # 创建节点
    local result="" cr
    for cr in 1 2 3; do
      result=$(lark-cli wiki +node-create --parent-node-token "$parent" --title "$title" --as user --format json 2>&1)
      obj_token=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('obj_token',''))" 2>/dev/null)
      node_token=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('node_token',''))" 2>/dev/null)
      { [ -n "$obj_token" ] && [ -n "$node_token" ]; } && break
      echo "[创建重试$cr] $title（疑似写限流）" >&2
      sleep $((cr*4))
    done
    if [ -z "$obj_token" ] || [ -z "$node_token" ]; then
      echo "[FAIL创建] $title: $(echo "$result" | head -3)" >&2
      return 1
    fi
    # 回填组级缓存，保证同组后续节点视图一致、不重复建
    if [ -n "${EXISTING_CACHE:-}" ]; then printf '%s\t%s\t%s\n' "$title" "$node_token" "$obj_token" >> "$EXISTING_CACHE"; fi
  fi

  # 写入 markdown 内容（通过 stdin 管道，避免 @file allowlist 限制），失败重试 3 次
  local upd=""
  for attempt in 1 2 3; do
    upd=$(cat "$file" | WIKI_MAP="$MAP_FILE" python3 "$SCRIPT_DIR/wiki_link_resolve.py" | lark-cli docs +update --doc "$obj_token" --command overwrite --doc-format markdown --content - --as user --format json 2>&1)
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
  # 批次节流：每真正处理 WIKI_BATCH 个节点（跳过的不计）主动长休，规避飞书滑动窗口限流
  CREATED_COUNT=$((CREATED_COUNT+1))
  if [ "${WIKI_BATCH:-100000}" -gt 0 ] && [ "$CREATED_COUNT" -ge "${WIKI_BATCH:-100000}" ]; then
    echo "[批次节流] 已处理 $CREATED_COUNT 个真实节点，休眠 ${WIKI_BATCH_SLEEP:-0}s 规避限流..." >&2
    sleep "${WIKI_BATCH_SLEEP:-0}"
    CREATED_COUNT=0
  fi
  echo "$node_token"
}
export -f create_and_fill
export DONE_DIR MAP_FILE TAX PARENT PROJECT_DIR SPACE_ID

# 预取某父节点下全部子节点到缓存 TSV（title\tnode\tobj），带限流重试；每组只调一次 node-list
prefetch_children() {
  local parent="$1" out="$2" q
  for q in 1 2 3 4 5; do
    if lark-cli wiki +node-list --space-id "$SPACE_ID" --parent-node-token "$parent" --as user --format json 2>/dev/null | python3 -c "
import sys,json
try: d=json.load(sys.stdin)
except Exception: sys.exit(3)
if d.get('ok') is False: sys.exit(3)
for n in d.get('data',{}).get('nodes',[]):
    print('%s\t%s\t%s'%(n.get('title',''),n.get('node_token',''),n.get('obj_token','')))
" > "$out" 2>/dev/null; then return 0; fi
    echo "[预取重试$q] parent=$parent（疑似限流）" >&2
    sleep $((q*3))
  done
  return 1
}
export EXISTING_CACHE=""

echo "============================================"
echo " 飞书新知识结构同步"
echo " 课程根: $PARENT"
echo " 开始: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# 预取课程根 PARENT 下全部子节点（全局篇 + 组节点共用，全程只网络 list 课程根一次）
ROOT_CACHE="$WS/logs/.existing_root.tsv"
if prefetch_children "$PARENT" "$ROOT_CACHE"; then echo "[预取] 课程根子节点清单 $(wc -l < "$ROOT_CACHE" | tr -d ' ') 条"; else : > "$ROOT_CACHE"; fi
EXISTING_CACHE="$ROOT_CACHE"

# 1. 课程全局篇（课程根下，走 root 缓存）
echo "--- 课程全局篇 ---"
create_and_fill "$PARENT" "课程做题思路解析" "$TAX/知识详解/课程做题思路解析.md"
sleep "$GROUP_PAUSE"
create_and_fill "$PARENT" "考试指导速查手册" "$TAX/知识详解/考试指导速查手册.md"
sleep "$GROUP_PAUSE"

# 2. 各组（章 README 为组节点，其下知识点为子节点）
TOTAL_GROUPS=0; TOTAL_POINTS=0
GROUP_CACHE="$WS/logs/.existing_group.tsv"
for group_dir in "$TAX/知识详解"/*/; do
  group_name=$(basename "$group_dir")
  readme="$group_dir/README.md"
  [ -f "$readme" ] || { echo "[跳过组无README] $group_name"; continue; }

  echo "--- 组: $group_name ---"
  # 断点续跑优化：组节点+组内全部知识点都已有 done_flag 时，整组零网络跳过（不 prefetch/不查重），
  # 避免续跑空跑穿过大量已建章白白消耗 node-list 配额、反被限流卡在半路
  g_safe=$(echo "$group_name" | tr '/' '_' | tr ' ' '_')
  group_pending=0 _pcnt=0
  [ -f "$DONE_DIR/${g_safe}.done" ] || group_pending=1
  for _m in "$group_dir"*.md; do
    [ -f "$_m" ] || continue
    _b=$(basename "$_m"); [ "$_b" = "README.md" ] && continue
    _pcnt=$((_pcnt+1))
    _s=$(echo "${_b%.md}" | tr '/' '_' | tr ' ' '_')
    [ -f "$DONE_DIR/${_s}.done" ] || group_pending=1
  done
  if [ "$group_pending" -eq 0 ]; then
    TOTAL_GROUPS=$((TOTAL_GROUPS+1)); TOTAL_POINTS=$((TOTAL_POINTS+_pcnt))
    echo "[整组已完成·零网络跳过] $group_name ($_pcnt 知识点)"
    continue
  fi

  EXISTING_CACHE="$ROOT_CACHE"
  group_node=$(create_and_fill "$PARENT" "$group_name" "$readme")
  if [ -z "$group_node" ]; then
    echo "[FAIL组节点] $group_name 组节点创建失败（多为写限流），跳过本组、留待续跑" >&2
    continue
  fi
  TOTAL_GROUPS=$((TOTAL_GROUPS+1))
  sleep "$GROUP_PAUSE"

  # 预取本组下全部现存子节点（每组只网络 list 一次，组内知识点走缓存、不再逐节点 list）
  if prefetch_children "$group_node" "$GROUP_CACHE"; then :; else : > "$GROUP_CACHE"; fi
  EXISTING_CACHE="$GROUP_CACHE"

  # 组下知识点文档（排除README）
  for md in "$group_dir"/*.md; do
    [ -f "$md" ] || continue
    fname=$(basename "$md")
    [ "$fname" = "README.md" ] && continue
    point_title="${fname%.md}"
    create_and_fill "$group_node" "$point_title" "$md" > /dev/null
    TOTAL_POINTS=$((TOTAL_POINTS+1))
    sleep "$STEP_PAUSE"
  done
  EXISTING_CACHE="$ROOT_CACHE"
done

echo ""
echo "============================================"
echo " 同步完成: $(date '+%Y-%m-%d %H:%M:%S')"
echo " 组节点: $TOTAL_GROUPS"
echo " 知识点节点: $TOTAL_POINTS"
echo " 映射文件: $MAP_FILE"
echo "============================================"

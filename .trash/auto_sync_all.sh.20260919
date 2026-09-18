#!/bin/bash
# 全自动六科同步调度器：自动监控、自动重启、按顺序推进
# 兼容 macOS bash 3.2
# 用法: nohup bash scripts/knowledge/auto_sync_all.sh > /tmp/auto_sync.log 2>&1 &
set -u

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_DIR"

LOG="/tmp/auto_sync_scheduler.log"
SPACE_ID="7678261729456852192"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"
}

# 同步单个科目（带自动重启）
# 参数: $1=profile $2=total $3=parent
sync_one_course() {
    local p="$1"
    local t="$2"
    local parent="$3"
    local done_dir="data/_workspace/$p/logs/resync_done"
    local no_progress=0

    log "【同步】开始 $p，目标 $t 篇"

    while true; do
        local d=$(ls "$done_dir" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$d" -ge "$t" ]; then
            log "【同步】$p 完成：$d/$t"
            return 0
        fi

        log "【同步】$p 进度 $d/$t，启动一轮..."

        # 启动一轮同步（最多3轮后退出）
        GAODUN_COURSE_PROFILE="$p" bash scripts/knowledge/run_resync_batches.sh "$p" 8 90 "$t" 900 3 >> "$LOG" 2>&1

        # 检查是否完成
        d=$(ls "$done_dir" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$d" -ge "$t" ]; then
            log "【同步】$p 完成：$d/$t"
            return 0
        fi

        # 检查进展
        local prev=$d
        sleep 10
        d=$(ls "$done_dir" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$d" -eq "$prev" ]; then
            no_progress=$((no_progress + 1))
            if [ "$no_progress" -ge 5 ]; then
                log "【错误】$p 连续5轮无进展，跳过"
                return 1
            fi
            log "【同步】$p 无进展(${no_progress}/5)，等60秒重试"
            sleep 60
        else
            no_progress=0
        fi
    done
}

# 为科目建树
# 参数: $1=profile $2=parent
build_one_tree() {
    local p="$1"
    local parent="$2"
    log "【建树】开始为 $p 建立节点结构..."

    WIKI_SPACE_ID="$SPACE_ID" WIKI_PARENT="$parent" GAODUN_COURSE_PROFILE="$p" bash scripts/sync_wiki_new.sh >> "$LOG" 2>&1

    local map="data/_workspace/$p/logs/wiki_node_map.tsv"
    if [ -f "$map" ] && [ -s "$map" ]; then
        local c=$(wc -l < "$map" | tr -d ' ')
        log "【建树】$p 完成，共 $c 个节点"
        return 0
    else
        log "【建树】$p 失败"
        return 1
    fi
}

# 主流程
log "========================================"
log "全自动六科同步调度器启动"
log "========================================"

# 税法
log ""
log "========== 1/6 税法 =========="
sync_one_course "cpa-tax-2026" 108 "UM6bwW23tiYkCVk3nXtc3TpBnGe"

# 会计
log ""
log "========== 2/6 会计 =========="
# 清除旧done标记，强制重刷
rm -rf "data/_workspace/cpa-accounting-2026/logs/resync_done"
sync_one_course "cpa-accounting-2026" 169 "TazhwSJ4mi58StkDT2ccahMGnlb"

# 审计
log ""
log "========== 3/6 审计 =========="
if [ ! -s "data/_workspace/ep3-audit-2026/logs/wiki_node_map.tsv" ]; then
    build_one_tree "ep3-audit-2026" "CPgZwfKG9iXphJklioEcWmr1nNb"
    rm -rf "data/_workspace/ep3-audit-2026/logs/resync_done"
fi
sync_one_course "ep3-audit-2026" 132 "CPgZwfKG9iXphJklioEcWmr1nNb"

# 财管
log ""
log "========== 4/6 财管 =========="
if [ ! -s "data/_workspace/ep3-finance-2026/logs/wiki_node_map.tsv" ]; then
    build_one_tree "ep3-finance-2026" "Z2jFwq1ZxigOb9k3XaMcB6H4nib"
    rm -rf "data/_workspace/ep3-finance-2026/logs/resync_done"
fi
sync_one_course "ep3-finance-2026" 144 "Z2jFwq1ZxigOb9k3XaMcB6H4nib"

# 经济法
log ""
log "========== 5/6 经济法 =========="
if [ ! -s "data/_workspace/ep3-econlaw-2026/logs/wiki_node_map.tsv" ]; then
    build_one_tree "ep3-econlaw-2026" "JbEjwyE22isCnok416YcfW3rnlG"
    rm -rf "data/_workspace/ep3-econlaw-2026/logs/resync_done"
fi
sync_one_course "ep3-econlaw-2026" 80 "JbEjwyE22isCnok416YcfW3rnlG"

# 战略
log ""
log "========== 6/6 战略 =========="
if [ ! -s "data/_workspace/ep3-strategy-2026/logs/wiki_node_map.tsv" ]; then
    build_one_tree "ep3-strategy-2026" "T4vNwlQ8yipvyskJonoc7GRynbb"
    rm -rf "data/_workspace/ep3-strategy-2026/logs/resync_done"
fi
sync_one_course "ep3-strategy-2026" 77 "T4vNwlQ8yipvyskJonoc7GRynbb"

log ""
log "========================================"
log "全部六科同步完成！"
log "========================================"

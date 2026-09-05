#!/bin/bash
# 冲刺6卷重做补全答案（修复canonAnswer多小问截断后）
# 顺序跑，每卷独立日志，最后汇总
set -u
cd "$(dirname "$0")/../.."
LOG="logs/sprint_redo_all_$(date +%Y%m%d_%H%M%S).log"
echo "===== 6卷重做开始 $(date) =====" | tee -a "$LOG"
echo "日志: $LOG" | tee -a "$LOG"
RESULTS=""
for k in s1 s2 s3 m1 m2 m3; do
  echo "" | tee -a "$LOG"
  echo "##### 开始 $k $(date +%H:%M:%S) #####" | tee -a "$LOG"
  node scripts/cdp/do_sprint_paper.js "$k" 2>&1 | tee -a "$LOG" | tail -25
  rc=${PIPESTATUS[0]}
  echo "##### $k 结束 rc=$rc $(date +%H:%M:%S) #####" | tee -a "$LOG"
  RESULTS="$RESULTS $k(rc=$rc)"
done
echo "" | tee -a "$LOG"
echo "===== 全部完成 $(date) =====" | tee -a "$LOG"
echo "各卷结果:$RESULTS" | tee -a "$LOG"
# 汇总最新exam_result
echo "" | tee -a "$LOG"
echo "===== 各卷最新成绩汇总 =====" | tee -a "$LOG"
for pid in 86722 86723 86724 86726 86727 86728; do
  f=$(ls -t data/cdp-sniff/exam_result_${pid}_*.json 2>/dev/null | head -1)
  if [ -n "$f" ]; then
    node -e "const j=require('./$f');console.log('$pid', 'score='+j.userScore+'/'+j.totalScore, 'fullScore='+j.fullScore, 'objectiveAllRight='+j.objectiveAllRight, 'aiFull='+j.aiFull+'/'+j.aiTotal, 'unsupported='+j.aiUnsupported.length, 'ceiling='+j.aiCeiling.length, 'failed='+j.aiFailed.length, 'answerGaps='+(j.answerGaps||[]).length);" 2>/dev/null | tee -a "$LOG"
  fi
done
echo "DONE" >> "$LOG"

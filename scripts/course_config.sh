#!/bin/bash
# 课程统一配置文件
# 用法：在脚本中 source 此文件，或设置环境变量覆盖默认值
#
# 切换课程有三种等价方式（优先级从高到低）：
#   1) 直接指定课程名：export COURSE_NAME="【26考季】VIPCPA系列-会计（罗翔老师）"
#   2) 指定课程档案卡(推荐，ID/章组/路径同源)：export COURSE_PROFILE="cpa-accounting-2026"
#      （等价 export GAODUN_COURSE_PROFILE=...，Node/Python 读取器认同一变量）
#   3) 都不设 → 默认税法
#
# 示例（会计课，走 profile）：
#   COURSE_PROFILE=cpa-accounting-2026 bash scripts/sync_raw_resources.sh all
# 示例（税法课，默认）：
#   bash scripts/sync_raw_resources.sh all

# —— 课程选择：显式 COURSE_NAME > COURSE_PROFILE > 默认税法 ——
_CC_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_CC_REPO_ROOT="$(cd "$_CC_SCRIPT_DIR/.." && pwd)"
if [ -z "${COURSE_NAME:-}" ]; then
  _CC_PKEY="${COURSE_PROFILE:-${GAODUN_COURSE_PROFILE:-}}"
  if [ -n "$_CC_PKEY" ]; then
    _CC_PF="$_CC_REPO_ROOT/config/courses/$_CC_PKEY.json"
    if [ ! -f "$_CC_PF" ]; then
      echo "[course_config] profile 不存在: $_CC_PF" >&2
      unset _CC_PKEY _CC_PF _CC_SCRIPT_DIR _CC_REPO_ROOT
      return 1 2>/dev/null || exit 1
    fi
    COURSE_NAME="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1],encoding="utf-8"))["primaryCourse"]["name"])' "$_CC_PF")" \
      || { echo "[course_config] 无法从 profile 读取 primaryCourse.name: $_CC_PF" >&2; unset _CC_PKEY _CC_PF _CC_SCRIPT_DIR _CC_REPO_ROOT; return 1 2>/dev/null || exit 1; }
  fi
fi
unset _CC_PKEY _CC_PF _CC_SCRIPT_DIR _CC_REPO_ROOT

# 课程名称（主变量，用于拼接路径）
export COURSE_NAME="${COURSE_NAME:-【26考季】VIPCPA系列-税法（蔡俊峻老师）}"

# 以下路径总是根据 COURSE_NAME 重新派生（避免切换课程时残留旧路径）
# 如需自定义路径，在 source 此文件后再覆盖
export COURSE_LOCAL_ROOT="data/高顿/CPA/课程库/$COURSE_NAME"
export COURSE_REMOTE_ROOT="/apps/CPA课程归档/高顿/CPA/课程库/$COURSE_NAME"
export COURSE_DESKTOP_ROOT="$HOME/Desktop/高顿/CPA/课程库/$COURSE_NAME"

# 百度网盘加密密码
export BAIDU_ENC_PASS="${BAIDU_ENC_PASS:-lover123}"

# 原始资源子目录名
export RAW_VIDEOS_DIR="${RAW_VIDEOS_DIR:-原始资源/videos}"
export RAW_NOTES_DIR="${RAW_NOTES_DIR:-原始资源/notes}"
export RAW_PAPERS_DIR="${RAW_PAPERS_DIR:-原始资源/papers}"
export RAW_USER_NOTES_DIR="${RAW_USER_NOTES_DIR:-原始资源/user-notes}"

# 知识详解子目录名
export KNOWLEDGE_DIR="${KNOWLEDGE_DIR:-知识详解}"

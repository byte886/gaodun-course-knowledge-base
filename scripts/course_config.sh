#!/bin/bash
# 课程统一配置文件
# 用法：在脚本中 source 此文件，或设置环境变量覆盖默认值
#
# 示例（会计课）：
#   export COURSE_NAME="【26考季】VIPCPA系列-会计（罗翔老师）"
#   bash scripts/sync_raw_resources.sh all
#
# 示例（税法课，默认）：
#   bash scripts/sync_raw_resources.sh all

# 课程名称（主变量，用于拼接路径）
# 切换课程时只需设置此变量：export COURSE_NAME="【26考季】VIPCPA系列-会计（罗翔老师）"
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

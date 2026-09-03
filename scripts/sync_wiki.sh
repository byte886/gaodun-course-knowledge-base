#!/bin/bash
# 批量同步知识库到飞书
# 用法: ./sync_wiki.sh <起始章号> <结束章号>
# 示例: ./sync_wiki.sh 04 15

set -e

PARENT_NODE="UM6bwW23tiYkCVk3nXtc3TpBnGe"  # 税法课程节点
CONTENT_DIR="/Users/wenjiechen/Doubao/chats/2026-08-26/new-chat/gaodun-course-knowledge-base/knowledge-base/organized-content"

START=${1:-03}
END=${2:-15}

echo "=== 开始同步知识库到飞书 ==="
echo "父节点: $PARENT_NODE"
echo "章节范围: $START - $END"
echo ""

# 遍历章节
for ((i=10#$START; i<=10#$END; i++)); do
    CHAPTER=$(printf "%02d" $i)
    
    # 查找章节目录
    CHAPTER_DIR=$(find "$CONTENT_DIR" -maxdepth 1 -type d -name "${CHAPTER}*" | head -1)
    
    if [ -z "$CHAPTER_DIR" ]; then
        echo "[$CHAPTER] 未找到章节目录，跳过"
        continue
    fi
    
    CHAPTER_NAME=$(basename "$CHAPTER_DIR")
    echo "[$CHAPTER] 处理章节: $CHAPTER_NAME"
    
    # 检查文件是否存在
    README_FILE="$CHAPTER_DIR/README.md"
    KNOWLEDGE_FILE="$CHAPTER_DIR/知识拆解.md"
    EXAM_FILE="$CHAPTER_DIR/考试指导.md"
    
    if [ ! -f "$README_FILE" ]; then
        echo "  未找到README.md，跳过"
        continue
    fi
    
    # 1. 创建章节点
    echo "  创建章节点..."
    CREATE_RESULT=$(lark-cli wiki +node-create --parent-node-token "$PARENT_NODE" --title "$CHAPTER_NAME" --as user --format json 2>&1)
    CREATE_JSON=$(echo "$CREATE_RESULT" | sed -n '/^{/,$p')
    CHAPTER_NODE_TOKEN=$(echo "$CREATE_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['node_token'])" 2>/dev/null)
    CHAPTER_OBJ_TOKEN=$(echo "$CREATE_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['obj_token'])" 2>/dev/null)
    
    if [ -z "$CHAPTER_NODE_TOKEN" ]; then
        echo "  创建章节点失败，跳过"
        echo "$CREATE_RESULT"
        continue
    fi
    
    echo "  章节点创建成功: node_token=$CHAPTER_NODE_TOKEN"
    
    # 2. 更新章节点内容（README）
    echo "  更新章节点内容..."
    lark-cli docs +update --doc "$CHAPTER_OBJ_TOKEN" --command overwrite --doc-format markdown --content "@$README_FILE" --as user --format json 2>&1 | tail -5
    
    # 3. 创建知识拆解节点
    if [ -f "$KNOWLEDGE_FILE" ]; then
        echo "  创建知识拆解节点..."
        KNOWLEDGE_RESULT=$(lark-cli wiki +node-create --parent-node-token "$CHAPTER_NODE_TOKEN" --title "知识拆解" --as user --format json 2>&1)
        KNOWLEDGE_JSON=$(echo "$KNOWLEDGE_RESULT" | sed -n '/^{/,$p')
        KNOWLEDGE_OBJ_TOKEN=$(echo "$KNOWLEDGE_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['obj_token'])" 2>/dev/null)
        
        if [ -n "$KNOWLEDGE_OBJ_TOKEN" ]; then
            echo "  更新知识拆解内容..."
            lark-cli docs +update --doc "$KNOWLEDGE_OBJ_TOKEN" --command overwrite --doc-format markdown --content "@$KNOWLEDGE_FILE" --as user --format json 2>&1 | tail -3
        fi
    fi
    
    # 4. 创建考试指导节点
    if [ -f "$EXAM_FILE" ]; then
        echo "  创建考试指导节点..."
        EXAM_RESULT=$(lark-cli wiki +node-create --parent-node-token "$CHAPTER_NODE_TOKEN" --title "考试指导" --as user --format json 2>&1)
        EXAM_JSON=$(echo "$EXAM_RESULT" | sed -n '/^{/,$p')
        EXAM_OBJ_TOKEN=$(echo "$EXAM_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['obj_token'])" 2>/dev/null)
        
        if [ -n "$EXAM_OBJ_TOKEN" ]; then
            echo "  更新考试指导内容..."
            lark-cli docs +update --doc "$EXAM_OBJ_TOKEN" --command overwrite --doc-format markdown --content "@$EXAM_FILE" --as user --format json 2>&1 | tail -3
        fi
    fi
    
    echo "[$CHAPTER] 完成"
    echo ""
done

echo "=== 同步完成 ==="

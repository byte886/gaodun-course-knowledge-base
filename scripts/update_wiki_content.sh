#!/bin/bash
# 更新飞书知识库节点内容（节点已创建，只更新内容）
# 用法: ./update_wiki_content.sh <起始章号> <结束章号>

set -e

PARENT_NODE="UM6bwW23tiYkCVk3nXtc3TpBnGe"  # 税法课程节点
CONTENT_DIR="/Users/wenjiechen/Doubao/chats/2026-08-26/new-chat/gaodun-course-knowledge-base/knowledge-base/organized-content"

START=${1:-05}
END=${2:-15}

echo "=== 开始更新知识库内容 ==="
echo "章节范围: $START - $END"
echo ""

# 获取税法课程节点下的所有子节点
ALL_NODES=$(lark-cli wiki +node-list --space-id 7678261729456852192 --parent-node-token "$PARENT_NODE" --as user --format json 2>&1)

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
    
    # 从节点列表中找到对应的章节点
    CHAPTER_NODE_TOKEN=$(echo "$ALL_NODES" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for node in data.get('data', {}).get('nodes', []):
    if node['title'].startswith('$CHAPTER_NAME') or node['title'].startswith('$CHAPTER'):
        print(node['node_token'])
        break
" 2>/dev/null)
    
    if [ -z "$CHAPTER_NODE_TOKEN" ]; then
        echo "  未找到章节点，跳过"
        continue
    fi
    
    echo "  章节点: $CHAPTER_NODE_TOKEN"
    
    # 获取章节点的obj_token
    CHAPTER_INFO=$(lark-cli wiki +node-get --node-token "$CHAPTER_NODE_TOKEN" --as user --format json 2>&1)
    CHAPTER_OBJ_TOKEN=$(echo "$CHAPTER_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['obj_token'])" 2>/dev/null)
    
    # 更新章节点内容（README）
    README_FILE="$CHAPTER_DIR/README.md"
    if [ -f "$README_FILE" ]; then
        echo "  更新README..."
        cat "$README_FILE" | lark-cli docs +update --doc "$CHAPTER_OBJ_TOKEN" --command overwrite --doc-format markdown --content - --as user --format json 2>&1 | grep -E '"result"' | head -1
    fi
    
    # 获取章节点下的子节点
    CHILD_NODES=$(lark-cli wiki +node-list --space-id 7678261729456852192 --parent-node-token "$CHAPTER_NODE_TOKEN" --as user --format json 2>&1)
    
    # 更新知识拆解
    KNOWLEDGE_FILE="$CHAPTER_DIR/知识拆解.md"
    if [ -f "$KNOWLEDGE_FILE" ]; then
        KNOWLEDGE_OBJ=$(echo "$CHILD_NODES" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for node in data.get('data', {}).get('nodes', []):
    if node['title'] == '知识拆解':
        print(node['obj_token'])
        break
" 2>/dev/null)
        
        if [ -n "$KNOWLEDGE_OBJ" ]; then
            echo "  更新知识拆解..."
            cat "$KNOWLEDGE_FILE" | lark-cli docs +update --doc "$KNOWLEDGE_OBJ" --command overwrite --doc-format markdown --content - --as user --format json 2>&1 | grep -E '"result"' | head -1
        fi
    fi
    
    # 更新考试指导
    EXAM_FILE="$CHAPTER_DIR/考试指导.md"
    if [ -f "$EXAM_FILE" ]; then
        EXAM_OBJ=$(echo "$CHILD_NODES" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for node in data.get('data', {}).get('nodes', []):
    if node['title'] == '考试指导':
        print(node['obj_token'])
        break
" 2>/dev/null)
        
        if [ -n "$EXAM_OBJ" ]; then
            echo "  更新考试指导..."
            cat "$EXAM_FILE" | lark-cli docs +update --doc "$EXAM_OBJ" --command overwrite --doc-format markdown --content - --as user --format json 2>&1 | grep -E '"result"' | head -1
        fi
    fi
    
    echo "[$CHAPTER] 完成"
    echo ""
done

echo "=== 内容更新完成 ==="

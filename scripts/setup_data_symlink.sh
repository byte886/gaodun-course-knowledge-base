#!/bin/bash
# setup_data_symlink.sh
# 用途：在项目目录创建 data/高顿 符号链接，指向外部数据目录
# 说明：不同电脑的数据目录路径可能不同，运行此脚本可快速创建或调整符号链接
#
# 用法：
#   ./scripts/setup_data_symlink.sh                    # 使用默认路径 ~/Desktop/高顿
#   ./scripts/setup_data_symlink.sh /path/to/高顿     # 指定自定义路径
#   ./scripts/setup_data_symlink.sh --check            # 只检查当前符号链接状态

set -euo pipefail

# 动态获取项目目录（脚本所在目录的上一级）；用 BASH_SOURCE 以兼容被 source 的场景
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$PROJECT_DIR/data"
SYMLINK_PATH="$DATA_DIR/高顿"
DEFAULT_TARGET="$HOME/Desktop/高顿"

# 解析参数
if [ "${1:-}" = "--check" ]; then
    echo "=== 检查符号链接状态 ==="
    if [ -L "$SYMLINK_PATH" ]; then
        echo "符号链接存在: $SYMLINK_PATH"
        echo "指向目标: $(readlink "$SYMLINK_PATH")"
        if [ -d "$SYMLINK_PATH" ]; then
            echo "目标目录: ✅ 可访问"
            echo "内容:"
            ls "$SYMLINK_PATH" 2>/dev/null | head -5
        else
            echo "目标目录: ❌ 不可访问（目标可能不存在）"
        fi
    else
        echo "符号链接不存在: $SYMLINK_PATH"
        echo "请运行此脚本创建符号链接"
    fi
    exit 0
fi

# 确定目标路径
if [ -n "${1:-}" ]; then
    TARGET="$1"
else
    TARGET="$DEFAULT_TARGET"
fi

echo "=== 设置数据目录符号链接 ==="
echo "项目目录: $PROJECT_DIR"
echo "符号链接: $SYMLINK_PATH"
echo "目标路径: $TARGET"
echo ""

# 检查目标目录是否存在
if [ ! -d "$TARGET" ]; then
    echo "⚠️  目标目录不存在: $TARGET"
    echo "请确认路径是否正确，或先创建该目录"
    read -p "是否仍要创建符号链接？(y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "已取消"
        exit 1
    fi
fi

# 创建data目录
mkdir -p "$DATA_DIR"

# 如果符号链接已存在，先删除
if [ -L "$SYMLINK_PATH" ] || [ -e "$SYMLINK_PATH" ]; then
    echo "移除已存在的符号链接/目录..."
    rm -f "$SYMLINK_PATH"
fi

# 创建符号链接
ln -s "$TARGET" "$SYMLINK_PATH"
echo "✅ 符号链接创建成功"
echo ""

# 验证
echo "=== 验证 ==="
ls -la "$SYMLINK_PATH"
echo ""
if [ -d "$SYMLINK_PATH" ]; then
    echo "目标目录内容:"
    ls "$SYMLINK_PATH" 2>/dev/null
else
    echo "⚠️  目标目录不可访问，请检查路径"
fi

echo ""
echo "=== 说明 ==="
echo "1. data/ 目录已在 .gitignore 中忽略，不会提交到GitHub"
echo "2. 不同电脑上运行此脚本可快速调整符号链接路径"
echo "3. 脚本和文档中统一使用相对路径 data/高顿/ 访问数据"
echo "4. 检查状态: ./scripts/setup_data_symlink.sh --check"

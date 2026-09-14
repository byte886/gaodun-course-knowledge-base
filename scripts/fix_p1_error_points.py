#!/usr/bin/env python3
"""P1修复：易错点格式统一为❌→✅对比表"""
import os
import re

COURSES = {
    '会计': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-会计/知识详解',
    '审计': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-审计/知识详解',
    '财管': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-财管/知识详解',
    '税法': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-税法/知识详解',
    '经济法': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-经济法/知识详解',
    '战略': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-战略/知识详解',
}

def extract_error_points(content):
    """提取易错点节内容"""
    # 匹配各种易错点标题
    patterns = [
        r'### \d+\.\s*易错点(?:提示)?\n(.*?)(?=\n### |\n## |\n---|\Z)',
        r'### \d+\.\s*易混点(?:提示)?\n(.*?)(?=\n### |\n## |\n---|\Z)',
        r'### 易错点(?:提示)?\n(.*?)(?=\n### |\n## |\n---|\Z)',
        r'### 易混点(?:提示)?\n(.*?)(?=\n### |\n## |\n---|\Z)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, content, re.DOTALL)
        if match:
            return match.group(1), match.start(), match.end()
    
    return None, None, None

def parse_points(error_text):
    """解析易错点为列表"""
    points = []
    
    # 编号列表：1. xxx 2. xxx
    numbered = re.findall(r'\d+\.\s*(.+?)(?=\n\d+\.|\n- |\Z)', error_text, re.DOTALL)
    if numbered:
        for p in numbered:
            p = p.strip()
            if p and len(p) > 5:
                points.append(p)
        return points
    
    # 项目符号：- xxx
    bullets = re.findall(r'^-\s*(.+)$', error_text, re.MULTILINE)
    if bullets:
        for p in bullets:
            p = p.strip()
            if p and len(p) > 5:
                points.append(p)
        return points
    
    # 段落
    paragraphs = [p.strip() for p in error_text.split('\n\n') if p.strip() and len(p.strip()) > 10]
    return paragraphs

def format_as_table(points):
    """格式化为❌→✅对比表"""
    if not points:
        return None
    
    lines = []
    lines.append('| 易错点 | 正确处理 |')
    lines.append('|--------|----------|')
    
    for p in points:
        # 清理文本
        p = re.sub(r'\n+', ' ', p).strip()
        p = re.sub(r'\s+', ' ', p)
        
        # 尝试分离错误和正确（常见格式："区分A与B：A是xxx，B是xxx"）
        if '：' in p and len(p) > 20:
            parts = p.split('：', 1)
            error_part = parts[0].strip()
            correct_part = parts[1].strip()
            if len(correct_part) > 80:
                correct_part = correct_part[:80] + '…'
            lines.append(f'| ❌{error_part} | ✅{correct_part} |')
        else:
            # 无法分离，错误列填原表述，正确列填"注意区分"
            if len(p) > 60:
                p_short = p[:60] + '…'
            else:
                p_short = p
            lines.append(f'| ❌{p_short} | ✅注意区分，详见上文解析 |')
    
    return '\n'.join(lines)

def fix_file(path):
    with open(path, 'r') as f:
        content = f.read()
    
    # 检查是否已经是对比表格式
    if '❌' in content and '✅' in content and '| 易错点 |' in content:
        return False, 'already table'
    
    # 提取易错点
    error_text, start, end = extract_error_points(content)
    if not error_text:
        return False, 'no error section'
    
    # 解析易错点
    points = parse_points(error_text)
    if not points:
        return False, 'no points parsed'
    
    # 格式化为表格
    table = format_as_table(points)
    if not table:
        return False, 'table generation failed'
    
    # 替换易错点节内容（保留标题）
    # 找到标题行（支持有数字和无数字两种格式）
    title_match = re.search(r'(### (?:\d+\.\s*)?易错点(?:提示)?)\n', content[start:end])
    if not title_match:
        title_match = re.search(r'(### (?:\d+\.\s*)?易混点(?:提示)?)\n', content[start:end])
    
    if title_match:
        title = title_match.group(1)
        new_section = title + '\n\n' + table + '\n'
        content = content[:start] + new_section + content[end:]
    else:
        return False, 'title not found'
    
    with open(path, 'w') as f:
        f.write(content)
    
    return True, f'{len(points)} points converted'

def main():
    total_changed = 0
    for course_name, base in COURSES.items():
        course_changed = 0
        for root, dirs, files in os.walk(base):
            for f in files:
                if not f.endswith('.md'):
                    continue
                path = os.path.join(root, f)
                success, msg = fix_file(path)
                if success:
                    course_changed += 1
        print(f"{course_name}: 修改{course_changed}个")
        total_changed += course_changed
    print(f"\n总计修改: {total_changed}个")

if __name__ == '__main__':
    main()

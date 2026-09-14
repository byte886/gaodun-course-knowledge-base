#!/usr/bin/env python3
"""P0修复：章节编号统一（## 数字. → ### 数字.，### （中文）→ ### 数字.）"""
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

# 中文数字到阿拉伯数字映射
CN_NUM = {
    '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
    '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
    '十一': '11', '十二': '12', '十三': '13', '十四': '14', '十五': '15',
    '十六': '16', '十七': '17', '十八': '18', '十九': '19', '二十': '20',
}

def fix_heading_numbers(content):
    """修复标题编号"""
    changes = []
    lines = content.split('\n')
    new_lines = []
    h3_counter = 0  # 当前H3编号计数器（在每个文档内重置）
    
    for line in lines:
        original = line
        
        # 1. 修复 ## 数字. → ### 数字. （层级错误，H2误用为H3）
        # 但要排除固定四节（一、知识拆解等）和H1
        match = re.match(r'^## (\d+)\.\s*(.+)$', line)
        if match:
            num = match.group(1)
            title = match.group(2)
            line = f'### {num}. {title}'
            changes.append('h2_to_h3')
            h3_counter = int(num)
        
        # 2. 修复 ### （中文）→ ### 数字.
        match = re.match(r'^### （([一二三四五六七八九十]+)）\s*(.+)$', line)
        if match:
            cn = match.group(1)
            title = match.group(2)
            if cn in CN_NUM:
                num = CN_NUM[cn]
                line = f'### {num}. {title}'
                changes.append('cn_to_num')
                h3_counter = int(num)
        
        new_lines.append(line)
    
    return '\n'.join(new_lines), changes

def fix_file(path):
    with open(path, 'r') as f:
        content = f.read()
    
    new_content, changes = fix_heading_numbers(content)
    
    if not changes:
        return False, 'no changes'
    
    with open(path, 'w') as f:
        f.write(new_content)
    
    return True, ', '.join(set(changes))

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

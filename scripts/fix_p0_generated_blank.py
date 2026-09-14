#!/usr/bin/env python3
"""P0修复：generated格式统一 + 清理多余空行"""
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

def fix_file(path):
    with open(path, 'r') as f:
        content = f.read()
    
    if not content.startswith('---'):
        return False, 'no frontmatter'
    
    parts = content.split('---', 2)
    if len(parts) < 3:
        return False, 'invalid frontmatter'
    
    fm = parts[1]
    body = parts[2]
    changes = []
    
    # 1. 修复generated展开格式（只有process，没有at）
    gen_match = re.search(r'generated:\s*\n\s*process:\s*(.+?)\n', fm)
    if gen_match and 'at:' not in gen_match.group(0):
        process = gen_match.group(1).strip()
        # 从文件修改时间或默认值获取at
        compact = f'generated: {{ by: {process}, at: 2026-09-13T00:00:00+08:00 }}'
        fm = fm[:gen_match.start()] + compact + '\n' + fm[gen_match.end():]
        changes.append('generated')
    
    # 2. 修复generated展开格式（有process和at）
    gen_match2 = re.search(r'generated:\s*\n\s*process:\s*(.+?)\n\s*at:\s*(.+?)\n', fm)
    if gen_match2:
        process = gen_match2.group(1).strip()
        at = gen_match2.group(2).strip()
        compact = f'generated: {{ by: {process}, at: {at} }}'
        fm = fm[:gen_match2.start()] + compact + '\n' + fm[gen_match2.end():]
        changes.append('generated')
    
    # 3. 清理frontmatter和body之间的多余空行
    # 匹配 --- 后面的多个空行
    body = re.sub(r'^\n{2,}', '\n', body)
    
    # 4. 清理frontmatter内部的多余空行
    fm = re.sub(r'\n{3,}', '\n\n', fm).strip()
    
    if not changes and body == parts[2]:
        return False, 'no changes'
    
    if body != parts[2]:
        changes.append('clean_blank_lines')
    
    new_content = '---\n' + fm + '\n---\n' + body
    
    with open(path, 'w') as f:
        f.write(new_content)
    
    return True, ', '.join(changes)

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

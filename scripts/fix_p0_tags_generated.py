#!/usr/bin/env python3
"""P0修复补充：tags/generated/teachers格式统一（简单可靠版）"""
import os
import re

COURSES = {
    '会计': {'base': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-会计/知识详解', 'slug': 'accounting'},
    '审计': {'base': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-审计/知识详解', 'slug': 'audit'},
    '财管': {'base': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-财管/知识详解', 'slug': 'finance'},
    '税法': {'base': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-税法/知识详解', 'slug': 'tax'},
    '经济法': {'base': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-经济法/知识详解', 'slug': 'economic-law'},
    '战略': {'base': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-战略/知识详解', 'slug': 'strategy'},
}

def get_chapter_num(fm_text):
    """从chapter字段提取章号"""
    match = re.search(r'^chapter:\s*"?(\d+)_', fm_text, re.MULTILINE)
    if match:
        return match.group(1).zfill(2)
    return '00'

def fix_file(path, course_slug):
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
    
    # 1. 修复generated展开格式 -> 紧凑格式
    # 匹配 generated:\n  process: xxx\n  at: xxx
    gen_match = re.search(r'generated:\s*\n\s*process:\s*(.+?)\n\s*at:\s*(.+?)\n', fm)
    if gen_match:
        process = gen_match.group(1).strip()
        at = gen_match.group(2).strip()
        compact = f'generated: {{ by: {process}, at: {at} }}'
        fm = fm[:gen_match.start()] + compact + '\n' + fm[gen_match.end():]
        changes.append('generated')
    
    # 2. 修复teachers展开格式 -> 紧凑格式
    # 匹配 teachers:\n  - xxx\n  - yyy
    teacher_match = re.search(r'teachers:\s*\n((?:\s+-.+\n?)+)', fm)
    if teacher_match:
        teachers = re.findall(r'-\s*(.+)', teacher_match.group(1))
        compact = 'teachers: [' + ', '.join(teachers) + ']'
        fm = fm[:teacher_match.start()] + compact + '\n' + fm[teacher_match.end():]
        changes.append('teachers')
    
    # 3. 添加tags（如果缺少）
    if not re.search(r'^tags:', fm, re.MULTILINE):
        chapter_num = get_chapter_num(fm)
        tags_line = f'tags: [cpa, {course_slug}, 26-season, chapter-{chapter_num}]'
        
        # 在description后面插入
        desc_match = re.search(r'^(description:\s*.+?)$', fm, re.MULTILINE)
        if desc_match:
            fm = fm[:desc_match.end()] + '\n' + tags_line + fm[desc_match.end():]
            changes.append('tags')
        else:
            # 在title后面插入
            title_match = re.search(r'^(title:\s*.+?)$', fm, re.MULTILINE)
            if title_match:
                fm = fm[:title_match.end()] + '\n' + tags_line + fm[title_match.end():]
                changes.append('tags')
    
    if not changes:
        return False, 'no changes'
    
    # 清理多余空行
    fm = re.sub(r'\n{3,}', '\n\n', fm).strip()
    
    new_content = '---\n' + fm + '\n---\n' + body
    
    with open(path, 'w') as f:
        f.write(new_content)
    
    return True, ', '.join(changes)

def main():
    total_changed = 0
    for course_name, config in COURSES.items():
        base = config['base']
        course_changed = 0
        for root, dirs, files in os.walk(base):
            for f in files:
                if not f.endswith('.md'):
                    continue
                path = os.path.join(root, f)
                success, msg = fix_file(path, config['slug'])
                if success:
                    course_changed += 1
                    if course_changed <= 5:  # 只打印前5个
                        print(f"  ✓ {course_name}/{os.path.relpath(path, base)}: {msg}")
        if course_changed > 5:
            print(f"  ... 还有 {course_changed - 5} 个文件已修改")
        print(f"{course_name}: 修改{course_changed}个")
        total_changed += course_changed
    print(f"\n总计修改: {total_changed}个")

if __name__ == '__main__':
    main()

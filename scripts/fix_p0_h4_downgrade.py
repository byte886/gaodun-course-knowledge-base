#!/usr/bin/env python3
"""P0修复补充：### （数字）→ #### （数字）（降级为H4）"""
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
    
    # ### （数字） → #### （数字）
    new_content = re.sub(r'^### （(\d+)）', r'#### （\1）', content, flags=re.MULTILINE)
    
    if new_content == content:
        return False, 'no changes'
    
    with open(path, 'w') as f:
        f.write(new_content)
    
    count = len(re.findall(r'^#### （\d+）', new_content, flags=re.MULTILINE)) - len(re.findall(r'^#### （\d+）', content, flags=re.MULTILINE))
    return True, f'{count} headings downgraded'

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

#!/usr/bin/env python3
"""P2修复：拆分过长段落（超过300字的在句号处拆分）"""
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

def split_long_paragraph(paragraph, max_len=300):
    """拆分过长段落"""
    # 清理文本长度
    text = re.sub(r'[#*>\-|`]', '', paragraph).strip()
    if len(text) <= max_len:
        return paragraph, False
    
    # 在句号处拆分
    # 先按句号分割，保留句号
    sentences = re.split(r'(。)', paragraph)
    if len(sentences) < 3:  # 不足2个完整句子，不拆分
        return paragraph, False
    
    # 重新组合句子，每段控制在max_len左右
    paragraphs = []
    current = ''
    for i in range(0, len(sentences) - 1, 2):
        sentence = sentences[i] + sentences[i+1]  # 句子+句号
        if len(current) + len(sentence) > max_len and current:
            paragraphs.append(current.strip())
            current = sentence
        else:
            current += sentence
    
    # 处理最后一个不完整的句子
    if len(sentences) % 2 == 1:
        current += sentences[-1]
    
    if current.strip():
        paragraphs.append(current.strip())
    
    if len(paragraphs) <= 1:
        return paragraph, False
    
    return '\n\n'.join(paragraphs), True

def fix_file(path):
    with open(path, 'r') as f:
        content = f.read()
    
    # 按段落分割
    parts = re.split(r'(\n\n+)', content)
    changed = False
    new_parts = []
    
    for part in parts:
        # 只处理非空、非标题、非表格、非列表、非引用块、非代码块的段落
        stripped = part.strip()
        if (stripped and 
            not stripped.startswith('#') and 
            not stripped.startswith('|') and 
            not stripped.startswith('-') and 
            not stripped.startswith('>') and 
            not stripped.startswith('```') and
            not stripped.startswith('---') and
            '\n' not in stripped):  # 单行段落
            
            new_part, was_split = split_long_paragraph(stripped)
            if was_split:
                changed = True
                # 保留原有的换行符
                leading = part[:len(part) - len(part.lstrip())]
                trailing = part[len(part.rstrip()):]
                new_parts.append(leading + new_part + trailing)
                continue
        
        new_parts.append(part)
    
    if not changed:
        return False, 'no changes'
    
    new_content = ''.join(new_parts)
    
    with open(path, 'w') as f:
        f.write(new_content)
    
    return True, 'paragraphs split'

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

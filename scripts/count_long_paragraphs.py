#!/usr/bin/env python3
"""统计过长段落数量"""
import os, re

COURSES = ['会计','审计','财管','税法','经济法','战略']
total_long = 0
for course in COURSES:
    base = f'/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-{course}/知识详解'
    long_count = 0
    for root, dirs, files in os.walk(base):
        for f in files:
            if not f.endswith('.md'): continue
            path = os.path.join(root, f)
            with open(path) as fp:
                content = fp.read()
            paragraphs = re.split(r'\n\n+', content)
            for p in paragraphs:
                p = p.strip()
                if p.startswith('#') or p.startswith('|') or p.startswith('-') or p.startswith('>') or p.startswith('```'):
                    continue
                if p.startswith('---'):
                    continue
                text = re.sub(r'[#*>\-|`]', '', p).strip()
                if len(text) > 200:
                    long_count += 1
    print(f'{course}: 超过200字段落={long_count}')
    total_long += long_count
print(f'\n总计超过200字段落: {total_long}')

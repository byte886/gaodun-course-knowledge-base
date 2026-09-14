#!/usr/bin/env python3
"""P1修复：压缩description至100-150字（基于文档结构自动生成）"""
import os
import re

COURSES = {
    '会计': {'base': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-会计/知识详解', 'exam': '会计'},
    '审计': {'base': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-审计/知识详解', 'exam': '审计'},
    '财管': {'base': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-财管/知识详解', 'exam': '财务成本管理'},
    '税法': {'base': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-税法/知识详解', 'exam': '税法'},
    '经济法': {'base': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-经济法/知识详解', 'exam': '经济法'},
    '战略': {'base': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-战略/知识详解', 'exam': '公司战略与风险管理'},
}

def extract_h1(content):
    """提取H1标题"""
    match = re.search(r'^# (.+)$', content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return ''

def extract_chapter(fm_text):
    """提取章名"""
    match = re.search(r'^chapter:\s*"?(\d+)_(.+?)"?\s*$', fm_text, re.MULTILINE)
    if match:
        return match.group(2).strip()
    return ''

def extract_h3_titles(content):
    """提取H3子标题（知识拆解节内的）"""
    # 找到知识拆解节
    kc_match = re.search(r'## 一、知识拆解\n(.*?)(?=\n## |\Z)', content, re.DOTALL)
    if not kc_match:
        return []
    
    kc_content = kc_match.group(1)
    # 提取H3标题
    h3_titles = re.findall(r'^### \d+\.\s*(.+)$', kc_content, re.MULTILINE)
    return h3_titles

def extract_key_points(content, max_points=5):
    """提取关键考点（从考试指导节）"""
    exam_match = re.search(r'## 二、考试指导\n(.*?)(?=\n## |\Z)', content, re.DOTALL)
    if not exam_match:
        return []
    
    exam_content = exam_match.group(1)
    # 提取高频考点
    hf_match = re.search(r'### \d+\.\s*高频考点\n(.*?)(?=\n### |\Z)', exam_content, re.DOTALL)
    if hf_match:
        points = re.findall(r'\d+\.\s*(.+?)(?=\n|$)', hf_match.group(1))
        return [p.strip() for p in points[:max_points]]
    
    return []

def generate_description(title, chapter, h3_titles, key_points, exam_name):
    """生成100-150字的description"""
    # 基础信息
    parts = [f'{chapter}知识点']
    
    # 核心要点（优先用H3标题，其次用高频考点）
    points = h3_titles[:4] if h3_titles else key_points[:4]
    if points:
        # 清理标题（去掉过长的描述）
        clean_points = []
        for p in points:
            p = re.sub(r'（.*?）', '', p).strip()  # 去掉括号内说明
            p = re.sub(r'\(.*?\)', '', p).strip()
            if len(p) > 15:
                p = p[:15] + '…'
            clean_points.append(p)
        parts.append('核心要点：' + '、'.join(clean_points))
    
    # 考试地位
    parts.append(f'2026考季CPA{exam_name}考点')
    
    desc = '。'.join(parts) + '。'
    
    # 调整长度到100-150字
    if len(desc) < 100 and h3_titles:
        # 补充更多要点
        extra = h3_titles[4:6]
        if extra:
            clean_extra = [re.sub(r'（.*?）', '', p).strip()[:10] for p in extra]
            desc = desc.replace('核心要点：' + '、'.join(clean_points[:4]), 
                               '核心要点：' + '、'.join(clean_points[:4] + clean_extra))
    
    if len(desc) > 150:
        # 截断
        desc = desc[:147] + '…。'
    
    return desc

def fix_file(path, exam_name):
    with open(path, 'r') as f:
        content = f.read()
    
    if not content.startswith('---'):
        return False, 'no frontmatter'
    
    parts = content.split('---', 2)
    if len(parts) < 3:
        return False, 'invalid frontmatter'
    
    fm = parts[1]
    body = parts[2]
    
    # 检查当前description长度
    desc_match = re.search(r'^description:\s*"?(.+?)"?\s*$', fm, re.MULTILINE)
    if not desc_match:
        return False, 'no description'
    
    old_desc = desc_match.group(1)
    if 100 <= len(old_desc) <= 150:
        return False, 'already good'
    
    # 提取信息生成新description
    title = extract_h1(body)
    chapter = extract_chapter(fm)
    h3_titles = extract_h3_titles(body)
    key_points = extract_key_points(body)
    
    new_desc = generate_description(title, chapter, h3_titles, key_points, exam_name)
    
    # 替换description
    fm = re.sub(r'^description:\s*"?(.+?)"?\s*$', f'description: {new_desc}', fm, flags=re.MULTILINE)
    
    new_content = '---\n' + fm.strip() + '\n---\n' + body
    
    with open(path, 'w') as f:
        f.write(new_content)
    
    return True, f'{len(old_desc)}字→{len(new_desc)}字'

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
                success, msg = fix_file(path, config['exam'])
                if success:
                    course_changed += 1
        print(f"{course_name}: 修改{course_changed}个")
        total_changed += course_changed
    print(f"\n总计修改: {total_changed}个")

if __name__ == '__main__':
    main()

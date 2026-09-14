#!/usr/bin/env python3
"""P1修复补充：description扩充至100-150字"""
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
    match = re.search(r'^# (.+)$', content, re.MULTILINE)
    return match.group(1).strip() if match else ''

def extract_chapter(fm_text):
    match = re.search(r'^chapter:\s*"?(\d+)_(.+?)"?\s*$', fm_text, re.MULTILINE)
    return match.group(2).strip() if match else ''

def extract_h3_titles(content):
    kc_match = re.search(r'## 一、知识拆解\n(.*?)(?=\n## |\Z)', content, re.DOTALL)
    if not kc_match:
        return []
    h3_titles = re.findall(r'^### \d+\.\s*(.+)$', kc_match.group(1), re.MULTILINE)
    return h3_titles

def extract_exam_info(content):
    """提取考试指导信息（考情、高频考点）"""
    exam_match = re.search(r'## 二、考试指导\n(.*?)(?=\n## |\Z)', content, re.DOTALL)
    if not exam_match:
        return '', []
    
    exam_content = exam_match.group(1)
    
    # 提取考情
    kq_match = re.search(r'### \d+\.\s*考情\n(.*?)(?=\n### |\Z)', exam_content, re.DOTALL)
    kq_text = kq_match.group(1).strip() if kq_match else ''
    # 清理考情文本（去掉markdown格式，取前50字）
    kq_text = re.sub(r'[#*>`\n]', ' ', kq_text)
    kq_text = re.sub(r'\s+', ' ', kq_text).strip()
    if len(kq_text) > 50:
        kq_text = kq_text[:50] + '…'
    
    # 提取高频考点
    hf_match = re.search(r'### \d+\.\s*高频考点\n(.*?)(?=\n### |\Z)', exam_content, re.DOTALL)
    points = []
    if hf_match:
        points = re.findall(r'\d+\.\s*(.+?)(?=\n|$)', hf_match.group(1))
        points = [p.strip() for p in points if p.strip()]
    
    return kq_text, points

def generate_description(title, chapter, h3_titles, kq_text, key_points, exam_name):
    """生成100-150字的description"""
    # 第一部分：定位
    part1 = f'{chapter}·{title}，2026考季CPA{exam_name}考点'
    
    # 第二部分：核心要点
    points = h3_titles[:5] if h3_titles else key_points[:5]
    clean_points = []
    for p in points:
        p = re.sub(r'（.*?）', '', p).strip()
        p = re.sub(r'\(.*?\)', '', p).strip()
        p = re.sub(r'教材例\d+-\d+', '', p).strip()
        if p and len(p) > 2:
            if len(p) > 12:
                p = p[:12] + '…'
            clean_points.append(p)
    
    # 去重
    clean_points = list(dict.fromkeys(clean_points))[:5]
    
    part2 = '核心要点：' + '、'.join(clean_points) if clean_points else ''
    
    # 第三部分：考情（如果有）
    part3 = kq_text if kq_text and len(kq_text) > 10 else ''
    
    # 组合
    parts = [p for p in [part1, part2, part3] if p]
    desc = '。'.join(parts) + '。'
    
    # 调整长度
    if len(desc) < 100 and h3_titles and len(clean_points) < 5:
        # 补充更多要点
        extra = [p for p in h3_titles[5:7] if p.strip()]
        for p in extra:
            p = re.sub(r'（.*?）', '', p).strip()[:10]
            if p and p not in clean_points:
                clean_points.append(p)
        if clean_points:
            part2 = '核心要点：' + '、'.join(clean_points[:6])
            parts = [p for p in [part1, part2, part3] if p]
            desc = '。'.join(parts) + '。'
    
    if len(desc) > 150:
        # 截断考情部分
        if part3:
            desc = '。'.join([part1, part2]) + '。'
        if len(desc) > 150:
            desc = desc[:147] + '…。'
    
    if len(desc) < 80:
        # 太短，补充通用说明
        desc = desc.rstrip('。') + '。涵盖定义、特征、分类、计算与账务处理，需结合教材例题理解。'
    
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
    
    desc_match = re.search(r'^description:\s*(.+)$', fm, re.MULTILINE)
    if not desc_match:
        return False, 'no description'
    
    old_desc = desc_match.group(1)
    if 100 <= len(old_desc) <= 150:
        return False, 'already good'
    
    title = extract_h1(body)
    chapter = extract_chapter(fm)
    h3_titles = extract_h3_titles(body)
    kq_text, key_points = extract_exam_info(body)
    
    new_desc = generate_description(title, chapter, h3_titles, kq_text, key_points, exam_name)
    
    fm = re.sub(r'^description:\s*.+$', f'description: {new_desc}', fm, flags=re.MULTILINE)
    
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

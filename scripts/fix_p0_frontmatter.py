#!/usr/bin/env python3
"""P0批量修复：frontmatter格式统一 + H1标题规范"""
import os
import re

# 科目配置
COURSES = {
    '会计': {
        'base': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-会计/知识详解',
        'slug': 'accounting',
    },
    '审计': {
        'base': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-审计/知识详解',
        'slug': 'audit',
    },
    '财管': {
        'base': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-财管/知识详解',
        'slug': 'finance',
    },
    '税法': {
        'base': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-税法/知识详解',
        'slug': 'tax',
    },
    '经济法': {
        'base': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-经济法/知识详解',
        'slug': 'economic-law',
    },
    '战略': {
        'base': '/Users/wenjiechen/Desktop/高顿/CPA/【VIPCPA专享】名师专业课-战略/知识详解',
        'slug': 'strategy',
    },
}

# 中文tag到英文slug的映射
TAG_MAP = {
    'CPA': 'cpa',
    '会计': 'accounting',
    '审计': 'audit',
    '财管': 'finance',
    '税法': 'tax',
    '经济法': 'economic-law',
    '战略': 'strategy',
}

def parse_frontmatter(content):
    """解析frontmatter，返回(frontmatter_text, body_text)"""
    if not content.startswith('---'):
        return None, content
    parts = content.split('---', 2)
    if len(parts) < 3:
        return None, content
    return parts[1], parts[2]

def extract_field(fm_text, field_name):
    """提取字段值（支持紧凑和展开格式）"""
    # 紧凑格式：field: value
    pattern_compact = rf'^{field_name}:\s*(.+)$'
    match = re.search(pattern_compact, fm_text, re.MULTILINE)
    if match:
        return match.group(1).strip(), 'compact'
    
    # 展开格式：field:\n  - value1\n  - value2
    pattern_expanded = rf'^{field_name}:\s*\n((?:\s+-.+\n?)+)'
    match = re.search(pattern_expanded, fm_text, re.MULTILINE)
    if match:
        items = re.findall(r'-\s*(.+)', match.group(1))
        return items, 'expanded'
    
    return None, None

def remove_field(fm_text, field_name):
    """删除字段（支持紧凑和展开格式）"""
    # 先删展开格式
    pattern_expanded = rf'^{field_name}:\s*\n(?:\s+-.+\n?)+'
    fm_text = re.sub(pattern_expanded, '', fm_text, flags=re.MULTILINE)
    
    # 再删紧凑格式
    pattern_compact = rf'^{field_name}:\s*.+\n'
    fm_text = re.sub(pattern_compact, '', fm_text, flags=re.MULTILINE)
    
    return fm_text

def normalize_tags(fm_text, course_slug, chapter_num):
    """统一tags为英文slug紧凑数组"""
    tags_value, tags_type = extract_field(fm_text, 'tags')
    
    # 构建标准tags
    standard_tags = f'[cpa, {course_slug}, 26-season, chapter-{chapter_num}]'
    
    if tags_type == 'compact':
        # 已经是紧凑格式，检查是否需要更新
        if 'cpa' in tags_value and course_slug in tags_value:
            return fm_text  # 已经是标准格式
    
    # 删除旧tags，插入新tags
    fm_text = remove_field(fm_text, 'tags')
    
    # 在description后面插入tags
    if 'description:' in fm_text:
        fm_text = re.sub(
            r'(description:\s*".+?")\n',
            rf'\1\ntags: {standard_tags}\n',
            fm_text,
            count=1
        )
    else:
        # 在title后面插入
        fm_text = re.sub(
            r'(title:\s*.+?)\n',
            rf'\1\ntags: {standard_tags}\n',
            fm_text,
            count=1
        )
    
    return fm_text

def normalize_generated(fm_text):
    """统一generated为紧凑格式"""
    gen_value, gen_type = extract_field(fm_text, 'generated')
    
    if gen_type == 'compact':
        return fm_text  # 已经是紧凑格式
    
    if gen_type == 'expanded':
        # 展开格式转紧凑
        process = ''
        at = ''
        for item in gen_value:
            if ':' in item:
                k, v = item.split(':', 1)
                k = k.strip()
                v = v.strip()
                if k == 'process':
                    process = v
                elif k == 'at':
                    at = v
        
        compact_gen = f'{{ by: {process}, at: {at} }}'
        
        fm_text = remove_field(fm_text, 'generated')
        
        # 在sources后面插入
        if 'sources:' in fm_text:
            # 找到sources块结束位置
            pattern = r'(sources:\s*\n(?:\s+-.+\n?)+)'
            match = re.search(pattern, fm_text)
            if match:
                fm_text = fm_text[:match.end()] + f'\ngenerated: {compact_gen}' + fm_text[match.end():]
            else:
                fm_text += f'\ngenerated: {compact_gen}'
        else:
            fm_text += f'\ngenerated: {compact_gen}'
    
    return fm_text

def normalize_teachers(fm_text):
    """统一teachers为紧凑数组"""
    teachers_value, teachers_type = extract_field(fm_text, 'teachers')
    
    if teachers_type == 'compact':
        return fm_text  # 已经是紧凑格式
    
    if teachers_type == 'expanded':
        compact_teachers = '[' + ', '.join(teachers_value) + ']'
        
        fm_text = remove_field(fm_text, 'teachers')
        
        # 在exam_season后面插入
        if 'exam_season:' in fm_text:
            fm_text = re.sub(
                r'(exam_season:\s*.+?)\n',
                rf'\1\nteachers: {compact_teachers}\n',
                fm_text,
                count=1
            )
        else:
            fm_text += f'\nteachers: {compact_teachers}'
    
    return fm_text

def remove_nonstandard_fields(fm_text):
    """删除非标准字段"""
    nonstandard = ['question_count', 'point_count', 'scope']
    for field in nonstandard:
        fm_text = remove_field(fm_text, field)
    return fm_text

def extract_chapter_num(chapter_value):
    """从chapter字段提取章号"""
    if not chapter_value:
        return '00'
    
    # 格式1："29_合并财务报表"
    match = re.match(r'(\d+)_', chapter_value)
    if match:
        return match.group(1).zfill(2)
    
    # 格式2："第五章 投资项目资本预算"
    cn_nums = {'一': '1', '二': '2', '三': '3', '四': '4', '五': '5', 
                '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
                '十一': '11', '十二': '12', '十三': '13', '十四': '14',
                '十五': '15', '十六': '16', '十七': '17', '十八': '18',
                '十九': '19', '二十': '20'}
    match = re.match(r'第([一二三四五六七八九十]+)章', chapter_value)
    if match:
        return cn_nums.get(match.group(1), '00').zfill(2)
    
    return '00'

def normalize_chapter(fm_text):
    """统一chapter字段格式为NN_章名"""
    chapter_value, _ = extract_field(fm_text, 'chapter')
    if not chapter_value:
        return fm_text
    
    chapter_value = chapter_value.strip('"').strip("'")
    
    # 如果已经是NN_格式，不处理
    if re.match(r'\d+_', chapter_value):
        return fm_text
    
    # 从"第五章 投资项目资本预算"转为"05_投资项目资本预算"
    match = re.match(r'第([一二三四五六七八九十]+)章\s*(.+)', chapter_value)
    if match:
        cn_num = match.group(1)
        name = match.group(2)
        cn_nums = {'一': '1', '二': '2', '三': '3', '四': '4', '五': '5', 
                    '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
                    '十一': '11', '十二': '12', '十三': '13', '十四': '14',
                    '十五': '15', '十六': '16', '十七': '17', '十八': '18',
                    '十九': '19', '二十': '20'}
        num = cn_nums.get(cn_num, '00').zfill(2)
        new_chapter = f'{num}_{name}'
        
        fm_text = re.sub(
            r'^chapter:\s*.+$',
            f'chapter: {new_chapter}',
            fm_text,
            flags=re.MULTILINE
        )
    
    return fm_text

def fix_h1_title(body_text):
    """修复H1标题：去掉point_id前缀"""
    # 匹配 "# 4001 合同的效力" 格式
    pattern = r'^#\s+\d+\s+(.+)$'
    match = re.search(pattern, body_text, re.MULTILINE)
    if match:
        new_title = match.group(1)
        body_text = re.sub(
            pattern,
            f'# {new_title}',
            body_text,
            count=1,
            flags=re.MULTILINE
        )
        return body_text, True
    return body_text, False

def process_file(path, course_name, course_config):
    """处理单个文件"""
    with open(path, 'r') as f:
        content = f.read()
    
    fm_text, body_text = parse_frontmatter(content)
    if fm_text is None:
        return False, 'no frontmatter'
    
    changes = []
    
    # 1. 提取chapter号
    chapter_value, _ = extract_field(fm_text, 'chapter')
    chapter_num = extract_chapter_num(chapter_value)
    
    # 2. 统一tags
    old_fm = fm_text
    fm_text = normalize_tags(fm_text, course_config['slug'], chapter_num)
    if fm_text != old_fm:
        changes.append('tags')
    
    # 3. 统一generated
    old_fm = fm_text
    fm_text = normalize_generated(fm_text)
    if fm_text != old_fm:
        changes.append('generated')
    
    # 4. 统一teachers
    old_fm = fm_text
    fm_text = normalize_teachers(fm_text)
    if fm_text != old_fm:
        changes.append('teachers')
    
    # 5. 统一chapter格式
    old_fm = fm_text
    fm_text = normalize_chapter(fm_text)
    if fm_text != old_fm:
        changes.append('chapter')
    
    # 6. 删除非标准字段
    old_fm = fm_text
    fm_text = remove_nonstandard_fields(fm_text)
    if fm_text != old_fm:
        changes.append('remove_nonstandard')
    
    # 7. 修复H1标题
    body_text, h1_fixed = fix_h1_title(body_text)
    if h1_fixed:
        changes.append('h1_title')
    
    if not changes:
        return False, 'no changes'
    
    # 清理frontmatter中的多余空行
    fm_text = re.sub(r'\n{3,}', '\n\n', fm_text).strip()
    
    # 写回
    new_content = '---\n' + fm_text + '\n---\n' + body_text
    
    with open(path, 'w') as f:
        f.write(new_content)
    
    return True, ', '.join(changes)

def main():
    total_changed = 0
    total_skipped = 0
    
    for course_name, config in COURSES.items():
        base = config['base']
        print(f"\n=== 处理 {course_name} ===")
        course_changed = 0
        course_skipped = 0
        
        for root, dirs, files in os.walk(base):
            for f in files:
                if not f.endswith('.md'):
                    continue
                path = os.path.join(root, f)
                success, msg = process_file(path, course_name, config)
                if success:
                    course_changed += 1
                    print(f"  ✓ {os.path.relpath(path, base)}: {msg}")
                else:
                    course_skipped += 1
        
        print(f"  {course_name}: 修改{course_changed}个, 跳过{course_skipped}个")
        total_changed += course_changed
        total_skipped += course_skipped
    
    print(f"\n=== 总计 ===")
    print(f"修改: {total_changed}个")
    print(f"跳过: {total_skipped}个")

if __name__ == '__main__':
    main()

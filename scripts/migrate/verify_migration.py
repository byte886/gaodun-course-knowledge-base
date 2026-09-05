#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
M6 迁移总校验：对照《存量迁移方案》第七节验收清单逐项核验，全绿才判定迁移完成。
用法: python3 scripts/migrate/verify_migration.py
"""
import json, os, glob, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
COURSE = os.path.join(ROOT, "data/高顿/CPA/课程库/【26考季】VIPCPA系列-税法（蔡俊峻老师）")
WS = os.path.join(COURSE, "_workspace")
RAW = os.path.join(COURSE, "原始资源")
ORG = os.path.join(ROOT, "knowledge-base/organized-content")

results = []
def check(name, cond, detail=""):
    results.append((cond, name, detail))

# 1. 视频
vdirs = sorted(glob.glob(os.path.join(RAW, "videos", "*/")))
mp4 = glob.glob(os.path.join(RAW, "videos", "*", "video.mp4"))
tmd = glob.glob(os.path.join(RAW, "videos", "*", "transcript.md"))
tj = glob.glob(os.path.join(RAW, "videos", "*", "transcript.json"))
check("videos 39 目录", len(vdirs) == 39, f"实{len(vdirs)}")
check("video.mp4/transcript.md/.json 各39", len(mp4) == len(tmd) == len(tj) == 39,
      f"{len(mp4)}/{len(tmd)}/{len(tj)}")

# 2. 讲义
pdf = glob.glob(os.path.join(RAW, "notes", "*", "*.pdf"))
ocr = glob.glob(os.path.join(RAW, "notes", "*", "*_OCR.md"))
check("讲义 PDF=26 / OCR=26", len(pdf) == 26 and len(ocr) == 26, f"pdf{len(pdf)}/ocr{len(ocr)}")
# PDF 与 OCR 成对
pdf_stems = {os.path.splitext(os.path.basename(p))[0] for p in pdf}
ocr_stems = {os.path.basename(o)[:-len("_OCR.md")] for o in ocr}
check("PDF 与 OCR 一一对应", pdf_stems == ocr_stems, f"缺OCR:{pdf_stems-ocr_stems} 多OCR:{ocr_stems-pdf_stems}")

# 3. papers
papers = glob.glob(os.path.join(WS, "papers", "*.json"))
check("_workspace/papers=116", len(papers) == 116, f"实{len(papers)}")

# 4. manifest
mf = os.path.join(WS, "manifest/course-manifest.json")
m = json.load(open(mf, encoding="utf-8"))
st = m["stats"]
check("manifest: 14组92点", len(m["knowledge"]["groups"]) == 14 and st["points"] == 92,
      f"组{len(m['knowledge']['groups'])} 点{st['points']} 分布{st['pointCountByGroup']}")
check("manifest: 116卷1296题", st["basePapers"] == 116 and st["questions"] == 1296, f"{st['basePapers']}/{st['questions']}")
check("manifest: 冲刺3卷标末期待采", st["mockPapers"] == 3 and "末期" in st["mockStatus"], st["mockStatus"])
# 每卷可路由到讲且有知识点
pr = m["resources"]["papers"]
no_idx = [k for k, v in pr.items() if v["lectureIdx"] is None]
no_kp = [k for k, v in pr.items() if not v["knowledgePointIds"]]
check("116卷全部路由到讲", len(pr) == 116 and not no_idx, f"无讲:{no_idx}")
check("116卷全部有知识点", not no_kp, f"无标签:{no_kp}")
# manifest 四件套+辅助件齐全
need = ["course-manifest.json", "course_catalog.json", "papers_inventory.json", "paper_index.json",
        "papers_audit.json", "legacy-inventory.md", "movement-log.json"]
have = set(os.listdir(os.path.join(WS, "manifest")))
check("manifest 7 件齐全", all(x in have for x in need), f"缺{set(need)-have}")

# 5. 留言原件
unr = glob.glob(os.path.join(WS, "user-notes-raw", "**", "*.md"), recursive=True)
check("user-notes-raw=3", len(unr) == 3, f"实{len(unr)}")

# 6. 旧成品保留（不搬不删）
org_files = glob.glob(os.path.join(ORG, "**", "*.md"), recursive=True)
legacy_dual = []
for pre in ["00_", "01_", "02_"]:
    d = glob.glob(os.path.join(COURSE, pre + "*/"))[0]
    for fn in ["知识拆解.md", "考试指导.md"]:
        legacy_dual.append(os.path.exists(os.path.join(d, fn)))
check("organized-content 旧成品保留(51文件)", len(org_files) == 51, f"实{len(org_files)}")
check("讲目录00-02旧双文档保留(6)", all(legacy_dual) and len(legacy_dual) == 6, "")

# 7. 无半搬：旧位置清零、无空讲壳(03-38)
old_lec = [d for d in glob.glob(os.path.join(COURSE, "[0-9]*/"))
           if not os.path.basename(d.rstrip("/")).startswith(("00_", "01_", "02_"))]
check("旧讲壳03-38已清空", not old_lec, f"残留{[os.path.basename(x) for x in old_lec]}")
check("旧 knowledge-source/cdp-sniff 已清",
      not os.path.exists(os.path.join(ROOT, "data/knowledge-source"))
      and not os.path.exists(os.path.join(ROOT, "data/cdp-sniff")), "")
# 原始资源下无 .vfetch/.DS_Store
junk = glob.glob(os.path.join(RAW, "**", ".vfetch"), recursive=True) + \
       glob.glob(os.path.join(RAW, "**", ".DS_Store"), recursive=True)
check("原始资源无 .vfetch/.DS_Store", not junk, f"{len(junk)}")

# 8. movement-log 可回滚（每条 src/dst）
log = json.load(open(os.path.join(WS, "manifest/movement-log.json"), encoding="utf-8"))
bad = [e for e in log if not (e.get("src") and e.get("dst"))]
check("movement-log 完整可回滚", len(log) >= 289 and not bad, f"{len(log)}条")

# 输出
print("=" * 72)
okn = 0
for cond, name, detail in results:
    print(f"[{'✓' if cond else '✗'}] {name}" + (f"  ({detail})" if detail and not cond else ""))
    okn += cond
print("=" * 72)
print(f"通过 {okn}/{len(results)}")
sys.exit(0 if okn == len(results) else 1)

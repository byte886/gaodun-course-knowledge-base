# 存量迁移与 course-manifest 生成方案（待审批）

> **文档类型**：Active（一次性施工方案，执行完归档）
> **创建**：2026-09-05　**状态**：✅ 已执行完成（M0–M6，verify_migration 18/18 通过；旧成品按 M5 保留待阶段③消化、阶段④清退）
> **上游范式**：[ADR-012](decisions/ADR-012-三层解耦与按知识点聚合.md)、[WORKFLOW 四阶段](../WORKFLOW.md)、[DIRECTORY_STRUCTURE](../DIRECTORY_STRUCTURE.md)
> **执行 SOP**：迁移本身是"把旧按讲存量搬进三层 + 生成 manifest"，为阶段①②③铺好原料；不替代四阶段 SOP。

---

## 一、目标、范围、非目标

**目标**：把税法课程现存的"按讲 00–38 目录 + knowledge-base 旧成品 + knowledge-source/cdp-sniff 过程件"，**无损搬迁**到封板的三层结构（`原始资源 / 知识详解 / _workspace`），并生成权威 `course-manifest.json`，使后续阶段①–④可直接运行。

**原则**：
1. **先 manifest 后搬数据**：先生成并校验路由，再按路由搬，避免边搬边猜；
2. **move 优先、可重跑、可回滚**：迁移脚本幂等、支持 `--dry-run`；data 不入 Git，回滚靠"移动清单 + 废纸篓"，不硬删；
3. **迁移阶段只搬不改内容**：不改写任何 transcript/OCR/papers 的正文；旧成品只标记为"③的输入"，**不在本阶段删除**；
4. **本地数量与官网 catalog 对齐**：每类资源搬前搬后数量必须相等，差异列出人工确认。

**非目标（本方案不做）**：
- 不生成 `知识详解/` 92 篇（那是阶段③，走 knowledge-detail-build-sop，含样板门）；
- 不采集冲刺模考 3 卷（末期分支，paperId 982347/48/50，现在保持缺失）；
- 不碰 `data/高顿/CPA/待整理/` 与会计课程；不操作飞书、网盘。

---

## 二、存量基线（脚本现算，2026-09-05）

课程目录：`data/高顿/CPA/课程库/【26考季】VIPCPA系列-税法（蔡俊峻老师）/`（data 软链到数据盘）

| 资源 | 官网 catalog | 本地存量 | 对齐 | 目标位置 |
|---|---|---|---|---|
| 视频 | 39（catalog idx1–39 各 1） | 39 讲各有 video.mp4 | ✅ 39=39 | `原始资源/videos/NN_讲题/video.mp4` |
| 转写 | — | 39 套 transcript.md/.json | ✅ | videos 同目录（.json 属过程件，传网盘时排除） |
| 讲义资料 | 26（catalog notes 条目） | 26 PDF + 26 OCR.md，分布在 17 个讲目录 | ✅ 26=26 | `原始资源/notes/NN_模块/` |
| 基础试卷 | 116（119−冲刺3） | 116 papers JSON + paper_index，共 1296 题 | ✅ | `_workspace/papers/` + `_workspace/manifest/` |
| 冲刺模考 | 3（每张48题） | **未采集** | ⛔ 末期 | 阶段②末期补，本方案不碰 |
| 旧双文档成品 | — | organized-content：`_34chapters/讲01` + `01..15` 共16组目录 + 2 全局篇；讲目录 00/01/02 内另有双文档 | ③输入 | 原地保留，阶段③消化后由④清退 |
| 用户留言原件 | — | source-materials/税法-总论 3 个 md | 迁移 | `_workspace/user-notes-raw/` |
| manifest 原料 | — | cdp-sniff：course_catalog / papers_inventory / papers_audit / schedule.jsonl | 迁移 | `_workspace/manifest/` 与 `_workspace/sniff/` |

**关键结构事实**：
- `course_catalog.json` 是 list、**40 条**：idx0=冲刺模考卷（3卷），idx1–39=开班+精讲34+强化4，与本地讲目录 00–38 **相差 1（本地号 = idx−1）**；每条已含 `{idx,name,videos[],notes[],papers[],other[]}`，是 manifest 的直接前身；
- 讲义是"**17 讲挂载、共 26 份**"（开班 idx1 挂 5 份、强化 idx36 挂 4 份等一讲多份；亦有跨讲复用），**不能按"一讲一讲义"搬**；
- paper_index 每条 `{paperId,title,chapter(讲名),cls,qCount,file}`，可据此把卷路由到讲、再经知识点标签路由到 14 组 92 点。

---

## 三、编号与命名映射规则（迁移难点，先定死）

### 3.1 视频 videos
- 顺序号 NN = catalog idx（1–39），两位补零；`NN_讲题` 的讲题用 catalog `name` 清洗（去首尾空格、文件名非法字符 `/\:*?"<>|&` 替换为 `·`）；
- 本地讲目录 `00..38` 按 `NN=本地号+1` 对应；video.mp4、transcript.md/.json 整体 move 入 `videos/NN_讲题/`。

### 3.2 讲义 notes（跨讲复用是重点）
- 以 **catalog notes 条目（按资源 id）为单位**，不按讲目录；
- `NN` = 该资料**首次出现讲的顺序号**；目录名 `NN_资料主题`（主题由 notes 标题去掉 `【…】` 前缀与"-蔡俊峻老师"后缀得到）；
- 一讲多份（如开班 5 份、强化冲刺 4 份）并入**同一个 NN 目录**，PDF 与同名 `_OCR.md` 成对；
- 跨讲复用的讲义只在首现讲存一份，manifest 记录 `usedByLectures:[idx…]`，不复制多份；
- 本地 PDF 文件名与 catalog notes 标题做归一化匹配（去空格/全半角/扩展名），**匹配不上的列入差异表人工确认，不硬搬**。

### 3.3 试卷 papers
- 116 个 JSON move 到 `_workspace/papers/`，文件名维持 `{paperId}.json`；
- paper_index / papers_inventory / course_catalog / papers_audit 入 `_workspace/manifest/`；schedule.jsonl 入 `_workspace/sniff/`（验证完即清）。

### 3.4 命名总依据
统一遵循 [NAMING_CONVENTION 第一~四章](../project-management/standards/NAMING_CONVENTION.md)；`_workspace` 内部英文命名。

---

## 四、course-manifest.json 结构（决策点③，请确认 schema）

落 `_workspace/manifest/course-manifest.json`（**课程派生数据、可 rebuild、不入库**）：

```json
{
  "course": { "courseId": 42660, "name": "【26考季】VIPCPA系列-税法（蔡俊峻老师）", "season": "2026", "generatedAt": "ISO时间" },
  "sequence": [
    { "idx": 1, "name": "开班典礼&规划方法", "kind": "live",
      "video": {"nn": "01", "path": "原始资源/videos/01_开班典礼&规划方法/", "catalogId": 896540},
      "notes": [ {"nn":"01","file":"…pdf","catalogId":929877,"usedByLectures":[1]} ],
      "paperIds": [] }
  ],
  "resources": {
    "videos": { "01": {"path":"…","title":"…","catalogId":896540} },
    "notes":  { "01": [ {"file":"…","title":"…","catalogId":929877,"ocr":"…_OCR.md","usedByLectures":[1]} ] },
    "papers": { "82710": {"file":"papers/82710.json","title":"…","qCount":16,"lectureIdx":33,"cls":"满分","knowledgePointIds":[…]} }
  },
  "knowledge": {
    "groups": [ {"code":1,"name":"税法总论","pointCount":6,"pointIds":[…]} ],
    "pointIndex": { "112376": {"title":"…","groupCode":2,"mergedInto":null,"paperIds":[…],"subQuestionCount":157} }
  },
  "stats": { "videos":39, "notes":26, "basePapers":116, "questions":1296, "mockPapers":3, "groups":14, "points":92 }
}
```

- `knowledge.groups/pointIndex` 由 papers 的 `knowledgePointList`（主观题下钻 subQuestionList）按既定**显式映射 + assert**生成，基线 14 组点数 6/14/7/12/10/3/5/2/2/7/3/6/8/7=92；
- 同时产出/更新 `papers_inventory.json`（官网台账）、`paper_index.json`（本地索引）、`course_catalog.json`（官网原始快照），四件套并列 `_workspace/manifest/`。

---

## 五、迁移阶段（每阶段：动作 / 脚本 / 校验门 / 回滚）

| 阶段 | 动作 | 产出 | 校验门（不过不进下一步） | 回滚 |
|---|---|---|---|---|
| **M0 冻结对齐** | 只读盘点、本地↔catalog 归一化匹配，出《对齐差异表》 | 匹配表、未匹配清单 | 视频/讲义/试卷数量与二、基线一致；未匹配项逐条列出 | 纯只读 |
| **M1 生成 manifest** | 建 `_workspace/{manifest,papers,sniff,user-notes-raw,logs,tmp}` 骨架；脚本生成四件套 + 92 归组 | course-manifest 等 | **assert 14 组=92、无未归类/重复；papers=116、题=1296** | 删 `_workspace` 重建 |
| **M2 迁原始资源** | 按 manifest 路由 move 视频/转写/讲义/OCR 到 `原始资源/` | 原始资源两层 | 搬后 39 视频、26 PDF、26 OCR 与搬前相等；空讲目录清零记录 | 按移动清单移回 |
| **M3 迁题答过程件** | knowledge-source/papers→`_workspace/papers`；cdp-sniff 三件套→manifest、jsonl→sniff | papers+manifest | 116 JSON 齐全、paper_index 与文件一一对应 | 移回原位 |
| **M4 迁留言原件** | source-materials/税法-总论 3md→`_workspace/user-notes-raw/` | user-notes-raw | 文件数=3、内容未改 | 移回 |
| **M5 标记旧成品** | organized-content 与讲目录 00–02 双文档**原地保留**，写一份 `_workspace/manifest/legacy-inventory.md` 登记为"③输入骨架" | 旧件清单 | 不移动、不删除、不进入 `原始资源/知识详解` | — |
| **M6 总校验** | 三层结构、数量、manifest、悬空引用全量核对 | 迁移报告 | 见第七节验收清单全绿 | 分阶段回滚 |

> 旧按讲空目录、`.vfetch` 等下载缓存在 M2 确认资源已就位后移废纸篓；`organized-content/source-materials/knowledge-source/cdp-sniff/lecture-resource-map.json` 的**最终删除**不在迁移阶段，按 finalize-sop 在阶段③消化、④双门禁后清退。

---

## 六、迁移脚本设计（入 Git，一次性但可重跑）

新增 `scripts/migrate/`：

| 脚本 | 职责 | 关键要求 |
|---|---|---|
| `build_course_manifest.py` | 读 catalog+paper_index+papers，生成 manifest 四件套与 92 归组 | 显式映射表内置、assert 组数点数、`--dry-run` 只打印 |
| `migrate_resources.py` | 按 manifest 把视频/讲义/题答/留言 move 到三层 | 幂等（已在位则跳过）、先 dry-run 出移动清单、写 `movement-log.json`、移废纸篓不硬删 |
| `verify_migration.py` | M6 全量校验：数量对账、文件成对、manifest 引用存在、无空旧目录 | 输出通过/失败明细，失败即阻断 |

脚本遵循 [CODE_STYLE](../project-management/standards/CODE_STYLE.md)、不硬编码课程无关常量（14 组点数属本课程派生，从 papers 现算并 assert，不写进通用规范）。

---

## 七、验收清单（M6 全绿才算迁移完成）

- [ ] `原始资源/videos` = 39 目录，各含 video.mp4 + transcript.md；
- [ ] `原始资源/notes` = 26 PDF + 26 同名 OCR，跨讲复用只一份且 usedByLectures 正确；
- [ ] `_workspace/papers` = 116 JSON，manifest 中每卷可路由到讲与知识点；
- [ ] course-manifest assert：14 组、92 点、116 卷、1296 题；冲刺 3 卷明确标"末期待采"；
- [ ] user-notes-raw = 3 份且内容未改；
- [ ] 旧成品完整保留并登记为③输入，未被误删/误搬；
- [ ] 旧按讲目录仅剩应保留项，无悬空/半搬文件；移动日志可逐条回滚；
- [ ] 全程未触飞书/网盘、未采集新数据、未改文件正文。

---

## 八、风险矩阵

| 风险 | 概率 | 影响 | 对策 | 验证 |
|---|---|---|---|---|
| catalog idx 与本地讲号差 1 错位 | 中 | 高（整体错序） | 以 catalogId/讲名双重比对，不用纯序号 | M0 出逐讲对照表 |
| 讲义跨讲复用被复制多份/漏搬 | 中 | 中 | 以 notes 资源 id 为单位、usedByLectures 记录 | M2 校验 26 份不变 |
| 文件名全半角/特殊字符匹配失败 | 中 | 中 | 归一化匹配，失败入差异表人工确认，不硬搬 | M0 未匹配清单 |
| 数据盘软链 + 大量 move 误操作 | 低 | 高 | dry-run 先行、movement-log、废纸篓可回滚 | 每阶段数量前后相等 |
| 92 归组被关键词误归 | 中 | 高 | 易混点显式映射 + assert 各组点数 | M1 assert 基线 |
| 把旧成品当原料搬进知识详解 | 低 | 中 | M5 只登记不搬，③才消化 | M6 检查知识详解为空 |

---

## 九、待你决策的点（批准即执行 M0→M1）

1. **notes 编号规则**：`NN=资料首现讲序、一讲多份并入同一 NN、跨讲只存一份`——是否认可；
2. **manifest schema（第四节）**字段是否够用、有无要增删；
3. **执行顺序**：建议先跑 M0（只读，产出对齐差异表给你看）→ 你确认后再 M1 生成 manifest（仍不搬数据）→ 再 M2–M6；
4. 迁移脚本放 `scripts/migrate/`、一次性使用后保留备查（入 Git），是否认可。

> 你确认后，我先执行 **M0 只读对齐**并把《对齐差异表》交你看，再继续，不会直接搬数据。

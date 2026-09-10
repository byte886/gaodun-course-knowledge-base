# ADR-019: 知识成品范式对齐——章号取官方 code 不重编号、讲目录命名与 frontmatter 著录口径

> **文档类型**：Active（决策记录）
> **更新频率**：决策变更时
> **维护者**：AI 自动维护 + 用户审核
> **读者**：AI 代理 + 人类

## 状态

已采纳（2026-09-10，用户对 L1 方案回复"按你的推荐走"）。本决策统一两门正课（会计罗翔 / 税法蔡俊峻）知识成品的编号、命名与 frontmatter 著录口径，消除"看着像范式不一致"的三类问题；不改变 ADR-012 的三层解耦与按知识点聚合，也不回溯已 finalize 的税法成品。

## 背景

对比会计（进行中，80 篇）与税法（已 finalize，108 篇）成品后，先排除了三类"伪差异"：篇数不同（会计目标 30 章/142 知识点/174 篇 vs 税法 14/92/108，是进度与学科差异）、缺全局篇与课程总览（finalize 阶段才由 `build_course_overview.py` 生成、不落本地）、notes 分册与章数差异（课程本身）。单篇 frontmatter、四节结构、章 README、全局篇分工两门其实一致。

真正需要对齐的有三点：

1. **会计知识章目录编号新旧混用、与官方 code 错位**：档案卡 `structure.groups` 里会计官方 01 入门 / 02 衔接是无视频/讲义/题的预科、正式章从 03 总论起。早期把总论建成物理目录 `01_总论`，而 04 存货起又沿用官方 code，造成物理 `01→04` 跳号，且 `01_总论` 与生成脚本按官方 code 建目录的预期（应为 `03_总论`）错位——finalize 补章时会重复建 `03_总论`。
2. **讲目录（videos/notes）序号起点与分隔符两门不一**：会计开班=`00`、正课从 01，分隔符保留平台标题里的 `&`、`、`；税法开班=`01`、正课从 02，分隔符为 `·`。排查代码确认现行脚本（`fetch_lecture_video.js` / `download_lecture_notes.js`）规则已统一为 `NN=idx-1`（开班 00），税法 01 开班是更早历史遗留；分隔符差异来自平台原始讲名、脚本只清文件系统非法字符。
3. **frontmatter 的 `sources.lecture` 著录粒度不一**：会计著录到讲**目录**，税法部分篇著录到单个 **PDF 文件**；且入库脚本 `batch_build_chapter.py` 的补壳模板是早期简化版（`sources:[]`、tags 用中文、generated 多行、缺 question_count、把 README 也标成 KnowledgePoint），落后于 Bundle A 推广的 OKF 标准档（标准模板当时只存在于一次性过程件 `data/_workspace/batch_add_frontmatter.py`，未回灌入库）。

## 决策

### 1. 知识章目录号直接取官方 code，跳过预科组不重编号
- 物理章目录 `NN_组名` 的 `NN` 必须等于档案卡 `structure.groups[].code`。
- 无来源、不做详解的组（如会计 01 入门 / 02 衔接）**只留空、不把后面的组前移连续编号**。
- 据此把会计 `知识详解/01_总论` 改回 `03_总论`（目录 + 6 篇 frontmatter 的 `chapter`/`tags.chapter-03`/description/正文"所属组"同步改，原始资源讲路径 `01_会计全面精讲01-总论` 属讲目录名、不动）。会计未同步过飞书，无飞书节点要改；网盘镜像改名挂到 finalize 同步时以本地为准处理。

### 2. 讲目录命名规则只约束未来，历史既成不回溯
- `NN = String(idx-1)` 两位补零：idx=1 开班典礼前缀 `00`、正课从 `01`；视频与讲义讲目录同规则。
- 目录名只替换文件系统非法字符，**忠实保留平台标题中的中文 `&`、`、`、（）、·`，不做跨课程分隔符归一化**（强改会与平台标题不一致、且易断链）。
- 税法（开班 01、正课 02、`·` 分隔）为历史既成，**不回溯重命名**（牵动 49 videos + notes + 108 篇 frontmatter 引用 + 已同步飞书，成本大于收益）。

### 3. frontmatter 标准档与 sources 著录口径
- `type` 词表：知识点=KnowledgePoint、章 README=ChapterIndex、课程全局篇=Reference（修正旧模板把 README 标成 KnowledgePoint）。
- `tags` 用英文 slug：`[cpa, {subject-slug}, 26-season, chapter-{NN}]`，subject-slug 从 `profile.key` 推导（`cpa-accounting-2026 → accounting`）。
- **`sources.lecture.resource` 著录到讲目录 `原始资源/notes/{NN_讲名}/`**（成品为目录内 `*_OCR.md`），不指单个 PDF——单文件改名即断链、目录更稳；transcript 指 `videos/{NN_讲名}/transcript.md`；题目用 `paper-{id}` + `paperId {id}`。
- 入库脚本 `batch_build_chapter.py` 只补"标准档壳"：sources 留空待知识生成环节填齐、内容定稿前 `status: draft`，不得留空交付为 stable。
- 标准模板唯一权威是 `docs/development/templates/KNOWLEDGE_BASE_TEMPLATE.md`（配合 AGENTS.md §3.12 字段全表）；Bundle A 的一次性脚本 `data/_workspace/batch_add_frontmatter.py` 是过程件、不入库、不作为模板复制源。

### 4. 不回溯已 finalize 课程
税法已 finalize、已同步飞书，问题 2/3 的历史形态保持原样；本决策全部"只约束未来生成/下载"。会计因尚未 finalize，问题 1 现在改成本最低。

## 后果与边界

- 会计 finalize 按官方 code 补 17–30 章时不再与现有目录冲突；后续名师课 / 其它正课的讲目录与知识篇自动遵循统一口径。
- 规则落点：模板 `KNOWLEDGE_BASE_TEMPLATE.md`、SOP `knowledge-base-organization.md §2.1`、`video-processing.md`（讲目录命名）、`document-download.md`（指针）、脚本 `batch_build_chapter.py`。
- 待办挂账：会计百度网盘镜像的 `01_总论 → 03_总论` 改名留到 finalize 镜像同步时以本地为唯一源头处理，旧目录入回收站。
- 本决策只管"成品编号/命名/著录格式"；四来源采集、Fan-In 时机、飞书同步剥离 frontmatter 等仍由各自既有 ADR/SOP 约束。

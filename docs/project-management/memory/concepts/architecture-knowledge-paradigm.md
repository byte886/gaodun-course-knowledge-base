---
type: Architecture
title: 课程数据三层解耦与按知识点聚合
description: 原始资源/知识详解/_workspace 三层解耦；加工单元从"讲"改为"官方知识点"，一个知识点一篇 md、固定四节；税法=官方 14 组 92 知识点，由接口现算禁 AI 自造。
tags: [knowledge, 三层解耦, 知识点聚合, 范式, architecture]
sources:
  - id: adr-012
    resource: ../../decisions/ADR-012-三层解耦与按知识点聚合.md
    title: ADR-012 三层解耦与按知识点聚合（范式级）
  - id: adr-019
    resource: ../../decisions/ADR-019-知识成品章号对齐官方code与著录命名口径.md
    title: ADR-019 章号取官方 code、讲目录命名与 frontmatter 著录口径
  - id: exam-api
    resource: ../../../development/api/gaodun-exam-api.md
    title: 高顿作业接口档案（知识点取数口）
generated: { by: "doubao/okf-wiki", at: "2026-09-07T20:30:00+08:00" }
status: stable
---

# 课程数据三层解耦与按知识点聚合

## 一句话结论
课程数据分**原始资源 / 知识详解 / 运行时工作区**三层，单向流动、互不污染；加工单元从"按讲"改为"**按官方知识点**"，跨讲聚合——**一个官方知识点 = 一篇 md，固定四节**；知识点分组与数量只能由官方接口数据现算，**严禁 AI 自造或照搬教材目录**。

## 三层解耦
| 层 | 内容 | 去向 |
|---|---|---|
| **原始资源** | 视频/音频/试卷原始报文/用户笔记原始 JSON（字段完整保留） | 本地 + 百度网盘永久归档，不直接给读者 |
| **知识详解**（成品） | 按知识点聚合的纯知识 md | 本地成稿过校验 → 传网盘 + 单向同步飞书 |
| **_workspace** | 采集/加工/转写的临时中间态 | 仅本地、可清退（见 [统一运行时工作区](architecture-runtime-workspace.md)） |

层与层之间靠 **manifest（清单）** 衔接，不互相内嵌。

## 一篇知识详解的固定结构
一个官方知识点一篇 md，正文固定四节（**四、学员补充为空时整节省略**）：
1. **一、知识拆解**
2. **二、考试指导**
3. **三、题答解析**
4. **四、学员补充**（每条只输出纯文本 `- …`，分类子标题：记忆口诀/易错点辨析/解题技巧/知识补充）

另有课程级两篇全局资料《课程做题思路解析》《考试指导速查手册》，以及CPA 层跨课程的《通用做题思路解析》。

## 知识点怎么来（强约束）
- **税法 = 官方 14 个知识组 / 92 个知识点**，由 `papers.knowledgePointList` 现算得到，不允许凭教材章目或 AI 臆测增减。
- **跨讲聚合**：同一知识点可能散在多讲/多卷，聚合到同一篇；加工时先算"知识点→题目"映射再组织内容。
- 归并特例要显式登记（如 id=112376 并入「增值税一般计税方法应纳税额的计算」）。
- 题目结构：客观题取顶层答案；**主观大题 type=5 是容器，必须下钻 `subQuestionList` 里 type=6 小问**（详见 [做题/试卷采集链路](workflow-exam-paper-pipeline.md)）。
- 主流程四阶段：采集原始资源 → 按知识点聚合加工 → 成本地知识详解 → 校验后同步。

## 成品编号与著录口径（ADR-019，只约束未来、不回溯已 finalize 课程）
- **知识章目录号 = 档案卡 `structure.groups[].code`**；无来源的预科组（如会计 01 入门/02 衔接）只留空、**不把后面的组前移连续编号**（会计曾误建 `01_总论`、官方实为 03，已改回 `03_总论`）。
- **讲目录命名**：`NN=idx-1` 两位补零（开班=00、正课从 01），只清文件系统非法字符、忠实保留平台标题里的 `&、（）·`；视频与讲义同规则。税法开班=01 是历史遗留、不回溯。
- **frontmatter 标准档**：type∈KnowledgePoint/ChapterIndex/Reference（README=ChapterIndex）；tags 用英文 slug `[cpa,{subject-slug},26-season,chapter-{NN}]`；`sources.lecture` 著录到**讲目录**（成品取目录内 `*_OCR.md`），不指单个易改名 PDF；补壳阶段 status=draft、sources 填齐定稿才 stable。标准模板唯一权威是 `docs/development/templates/KNOWLEDGE_BASE_TEMPLATE.md` + AGENTS §3.12。

## 易踩坑
- 不要按"第几讲"切成品文件——讲是授课顺序，知识点才是稳定主键。
- **名师课本地 manifest 读取口径**：`data/_workspace/ep3-{subject}-2026/manifest/course-manifest.json` 先取 `['knowledge']`；`groups[].code` 是**整数**（9/10，不是 `'09'`），`pointIndex[str(pid)]`（键是字符串）取 title/lessonDirs/teachers；章目录＝两位 `NN_`＋组名原样（顿号标点保留）。风控期 AI 直接成稿时，一科选一套体系最完整的精讲 OCR 作主干（审计＝王依然上下册、陈岩稿补充、独立课件仅 03/17/18 章），大 OCR 用 awk 定章节行边界后按 ~200 行分段读尽再写，一章一闭环（成稿→手写章 README→`okf_validate` E=0→find 现算→回写台账→单章 commit/push）。操作细则见知识生成 SOP §2.1/§2.12。
- 原始资料字段可以全量保留，但**成品只留纯知识**（元数据边界见 [静态/动态分离与元数据边界](architecture-metadata-boundary.md)）。
- 会计课结构尚未拉取前，组/点数留空、标"以 syllabusId 拉取后回填"，不拿税法的 14/92 套过去。

## 来源与下钻
- [ADR-012 三层解耦与按知识点聚合](../../decisions/ADR-012-三层解耦与按知识点聚合.md)（范式权威：三层、四节、92 知识点、四阶段；早期 ADR-004 的按讲组织已被其演进替代）
- [高顿作业接口档案](../../../development/api/gaodun-exam-api.md)（题面/标准答案/解析取数口、题型结构）
- [知识库组织规范 §2.1/§2.12](../../../development/knowledge/knowledge-base-organization.md)（名师课 ep3 来源形态变体、manifest 读取口径、精讲 OCR 取材与大文件作业法）

---
type: Reference
title: 课程 profile 机制与多课程 ID 对照
description: 一门课一张 profile 档案卡、脚本统一读卡、换课只换卡不改代码；CPA 六科 subjectId、税法/会计的正课(glivepro)与名师课(epiphany)各套 ID、学习状态与结构回填口径。
tags: [course-profile, config, 课程id, 多课程, reference]
sources:
  - id: tax-profile
    resource: ../../../../config/courses/cpa-tax-2026.json
    title: config/courses/cpa-tax-2026.json 税法档案
  - id: accounting-profile
    resource: ../../../../config/courses/cpa-accounting-2026.json
    title: config/courses/cpa-accounting-2026.json 会计档案
  - id: exam-api
    resource: ../../../development/api/gaodun-exam-api.md
    title: 接口档案 1.3 常量 / 2.11 用户空间
generated: { by: "doubao/okf-wiki", at: "2026-09-07T20:30:00+08:00" }
status: stable
---

# 课程 profile 机制与多课程 ID 对照

## "课程 profile"是什么（先解释概念）
**一门课一张 JSON 档案卡** `config/courses/<profile-key>.json`，把这门课的所有差异（课程 ID、科目、老师、章节结构、本地/网盘路径、学习 URL、有效期）集中在一张卡里；所有脚本**统一读卡取值，代码里不写死某门课**。换一门课（税法→会计）= 新增/切换一张卡，**不改脚本**，这就是"课程 profile 单一配置"。

## 固定常量（全 CPA 通用）
- `projectId` CPA = **8**。
- `subjectId`：会计 **37** / 审计 36 / 财管 45 / 经济法 39 / **税法 38** / 战略 46。
- 做题链路的 `courseId` 就是 **saasCourseId**（不是 vcourseId）；听课/进度用 vcourseId。

## 正课 vs 名师课：是两套独立课程
每科通常有两条线，**ID、平台、页面排版都不同**，别混：
| 线 | 平台 | 说明 |
|---|---|---|
| **正课（主课）** | `glivepro.gaodun.com`（`/course/{saasCourseId}/guide-course`），saasCourseType=16 | 体系正课，做题/作业链路主要对象 |
| **名师专业课（companion）** | `epiphany.gaodun.com`（`/ep3/course/{saasCourseId}`），type=13 | 智能学习平台页面，排版与正课不同 |

名称以平台完整名为准（如「【VIPCPA 专享】名师专业课-税法」），口头简称"名师专业课-税法/会计/…"不完整。

## 税法 cpa-tax-2026（已完结，结构齐全）
- 老师 蔡俊峻；考试 2026-08-29 13:00–15:00；账号有效期至 2026-10-31。
- 正课 glivepro：vcourseId **96834** / saasCourseId **42660** / syllabusId **75181** / gradationId null / learnStatus **3（已完结）**。
- 名师 epiphany：vcourseId 50122 / saasCourseId 17247。
- 结构：**官方 14 组 / 92 知识点**（profile 内 code01–14 组名齐全）。
- 本地根 `data/高顿/CPA/课程库/【26考季】VIPCPA系列-税法（蔡俊峻老师）`；网盘根 `/apps/CPA课程归档/高顿/CPA/课程库/同名`。

## 会计 cpa-accounting-2026（在建，结构待回填）
- 老师 罗翔。正课 glivepro：vcourseId **96760** / saasCourseId **42656** / syllabusId **75086** / gradationId **74570** / learnStatus 3；名师 epiphany：vcourseId 50126 / saasCourseId 17244。
- **`structure` 组为空**（officialGroupCount/pointCount = null）：历史提示"36 章 164 考点"仅供参考，**必须用 syllabusId 实际拉取后回填，禁止拿税法结构或历史章数臆造**。

## 学习状态与采集顺序
- `learnStatus` / 用户空间 `wareStatus`（"1"已开课/"0"未开课）、`learnStatusDesc` 区分进度；显示"**待学习**"的内容**不是不录，而是放到最后处理**。
- 开工前先调用户空间 `ep-course/.../space/vcourse/pc` 盘点账号全部课程（无分页、一次全量），精简台账落 `data/_workspace/_account/user-space/account_courses.json`（覆盖式、不入库）；脚本 `scripts/cdp/fetch_user_space_courses.js`。
- 本账号 2026-09-07 实测 CPA 共 8 门：26 考季 VIPCPA 税法/会计 + 名师专业课六科（税法17247、会计17244、战略17249、审计17245、财管17246、经济法17248）。

## 来源与下钻
- [cpa-tax-2026.json](../../../../config/courses/cpa-tax-2026.json)、[cpa-accounting-2026.json](../../../../config/courses/cpa-accounting-2026.json)（字段以卡片现状为准）
- [接口档案 1.3/2.11](../../../development/api/gaodun-exam-api.md)（ID 常量、用户空间清单字段）
- 工作区落点见 [统一运行时工作区](architecture-runtime-workspace.md)；取题流程见 [做题/试卷采集链路](workflow-exam-paper-pipeline.md)。

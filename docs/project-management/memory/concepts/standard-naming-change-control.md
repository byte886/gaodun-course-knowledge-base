---
type: Standard
title: 命名规范与变更分级控制
description: 改动先按 L0/L1/L2 分级、高扩散先出方案经确认再动；ADR 与变更日志只增不改；文档类型词与文件/脚本命名规则；以精简删冗余为荣；pre-commit 机械门 + 人工语义体检；工程自包含不依赖全局。
tags: [naming, change-control, L1, 质量门, 精简, standard]
sources:
  - id: agents
    resource: ../../../../AGENTS.md
    title: 项目根 AGENTS.md（执行规则，3.2/3.7/3.9）
  - id: naming
    resource: ../../standards/NAMING_CONVENTION.md
    title: 命名规范与文档类型标注
  - id: precommit
    resource: ../../../../scripts/pre-commit
    title: scripts/pre-commit 提交质量门
generated: { by: "doubao/okf-wiki", at: "2026-09-07T20:30:00+08:00" }
status: stable
---

# 命名规范与变更分级控制

## 一、改动先分级（AGENTS 3.2，强制）
| 级别 | 范围 | 动作 |
|---|---|---|
| **L0 顺手修复** | 错字、单处断链、单文件明显小错、不牵连它文件 | 直接修，记入任务报告 |
| **L1 高扩散** | 批量重命名/跨目录移动、预计 ≥5 处引用级联、**改命名或治理规范本身**、新增/删除持久文档或机制 | **先出"方案 + 全量影响清单（老→新/依据/影响面）"，用户确认后才动**；本地改完先不提交，验收后再 commit |
| **L2 架构/流程** | 流程变更、架构调整、新增功能 | 先讨论、确认方案再执行 |

拿不准就**就高不就低**，先按 L1 出方案。治理类（L1/L2）验收后才提交；日常开发与课程生产按里程碑及时 commit。**本仓库约定只 commit、不 push，push 由用户决定。**

## 二、历史只增不改
- **ADR 决策记录、CHANGELOG、任务报告按"不改写历史"保留原文**，即使其中引用了已删除脚本/旧结构也不回溯；结论被后续 ADR 演进时，在**新 ADR** 里说明，并可在旧文末尾加"修订注记/演进指针"，不抹掉原决策。

## 三、命名规则（权威见 NAMING_CONVENTION）
- **文档类型词**（文首 Context Block 的"文档类型"，按实质职责判，不按标题猜）：Active / Task / Concept / Reference / Governance / Template 等受控词表；类型与目录位置必须一致（规范文档放 standards/、决策放 decisions/）。
- **文件名**：治理/规范类用 `UPPER_SNAKE_CASE`（如 `DOC_SYNC_CHECKLIST.md`）；ADR 用 `ADR-NNN-中文描述.md` 三位编号顺延；知识成品等内容文档用清晰中文名。
- **脚本一律全小写 snake_case，禁止大写/驼峰**（历史 `connectBrowser.js`→`connect_browser.js` 即按此更名）；新增脚本前先查有无同类实现。
- 判型以"文档实质承担的职责"为准，无法判定先读内容再定，不靠文件名或标题反推。

## 四、精简原则（AGENTS 3.7，核心价值观）
**以精简并删除历史冗余为荣，以堆彻重复实现为耻**——同时适用于项目结构、文档内容、代码：
- 新增持久文档/机制前先过"防重复建设门禁"：逐项列职责并指认现有权威源，已被承担就**不新建**，改为补权威源（task-handover 重复建设后删除是教训）。
- 0 引用一次性脚本、被替代旧版、僵尸"以防万一"文档、空目录/空章节/0 条目分类，主动清理。
- **删除一律 `mv` 到带时间戳的回收站，不硬删**；文件/目录变化同步检查 `.gitignore`。

## 五、质量门：机械 + 人工，且工程自包含
- **机械门**：`scripts/pre-commit`（安装：`cp scripts/pre-commit .git/hooks/pre-commit && chmod +x`）在提交前自动查大文件/敏感信息/运行产物（硬拦截）、文档关联、相对链接与类型词、命名一致性（多为警告）；OKF 记忆 bundle 另跑 `python3 scripts/okf_validate.py docs/project-management/memory`，E 必须为 0。
- **人工语义体检不可省**（AGENTS 3.9）：pre-commit 检不出内容过时、职责重复、台账与实际不符、文件去留价值；大任务后仍须按 DOCUMENTATION_OPTIMIZATION 第十二章人工体检，**不得因 pre-commit 通过就跳过**。
- **自包含 / 可移植（硬约束）**：工程不依赖全局 `~/Doubao/AGENTS.md` 或全局技能即可跑通——校验器等工具要 vendor 进项目 `scripts/`，规则写项目内文档；换一个 Agent/换一台机器，按仓库自身文档就能接手。

## 来源与下钻
- [项目根 AGENTS.md](../../../../AGENTS.md)（3.2 分级、3.4 防重复、3.7 精简、3.9 健康度）
- [命名规范与文档类型标注](../../standards/NAMING_CONVENTION.md)
- [scripts/pre-commit](../../../../scripts/pre-commit)

---
type: Architecture
title: 四地存储分工与仓库版图
description: Git 仓库 / 本地大文件目录 / 百度网盘 / 飞书知识库各放什么，data 软链与 gitignore 边界，以及"轻量派生元数据才入库"的判据。
tags: [storage, architecture, gitignore, symlink, 分工]
sources:
  - id: adr-005
    resource: ../../decisions/ADR-005-项目存储分工.md
    title: ADR-005 项目存储分工
  - id: adr-012
    resource: ../../decisions/ADR-012-三层解耦与按知识点聚合.md
    title: ADR-012 三层解耦与按知识点聚合
  - id: adr-020
    resource: ../../decisions/ADR-020-课程存储去课程库层与网盘会计知识库分库及百度沙箱根名不可改.md
    title: ADR-020 去课程库层、网盘会计知识库分库、沙箱根名不可改
  - id: directory-structure
    resource: ../../../DIRECTORY_STRUCTURE.md
    title: DIRECTORY_STRUCTURE 目录结构与文件命名规范
generated: { by: "doubao/okf-wiki", at: "2026-09-07T20:30:00+08:00" }
status: stable
---

# 四地存储分工与仓库版图

## 一句话结论
**代码/脚本/规范/轻量派生元数据进 Git；大文件只在本地与网盘；知识成品经本地成稿后单向同步飞书；运行时临时物全部进 `data/_workspace/` 且不入库、不传网盘、不同步飞书。** 出现"某文件该放哪"的问题时，先按这张分工表归位，不要新开目录。

## 四地分工（稳定结论）

| 载体 | 放什么 | 不放什么 |
|---|---|---|
| **GitHub 仓库** | 脚本、docs 文档、ADR/规范、课程 profile、**轻量派生元数据**（manifest/paper_index 等可重建的小 JSON） | 视频/音频/原始报文、JWT/Cookie、`_workspace` 临时物、课程知识成品（Git 不版本化课程成品） |
| **本地大文件目录** `~/Desktop/高顿`（课程在 `CPA/<课程>/`，无"课程库"中间层） | 原始视频、音频、压缩产物、课程原始资源 + 知识详解成品 | 工程脚本 |
| **百度网盘** `/apps/CPA课程归档/会计知识库/高顿/`（沙箱根名与授权绑定、不可 API 改名，见 ADR-020） | 本地大文件目录的**镜像**（原始资源永久传、知识成品传） | `_workspace`、脚本 |
| **飞书知识库** | **只同步知识详解成品**（本地成稿后单向同步）；飞书文档另放任务报告 | 原始资料、过程留痕、脚本、裸 YAML frontmatter |

## 关键规则
- **`data/高顿` 是软链**，指向 `~/Desktop/高顿`；换机用 `scripts/setup_data_symlink.sh` 重建。因此 `find data/高顿` 必须带 `-L` 才会跟随软链，否则结果为 0。
- **课程物理层无"课程库"中间层（ADR-020，2026-09-12）**：本地 `~/Desktop/高顿/CPA/<课程>/{原始资源,知识详解}`、网盘 `/apps/CPA课程归档/会计知识库/高顿/CPA/<课程>`；跨课《通用做题思路解析.md》在 CPA 层（与各课程平级）。百度沙箱根名 `/apps/CPA课程归档` 与应用授权绑定，**禁止用 API 改名**（实测改名后写操作全报 31064、改回立即恢复），根内按领域分 `会计知识库/股票知识库/珠宝知识库`。飞书知识空间里的"课程库"是浏览层节点、与物理层解耦，不在此列。
- **轻量派生元数据入库"判据三问"**（同时满足才进 Git）：① 足够轻量；② 跨环境 `clone` 后立即需要；③ 需要用 `git diff` 追踪其变化。缺一即放本地/工作区。
- **JWT / Cookie / token 禁止入库**，只存 `data/_workspace/_account/auth/`（见 [统一运行时工作区](architecture-runtime-workspace.md)）。
- 存储口径有演进：**最新以 ADR-012 第 6 节 + `DIRECTORY_STRUCTURE.md` 第〇章为准**，ADR-005 是早期基线，冲突时看文首演进指针。

## 易踩坑
- 不要在项目根或 `data/` 下散落临时文件/日志——它们统一归 `_workspace`（历史上 `user-notes`、`notes`、`cdp-sniff`、`logs` 重复目录就是反例，已收口）。
- 新增/移动文件后必须检查 `.gitignore` 是否需要同步（AGENTS 3.7）。

## 来源与下钻
- [ADR-005 项目存储分工](../../decisions/ADR-005-项目存储分工.md)（四地分工基线、入库判据三问）
- [ADR-012 三层解耦与按知识点聚合](../../decisions/ADR-012-三层解耦与按知识点聚合.md)（第 6 节存储分工最新口径、Git 不版本化成品）
- [ADR-020 去课程库层与网盘分库](../../decisions/ADR-020-课程存储去课程库层与网盘会计知识库分库及百度沙箱根名不可改.md)（物理目录新层级、百度沙箱根名不可改、飞书节点不动）
- [DIRECTORY_STRUCTURE.md](../../../DIRECTORY_STRUCTURE.md)（目录树与命名权威）
- 运行时临时物边界见 [统一运行时工作区](architecture-runtime-workspace.md)；飞书侧边界见 [飞书同步与单窗口导航](workflow-feishu-sync.md)。

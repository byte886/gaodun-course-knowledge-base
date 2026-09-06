# 知识库目录（knowledge-base）

> **文档类型**：Reference（参考资料）
> **维护者**：AI 自动维护
> **读者**：AI 代理 + 人类

## 现状：旧范式已整体退役（2026-09-06）

本目录曾是**旧范式**（按讲 `organized-content/` 成品、`source-materials/` 原料、双文档、`lecture-resource-map.json` 取料路由）的存放地。按 [ADR-012](../docs/project-management/decisions/ADR-012-三层解耦与按知识点聚合.md) 的课程三层架构改造完成后，这些内容已**全部清退**，本目录不再存放任何课程成品或原料，Git 也不再版本化课程成品。

## 知识内容现在在哪里

课程的全部内容都在**单个课程目录的三层桶**中（本地 `data/高顿/CPA/课程库/<课程名>/`，Desktop 同源，成品/原料备份到百度网盘、成品同步飞书知识库）：

| 三层桶 | 放什么 | 对应旧概念 |
|---|---|---|
| `原始资源/` | 永久原料：`videos/`（video.mp4+transcript.md）、`notes/`（讲义 PDF+OCR）、`papers/`（题答 JSON）、`user-notes/`（用户笔记/留言原件） | 旧 source-materials + 视频/讲义原料 |
| `知识详解/` | **成品**：按官方知识点聚合（14 组 → 92 知识点 + 课程全局篇），一篇 4 节，同步飞书知识库 | 旧 organized-content |
| `_workspace/` | 可重建过程件（manifest 路由、抓包、临时件），双门禁满足后清、不入库不传网盘 | —— |

- 讲↔资源↔知识点的取料路由是课程 `_workspace/manifest/course-manifest.json`（可 rebuild、随课即变、**不入库**），**不再使用** 已退役的 `knowledge-base/lecture-resource-map.json`。
- 目录与四地分工（Git / 本地 / 网盘 / 飞书）以 [DIRECTORY_STRUCTURE.md](../docs/DIRECTORY_STRUCTURE.md) 为准；收尾备份/同步/清退流程见 [finalize-sop.md](../docs/development/guides/finalize-sop.md)。

## 仍然适用的通用原则

1. **本地是源头**：知识内容先在本地课程目录完成，再同步飞书；不在飞书直接编辑。
2. **题/答/解析走接口采集**到 `原始资源/papers/` JSON，不产手抄做题记录 md。
3. **冲突处理**：用户留言与讲义冲突时以讲义为准；用户留言中的个人信息注意脱敏。

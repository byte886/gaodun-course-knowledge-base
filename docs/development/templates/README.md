# 模板目录（templates）

> **文档类型**：Reference（参考资料）
> **更新频率**：新增或变更模板时
> **维护者**：AI自动维护
> **读者**：AI代理（生成文档时参考模板）

本目录存放项目所有模板文件，统一管理，避免分散。

---

## 模板清单

| 模板文件 | 用途 | 适用场景 |
|---------|------|---------|
| `KNOWLEDGE_BASE_TEMPLATE.md` | 知识库内容模板 | 生成知识拆解和考试指导文档时 |
| `PARENT_NODE_TEMPLATE.md` | 知识库父节点模板 | 生成章节父节点页面（含子节点链接）时 |
| `REPORT_TEMPLATE.md` | 任务报告模板 | 生成任务完成报告时 |
| `VERIFICATION_TEMPLATE.md` | 通用验证模板 | 视频/转写/OCR 等专项质检、确需独立留痕时（验证默认不单独成文） |
| `REFACTOR_PLAN_TEMPLATE.md` | 批量整改清单模板 | 批量重命名/结构整改，出全量清单与回归核对时（配合结构维护 SOP） |
| `TEST_PLAN_TEMPLATE.md` | 流程测试计划模板 | 新学科首跑/链路改造，做端到端可行性测试时 |
| idea-to-tickets 六件套（共识/规范/工单/台账/BUG/需求） | 唯一权威位置 `docs/project-management/templates/idea-to-tickets/`（本目录不再放副本，避免双写分叉） | clarify/spec/slice 拆单与过程台账时 |

---

## 模板使用原则

1. **生成文档前先读对应模板**：确保文档结构和格式统一
2. **模板变更时同步更新**：模板变更后，已生成的文档不需要强制更新，但新文档必须使用新模板
3. **模板按治理分层放置、同类只留一份权威**：知识/报告/验证/测试等开发类模板放本目录；任务工程（idea-to-tickets）六件套统一放 `docs/project-management/templates/idea-to-tickets/`（治理分层，见 AGENTS §3.13），禁止在两处放副本（双写必分叉）

---

## 模板分类

### 知识库模板（2个）
- `KNOWLEDGE_BASE_TEMPLATE.md`：知识拆解 + 考试指导
- `PARENT_NODE_TEMPLATE.md`：章节父节点（含子节点链接）

### 报告模板（1个）
- `REPORT_TEMPLATE.md`：任务完成报告

### 验证模板（1个）
- `VERIFICATION_TEMPLATE.md`：通用验证模板（视频/转写/OCR 等专项质检按需；做题回查、飞书同步验证默认不单独成文、结论并入任务报告）

### 流程与治理模板（2个）
- `REFACTOR_PLAN_TEMPLATE.md`：批量重命名/结构整改的全量清单 + 回归核对
- `TEST_PLAN_TEMPLATE.md`：端到端流程测试计划（步骤状态、问题两级分级、通过标准）；区别于验证报告——它测的是流程可行性

### 任务工程与过程台账模板（idea-to-tickets 六件套）
- **唯一权威位置：`docs/project-management/templates/idea-to-tickets/`**。本目录早期曾放 `TASK_*_TEMPLATE.md` / `BUG_BACKLOG_TEMPLATE.md` / `REQUIREMENTS_TEMPLATE.md` 大写副本，已合并去重删除，**勿再在此建副本**（双写必分叉）。
- 任务工程四件套（clarify→spec→slice 纵向流水线，可单用可串联；简单任务不必走全套）：
  - `consensus.md`：clarify 共识小结（定了什么/不做什么/待确认）
  - `spec.md`：spec 带验收规范（记决策不记实现、找接缝 seam、异路径回读）
  - `ticket.md`：单张垂直工单（穿透数据·逻辑·可见结果，做完即可验收）
  - `tickets-index.md`：工单台账（依赖/并行前沿/实时状态，唯一进度来源）
- 过程台账两件套（**实例落 `data/_workspace/<course>/tickets/`，不进 docs、不入库**；稳定结论再提炼 OKF/ADR/SOP）：
  - `bug-backlog.md`：缺陷的定位/根因/闭环记录
  - `requirements.md`：改进需求与拍板决策；与 BUG 表分工——BUG 记"做错了什么"，需求表记"还要做什么"

---

## 相关文档

- 知识库组织规范：`docs/development/knowledge/knowledge-base-organization.md`
- 质量保证规范：`docs/project-management/standards/QUALITY_ASSURANCE.md`
- 报告目录：`data/_workspace/<course>/task-reports/`（只放实际报告，不放模板）

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

---

## 模板使用原则

1. **生成文档前先读对应模板**：确保文档结构和格式统一
2. **模板变更时同步更新**：模板变更后，已生成的文档不需要强制更新，但新文档必须使用新模板
3. **模板只放本目录**：所有模板统一放在本目录，其他目录不放模板文件

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

---

## 相关文档

- 知识库组织规范：`docs/development/knowledge/knowledge-base-organization.md`
- 质量保证规范：`docs/project-management/standards/QUALITY_ASSURANCE.md`
- 报告目录：`project-management/task-reports/`（只放实际报告，不放模板）

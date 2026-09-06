# 文档地图（DOCUMENTATION MAP）

> **文档类型**：Reference（参考资料 — 文档索引）
> **更新频率**：每次新增/删除/移动文档时
> **维护者**：AI自动维护
> **读者**：AI代理（快速定位文档）和人类（查找文档时）

> 本文档是项目所有文档的导航入口，告诉AI和人"先读什么、去哪里找什么"。
> 类似 llms.txt 的作用：文档地图，快速定位。

---

## 快速入口（按场景）

### 开始新任务前
1. `AGENTS.md` — AI操作手册（必读）
2. `README.md` — 项目概览、存储分工
3. `docs/REQUIREMENTS.md` — 项目需求文档（核心诉求、功能需求、验收标准）
4. `docs/WORKFLOW.md` — 主工作流，找到当前任务所属环节
5. `project-management/active/TASK_STATUS.md` — 当前任务状态和前置依赖

### 做题验证前
1. `docs/development/api/gaodun-exam-api.md` — **高顿做题接口契约（接口为主：syllabus 枚举作业→redo-paper 取题与标准答案→submit-paper 交卷→exam-report 回查）**
2. `docs/development/guides/exam-workflow.md` — 做题/交卷任务执行指南（接口为主、UI 兜底：前置准备/枚举作业/批量与单卷/两层回查/异常分流/知识反哺）
3. 课程目录 `知识详解/NN_模块组/{官方知识点}.md` — 知识点单篇（一篇 4 节，含题答解析）
4. `docs/development/guides/knowledge-detail-build-sop.md` — 题答如何加工成知识详解
5. 课程库层 `通用做题思路解析.md`、课程层 `知识详解/课程做题思路解析.md` — 做题方法论
6. `scripts/cdp/api_do_paper.js` — 纯接口做卷（推荐）；`scripts/answer_option.sh`/`scripts/answer_multi.sh`/`scripts/submit_exam.sh` — 旧 UI 做题脚本（兜底）

### 视频下载/压缩
1. `docs/WORKFLOW.md` 第2节
2. `docs/development/tools/video-processing.md` — 压缩参数、CRF测试结果
3. `scripts/compress.sh` — 压缩脚本

### 文档下载
1. `docs/WORKFLOW.md` 第3节
2. `docs/development/tools/document-download.md` — CDN直链获取、curl后台下载、完整性校验
3. `scripts/batch_ocr.sh` — OCR脚本（下载后提取文字）

### 视频转文字
1. `docs/WORKFLOW.md` 第5节
2. `docs/development/tools/transcription.md` — 转写方案对比、FunASR使用
3. `scripts/transcribe_pipeline.py` — 转写管道

### 知识系统构建（四阶段）
1. `docs/WORKFLOW.md` — 四阶段总纲与校验门
2. 四阶段 SOP（`docs/development/guides/`）：resource-collection-sop（①采集）→ paper-manifest-sop（②做题/manifest）→ knowledge-detail-build-sop（③知识详解，核心）→ finalize-sop（④网盘/飞书/清理）
3. `docs/development/knowledge/knowledge-base-organization.md` — 三层架构与 14 组/92 点组织原则
4. `docs/development/knowledge/knowledge-base-sources.md` — 来源清单与优先级
5. `docs/development/templates/KNOWLEDGE_BASE_TEMPLATE.md` — 知识点单篇 4 节/组父/课程全局模板

### 百度网盘同步
1. `docs/WORKFLOW.md` 第4节
2. `docs/development/api/netdisk-setup.md` — 网盘API配置、上传脚本使用
3. `scripts/baidu_upload.py` — 上传脚本

### 遇到问题/异常
1. `grep -rn "关键词" docs/` — 搜索相关文档
2. `docs/development/tools/playwright-cli-guide.md` — Playwright常见问题
3. `docs/development/tools/browser-cdp-connect-guide.md` — 浏览器CDP连接/抓包、端点与授权问题
4. `docs/development/guides/macos-accessibility-automation.md` — macOS原生控件/系统弹窗/多屏精准点击
5. `docs/development/guides/debugging-and-collaboration.md` — 问题排查方法论与人机配合
6. `docs/development/guides/interaction-workflow.md` — 交互异常处理
7. `AGENTS.md` 第10节 — 异常处理流程

### 项目维护/文档更新
1. `docs/project-management/standards/PROJECT_MAINTENANCE.md` — 项目维护规范索引（拆分为三个子文档）
2. `docs/project-management/standards/PROJECT_STRUCTURE_MAINTENANCE.md` — 项目结构维护规范
3. `docs/project-management/standards/DOCUMENTATION_GUIDE.md` — 文档写作指南
4. `docs/project-management/standards/DOCUMENTATION_OPTIMIZATION.md` — 文档优化流程与变更驱动
5. `docs/project-management/standards/PROJECT_STATUS_QUERY.md` — 状态查询协议、意图分类、模糊表达映射、标准响应格式
6. `docs/project-management/standards/DOC_SYNC_CHECKLIST.md` — 文档同步清单
7. `docs/project-management/standards/NAMING_CONVENTION.md` — 命名规范
8. `docs/project-management/decisions/README.md` — 架构决策记录（ADR）索引，做重要决策前先查看历史决策

### 飞书知识库整理 / 维护
1. `docs/development/guides/feishu-knowledge-base-maintenance.md` — 盘点分类、结构整理SOP、父节点导航规范与覆盖校验（先读）
2. `docs/development/guides/wiki-link-verification-sop.md` — 飞书链接三层验证SOP（总览页→章README→知识点详解，回读比对node_token）
3. `docs/development/api/feishu-api.md` — lark-cli 通用命令踩坑（移动 / 删除 / 传参 / token）

---

## 文档完整清单（按类型分类）

### 零、标准开源文档（根目录）

| 文档 | 路径 | 用途 |
|------|------|------|
| 项目介绍 | `README.md` | 项目目标、存储分工、目录结构 |
| AI操作手册 | `AGENTS.md` | 全局执行规则、Things to Avoid、技术栈、设置命令 |
| 变更日志 | `CHANGELOG.md` | 版本变更记录（Keep a Changelog格式） |
| 开源协议 | `LICENSE` | MIT协议 |

### 一、操作指南（Task — 怎么做）

| 文档 | 路径 | 用途 |
|------|------|------|
| 主工作流 | `docs/WORKFLOW.md` | 全流程概览，各环节的操作步骤 |
| 视频处理 | `docs/development/tools/video-processing.md` | 下载、压缩、参数调优 |
| OCR讲义 | `docs/development/tools/ocr.md` | PDF/PPT/DOC文字提取 |
| 音频转写 | `docs/development/tools/transcription.md` | FunASR方案、环境配置 |
| 网盘操作 | `docs/development/api/netdisk-setup.md` | 百度网盘API配置与上传 |
| 飞书API | `docs/development/api/feishu-api.md` | 知识库、文档、多维表格API |
| 加密凭证 | `docs/development/api/encryption.md` | Token加密存储与使用 |
| Git工作流 | `docs/development/guides/git-workflow.md` | 分支策略、提交规范、pre-commit |
| AGENTS.md最佳实践 | `docs/development/guides/agents-md-best-practices.md` | AGENTS.md写作规范、结构优化、AI友好设计 |
| Playwright指南 | `docs/development/tools/playwright-cli-guide.md` | CLI使用、Token刷新、常见问题 |
| 交互工作流 | `docs/development/guides/interaction-workflow.md` | 通用页面交互、异常恢复、卡住处理 |
| **做题/交卷任务执行指南** | `docs/development/guides/exam-workflow.md` | 纯接口做题主链路（枚举/批量/单卷/两层回查/异常分流）、UI 兜底最小集、知识反哺、检查清单；接口契约见 gaodun-exam-api.md |
| **阶段①资源采集 SOP** | `docs/development/guides/resource-collection-sop.md` | 视频/转写、讲义/OCR 采集到课程「原始资源/」、并发调度、阶段校验门 |
| **阶段②做题/manifest SOP** | `docs/development/guides/paper-manifest-sop.md` | 接口做题交卷、采全 papers、主观题下钻、生成 manifest 与 14 组显式归组 |
| **阶段③知识详解生成 SOP（核心）** | `docs/development/guides/knowledge-detail-build-sop.md` | 按官方知识点跨讲聚合、一篇 4 节、样板门、全量自检（替代旧 lecture-knowledge-build-sop） |
| **阶段④收尾 SOP** | `docs/development/guides/finalize-sop.md` | 网盘备份、飞书统一同步、_workspace 按门禁时序清理 |
| 多角色协作（项目配合部分） | `docs/development/guides/multi-role-collaboration.md` | 角色定义、职责分工、协作关系；完整方法见飞书知识库 |
| 浏览器CDP连接手册 | `docs/development/tools/browser-cdp-connect-guide.md` | 用 puppeteer-core 连接日常Chrome（复用登录态）、自动授权、抓包与排障 |
| macOS辅助功能自动化 | `docs/development/guides/macos-accessibility-automation.md` | 元素级AXPress vs 坐标点击、多属性定位、多显示器坐标、通用SOP |
| 问题排查与人机协作方法论 | `docs/development/guides/debugging-and-collaboration.md` | 分层证伪、证据分级、失败换通道、人机分工与协作节奏 |
| 飞书知识库整理与维护 | `docs/development/guides/feishu-knowledge-base-maintenance.md` | 盘点与通用分类原则、结构整理SOP、父节点导航规范与覆盖校验、安全红线 |
| 文档下载 | `docs/development/tools/document-download.md` | CDN直链、curl后台下载、完整性校验 |

### 二、概念说明（Concept — 是什么）

| 文档 | 路径 | 用途 |
|------|------|------|
| 项目介绍 | `README.md` | 项目目标、存储分工、目录结构 |
| **项目需求文档** | `docs/REQUIREMENTS.md` | 核心诉求、功能需求、非功能需求、特殊规则、验收标准 |
| 知识库组织结构 | `docs/development/knowledge/knowledge-base-organization.md` | 知识库设计原则、节点层次 |
| 知识库来源清单 | `docs/development/knowledge/knowledge-base-sources.md` | 知识库内容来源、优先级 |
| 项目维护规范索引 | `docs/project-management/standards/PROJECT_MAINTENANCE.md` | 项目维护规范索引（拆分为三个子文档） |
| 项目结构维护规范 | `docs/project-management/standards/PROJECT_STRUCTURE_MAINTENANCE.md` | 结构维护、文件归属、网盘筛选、测试闭环、状态查询 |
| 文档写作指南 | `docs/project-management/standards/DOCUMENTATION_GUIDE.md` | 组织、分解、分类、Docs as Code、定期梳理、AI友好写作 |
| 文档优化流程与变更驱动 | `docs/project-management/standards/DOCUMENTATION_OPTIMIZATION.md` | 优化流程、变更驱动、检查清单、联动关系 |
| 质量保证规范 | `docs/project-management/standards/QUALITY_ASSURANCE.md` | 验证标准、质量检查流程 |
| 目录结构说明 | `docs/DIRECTORY_STRUCTURE.md` | 仓库/本地/网盘/飞书目录结构、Git忽略说明、维护原则 |
| 系统要求与环境配置 | `docs/SYSTEM_REQUIREMENTS.md` | 平台兼容性、硬件要求、环境配置、迁移新Mac步骤 |

### 三、参考资料（Reference — 查什么）

| 文档 | 路径 | 用途 |
|------|------|------|
| 知识库模板 | `docs/development/templates/KNOWLEDGE_BASE_TEMPLATE.md` | 层级树、知识点单篇 4 节、组父/课程全局/导航模板 |
| 父节点模板 | `docs/development/templates/PARENT_NODE_TEMPLATE.md` | 知识库父节点内容模板 |
| 命名规范 | `docs/project-management/standards/NAMING_CONVENTION.md` | 文件、目录、变量命名 |
| 文档同步清单 | `docs/project-management/standards/DOC_SYNC_CHECKLIST.md` | 同步时机、更新内容 |
| 状态查询协议 | `docs/project-management/standards/PROJECT_STATUS_QUERY.md` | 意图分类、模糊表达映射、标准响应格式 |
| 大任务执行规范 | `docs/project-management/standards/BATCH_TASK_EXECUTION.md` | 检查点、预警、异常恢复 |
| 脚本说明 | `scripts/README.md` | 所有脚本的用途、参数、可靠性 |
| 开发文档索引 | `docs/development/README.md` | 开发文档快速索引 |
| 高顿作业接口档案 | `docs/development/api/gaodun-exam-api.md` | 做题链路接口契约、ID映射、JWT鉴权与最小作答时长风控（接口为主路线） |
| 项目管理索引 | `docs/project-management/README.md` | 项目管理文档快速索引 |
| 报告模板 | `project-management/task-reports/README.md`、`docs/development/templates/REPORT_TEMPLATE.md` | 任务报告模板 |
| 通用验证模板 | `docs/development/templates/VERIFICATION_TEMPLATE.md` | 视频/转写等专项质检按需（验证默认不单独成文，无知识库专用模板） |
| 批量整改清单模板 | `docs/development/templates/REFACTOR_PLAN_TEMPLATE.md` | 批量重命名/结构整改的全量清单与回归核对（配合 PROJECT_STRUCTURE_MAINTENANCE 第六章 SOP） |
| 流程测试计划模板 | `docs/development/templates/TEST_PLAN_TEMPLATE.md` | 新学科首跑/链路改造的端到端流程测试（步骤状态、问题两级分级、通过标准） |

### 四、过程记录（Active — 做了什么）

> **说明**：这类文档是"过程记录"和"原始素材"，记录任务执行过程中的状态和产出。**不要求被其他文档交叉引用**（这是正常的，不是"文档孤岛"）。它们的价值在于可追溯性，需要时通过目录结构查找。

| 文档 | 路径 | 用途 |
|------|------|------|
| 任务状态 | `project-management/active/TASK_STATUS.md` | 当前任务进度（唯一权威来源） |
| 问题/BUG跟踪 | `project-management/active/ISSUES.md` | 未解决问题、已解决问题、潜在风险 |
| 批量任务状态 | `project-management/active/BATCH_TASK_STATUS.md` | 大任务执行进度、恢复点 |
| 课程索引 | `project-management/active/COURSE_INDEX.md` | 所有课程清单、进度、资源位置 |
| 测试计划 | `project-management/test-plans/测试计划_*.md` | 各课程测试计划（按需、不常驻） |
| 决策记录（ADR） | `docs/project-management/decisions/ADR-*.md` | 重要决策的背景、原因、后果 |
| 题答解析（接口采集） | 课程 `_workspace/papers/<paperId>.json`、`_workspace/manifest/{paper_index,papers_inventory,course-manifest}.json` | 题面/标准答案/官方解析只读采集与归组路由（gitignore 不入库） |
| 用户留言/笔记原件 | 课程 `_workspace/user-notes-raw/` | 高赞留言/口诀原件，提炼入「学员补充」后清（gitignore） |
| 任务报告 | `project-management/task-reports/任务报告_*.md` | 各任务执行报告（不要求引用） |

### 五、治理规范（Governance — 规则）

| 文档 | 路径 | 用途 |
|------|------|------|
| AI操作手册 | `AGENTS.md` | 全局执行规则、Things to Avoid |
| 项目需求文档 | `docs/REQUIREMENTS.md` | 核心诉求、功能需求、验收标准 |
| 大任务执行规范 | `docs/project-management/standards/BATCH_TASK_EXECUTION.md` | 检查点、预警、异常恢复 |
| 文档同步清单 | `docs/project-management/standards/DOC_SYNC_CHECKLIST.md` | 同步时机、更新内容 |
| 项目管理规范总览 | `docs/project-management/README.md` | 项目管理文档索引 |
| 编码规范 | `docs/project-management/standards/CODE_STYLE.md` | Python/Shell 编码、文档与命名的强制规范 |

### 六、知识库内容（Knowledge — 学什么）

| 文档 | 路径 | 用途 |
|------|------|------|
| 知识点单篇（成品主体） | 课程 `知识详解/NN_模块组/{官方知识点}.md` | 一个知识点一篇、固定 4 节（知识拆解/考试指导/题答解析/学员补充） |
| 课程做题思路解析 | 课程 `知识详解/课程做题思路解析.md` | 结合本科目题型的做题套路 |
| 考试指导速查手册 | 课程 `知识详解/考试指导速查手册.md` | 通用速查（只含通用内容、不含具体业务题、不按税种强行组织） |
| 通用做题思路解析 | 课程库层 `通用做题思路解析.md` | 跨课程通用做题方法论 |

---

## 文档维护规则

1. **新增文档时**：必须在本文档对应分类中添加条目，确保可发现
2. **删除文档时**：必须从本文档中移除条目，并检查是否有其他文档引用它
3. **文档移动/重命名时**：必须更新本文档和所有引用该文档的链接
4. **定期检查**：每次大阶段完成后，检查本文档与实际文件是否一致

---

## 文档优化记录

### 2026-09-04 三层解耦范式切换（ADR-012）

**新增**：
- `docs/project-management/decisions/ADR-012-三层解耦与按知识点聚合.md`
- 四阶段 SOP：`resource-collection-sop.md` / `paper-manifest-sop.md` / `knowledge-detail-build-sop.md` / `finalize-sop.md`

**重写**：WORKFLOW（四阶段总纲）、knowledge-base-organization、KNOWLEDGE_BASE_TEMPLATE、DIRECTORY_STRUCTURE、NAMING_CONVENTION 数据段、knowledge-base-sources、PARENT_NODE_TEMPLATE。

**废弃（加头部指引、正文留作追溯，勿据此执行）**：
- `lecture-knowledge-build-sop.md` → 被 `knowledge-detail-build-sop.md` 替代
- `knowledge/chapter-mapping-draft.md`（旧按讲映射）→ 被 ADR-012 / organization 替代

**加演进注记（历史决策保留）**：ADR-004（双文档→一篇4节）、ADR-005（四地分工最新口径）、ADR-011（lecture-resource-map→course-manifest）。

### 2026-08-29 文档治理优化

**新增文档**：
- `docs/REQUIREMENTS.md` — 项目需求文档
- `CHANGELOG.md` — 变更日志
- `LICENSE` — MIT协议

**合并文档**：
- `docs/knowledge-base/methodology/交互优化指南.md` → 合并到 `docs/development/guides/exam-workflow.md`（v4 JavaScript方法、检查清单、试卷统计）
- `docs/knowledge-base/methodology/做题流程与方法论.md` → 技术操作部分已在 `docs/development/guides/exam-workflow.md`，删除重复文档

**移动文档**：
- `docs/project-management/NAMING_CONVENTION.md` → `docs/project-management/standards/NAMING_CONVENTION.md`
- `docs/project-management/DOC_SYNC_CHECKLIST.md` → `docs/project-management/standards/DOC_SYNC_CHECKLIST.md`

**简化文档**：
- `docs/development/README.md` — 简化为快速索引，引用本文档
- `docs/project-management/README.md` — 简化为快速索引，引用本文档

**明确边界**：
- `AGENTS.md` — 添加文档边界说明（AI操作手册，不包含项目介绍、流程、需求）
- `README.md` — 添加文档边界说明（项目介绍，不包含AI规则、流程、需求）
- `docs/WORKFLOW.md` — 添加文档边界说明（操作流程，不包含项目介绍、AI规则、需求）

---

*本文档是项目的"文档索引"，所有新增/删除/移动文档时必须同步更新。*

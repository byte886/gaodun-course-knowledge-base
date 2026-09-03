# 高顿课程知识库系统

> **文档类型**：Concept（概念说明 — 项目介绍）
> **更新频率**：项目结构/课程/存储分工变更时
> **维护者**：AI自动维护 + 用户审核
> **读者**：人类（新加入项目者）和AI（首次了解项目时）

---

## 文档边界

| 维度 | 本文档（README.md） | 其他文档 |
|------|---------------------|----------|
| **定位** | 项目介绍，给人看的概览 | - |
| **读者** | 人类（新加入项目者）和AI（首次了解项目时） | - |
| **包含** | 项目目标、仓库地址、常用查询话术、课程列表、存储分工、目录结构 | - |
| **不包含** | AI执行规则、命令、Things to Avoid | → [AGENTS.md](AGENTS.md) |
| **不包含** | 详细操作流程、各环节步骤 | → [docs/WORKFLOW.md](docs/WORKFLOW.md) |
| **不包含** | 需求定义、功能清单、验收标准 | → [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) |
| **不包含** | 文档索引、所有文档清单 | → [docs/DOCUMENTATION_MAP.md](docs/DOCUMENTATION_MAP.md) |

---

## 项目介绍

把在线课程变成你自己的、可搜索、可问答、永久保存的备考资产。

最终你会得到：

1. **一个永不失效的课程资料库** — 所有购买的 CPA 课程视频和讲义保存在本地和百度网盘，平台到期也能看
2. **一个可搜索的个人知识库** — 视频里老师讲的、讲义上写的，全部变成文字，按课程章节组织在飞书知识库里，随时搜得到
3. **一个会做题的备考助手** — 学完直接做课后练习，知识库帮你找答案、对依据、查漏补缺

## 仓库地址

- GitHub: https://github.com/byte886/gaodun-course-knowledge-base （公有）

## 常用查询话术（直接复制使用）

想了解项目状态时，直接复制下面的话术发送给AI：

| 你想知道 | 直接复制 |
|----------|----------|
| 还有哪些任务要做 | `查询任务状态：还有哪些待完成的任务？` |
| 有什么问题/BUG | `查询问题：当前有哪些未解决的问题或BUG？` |
| 需要做什么维护 | `查询维护：当前有哪些待完成的维护工作？` |
| 给项目做体检/维护（执行型） | `以项目架构师身份做一次维护检查：结构一致性+文档健康度，出报告` |
| 项目整体进度 | `查询概览：给我一个项目整体状态的总结` |
| 为什么这样做 | `查询历史：为什么[某个决策]是这样做的？` |
| **刷新Playwright token** | `刷新Playwright token` |
| 不确定想查什么 | `我想了解项目状态，请给我几个选项让我选择` |

**完整速查表**：[PROJECT_STATUS_QUERY.md](docs/project-management/standards/PROJECT_STATUS_QUERY.md) 第零节

## 课程

- 【26考季】VIPCPA系列-税法（蔡俊峻老师）— 39场直播（跳过开班典礼后38场）
- 【26考季】VIPCPA系列-会计（罗翔老师）— 待采集
- 【26考季】VIPCPA-基础必修-会计（罗翔老师）— 12讲（手工录制视频）

## 存储分工

| 位置 | 内容 |
|------|------|
| GitHub 仓库 | Skill 代码、需求文档、工作流、项目计划、报告模板、加密凭证 |
| 本地 `~/Desktop/高顿/` | 视频文件、讲义文档、文字稿（生成结果） |
| 项目目录 `data/高顿/` | **符号链接**，指向 `~/Desktop/高顿/`（不同电脑可指向不同路径） |
| 百度网盘 `/apps/CPA课程归档/高顿/` | 与本地完全镜像 |
| 飞书知识库「CPA备考知识库」 | 视频文字稿、文档文字、知识梳理 |
| 飞书文档 | 任务报告 |

> **符号链接说明**：项目目录中的 `data/高顿/` 是符号链接，指向外部数据目录（默认 `~/Desktop/高顿/`）。不同电脑上数据目录路径可能不同，运行 `./scripts/setup_data_symlink.sh` 可快速创建或调整符号链接。检查状态：`./scripts/setup_data_symlink.sh --check`。`data/` 目录已在 `.gitignore` 中忽略，不会提交到GitHub。

## 多角色协作

本项目采用多角色协作模式，通过专业化分工提高项目执行效率。目前定义了以下4个角色：

| 角色名称 | 核心职责 | 技能数量 |
|---------|---------|---------|
| **项目架构师** | 项目架构设计、任务规划、需求分析、风险识别、目录结构和文件命名规范设计 | 12个 |
| **开发工程师** | 脚本开发、自动化工具构建、技术问题排查、代码质量与性能优化 | 18个 |
| **产品经理** | 对业务很熟悉，完成知识整理工作、PRD需求梳理、产品测试 | 待定义 |
| **私人秘书** | **首先**：个人记忆管理、日程安排、通用助手功能；**其次**：作为用户的代表，协调其他角色的工作，传递用户需求 | 待定义 |

### 产品经理角色说明

产品经理是一个对业务很熟悉的角色，结合了知识整理师和产品经理的能力，核心职责包括三个方面：

1. **完成原先"知识整理师"的工作**：知识库内容整理、知识拆解、考试指导内容生成、做题结果分析
2. **完成PRD的需求梳理工作**：产品需求文档（PRD）编写、业务流程梳理、功能规则定义、验收标准制定
3. **完成产品测试的工作**：功能测试、回归测试、知识库质量检查、验证修复效果

### 私人秘书角色说明

私人秘书是老板的助手，承担双重职责：

1. **首先：个人助理功能**：个人记忆管理、日程安排、通用助手功能、个人资料整理
2. **其次：团队协调者功能**：作为用户的代表，协调其他角色的工作，传递用户需求，帮助老板与项目架构师之间的传达和了解项目情况

**核心定位**：私人秘书是用户的第一联系人，用户的需求首先传达给私人秘书，由私人秘书协调其他角色完成工作。

**核心原则**：
- 管理统一由项目架构师负责（目录结构、文件命名、文档体系、流程管理等）
- 其他角色只负责写自己相关的内容，不负责管理
- 变更驱动更新：目录结构/流程变化由项目架构师负责，功能变化由开发工程师负责写技术文档

**本项目的角色职责分工和协作关系见**：[多角色协作（项目配合部分）](docs/development/guides/multi-role-collaboration.md)

**完整的多角色协作方法（角色配置、技能组合、详细协作流程、最佳实践等）见飞书知识库**：[豆包多角色定制指南](https://zcnjheoajxng.feishu.cn/wiki/M763wvGcnigwWVkqaOIcDbxPnib)

**启动新对话时指定角色**：用户只需要把项目文件夹加入新对话，然后说角色名称即可（如"开发工程师"、"项目架构师"），不需要说完整的句子。

## 目录结构

本地、百度网盘、飞书知识库三者使用相同的课程/讲座层级结构。

> **详细的目录结构说明见 [docs/DIRECTORY_STRUCTURE.md](docs/DIRECTORY_STRUCTURE.md)**，包含：
> - 项目仓库目录结构（简化版 + 详细版）
> - 本地与百度网盘课程目录结构
> - 飞书知识库结构
> - Git忽略目录说明
> - 目录结构维护原则

### 项目仓库结构（摘要）

```
项目根目录/
├── docs/                 # 项目文档（只放静态内容：方法论、指导、规范、流程、模板）
├── project-management/   # 项目管理（动态内容：任务状态、问题跟踪、测试计划、报告）
├── knowledge-base/       # 知识库内容（本地源头，同步到飞书）
├── scripts/              # 脚本（下载、压缩、转写、上传、做题等）
├── transcription/        # 转写工作目录（.gitignore忽略）
├── .secrets/             # 加密凭证（加密文件提交到仓库）
├── data/                 # 符号链接，指向外部数据目录（.gitignore忽略）
├── README.md             # 项目介绍（本文件）
├── AGENTS.md             # AI操作手册
└── .gitignore            # 忽略规则
```

### 课程目录结构（摘要）

```
高顿/
└── CPA/
    ├── 课程库/            # 走完整流程（有知识库）
    │   └── <课程名>/
    │       └── <章节名>/
    │           ├── video.mp4
    │           ├── transcript.md
    │           ├── 知识拆解.md
    │           ├── 考试指导.md
    │           ├── docs/
    │           └── docs_text/
    └── 待整理/            # 未走完整流程（暂无知识库）
        └── <课程名>/
```

### 飞书知识库结构（摘要）

知识库名称：**CPA备考知识库**，结构与本地/网盘一致。

---

## 文档快速入口

按任务类型查找文档（执行前必读对应文档）：

| 任务类型 | 先看 | 再看 |
|----------|------|------|
| **全局规则** | [AGENTS.md](AGENTS.md) | - |
| 视频下载/压缩 | [WORKFLOW.md 第2节](docs/WORKFLOW.md) | [video-processing.md](docs/development/tools/video-processing.md) |
| 文档下载 | [WORKFLOW.md 第3节](docs/WORKFLOW.md) | - |
| 百度网盘同步 | [WORKFLOW.md 第4节](docs/WORKFLOW.md) | [netdisk-setup.md](docs/development/api/netdisk-setup.md) |
| 视频转文字 | [WORKFLOW.md 第5节](docs/WORKFLOW.md) | [transcription.md](docs/development/tools/transcription.md) |
| 知识库生成 | [WORKFLOW.md 第6节](docs/WORKFLOW.md) | [knowledge-base-organization.md](docs/development/knowledge/knowledge-base-organization.md) |
| **做题验证** | [WORKFLOW.md 第7节](docs/WORKFLOW.md) | ⚠️ [exam-workflow.md](docs/development/guides/exam-workflow.md) |
| 任务报告 | [WORKFLOW.md 第8节](docs/WORKFLOW.md) | [project-management/README.md](docs/project-management/README.md) |
| Git操作 | [git-workflow.md](docs/development/guides/git-workflow.md) | - |
| 项目维护 | [PROJECT_MAINTENANCE.md](docs/project-management/standards/PROJECT_MAINTENANCE.md) | - |
| 决策历史 | [ADR索引](docs/project-management/decisions/README.md) | 做重要决策前先查看历史决策，避免冲突 |
| OCR识别 | [ocr.md](docs/development/tools/ocr.md) | - |
| 飞书API | [feishu-api.md](docs/development/api/feishu-api.md) | - |


## 完整工作流

详见 [docs/WORKFLOW.md](docs/WORKFLOW.md)（持续更新）。

简要流程：建目录 → 下载视频 → 下载文档 → 压缩验证 → 同步网盘 → 内容解析 → 知识库 → 做题验证 → 任务报告


## 项目维护规则

> ⚠️ **执行任何任务前，必须先读 [AGENTS.md](AGENTS.md)** — 里面有全局执行规则、文档快速入口、存储分工等核心要求。
>
> 每次开始新任务前、完成大任务后，必须检查项目结构是否合理，发现问题主动梳理调整。
> 详细规范见 [docs/project-management/standards/PROJECT_MAINTENANCE.md](docs/project-management/standards/PROJECT_MAINTENANCE.md)

### 核心原则

1. **GitHub 仓库只放代码和文档**：生成结果（视频、PDF、文字稿）放本地和百度网盘
2. **脚本统一放 `scripts/`**：不分散在各子目录
3. **文档按专业领域分类**：`docs/project-management/`、`docs/development/`
4. **具体产出物放对应课程目录**：专项质检、知识梳理等和被验证对象在一起（验证默认不单独成文）
5. **定期清理**：测试文件、临时日志、残留目录及时清理

### 文档组织三层保障

| 层级 | 位置 | 内容 |
|------|------|------|
| 第一层 | **README.md 正文** | 核心规则、维护原则、存储分工 |
| 第二层 | **docs/ 子文档** | 详细操作步骤、参数、常见问题 |
| 第三层 | **自动化机制** | pre-commit hook、脚本检查 |

### 问题驱动更新（强制）

发现任何问题（文件位置不对、脚本有bug、流程有缺陷等）时，必须立即评估是否需要更新文档或自动化检查，评估后必须执行，不能只发现问题不更新。


## 系统要求

> ⚠️ **项目主要在 macOS 下开发和运行**，部分工具依赖 macOS 原生功能。

> **详细的系统要求与环境配置见 [docs/SYSTEM_REQUIREMENTS.md](docs/SYSTEM_REQUIREMENTS.md)**，包含：
> - 支持的平台与兼容性
> - Mac专用工具与跨平台工具
> - 硬件要求
> - 开发与测试环境（当前配置）
> - 环境检查命令
> - 迁移到新 Mac 的步骤

### 摘要

| 维度 | 要求 |
|------|------|
| **平台** | macOS 12+（完全支持），Linux/Windows（部分支持） |
| **CPU** | 建议 8 核以上 |
| **内存** | 建议 16GB 以上 |
| **磁盘** | 建议 500GB 以上 |
| **关键工具** | ffmpeg、Node.js、Python 3.10+、Playwright CLI、iTerm2 |

---

## 技术方案

- 浏览器自动化：Playwright Extension 模式附加 Chrome
- 密钥提取：Hook hls.js Worker 通信截获 AES-128 密钥
- 下载：Node.js 多线程下载 HLS 分片
- 解密：AES-128-CBC
- 压缩：ffmpeg H.265 CRF30 + AAC 96k
- 网盘：百度网盘 PCS API 分片上传（4MB 分片，MD5 秒传）
- 验证：ffprobe 自动校验时长和可播放性


## 密钥管理

敏感凭证使用 openssl AES-256-CBC -pbkdf2 加密存储，加密文件提交到仓库，解密密码由用户保管。

```bash
./scripts/secrets.sh decrypt <name>   # 解密查看
```


## 文档同步清单

每次完成阶段性任务后，按清单检查并同步相关文档。详见 [docs/project-management/standards/DOC_SYNC_CHECKLIST.md](docs/project-management/standards/DOC_SYNC_CHECKLIST.md)。

清单包含：
- 任务管理类（任务状态、测试计划、课程索引）
- 做题产出类（题答 papers JSON、用户笔记；验证结论并入任务报告）
- 知识库内容类（知识拆解、考试指导、通用方法）
- 方法论类（做题方法论、知识库组织方法论）
- 工作流与规范类
- 开发文档类
- 项目概览类（README）

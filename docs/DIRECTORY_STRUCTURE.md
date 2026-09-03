# 目录结构详细说明

> **文档类型**：Reference（参考资料）
> **更新频率**：目录结构变更时
> **维护者**：AI自动维护
> **读者**：AI代理+人类

本文档详细说明项目的各类目录结构，包括项目仓库结构、本地与网盘课程目录结构、飞书知识库结构。

> README.md 中只保留摘要和链接，详细内容见本文档。

> **命名速查（唯一事实源：`docs/project-management/standards/NAMING_CONVENTION.md` 第九章）**
> - **工程目录**：全小写 kebab-case；知识库内容目录用中文体系（`01税法总论`、`税法-总论`）。
> - **脚本** `scripts/`：全小写 snake_case（`.py/.sh/.js`），Git 固定名 `pre-commit` 除外。
> - **规范/标准/模板/状态台账/全局索引**：英文 UPPER_SNAKE_CASE（如 `NAMING_CONVENTION.md`、`REPORT_TEMPLATE.md`、`TASK_STATUS.md`、`DOCUMENTATION_MAP.md`）。
> - **方法/操作/工具/API 文档**：英文小写 kebab-case，H1 标题仍用中文（如 `git-workflow.md`、`multi-role-collaboration.md`）。
> - **知识库内容与中文过程报告**：中文，文件名与 H1/飞书节点对应，日期用 ISO `YYYY-MM-DD`（如 `知识拆解.md`、`任务报告_对象_2026-08-31.md`）。
> - **固定名白名单**：`README.md`/`LICENSE`/`CHANGELOG.md`/`CONTRIBUTING.md`/`AGENTS.md`/`.gitignore`/`requirements.txt`/`pre-commit`/`.github/`。

---

## 一、项目仓库目录结构（GitHub）

### 1.1 简化版

```
项目根目录/
├── docs/                          # 项目文档（只放静态内容：方法论、指导、规范、流程、模板）
│   ├── development/               # 开发文档
│   │   ├── api/                   # API文档（飞书API、百度网盘API）
│   │   ├── guides/                # 详细操作指南（做题、Git、交互）
│   │   ├── knowledge/             # 知识库方法论（组织规范、来源清单）
│   │   ├── templates/             # 模板（知识库模板、父节点模板）
│   │   └── tools/                 # 工具使用文档（视频处理、转写、OCR、Playwright）
│   ├── project-management/        # 项目管理方法论（静态）
│   │   ├── decisions/             # 决策记录（ADR，半静态，只增不改）
│   │   └── standards/             # 规范文档（命名规范、文档同步、项目维护等）
│   ├── WORKFLOW.md                # 主工作流（总体流程概览）
│   ├── REQUIREMENTS.md            # 需求文档
│   ├── DIRECTORY_STRUCTURE.md     # 目录结构说明
│   └── DOCUMENTATION_MAP.md       # 文档地图（所有文档索引）
├── project-management/            # 项目管理（动态内容：任务状态、问题跟踪、测试计划、报告）
│   ├── active/                    # 活动状态（任务状态、问题跟踪、课程索引）
│   ├── test-plans/                # 测试计划（按需生成、不常驻，无任务时可不建）
│   └── task-reports/              # 任务执行报告（验证结论默认并入；目录保留 README）
├── knowledge-base/                # 知识库内容（本地源头，同步到飞书）
│   ├── organized-content/         # 整理后的知识内容（成品，新旧两套并存见其 README）
│   │   ├── _34chapters/讲NN/      # 【现役】官方 34 讲三件套（重建中，样板=讲01，做到哪讲建哪讲）
│   │   ├── NN<税种章名>/          # 【过渡底座】旧 15 章三件套，S3 逐章替换前保留
│   │   ├── 做题思路解析.md / 考试指导速查手册.md  # 两个全局文件（跨课程/跨章，非"通用方法/"目录）
│   │   └── ...
│   ├── source-materials/          # 原始素材（原材料，用于生成知识库）
│   │   ├── 税法-总论/             # 各课程的解析与用户留言、用户笔记精华（题答走 data/knowledge-source）
│   │   └── ...
│   └── lecture-resource-map.json  # 讲次→课件/OCR/转写取料路由（ADR-011，入库，脚本可校验重建）
├── scripts/                       # 脚本（下载、压缩、转写、上传、做题等）
├── transcription/                 # 转写工作目录（.gitignore忽略）
├── .secrets/                      # 加密凭证（加密文件提交到仓库）
├── data/                          # 符号链接，指向外部数据目录（.gitignore忽略）
├── README.md                      # 项目介绍
├── AGENTS.md                      # AI操作手册（每次启动自动加载）
├── CHANGELOG.md                   # 变更日志
├── LICENSE                        # MIT协议
└── .gitignore                     # 忽略规则
```

### 1.2 详细版（含文件说明）

```
gaodun-course-knowledge-base/
├── .gitignore                # Git忽略规则（视频/文档/音频/转写结果等）
├── README.md                 # 项目说明
├── AGENTS.md                 # 全局执行规则、文档快速入口、存储分工
├── .secrets/                 # 加密凭证（已提交，密码由用户保管）
│   ├── gh_token.enc          # GitHub Personal Access Token（加密）
│   └── baidu_credentials.enc # 百度网盘API凭证（加密）
├── scripts/                  # 所有可执行脚本
│   ├── capture_key.js        # HLS AES密钥捕获（Playwright Worker hook注入）
│   ├── download_decrypt.js   # HLS分片下载并AES-128解密合并
│   ├── compress.sh           # ffmpeg压缩为H.265 MP4（CRF30，iTerm显示进度）
│   ├── baidu_upload.py       # 百度网盘分片上传（4MB分片+MD5秒传）
│   ├── batch_upload.sh       # 批量上传视频（iTerm运行，断点续传）
│   ├── upload_course.sh      # 课程目录批量上传（自动过滤技术过程文档）
│   ├── transcribe_pipeline.py # 音频转文字（FunASR+VAD）
│   ├── batch_transcribe.sh   # 批量转写（iTerm运行，断点续传）
│   ├── batch_ocr.sh          # 批量OCR（macOS Vision框架）
│   ├── playwright_connect.sh # Playwright连接脚本（自动处理连接确认）
│   ├── secrets.sh            # 密钥加密/解密工具（AES-256-CBC）
│   ├── setup_data_symlink.sh # data/符号链接设置（跨电脑调整路径）
│   ├── setup_transcription_env.sh # 转写环境搭建（新电脑一键创建虚拟环境）
│   ├── answer_option.sh      # 单选题答题脚本
│   ├── answer_multi.sh       # 多选题答题脚本
│   ├── submit_exam.sh        # 交卷脚本
│   ├── check_directory_structure.sh # 检查目录结构
│   ├── check_kb_structure.sh # 检查知识库结构
│   ├── collect_analysis.js   # 收集解析
│   ├── pre-commit            # pre-commit hook源文件（大文件/敏感信息检查）
│   └── README.md             # 脚本说明文档
├── docs/
│   ├── WORKFLOW.md           # 总体工作流（索引+流程）
│   ├── REQUIREMENTS.md       # 需求文档
│   ├── DOCUMENTATION_MAP.md  # 文档地图
│   ├── DIRECTORY_STRUCTURE.md # 目录结构详细说明（本文档）
│   ├── project-management/   # 项目管理方法论（静态）
│   │   ├── README.md         # 项目管理规范
│   │   ├── standards/        # 标准规范
│   │   │   ├── QUALITY_ASSURANCE.md # 质量保证规范
│   │   │   ├── PROJECT_MAINTENANCE.md # 项目维护规范索引
│   │   │   ├── PROJECT_STRUCTURE_MAINTENANCE.md # 项目结构维护规范
│   │   │   ├── DOCUMENTATION_GUIDE.md # 文档写作指南
│   │   │   ├── DOCUMENTATION_OPTIMIZATION.md # 文档优化流程与变更驱动
│   │   │   ├── NAMING_CONVENTION.md # 命名规范
│   │   │   ├── BATCH_TASK_EXECUTION.md # 大任务执行规范
│   │   │   ├── DOC_SYNC_CHECKLIST.md # 文档同步清单
│   │   │   ├── CODE_STYLE.md        # 编码规范（强制标准）
│   │   │   └── PROJECT_STATUS_QUERY.md # 状态查询协议
│   │   └── decisions/        # 决策记录（ADR，半静态，只增不改）
│   └── development/          # 开发文档
│       ├── README.md         # 开发文档索引
│       ├── api/              # API文档
│       │   ├── feishu-api.md     # 飞书API使用
│       │   ├── netdisk-setup.md  # 百度网盘接入
│       │   └── encryption.md      # 加密凭证
│       ├── guides/           # 详细操作指南
│       │   ├── exam-workflow.md      # 做题工作流
│       │   ├── git-workflow.md       # Git工作流
│       │   ├── interaction-workflow.md # 通用交互流程
│       │   ├── agents-md-best-practices.md # AGENTS写作最佳实践
│       │   └── multi-role-collaboration.md # 多角色协作（项目配合部分）
│       ├── knowledge/        # 知识库方法论
│       │   ├── knowledge-base-organization.md # 知识库组织规范
│       │   └── knowledge-base-sources.md      # 知识库来源清单
│       ├── tools/            # 工具使用文档
│       │   ├── playwright-cli-guide.md # Playwright CLI使用指南
│       │   ├── video-processing.md    # 视频处理详细指南
│       │   ├── transcription.md       # 音频转文字
│       │   ├── ocr.md                 # OCR文字提取
│       │   └── document-download.md   # 文档下载
│       └── templates/        # 模板文件
│           ├── KNOWLEDGE_BASE_TEMPLATE.md # 知识库页面模板
│           ├── PARENT_NODE_TEMPLATE.md    # 父节点页面模板
│           ├── REPORT_TEMPLATE.md          # 任务报告模板
│           └── VERIFICATION_TEMPLATE.md    # 通用验证模板（视频/转写等专项质检按需，非每次必出）
├── project-management/       # 项目管理（动态内容）
│   ├── README.md             # 项目管理目录说明
│   ├── active/               # 活动状态（频繁更新）
│   │   ├── TASK_STATUS.md    # 任务状态（唯一任务状态来源）
│   │   ├── ISSUES.md         # 问题跟踪
│   │   ├── BATCH_TASK_STATUS.md # 批量任务状态
│   │   └── COURSE_INDEX.md   # 课程清单索引
│   ├── test-plans/           # 测试计划（按需生成、不常驻）
│   │   └── 测试计划_*.md
│   └── task-reports/         # 任务执行报告（验证结论默认并入；目录保留 README）
│       ├── README.md         # 报告目录说明
│       └── 任务报告_*.md
├── knowledge-base/           # 知识库实际内容（本地，唯一源头）
│   ├── organized-content/    # 整理后的知识内容
│   │   ├── 做题思路解析.md / 考试指导速查手册.md  # 两个全局文件（跨课程/跨章，非"通用方法/"目录）
│   │   ├── 01税法总论/ … 15强化冲刺/  # 旧15章版（过渡底座，待被34讲版替换，去留见阶段计划D4）
│   │   │   ├── README.md        # 章节概览（含子节点链接）
│   │   │   ├── 知识拆解.md      # 章节核心知识点
│   │   │   └── 考试指导.md      # 做题技巧/易错点/记忆口诀（验证/同步不单独成文）
│   │   └── _34chapters/      # 新版：严格对齐官方34讲（讲01…讲34，重建中）
│   │       └── 讲NN/ 知识拆解.md + 考试指导.md + README.md
│   ├── source-materials/     # 原始素材（题/答/解析走 data/knowledge-source 接口采集，不在此）
│   │   └── 税法-总论/
│   │       ├── 解析与用户留言_*.md # 官方解析和用户留言整理（永久）
│   │       └── 用户笔记精华_*.md # 高赞用户留言整理（永久）
│   └── lecture-resource-map.json # 讲次→课件/OCR/转写取料路由（ADR-011，入库版本化，verify_lecture_map.py 校验/重建）
├── transcription/            # 转写工作目录
│   ├── requirements.txt      # Python依赖清单（新电脑复现环境用）
│   └── venv/                 # Python虚拟环境（gitignore忽略，不提交）
├── data/                     # 工作区：接口采集/抓包/做题进度（实体目录，整体 gitignore 不提交）
│   ├── 高顿/                 # 符号链接 → ~/Desktop/高顿/（课程库：A视频/C讲义线，传网盘）
│   ├── cdp-sniff/            # 做题进度总账+抓包（仅留 papers_inventory/papers_audit/course_catalog；侦查包结论入文档后清，全部定稿后整目录清）
│   ├── knowledge-source/     # B做题线原料 L1（按 paperId 集中存，按讲聚合走 paper_index）
│   │   ├── paper_index.json  # 试卷索引（paperId↔chapter，按讲聚合用）
│   │   └── papers/*.json     # 每套卷题面/标准答案/解析（116套，备份到网盘独立原料区）
│   └── （其余抓包/运行过程文件按需生成、不常驻，结论沉淀后可清）
└── .git/hooks/
    └── pre-commit            # 实际生效的pre-commit hook
```

### 1.3 Git忽略目录说明

| 目录 | 忽略原因 | 复现方式 |
|------|----------|----------|
| `transcription/venv/` | Python虚拟环境，路径硬编码，不应复制 | `./scripts/setup_transcription_env.sh` 重新创建 |
| `data/` | 工作区（抓包、题答原料、做题进度等），体积大且随任务变化，整体不提交（轻量派生元数据 lecture-resource-map 例外，已移入库 `knowledge-base/`） | 目录内 `高顿` 软链由 `./scripts/setup_data_symlink.sh` 创建；其余为接口采集/运行产物，可由脚本重建 |

**虚拟环境迁移原则**：Python虚拟环境不直接复制到新电脑，用 `requirements.txt` + 搭建脚本重新创建。

---

## 二、本地与百度网盘（完全镜像）

本地、百度网盘、飞书知识库三者使用相同的课程/讲座层级结构。

```
高顿/                                    ← 本地: ~/Desktop/高顿/
└── CPA/                                 ← 网盘: /apps/CPA课程归档/高顿/CPA/
    ├── 课程库/                          ← 走完整流程（有知识库）
    │   ├── 【26考季】VIPCPA系列-税法（蔡俊峻老师）/
    │   │   ├── 01_税法全面精讲01-税法总论/
    │   │   │   ├── video.mp4
    │   │   │   ├── transcript.md
    │   │   │   ├── 知识拆解.md
    │   │   │   ├── 考试指导.md
    │   │   │   ├── docs/
    │   │   │   └── docs_text/
    │   │   └── ...
    │   └── 【26考季】VIPCPA系列-会计（罗翔老师）/
    └── 待整理/                          ← 未走完整流程（暂无知识库）
        └── 【26考季】VIPCPA-基础必修-会计（罗翔老师）/
            ├── 01_会计总论(一)/
            └── ...
```

### 2.1 每个讲座目录下

```
NN_讲座标题/
├── video.mp4          # 压缩后的最终视频（H.265 CRF30）
├── transcript.md      # 视频文字稿（语音转文字）
├── transcript.json    # 转写原始数据（含时间戳）
├── 知识拆解.md         # 知识本身（结构化知识点，用于搜索、应用、AI问答）
├── 考试指导.md         # 考试指导（考点、易错点、记忆口诀、真题回顾）
├── docs/              # 讲义文档原件（PDF/PPT/DOC）
├── docs_text/         # OCR文字稿（讲义文档中图片的OCR识别结果）
├── VERIFICATION.md    # 视频/转写专项质检（按需，非每次必出）
└── .uploaded          # 上传标记（已上传到百度网盘后生成）
```

> **说明**：
> - `docs_text/` 是标准目录，用于存放OCR识别后的文字稿（与docs/原始文档区分）
> - `.uploaded` 是上传标记文件，存在表示已上传到百度网盘
> - 课程根目录下可能有 `upload_log.txt`（上传日志）和 `.DS_Store`（macOS系统文件，应忽略）

---

## 三、飞书知识库

知识库名称：**CPA备考知识库**

结构与本地/网盘一致，每个讲座对应一个知识库页面：

```
CPA备考知识库/
└── CPA/
    ├── 课程库/
    │   ├── 【26考季】VIPCPA系列-税法（蔡俊峻老师）/
    │   │   ├── 01_税法全面精讲01-税法总论    ← 页面：视频文字稿 + 讲义要点
    │   │   └── ...
    │   └── 【26考季】VIPCPA系列-会计（罗翔老师）/
    └── 待整理/
        └── 【26考季】VIPCPA-基础必修-会计（罗翔老师）/
```

"待整理"中的课程走完知识库流程后，移动到"课程库"下（本地、网盘、知识库三处同步移动）。

---

## 四、目录结构维护原则

### 4.1 基本原则

1. **本地、网盘、知识库三者结构一致**：课程/讲座层级结构在三处保持同步
2. **项目仓库只放代码和文档**：生成结果（视频、PDF、文字稿）放本地和网盘，不放GitHub
3. **模板统一管理**：所有模板放在 `docs/development/templates/`，其他目录不放模板
4. **目录结构变更时同步更新**：新增/移动/删除目录时，必须更新本文档和 README.md
5. **文件和目录有变化时检查 .gitignore**：确保新的文件类型或目录被正确忽略

### 4.2 文档创建规则（强制执行）

在创建任何新文档前，必须按以下流程操作：

#### 第一步：检查是否已有类似文档

```bash
# 搜索是否已有类似主题的文档
grep -r "关键词" docs/ --include="*.md" -l
# 查看文档地图
cat docs/DOCUMENTATION_MAP.md
```

**如果已有类似文档**：
- 优先更新现有文档，而不是创建新文档
- 如果现有文档内容过多需要拆分，参考"文档分解原则"（DOCUMENTATION_GUIDE.md 第二章）

#### 第二步：确定文档类型和归属目录

根据 Diátaxis 框架确定文档类型，然后选择对应的目录：

| 文档类型 | 归属目录 | 说明 |
|----------|----------|------|
| Tutorial（教程） | `docs/development/guides/` | 面向初学者的操作指南 |
| How-to（操作指南） | `docs/development/guides/` | 具体任务的操作步骤 |
| Reference（参考资料） | `docs/development/api/` 或对应目录 | API、参数、配置等参考 |
| Explanation（解释说明） | `docs/development/knowledge/` | 概念、原理、方法论 |
| Standard（规范标准） | `docs/project-management/standards/` | 命名规范、质量标准等 |
| Decision（决策记录） | `docs/project-management/decisions/` | ADR架构决策记录 |
| Active（活动状态） | `project-management/active/` | 任务状态、问题跟踪等 |
| Template（模板） | `docs/development/templates/` | 各类文档模板 |
| Tool（工具文档） | `docs/development/tools/` | 工具使用说明 |

> **两套词表的关系（避免混淆）**：本表用 Diátaxis 框架判断"归属哪个目录"；文档**头部 `文档类型` 标注**必须用 `DOCUMENTATION_GUIDE.md` 3.1 的 7 类封闭词表（`Task/Concept/Reference/Governance/Active/Knowledge/Template`）。映射：Tutorial/How-to/Tool→`Task`，Explanation→`Concept`，Reference→`Reference`，Standard/Decision→`Governance`（ADR 按 NAMING 9.8），活动状态→`Active`，模板→`Template`，知识内容→`Knowledge`。定完类型与目录后，**文件名风格按 `NAMING_CONVENTION.md` 第九章**。

#### 第三步：评估是否需要新目录

**只有在以下情况才创建新目录**：
1. 现有目录中没有适合该类文档的位置
2. 该类文档预计会有3个以上的文件
3. 新目录的职责清晰，与现有目录不重叠

**创建新目录前必须回答**：
- 这个目录的职责是什么？
- 与现有目录的边界在哪里？
- 预计会有多少个文件？
- 是否可以放在现有目录下，用前缀区分？

#### 第四步：创建文档并更新索引

创建文档后，必须更新：
1. `docs/DOCUMENTATION_MAP.md`（文档地图）
2. 对应目录的 `README.md`（如果有）
3. `docs/DIRECTORY_STRUCTURE.md`（如果涉及目录变更）

### 4.3 文档删除规则（强制执行）

在删除任何文档前，必须按以下流程操作：

#### 第一步：检查引用关系

```bash
# 搜索哪些文档引用了待删除的文档
grep -r "文档名" docs/ --include="*.md" -l
# 搜索脚本中是否引用
grep -r "文档名" scripts/ -l
```

**如果有其他文档引用**：
- 先更新引用关系，将引用指向新位置或删除引用
- 不能直接删除有引用的文档

#### 第二步：评估内容价值

问自己：
1. 这个文档的内容是否已融入其他文档？
2. 这个文档是否还有追溯价值？
3. 删除后是否会影响后续工作？

**如果内容已融入其他文档且无追溯价值**：可以删除
**如果还有追溯价值**：考虑移到 `project-management/active/` 或归档目录

#### 第三步：删除文档并更新索引

删除文档后，必须更新：
1. `docs/DOCUMENTATION_MAP.md`（文档地图）
2. 对应目录的 `README.md`（如果有）
3. 所有引用该文档的地方

### 4.4 目录调整规则（强制执行）

在调整任何目录结构前，必须按以下流程操作：

#### 第一步：评估调整必要性

问自己：
1. 为什么需要调整目录？（文档过多？职责不清？新需求？）
2. 不调整是否可以解决问题？（用前缀区分？更新文档内容？）
3. 调整的收益是否大于成本？（更新引用、更新文档、潜在错误）

**只有在以下情况才调整目录**：
1. 目录职责不清，与其他目录重叠
2. 目录下文件过多（超过20个），需要细分
3. 新的文档类型没有合适的归属目录
4. 项目结构发生重大变化

#### 第二步：制定调整方案

调整方案必须包括：
1. 调整前的目录结构
2. 调整后的目录结构
3. 每个文件的移动路径（从哪里到哪里）
4. 需要更新的引用关系清单
5. 需要更新的文档清单（DOCUMENTATION_MAP.md、README.md等）

#### 第三步：执行调整并验证

执行调整后，必须验证：
1. 所有文件都已移动到正确位置
2. 所有引用关系都已更新
3. 文档地图和目录结构文档已更新
4. 脚本中的路径引用都已更新（如果有）

```bash
# 验证：搜索是否还有旧路径的引用
grep -r "旧目录名" docs/ scripts/ --include="*.md" --include="*.sh" --include="*.py" -l
```

### 4.5 文档与目录的关系原则

1. **目录先于文档**：创建文档前，先确定归属目录；不要先创建文档再想放哪里
2. **目录职责单一**：每个目录只有一个清晰的职责，避免"大杂烩"目录
3. **文档归属唯一**：每个文档只有一个主要归属目录，避免重复存放
4. **目录深度适中**：目录深度不超过4层（docs/xxx/yyy/zzz/），过深会增加查找成本
5. **目录名称稳定**：目录名称确定后尽量不变，频繁变更会增加维护成本
6. **空目录及时清理**：删除文档后，如果目录为空，及时删除空目录

### 4.6 常见错误与纠正

| 错误做法 | 正确做法 |
|----------|----------|
| 想到就创建文档，不检查是否已有类似文档 | 先搜索，优先更新现有文档 |
| 创建文档后不更新文档地图 | 创建后立即更新 DOCUMENTATION_MAP.md |
| 删除文档前不检查引用关系 | 先检查引用，更新引用后再删除 |
| 频繁调整目录结构 | 评估必要性，只有收益大于成本时才调整 |
| 目录职责不清，什么都往里放 | 每个目录只有一个清晰职责 |
| 调整目录后不验证引用关系 | 调整后搜索验证所有引用都已更新 |
| 为单个文档创建新目录 | 只有预计3个以上文件时才创建新目录 |

# 目录结构详细说明

> **文档类型**：Reference（参考资料）
> **更新频率**：目录结构变更时
> **维护者**：AI自动维护 + 用户审核
> **读者**：AI代理 + 人类

本文档说明四类存储的目录结构与分工：**GitHub 仓库（工程）、本地课程数据（data）、百度网盘（备份）、飞书知识库（成品知识系统）**。范式基线 [ADR-012](project-management/decisions/ADR-012-三层解耦与按知识点聚合.md)。

> README.md 只留摘要与链接，详细内容见本文档。
> **命名唯一事实源**：[NAMING_CONVENTION.md](project-management/standards/NAMING_CONVENTION.md)（第九章管 Git 工程命名，第一~八章管课程数据三层命名）。

---

## 〇、四地存储分工总表（先看这张）

| 内容 | Git 仓库 | 本地 data | 百度网盘 | 飞书知识库 |
|------|:---:|:---:|:---:|:---:|
| 规范/模板/SOP/脚本/ADR | ✅ 唯一源 | — | — | — |
| 原始资源（视频/转写/讲义/OCR） | ❌ 忽略 | ✅ | ✅ 备份 | ❌ |
| 知识详解成品（组→92 篇 + 全局篇） | ❌ 不入 Git | ✅ | ✅ 备份 | ✅ 唯一对外知识系统 |
| `_workspace/` 过程件（papers/manifest/留言原件/tmp/logs） | ❌ 忽略 | ✅ | ❌ 不传 | ❌ |
| 加密凭证 `.secrets/*.enc`、工具链 venv/node_modules | 见 .gitignore | ✅ | ❌ | ❌ |

**一句话**：Git 只放"怎么做"的工程资产；课程"原料 + 成品"在本地 data，原料与成品备份网盘，**成品知识系统最终落飞书**；过程件只在本地 `_workspace`、收尾清。

---

## 一、项目仓库目录结构（GitHub，只放工程）

```
gaodun-course-knowledge-base/
├── docs/                          # 工程文档（静态：方法论/规范/流程/模板/API）
│   ├── WORKFLOW.md                # 主工作流（四阶段总纲）
│   ├── REQUIREMENTS.md
│   ├── DIRECTORY_STRUCTURE.md     # 本文档
│   ├── DOCUMENTATION_MAP.md
│   ├── development/
│   │   ├── api/                   # API 文档（feishu / gaodun-exam / netdisk / encryption）
│   │   ├── guides/                # 阶段 SOP 与操作指南（resource-collection / paper-manifest /
│   │   │                          #   knowledge-detail-build / finalize / exam-workflow 等）
│   │   ├── knowledge/             # 知识库方法论（organization 组织规范 / sources 来源清单）
│   │   ├── templates/             # 模板（KNOWLEDGE_BASE_TEMPLATE / PARENT_NODE_TEMPLATE / REPORT_TEMPLATE）
│   │   ├── methodology/           # 通用方法论（调试/并发/任务规划等，课程无关）
│   │   ├── performance/           # 性能/并行
│   │   └── tools/                 # 工具文档（video-processing/transcription/ocr/document-download/browser-cdp）
│   └── project-management/
│       ├── decisions/             # ADR（只增不改）
│       └── standards/             # 治理规范（NAMING/QUALITY/CODE_STYLE/DOC_* 等）
├── project-management/            # 项目管理（动态：active 状态台账 / test-plans / task-reports）
├── scripts/                       # 可执行脚本（下载/压缩/转写/OCR/上传/做题/校验，snake_case）
├── transcription/                 # 转写工具链：requirements.txt 入库，venv/ 忽略
├── .secrets/                      # 加密凭证（*.enc；*.json/*.txt 忽略）
├── data/                          # → 软链外部数据盘，整体 gitignore（见第二章）
├── logs/、node_modules/           # 运行日志/依赖，均 gitignore
├── README.md / AGENTS.md / CHANGELOG.md / LICENSE / .gitignore
└── （旧 knowledge-base/ 在存量消化、校验后移除，不再版本化课程成品）
```

要点：
1. **Git 不再版本化课程成品**（旧 `knowledge-base/organized-content`、`source-materials` 是旧范式产物，作为阶段③输入被消化、校验后清退；`lecture-resource-map.json` 的职责由 `_workspace/manifest/course-manifest.json` 承接，见 ADR-012）。
2. 工程文档怎么分类、何时新建/删除/调整目录，见本文档第六章。

---

## 二、本地课程数据（data，软链外部、整体 gitignore）

`data/高顿` 软链到外部数据盘（如 `~/Desktop/高顿`），`data/` 整体不入库。单个**课程目录**采用封板三层结构：

```
data/高顿/CPA/课程库/【26考季】VIPCPA系列-税法（蔡俊峻老师）/
├── README.md                          # 课程目录说明：结构图 + 各文件来源/作用 + 对应关系
├── 原始资源/                          # 第一层：按资源类型分桶的原始原料（永久、传网盘）
│   ├── videos/
│   │   └── NN_讲题/
│   │       ├── video.mp4              # 压缩成品（H.265）
│   │       ├── transcript.md          # 转写文字稿（面向人）
│   │       └── transcript.json        # 转写原始数据（技术件，不传网盘）
│   └── notes/
│       └── NN_模块/
│           ├── 讲义_{名称}.pdf        # 官方讲义原件（有则建，试卷/纯视频讲可为空）
│           └── 讲义_{名称}_OCR.md     # 讲义 OCR 文字稿
├── 知识详解/                          # 第二层：成品（传网盘 + 同步飞书，与飞书同构）
│   ├── 01_税法总论/
│   │   ├── 税法概念.md                # 一个官方知识点 = 一篇，篇内固定 4 节
│   │   └── …（本组 N 篇）
│   ├── 02_增值税法/ …
│   ├── …（共 14 组、92 篇）
│   ├── 课程做题思路解析.md            # 课程全局篇（带本科目特征）
│   └── 考试指导速查手册.md            # 课程全局篇（只通用，冲刺后定稿）
└── _workspace/                        # 第三层：运行过程件（英文命名，gitignore+不传网盘，收尾清）
    ├── README.md                      # 工作区说明（结构/作用/清理时机）
    ├── manifest/
    │   ├── course-manifest.json       # 讲↔资源↔知识点 路由 + 组→知识点映射（可 rebuild）
    │   ├── papers_inventory.json      # 官网试卷台账
    │   ├── paper_index.json           # 本地试卷索引（paperId↔讲/组）
    │   └── course_catalog.json        # 课程表/syllabus 快照
    ├── papers/                        # 116 套卷题/标准答案/官方解析 JSON
    ├── sniff/                         # CDP 抓包（验证完即删）
    ├── user-notes-raw/                # 用户留言/笔记原件（100% 吸收进成品后删）
    ├── logs/
    └── tmp/
        ├── download/NN_讲题/          # 下载临时（单任务成功即清）
        └── transcribe/NN_讲题/        # 转写临时（单任务成功即清）
```

课程库层（跨课）另有一份：`data/高顿/CPA/课程库/通用做题思路解析.md`。

### 2.1 三层边界

| 层 | 进什么 | 不进什么 | 生命周期 |
|----|--------|----------|----------|
| 原始资源 | 视频/转写、讲义/OCR | 题答 JSON、过程件 | 永久，传网盘 |
| 知识详解 | 92 知识点篇 + 课程全局篇 | 原始件、临时件 | 成品，可迭代，传网盘+同步飞书 |
| _workspace | manifest/papers/sniff/留言原件/logs/tmp | 成品、原始件 | 临时，按序清理 |

### 2.2 不进 _workspace 的例外（留标准位置）

- `.secrets/*.enc`：加密、跨课复用，留仓库根；
- `node_modules/`、`transcription/venv/`：工具链环境、跨课、包管理器要求标准位置，留原位 + gitignore；
- `package.json`/`requirements.txt` 与 `scripts/`：入 Git。

### 2.3 旧散落件去向（存量迁移）

- 旧按讲目录（`00_…`~`38_…`，内含 video/transcript/docs/docs_text/.vfetch/零星旧成品）→ 拆入 `原始资源/{videos,notes}` 与 `知识详解/`；
- `data/knowledge-source/{papers,paper_index.json}` → `_workspace/{papers,manifest}`；
- `data/cdp-sniff/*` → `_workspace/{manifest,sniff}`，侦查包结论入文档后清；
- 讲目录内 `.vfetch/` 下载缓存 → `_workspace/tmp/download` 后清。

---

## 三、百度网盘（备份：镜像原始资源 + 知识详解）

- 网盘根：`/apps/CPA课程归档/高顿/CPA/`，与本地**同构镜像"原始资源 + 知识详解"两层**；
- **不传 `_workspace/`**（过程件可由接口/脚本重建），不传 `transcript.json`、tmp、logs；
- 上传凭证与命令见 [netdisk-setup.md](development/api/netdisk-setup.md)；上传后做本地↔网盘文件数/大小核对。

```
/apps/CPA课程归档/高顿/CPA/课程库/【26考季】VIPCPA系列-税法（蔡俊峻老师）/
├── 原始资源/…（同本地）
└── 知识详解/…（同本地）
```

---

## 四、飞书知识库（只同步知识详解成品）

知识库「CPA备考知识库」，结构与本地 `知识详解/` **同构**，只同步成品：

```
CPA备考知识库/
└── 课程库/
    ├── 通用做题思路解析（跨课一份）
    └── 【26考季】VIPCPA系列-税法（蔡俊峻老师）
        ├── 01_税法总论（父节点）→ 知识点子页面…
        ├── …14 组
        ├── 课程做题思路解析
        └── 考试指导速查手册
```

- 不同步原始资源（视频/讲义在网盘）、不同步 `_workspace`；
- **本地全量生成并通过阶段③校验门后统一同步**，冲刺模考后做最终一次同步；不在飞书直接编辑（紧急修复除外）；
- 节点模板见 [KNOWLEDGE_BASE_TEMPLATE.md](development/templates/KNOWLEDGE_BASE_TEMPLATE.md)，接口见 [feishu-api.md](development/api/feishu-api.md)。

---

## 五、目录结构维护原则

### 5.1 基本原则
1. **四地分工不串味**：工程入 Git、原料/成品入 data、原料+成品备份网盘、成品同步飞书、过程件留 _workspace；
2. 项目仓库只放代码和文档，大体积课程数据不进 GitHub；
3. 模板统一放 `docs/development/templates/`；
4. 目录结构变更必须同步本文档、NAMING、README、DOCUMENTATION_MAP 与 .gitignore。

### 5.2 新建文档前（强制）
先 `grep -r 关键词 docs/` + 查 DOCUMENTATION_MAP 确认无重复；按 Diátaxis 判型、按 NAMING 第九章定文件名与归属目录；预计≥3 个同类文件才新建子目录；建好后更新文档地图与目录 README。

### 5.3 删除文档前（强制）
先 `grep -r 文档名 docs/ scripts/` 查引用，先改/删引用再删；评估是否已融入他文、有无追溯价值；删后更新文档地图与所有引用。

### 5.4 调整目录前（强制）
先评估必要性（职责重叠/文件过多/新类型无归属/结构重大变化），产出"前结构→后结构→逐文件移动路径→引用更新清单→文档更新清单"，执行后用 grep 验证无旧路径残留；改名用 `git mv` 保留历史。

### 5.5 通用原则
目录先于文档、职责单一、归属唯一、深度适中（docs 内≤4 层）、名称稳定、空目录及时清理。常见错误纠正沿用"先搜再建/改引用再删/改完验证"的闭环。

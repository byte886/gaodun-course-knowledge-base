# 课程档案卡（course-profile）

> **文档类型**：Reference（配置说明）
> **更新频率**：新增课程或 profile 字段变更时
> **维护者**：课程工具链

> 一门课一个 JSON 文件，是该课程所有脚本共用的**唯一事实源**：课程叫什么、各类 ID 是多少、
> 属于哪个科目/平台、分几个官方组、本地和网盘路径在哪。脚本读它，不再把这些信息写死在代码里。

## 一句话理解

以前每个脚本里都手抄一遍"税法 courseId=42660、syllabus=75181、14 章、路径是 xxx"，换会计课
就要逐个脚本改、容易漏。现在把这些集中到一张"档案卡"，**换课只换卡，代码一行不改**：

```bash
# 处理税法（默认）
node scripts/cdp/refresh_inventory.js
# 换会计：指定档案卡即可
GAODUN_COURSE_PROFILE=cpa-accounting-2026 node scripts/cdp/refresh_inventory.js
```

## 文件

| 文件 | 说明 |
|---|---|
| `cpa-tax-2026.json` | 税法（样板，字段最全，14 官方组 92 知识点已填） |
| `cpa-accounting-2026.json` | 会计（草稿：课程级 ID 已填，官方章组待 syllabus 拉取后补） |

## 关键字段怎么看

- `primaryCourse`：**主采集源**。26 考季正课在 `glivepro` 平台，和现有工具链同构，默认走它。
- `companionCourses`：配套课（如"名师专业课"）。它们在另一个学习平台 `epiphany`（智能学习平台，
  前端和接口与 glivepro 不通用），`collect:false` 表示**当前阶段**不采集，需要时先单独适配其接口。
- `learnStatus`：学习状态，`0=待学习 / 2=已学习 / 3=已完结`。**"待学习"不是永久不录，而是优先级最低、排到最后**：
  采集顺序＝先 glivepro 正课 → 再已学习的 epiphany 名师课（须先适配接口）→ 最后才轮到待学习名师课（战略/审计/财管，学完或到收尾阶段再录）。
- `structure.groups`：官方章组清单；`paths`：本地/网盘根路径。
- `overview`：**可选**的总览页教学内容（课程信息、全局资料、概述、章节重要性层级、学习方法）。
  属于"一门课一份的成品文案"而非课程参数；税法已填，会计等新课在内容生产前留空即可——
  `build_course_overview.py` 对空段自动省略，不会串入别课内容。
- ID 口径：`saasCourseId`＝做题/内容接口用的 courseId；`vcourseId`＝购课听课实例，二者不可混用。

## 谁在读这张卡

- Node 脚本：`scripts/cdp/load_profile.js`（`loadProfile()`，可 `node .../load_profile.js <key>` 自检）
- Python 脚本：`scripts/knowledge/course_profile.py`（`load_profile()`，同样支持命令行自检）
- Shell 脚本：`scripts/course_config.sh`（认 `COURSE_PROFILE` / `GAODUN_COURSE_PROFILE`）
- 已接入的生产脚本：`refresh_inventory.js`、`fetch_lecture_video.js`、`collect_user_notes.js`、
  `organize_user_notes.py`、`build_course_overview.py`（均支持 `--profile <key>` 或环境变量，缺省税法）

课程清单（账号下到底有哪些课、各自 ID）由 `scripts/cdp/fetch_user_space_courses.js` 实时拉取，
台账在 `data/_workspace/_account/user-space/account_courses.json`（账号级动态件，当次原始响应留痕
`user_space_vcourse_<ts>.json`，滚动留最新、**不上网盘**）；本目录的档案卡是在台账基础上补全章组/路径后的**生产配置**，
入 Git 跟踪。设计背景见 `docs/development/guides/parallel-toolkit-design.md`。

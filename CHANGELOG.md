# 变更日志

> **文档类型**：Active（过程记录）
> **更新频率**：每次重要变更后
> **维护者**：AI自动维护
> **读者**：AI代理+人类

> 本文档记录项目的所有重要变更，遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式。
> 版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [未发布]

> 自最近一次版本结算以来、尚未定版本的变更先累积于此；结算时把本块整体改名为 `[版本号] - 日期`，并在上方另开一个空的 [未发布]。

### 新增
- 浏览器自动化连接通道选型与落地（「自动做作业」接口化改造前置，决策见 ADR-010）：实测确定用 puppeteer-core 经 Chrome 144+ 运行时远程调试通道连接用户日常 Chrome（默认 Profile、复用登录态、免重启免重登），macOS AX 的 AXPress 自动点授权并内置 403 退避重试；Playwright 连接层在该通道不稳定故弃用、扩展模式保留为 UI 兜底，chrome-devtools-mcp 不进运行时
- 新增 `scripts/cdp/`：connectBrowser.js（读 DevToolsActivePort 带 UUID 端点、Chrome 没开自动拉起[按 Local State 选上次/首个 Profile]、串行自动授权、重试、找页、安全断开、可自检）、press_allow.applescript（只查授权 sheet、跳过网页 AXWebArea 的元素级代点，多屏可靠）、sniff_demo.js（抓请求/响应落 data/cdp-sniff JSONL）；新增仓库根 package.json/package-lock.json 声明 puppeteer-core（node_modules 不入库，新环境 npm install 自补足）
- 新增文档：ADR-010、docs/development/tools/browser-cdp-connect-guide.md（CDP 连接手册）、docs/development/guides/macos-accessibility-automation.md（macOS 多屏辅助功能自动化通用方法）、docs/development/guides/debugging-and-collaboration.md（问题排查与人机协作方法论）、task-reports《任务报告_浏览器连接通道选型实测_2026-09-01》
- 新增 `docs/development/guides/feishu-knowledge-base-maintenance.md`（飞书知识库整理与维护 SOP：盘点与通用分类原则、结构整理流程、父节点导航规范、覆盖校验与安全红线）；`docs/development/api/feishu-api.md` 增补 wiki +move 移动、删除级联风险、stdin 转后台静默未写入、占位符坏链、node/obj token 通用等实测踩坑
- 「自动做作业」做题链路接口化侦查与纯接口闭环验证（决策点②路线确定为「接口为主、UI 仅负责登录与兜底」）：实测 `redo-paper` 进卷即返回题面/选项/标准答案/解析（无需"先随便做一遍"）、`submit-paper` 明文 JSON 无 sign/nonce/加密、鉴权仅 `authentication` JWT（HS256、有效期 7 天）、同卷题集与选项顺序固定不乱序、存在"最小作答墙钟时长"风控（约 1s 交卷被拒 10462203、与 body.costTime 无关）、`syllabus` 单接口枚举全课程 119 张卷且 `csItemId=章节 itemId`（非 paper 资源节点 id）；纯接口闭环 6 题卷 6/6、此前未做过的 9 题卷 9/9，对照 UI 逐题点选仅 1/6（题序/时序错位，反证 UI 不稳根因在交互而非知识）；3 张 48 题冲刺模考按流程留待基础作业完成后单独验证
- 新增 `docs/development/api/gaodun-exam-api.md`（高顿作业接口档案 Reference：接口契约、ID 映射、JWT 与风控、已验证边界与待验证清单）与 task-reports《任务报告_做题接口侦查与纯接口闭环验证_2026-09-02》；`scripts/cdp/` 新增 7 个脚本：probe_exam_entry.js、probe_quiz_dom.js（只读侦查）、capture_quiz_load.js、capture_schedule_list.js（抓取题/大纲）、answer_submit_capture.js（UI 对照实验）、api_submit_test.js（闭环验证）、api_do_paper.js（通用纯接口做卷蓝本，syllabus 解析 id→record→redo→等待→submit→exam-report 回查）

- 知识来源口径对齐（2026-09-02）：重写 `knowledge-base-sources.md`，认定 4 类内容来源（初始知识库 / 题与标准答案 / 官方解析 / 用户笔记）＋冲刺模考题答（全部前置完成后的末期特例）；明确**剔除"自动化作业产生的 AI 错题"**（旧 Playwright UI BUG 的产物、非用户本人知识），「考点图谱」经侦查只给章→考点目录归属、无知识点关联、已否决；WORKFLOW 第7节、knowledge-base-organization、gaodun-exam-api 同步该口径（做题首要目的=100% 完成作业）
- 「考点图谱」侦查后否决（2026-09-02）：经 CDP 抓包与逐层点击验证，其数据（with-sid→ep-syllabus course/point）只是 15 章→96 考点的**目录归属树**（多父考点=0、无关联字段、点节点不发额外请求），**不含知识点之间的关联**，不符用户所需，决定**不作知识来源、不做圆点遍历**；相关临时侦查脚本已移除，结论留存当日任务报告以免重复调研

### 变更
- 作业完成度只读盘点 + 接口化批量补做（2026-09-02）：syllabus+record 全量盘点 119 卷（progress=2=做过未提交、record 只反映最近一次），新增 `scripts/cdp/batch_redo_papers.js` 批量纯接口补做，原 23 张待补卷 22 张补到满分、累计满分 25 张；验证课后(多选)/分章真题(单选)卷型同样进卷即回答案、记录 redo 会切换最近实例的副作用；发现 type=5/6 主观计算大题（AI 批改、标准答案在解析文本、纯选项提交只对客观题）新边界并立专项，82749 客观题满分、主观待专项
- 登记本轮接口化产物：scripts/README 脚本总览由 23 扩为 31 并新增「十、高顿做题接口链路（7个）」、DOCUMENTATION_MAP 快速入口「做题验证前」置顶接口档案并在参考资料表登记、docs/development/README 目录树与技术栈表补「自动做题·主链路/兜底」
- 飞书「AI」知识空间结构治理（外部知识库，流程沉淀见新增的维护 SOP）：按主题重构为 Chrome（其下再分 Chrome 自动化 / Chrome 使用与配置，形成三层）、macOS 自动化、豆包、工程方法论与协作四个一级分组；浏览器自动化与 macOS 自动化拆开、Gemini 指南归入「Chrome 使用与配置」、迁出内容后清空并删除名不副实的旧分组；全部 7 个父节点补齐「子文档链接 + 一句话摘要」导航并通过覆盖校验（19/19 直接子节点可点达、无坏链）

### 修复
- 修复「自动点 Chrome 调试授权时好时坏、偶发永久卡住」：定位到三层叠加根因并逐一修复——①授权脚本递归整张窗口、遍历网页 AXWebArea 上万节点致单次 9.3s 被超时杀（改为只查窗口模态 sheet、跳过 AXWebArea、限深，降到 0.31s）；②Node 侧 setInterval 并发派生 osascript，在 System Events 拥塞堆积卡死（改为串行点击循环：同一时刻一个 osascript、单次硬超时、结束清理在途子进程）；③点中后 sheet 立即关闭、递归继续访问失效元素报错（点中即停+全程容错）。修复后连续 8 次连接全部成功（2.1–3.2s）、osascript 残留恒为 0；通用规律同步沉淀进 AX 指南 §5

---

## [0.2.0] - 2026-09-01

### 新增
- 创建项目需求文档 `docs/REQUIREMENTS.md`，梳理核心诉求、功能需求、非功能需求、特殊规则和验收标准
- 创建标准开源文档：CHANGELOG.md、CONTRIBUTING.md、LICENSE、.github/模板
- 文档治理优化：合并重叠文档、统一文档结构、明确文档边界
- 新增《命名规范审计与整改方案_2026-08-31》：全仓126文件/31目录命名实测，确立 L0-L6 分层命名规则（目录全小写kebab；规范/模板/台账用UPPER_SNAKE；操作指南用小写kebab；脚本统一snake_case；课程内容与过程报告用中文；固定名走白名单），列出 P0-P3 问题（真·大小写混排仅1处）与3批整改清单及D1-D5决策点；本轮只出方案不改名
- 命名整改四步法·第1步：新增《命名整改第1步-问题调研报告_2026-08-31》——明确8项检查依据并指出依据自身缺陷E1-E4；问题分类（A硬缺陷1/B同目录混用3/C脚本分隔符3/D过程文档6/E依据缺陷/F目录观察）；覆盖28目录组127文件的逐文件检查清单（合规114/待整改12/硬缺陷1，无问题也列出）与P编号追踪表；本步只诊断不改名，作为第2步优化依据文档的输入
- 命名整改四步法·第2步（优化依据文档）：NAMING_CONVENTION 新增第九章「Git仓库工程目录与文件命名规范」（命名决策树+L0固定名/L1治理大写/L2方法小写kebab/L3脚本snake/L4L5中文内容产物/L6 ADR+目录规则+检查清单，附 Google 开发者风格指南与 PEP8 依据）；CODE_STYLE 脚本统一 snake_case 并补齐7类类型词；DOCUMENTATION_GUIDE 增「文档类型→命名风格映射」；DIRECTORY_STRUCTURE 增命名速查与两套词表衔接；新增《命名整改第2步-依据文档优化记录_2026-08-31》。本步只改规范不改文件名，第3步按12项清单 git mv
- 命名整改第2步·内容规范化二次迭代：NAMING 第九章补 L0-L6 分层总览表与"docs 根 5 个顶层骨架固定大写"规则；修正 5 处文档类型↔文件名风格不自洽（CODE_STYLE/AGENTS_MD_BEST_PRACTICES/multi-role-collaboration/任务交接文档 改标 Task、knowledge-base-organization 改标 Concept）；DOCUMENTATION_GUIDE 消除 WORKFLOW 矛盾示例并补单文件类型判定。脚本扫描 42 个工程文档不自洽为 0
- 命名整改四步法·第3步（执行改名）：12 个文件 git mv（模板全大写 1、方法文档小写 3 含任务交接→task-handover、脚本 snake 3、中文过程产物 5），26 个文件 102 处引用级联更新（含 .gitignore 中文 glob、各规范命名模式中文化、目录树/链接/脚本自指注释）；活文档旧名 0 残留、148 相对链接 0 真实断链、类型↔命名自洽 0 问题；新增《命名整改第3步-整改方案与执行结果_2026-08-31》；ADR 与历史报告按规则保留旧名
- 2026-09-01 全仓治理制度化：①新增 `scripts/check_naming_consistency.py` 命名一致性巡检（默认巡检 / `--impact` 改名影响面 / `--regression` 回归三模式，查类型↔命名、中文分隔符、相对断链），pre-commit 增第6节命名提示（警告级不阻断）；②新增 REFACTOR_PLAN_TEMPLATE（批量整改全量清单+回归核对）、TEST_PLAN_TEMPLATE（流程测试计划）两个模板；③AGENTS 增 3.2 变更分级门禁（L0 顺手修 / L1 高扩散先出全量清单确认 / L2 架构先讨论，拿不准就高）与 3.4 新建持久文档前防重复门禁；④PROJECT_STRUCTURE_MAINTENANCE 增第六章批量重命名 SOP 与 1.2「文件去留与沉淀判据」；⑤git-workflow 增 8.3「提交时机分场景」（治理等验收、生产按里程碑及时 commit，commit 与 push 分开）；⑥状态查询 Q7 流程接入命名巡检脚本、报告改按需生成不常驻；AGENTS 3.9 与第十二章明确 pre-commit 仅覆盖机械项、不能替代语义级人工体检

### 变更
- 命名整改·回炉修正两处误判：①删除冗余 `active/task-handover.md`（职责均由 TASK_STATUS/AGENTS 3.10/README 等承担且静态快照已过时），交接不再设任何文件或摘要机制——角色职责在 AGENTS、项目情况由使用者话术让 AI 按需读实时台账；AGENTS 3.10 删交接摘要模板与强制生成条目、DOCUMENTATION_MAP 删交接登记行、TASK_STATUS 删两条交接完成项。②`development/guides/code-style.md` 复核通篇为"必须/禁止"强制规范＝Governance，git mv 回 `standards/CODE_STYLE.md` 并改回大写、头部 Task→Governance，级联 9 份文档路径与分类。NAMING 第九章补"头部类型与正文实质冲突时以实质为准并回头修正头部"判据及五类命名形态速查表；现存 119 文件类型↔命名 0 不自洽、0 真实断链；新增《命名整改-全量文件清单_2026-08-31》（老名/新名/依据三列、0 待决）
- 项目重命名：`cpa-course-archive` → `gaodun-course-knowledge-base`，本地目录 `gaodun_downloads` → `gaodun-course-knowledge-base`，标题"高顿 CPA 课程智能归档项目" → "高顿课程知识库系统"（百度网盘应用名称保持不变）
- 文档结构优化：将 project-management/ 根目录的规范文档移到 standards/ 子目录
- 合并做题交互相关文档（交互优化指南、exam-workflow、interaction-workflow 中的做题部分）
- 合并做题方法论文档（做题流程与方法论、做题思路解析）
- 状态查询协议新增 Q7「项目维护检查（执行型）」：补标准话术、模糊表达映射与7步执行流程，明确区分 Q3（只问有哪些维护）与 Q7（实际动手检查/修复/出报告）；README 精简话术表、PROJECT_STRUCTURE_MAINTENANCE 触发机制同步
- 02讲目录级联改名：本地+百度网盘 `02_消费税法（1）`→`02_税法全面精讲02-消费税法（1）`（网盘走 filemanager rename、不重传文件，内容完整）；飞书经核实为"文件系统全名 / 飞书简短标题"双轨制，02与01同级一致、保持"02消费税法（1）"；NAMING_CONVENTION 历史遗留小节重写为双轨制命名现状，BATCH 命名问题销项，结构脚本4目录0问题
- 文档类型词表统一为7类权威封闭词表（Task/Concept/Reference/Governance/Active/Knowledge/Template，新增 Template、取消自造的 Guide）：DOCUMENTATION_GUIDE 3.1 定词表并由 pre-commit 白名单强校验；6个 `*_TEMPLATE.md` 统一为 Template、multi-role-collaboration 由 Guide 归为 Governance
- 2026-09-01 全仓四批价值审计与健康度治理：按"对后续工作的价值"逐文件审 A 规范 9 份 / B 顶层骨架 5 份 / C 动态台账 4 份 / D 方法工具与模板 23 份；NAMING_CONVENTION 确立为命名 SSOT（7 类封闭类型 + 实质优先判据，标题用词不决定类型）；SYSTEM_REQUIREMENTS 工具链版本按真机核对更新（macOS 15.7.8 / ffmpeg 8.1.2 / Node 22 / Python 3.14 / git 2.45 等）；PROJECT_MAINTENANCE 去章节锁定瘦身、BATCH_TASK_EXECUTION 真实讲次占位化并统一步骤口径；多份规范做一致性级联修订

### 移除
- 2026-09-01 归档一次性过程文件（git rm、历史可溯，目录按需不常驻）：删除被 REQUIREMENTS / WORKFLOW / BATCH_TASK_EXECUTION / active 台账全面承接的 PROJECT_PLAN（项目计划职责由 6 份活文档分解、不再单设规范）；移除 verification-reports 5 份命名整改过程报告、task-reports 2 份一次性任务报告、test-plans 1 份一次性测试计划（测试计划先抽成 TEST_PLAN_TEMPLATE 再归档原件）
- 2026-09-01 移除面向外部贡献者的开源套壳文件（单人项目无外部贡献场景、内容与权威源重复且已过时）：CONTRIBUTING.md（停留旧 5 类词表、main/feature 分支、Node18 等多处与现行规则冲突）与 .github/ 下 PR/Issue 模板共 4 份，级联清理 DOCUMENTATION_MAP、DIRECTORY_STRUCTURE 活引用；LICENSE（MIT）保留（明确授权状态+免责、零维护），NAMING 固定名白名单作为命名规则保留

### 修复
- 2026-08-30 项目及文档整理：修复8个文档共14处相对路径断链（文档移入 development 子目录后未同步的层级引用），涉及 task-reports/README、REQUIREMENTS、WORKFLOW、document-download、playwright-cli-guide、knowledge-base-organization、netdisk-setup
- git-workflow 中3处当前可执行命令的旧仓库名 `cpa-course-archive` 更新为 `gaodun-course-knowledge-base`（历史叙述与ADR中的旧名保留）
- DOCUMENTATION_MAP 补登4个遗漏文档：DIRECTORY_STRUCTURE、SYSTEM_REQUIREMENTS、EXAM_RECORD_TEMPLATE、任务交接文档，并补充章节本地验证/同步报告说明
- 统一进度口径为 3/39、剩余36讲；修正 TASK_STATUS 5.9 文档类型标注统计（95个仓库文档中76个标注、19个按规范豁免）与交接文档"93个文档/剩余35讲"等过时数字
- 2026-08-31 Q7维护检查：补全 DIRECTORY_STRUCTURE 详细目录树漏列的4个文件（guides 3、templates 1）；统一2处旧角色名残留（交接文档"开发人员"→开发工程师、multi-role 协作角色"知识整理师"→产品经理）；新增0831健康度检查报告
- pre-commit 新增第5节自动校验：暂存 .md 的相对链接有效性检查（断链硬阻止，跳过围栏/行内代码/外链/锚点）与文档类型词白名单校验；git-workflow 9.2 检查项表同步；已用"故意制造断链+非法类型词"负向用例与空暂存正向用例双向自检
- 2026-09-01 台账失同步修复：COURSE_INDEX 00 开班典礼状态由全 pending 更正为完成态（对齐 BATCH 九环节已完成）、基础必修 02 由 compressing 更正为 uploaded/done（对齐 12 讲已上传）；ISSUES 未解决区清出 3 条已解决条目（I-002 去重、I-004/I-005 迁入已解决区并保持最近 10 条），未解决仅留 I-001/I-003；.gitignore 为 TEST_PLAN_TEMPLATE 加单点例外（`test_*` 在 macOS 大小写不敏感误伤大写模板）

---

## [0.1.0] - 2026-08-28

### 新增
- 项目初始化：创建 GitHub 公有仓库 `cpa-course-archive`
- 核心功能：视频下载（HLS AES-128解密）、视频压缩（H.265 CRF30）、音频转写（FunASR）、OCR（macOS Vision）
- 知识库系统：飞书知识库集成，知识拆解与考试指导分离，两阶段生成
- 做题验证：自动化做题脚本，错题反馈与知识库补充
- 百度网盘集成：API上传，目录镜像
- 项目管理：任务状态跟踪、问题跟踪、测试计划、决策记录（ADR）
- 文档体系：工作流、开发文档、项目管理规范、知识库模板

### 技术栈
- 浏览器自动化：Playwright CLI（Extension模式）
- 视频处理：ffmpeg（H.265）
- 音频转写：FunASR SenseVoiceSmall
- OCR：macOS Vision框架
- 网盘：百度网盘开放平台API
- 知识库：飞书知识库（Lark Wiki）
- 版本控制：Git + GitHub（pre-commit hook）

---

## 版本说明

| 版本类型 | 说明 |
|----------|------|
| 主版本号 | 不兼容的 API 变更 |
| 次版本号 | 向下兼容的功能性新增 |
| 修订号 | 向下兼容的问题修正 |

### 变更类型

- **Added** — 新功能
- **Changed** — 对现有功能的变更
- **Deprecated** — 即将废弃的功能
- **Removed** — 已废弃的功能
- **Fixed** — 缺陷修复
- **Security** — 安全相关修复

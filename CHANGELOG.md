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
- 项目检查与架构师收拢（2026-09-04）：新增 **ADR-011**（讲次→课件跨讲映射机制：官方课件按税种模块覆盖连续多讲、放模块起始讲，非缺讲义）、`data/lecture-resource-map.json`（39讲逐讲原料映射：课件来源讲次+PDF/OCR/转写路径，脚本验证全覆盖；业务数据不入库）、`project-management/active/STAGE2_EXECUTION_PLAN.md`（阶段二作战计划：网盘补传→34章重建→分讲飞书同步→速查手册→冲刺模考，含DAG/并发/验收/回滚/D1-D5待决项）、task-reports《任务报告_项目检查与维护_2026-09-03》
- 运行产物长效治理「三道防线」（2026-09-04，一次到位，治"事后不清理、.gitignore 不同步"）：①系统重组 `.gitignore`（分类去重、venv 由写死的 `transcription/venv/` 通用化为任意位置 `venv/.venv/env/`、与模式表对齐并加同步说明头）；②`scripts/pre-commit` 新增第 4 项「运行产物误入硬拦截」——`ARTIFACT_RE` 模式表识别 venv/env/node_modules/data/logs/.tmp/完成哨兵/题缓存/字节码，叠加 `git check-ignore` 拦截 `git add -f`，即使漏配 ignore 也兜底、硬阻止提交，已重装到 `.git/hooks`；③新增只读全量体检 `scripts/check_git_hygiene.sh`（被跟踪运行产物 / 未跟踪项分类 / 大文件 / 仓库体积；pre-commit 拦增量、它查存量，互补）。另给 `transcribe_all.sh`、`batch_transcribe.sh` 加 `trap cleanup EXIT` 退出自清当前讲临时目录（`encode_all.sh`/`download_all.sh` 的外部课程库 `.vfetch/merged` 是断点续跑凭证，按规范刻意不加删除型 trap）；落点约定写入 PROJECT_STRUCTURE_MAINTENANCE 2.1「产物落点与忽略模式表」与 CODE_STYLE 脚本规范，git-workflow 第 9 节、scripts/README 同步。实测：拦截退出码 1 / 正常 0、trap 在正常与异常退出都清当前 tmp 且保留根目录续跑、两处 ARTIFACT_RE 逐字一致、改动文档断链 0
- .gitignore 按项目实际产物做减法精简（2026-09-04，用户评审驱动，区分"整理"与"梳理"）：以「git 全历史提交类型 + 脚本实际产出 + 外部课程库成品侧文件 + 全仓引用」四证交叉，删除本项目永不产生的规则——通用模板冗余（`*.zip/*.tar.gz/*.rar/*.7z`、Office 族 `doc/docx/ppt/pptx/xls/xlsx`、`*.mp3/*.aac`）、历史方案遗留（`.venv-transcribe`、`.gguf_test`、`transcripts_test`、`pdf_test_pages`、路径错配的 `upload_log_*`、`对比_*`、题缓存 `.*_questions.json`——现役题源统一落 `data/knowledge-source/papers`、纯接口代码对题缓存零引用）、固定技术栈用不到的（`.idea`、`*.swp/*.swo`、`*.mov/*.mkv`），`.env` 三条合并为一条；确立原则「只忽略确定反复产生且确定不入库的；低频类型不预先忽略，真出现时作为 untracked 冒头、由 pre-commit 第 3 项警告兜底」。同步精简两处 ARTIFACT_RE（去题缓存与 transcripts_test，保持逐字一致），pre-commit 第 3 项媒体/办公文档警告清单**刻意保留**作为放开后的兜底（分工：gitignore 管高频确定产物、第3项警告管低频偶发）。实测：20 项高频产物仍忽略、20 项删除项正确放开、运行产物硬拦 exit 1、docx 走警告不阻断 exit 0、已跟踪文件 0 误伤
- 修复课程库过程文件治理与网盘上传过滤缺口（2026-09-04，排查"各讲文件为何不一致"时发现）：①`upload_course.sh` 的 `SKIP_PATTERNS` 补全——原"验证报告_*.md"匹配不上实际文件名 `VERIFICATION.md`、且漏 `SYNC_REPORT_*`；补齐 `VERIFICATION.md/VERIFICATION_*.md/验证报告_*.md/验证_*.md/SYNC_REPORT_*.md/同步报告_*.md`，并写清三层职责：过滤在 upload_course.sh 生效、sync_course_netdisk.sh 逐讲调用它、baidu_upload.py 只是底层单文件 API 不过滤；点开头项（`.vfetch/`、`.uploaded`）因 bash glob `*` 不匹配隐藏项天然不上传。②全量核查网盘 39 讲，仅讲02 在早期过滤未覆盖时误传 `VERIFICATION.md`+`transcript.json`，已删（进网盘回收站可恢复），其余 38 讲与各子目录均干净。③本地课程库清理：讲01/02 的 VERIFICATION×2、讲02 SYNC_REPORT、讲02 .uploaded 移入废纸篓，讲03 两个空壳 docs/docs_text 删除（03 课件按 ADR-011 跨讲映射放在讲02）。④同步 PROJECT_STRUCTURE_MAINTENANCE 3.1 分类表与脚本过滤段。⑤明确课程目录三层结构：统一底座（video.mp4/transcript.md/transcript.json，39 讲全有）、按 ADR-011 跨讲映射分布的 docs/docs_text（18 讲有课件、其余引用别讲）、S2 才逐讲生成的知识拆解/考试指导（进度产物）
- 阶段二存量治理收尾与数据分层范式固化（2026-09-04）：①`PROJECT_STRUCTURE_MAINTENANCE` 新增 2.2「数据分层模型 L0–L4 与产物生命周期」——确立"两根三线"版图（项目 `data/` 工作区承载 B 做题线原料、桌面课程库按讲承载 A 视频线/C 讲义线成品并传网盘，S2 汇聚初始知识库+用户笔记生成知识成品进飞书）；L0 可重建环境 / L1 原始底片 / L2 成品 / L3 过程状态凭证 / L4 一次性取证五层各自的位置·入库·网盘·终态，轻量派生元数据入库"三问"判据，papers「物理集中存、逻辑按讲视图」（按 paperId 集中 `data/knowledge-source`、由 paper_index.chapter group by 派生只读视图、不按讲复制），并定清理时机与负面清单。②`lecture-resource-map.json` 由 `data/` 迁入 `knowledge-base/` 入库版本化（ADR-011 第4条、ADR-005 决策6同步修订），`verify_lecture_map.py` 支持校验 / `--rebuild`，实测 legacy 清零、幂等、空占位课程硬保护。③新增 `scripts/papers_view.py`（papers 按讲只读索引视图，34 讲 116 套 1296 题实测）与 `scripts/check_course_lib.py`（逐讲标准构成 + 污染/旧件体检，真实 39 讲全绿、问题夹具 6 类问题全捕获、退出码正确）。④papers 116 套题源 + paper_index 备份到网盘独立「知识原料区」（与课程库平级、不混入按讲成品区）。⑤讲00/01 去重：先 md5 / 内容 diff 取证（3 个 PDF 旧件与标准件逐字节相同；3 个 OCR 旧件去标题行后正文一致，其中讲00课件标准件另修正 36 处"高顿教育"水印 OCR 错字、标准件等同或更优），6 个旧件移废纸篓；网盘「先补传 12 个标准件、齐全后再删 6 旧件」，独立回读复核讲00各5、讲01各1，本地=网盘。⑥`data/` 由 53M 清至 3.3M：删 PoC 遗留独立 browser-profile（现役 Chrome 拉起走 `scripts/cdp/connectBrowser.js`，与其无关）、cdp-sniff 只留 papers_inventory/papers_audit/course_catalog（后者保留未做的 3 张 48 题冲刺模考入口 ID 线索，S5 前以重新抓取为准）。⑦`lecture-knowledge-build-sop` 补"生成前先跑 verify_lecture_map、重复件 md5/diff 取证、步骤7产物按 L0–L4 对号入座（只引用 standards 不复制规则）"

### 变更
- 作业完成度只读盘点 + 接口化批量补做（2026-09-02）：syllabus+record 全量盘点 119 卷（progress=2=做过未提交、record 只反映最近一次），新增 `scripts/cdp/batch_redo_papers.js` 批量纯接口补做，原 23 张待补卷 22 张补到满分、累计满分 25 张；验证课后(多选)/分章真题(单选)卷型同样进卷即回答案、记录 redo 会切换最近实例的副作用；发现 type=5/6 主观计算大题（AI 批改、标准答案在解析文本、纯选项提交只对客观题）新边界并立专项，82749 客观题满分、主观待专项
- 登记本轮接口化产物：scripts/README 脚本总览由 23 扩为 31 并新增「十、高顿做题接口链路（7个）」、DOCUMENTATION_MAP 快速入口「做题验证前」置顶接口档案并在参考资料表登记、docs/development/README 目录树与技术栈表补「自动做题·主链路/兜底」
- 飞书「AI」知识空间结构治理（外部知识库，流程沉淀见新增的维护 SOP）：按主题重构为 Chrome（其下再分 Chrome 自动化 / Chrome 使用与配置，形成三层）、macOS 自动化、豆包、工程方法论与协作四个一级分组；浏览器自动化与 macOS 自动化拆开、Gemini 指南归入「Chrome 使用与配置」、迁出内容后清空并删除名不副实的旧分组；全部 7 个父节点补齐「子文档链接 + 一句话摘要」导航并通过覆盖校验（19/19 直接子节点可点达、无坏链）
- 全量校准三份过时台账（2026-09-04，原停留在 2026-08-29 03讲断点）：COURSE_INDEX 39讲状态按真实文件系统/API重写（视频与转写 39/39、讲义17讲自有+22讲跨讲引用全覆盖、116套作业全满分/平台最优、网盘仅3/39）；BATCH_TASK_STATUS 重写为「阶段一收尾 / 阶段二待启动」；TASK_STATUS 任务树与当前断点同步更新；DIRECTORY_STRUCTURE 补登 data/ 真实子结构（browser-profile/cdp-sniff/knowledge-source/lecture-resource-map）与 _34chapters，并修正"data 为软链"为"实体目录、内含高顿软链"
- 做题文档对齐纯接口现状（2026-09-04）：整篇重写 `docs/development/guides/exam-workflow.md`，由旧 Playwright UI 点选手册重定位为「做题/交卷任务执行指南（接口为主、UI 兜底）」——主链路改为 connectBrowser→refresh_inventory→batch_redo_papers/api_do_paper→两层回查（fullScore/platformDone）、异常三出口、UI 兜底最小集、collect_paper_sources 知识反哺；删除 L1/L2/L3 猜答分级、JS 点选 hack、错题加练、✓/AI选错记录、错题补知识库等旧 UI 内容；接口契约不重复（统一引用 gaodun-exam-api）。同步联动 gaodun-exam-api、WORKFLOW 步骤5、REQUIREMENTS、playwright-cli-guide、development/README、DOCUMENTATION_MAP、DOCUMENTATION_GUIDE 共 8 处对该文档的名称/定位描述

### 修复
- 修复「自动点 Chrome 调试授权时好时坏、偶发永久卡住」：定位到三层叠加根因并逐一修复——①授权脚本递归整张窗口、遍历网页 AXWebArea 上万节点致单次 9.3s 被超时杀（改为只查窗口模态 sheet、跳过 AXWebArea、限深，降到 0.31s）；②Node 侧 setInterval 并发派生 osascript，在 System Events 拥塞堆积卡死（改为串行点击循环：同一时刻一个 osascript、单次硬超时、结束清理在途子进程）；③点中后 sheet 立即关闭、递归继续访问失效元素报错（点中即停+全程容错）。修复后连续 8 次连接全部成功（2.1–3.2s）、osascript 残留恒为 0；通用规律同步沉淀进 AX 指南 §5
- 文档健康度修复（2026-09-04）：修复 4 处断链——task-planning-and-parallel-scheduling 中 parallel-processing-guide、watch_stage_done.sh 两处相对路径层级错误，knowledge-base-organization 两处模板示例链接改为占位符；对全部 md 重跑链接存在性校验，真断链为 0（剩余 (链接)/(URL) 均为模板占位符）；统一 WORKFLOW 步骤8「冲刺模考」表述为步骤5"特殊模式"，清除残留的"分支流程"措辞
- 旧15章产物补修 4 处断链（2026-09-04）：organized-content 下《知识拆解总目录》《考试指导速查手册》引用 docs 的相对路径少一级（`../docs`→`../../docs`），修复后全仓 226 个 md 断链为 0

### 移除
- 阶段二启动前清理（2026-09-04，用户已逐项确认）：删 `transcription/.gguf_test/`（933M，GGUF量化转写死路调研残留，结论见 ADR-003）与其孤立配套脚本 `scripts/transcribe_all_gguf.sh`（未被任何脚本/文档引用、FunASR 主链路不依赖）；删 `data/exam-net-poc.{har,json,jsonl}`（11.7M，接口侦查 POC 原始抓包，结论已沉淀进 gaodun-exam-api、题答已入 papers；输出脚本 poc_persistent_browser.js 保留、需要时重跑再生成）；删本地《知识拆解总目录.md》并清速查手册指向它的链接、删除飞书同名 Wiki 节点（用户已决定不建该总目录，税法根节点 18→17）。保留 `transcription/venv/`（6个活跃转写/OCR脚本依赖）与 `data/browser-profile/`（CDP登录态）
- 废弃并删除 `docs/development/templates/EXAM_RECORD_TEMPLATE.md`（2026-09-04，用户已确认）：UI 时代手抄做题记录模板（✓/AI选错标记、"做题不强求全对"），其用途已被接口链路 `data/knowledge-source/papers/<paperId>.json`+`paper_index.json`（collect_paper_sources 只读采集，116 份在位）与 `batch_result_*.json`/exam-report 客观凭据完全覆盖；清理 templates/README、WORKFLOW、DOCUMENTATION_MAP、DIRECTORY_STRUCTURE、knowledge-base-sources 共 6 处直接引用（sources 改为说明替代凭据）。旧 UI 脚本 answer_option/answer_multi/submit_exam 按用户决定保留作兜底。**遗留待决（L1）**：`knowledge-base/source-materials/` 下 10 份历史「做题记录_*.md」实体、以及 NAMING_CONVENTION/DOC_SYNC_CHECKLIST/DIRECTORY_STRUCTURE 等 8 处对"产出做题记录md"的指引是否一并清除，待用户确认
- 做题记录产物形态整体下线（2026-09-04，用户二次确认后执行）：删除 source-materials 下 10 份旧 UI 时代手抄「做题记录_*.md」（讲01八份、讲02两份；题答已由 116 份 papers JSON 完整覆盖，保留同目录 1 份用户笔记精华、2 份解析与用户留言）；同步改写 13+ 处仍要求产出该文件的活文档指引——REQUIREMENTS 来源口径、multi-role-collaboration、NAMING_CONVENTION（L4/素材命名）、DOCUMENTATION_GUIDE、DOC_SYNC_CHECKLIST（时机/3.1 节/阶段检查）、DOCUMENTATION_MAP、DIRECTORY_STRUCTURE、根 README、knowledge-base/README、organized-content/README、source-materials/README、TASK_STATUS 台账，统一为"题/答/解析由 collect_paper_sources 接口采集到 data/knowledge-source/papers JSON，不产手抄 md"。讲01旧同步/验证报告（2026-08-28 历史快照）按"不改写历史"保留
- 清理讲01旧15章历史过程报告（2026-09-04，用户确认"同时清理历史报告"）：删除 organized-content/01税法总论/ 下《验证报告_税法总论_分章真题测》《同步报告_税法总论_2026-08-28》两份旧 UI/旧飞书节点时代一次性过程报告（前者通篇为已废弃的点击间隔/L1-L3 分级且指向已删做题记录，后者对应旧飞书 token、通用踩坑已沉淀进 feishu-api）；同步把 task-reports/README、project-management/README、NAMING_CONVENTION（3 处）、QUALITY_ASSURANCE 中以这两份为"现存正例"的命名示例替换为占位或现存任务报告示例（验证/同步报告作为文件类型的命名规范保留，面向未来按需生成）。01 目录保留旧成品知识拆解/考试指导/README，待 _34chapters 新版核对后按 D4 决策逐章替代
- 精简报告类规范、确立「验证是动作、不是必交文档」（2026-09-04，用户确认）：删除模板 VERIFICATION_TEMPLATE_KNOWLEDGE_BASE.md（飞书导入质量专用，其对比动作并入同步回读）；全仓约 20 份规范/索引/README 统一改为——做题回查由 exam-report/batch_result JSON 客观判定、飞书同步由 lark-cli 返回+回读校验，验证动作必做但默认不再单独产出「验证报告_*.md / 同步报告_*.md」，结论并入任务输出或《任务报告》（REPORT_TEMPLATE，落 task-reports）；不再设 verification-reports 目录、章节目录不常驻验证/同步报告。保留：通用 VERIFICATION_TEMPLATE.md（视频/转写/OCR 非标准对象专项质检按需、仅本地）、TEST_PLAN_TEMPLATE 与 test-plans（事前测试计划，非事后报告）、task-reports 现存任务报告、ADR-007 等历史记录不改写
- 澄清做题「回查」语义（2026-09-04，用户确认）：exam-workflow 第五章与 QUALITY_ASSURANCE 明确——回查查的是"提交是否被平台正确结算"（技术闭环：漏交/主观题留空/AI 批改未完成/新题型未覆盖），不是答案正确性；答案取自 redo 接口标准答案、提交即标准、无需验证，非满分一律按技术异常排查分流
- 清理误入仓库的运行期产物并补齐 .gitignore（2026-09-04，用户确认）：git rm 三个在 a515817 被误提交的 transcription 运行文件——`.city_tax_questions.json`(38题)/`.vat_questions.json`(92题)（经比对已被 data/knowledge-source/papers 116 套 1672 题 100% 覆盖、且全仓零引用）、`.transcribe_done`（watch 哨兵、无脚本读取、需要时自动重建）；补登记两个工作区早已删除的遗留（`scripts/transcribe_all_gguf.sh` 废弃 GGUF 路线、`知识拆解总目录.md` 已否决）。.gitignore 增补 `transcription/.tmp_*/`、`transcription/.transcribe_done`、`transcription/.*_questions.json` 与 `logs/`（网盘上传日志+done 哨兵，本地运行状态不入库）。此后 transcription 下仅 requirements.txt 入库，venv(1.3G) 靠其 `pip install -r` 重建
- 阶段④finalize 收尾与旧范式全量清退（2026-09-06，用户授权"全部按推荐执行"）：①网盘删 39 个旧按讲目录 00–38（删前按"文件大小→文件名"全量交叉校验，130 个原料 100% 已迁入新 `原始资源/`，其间发现并补传 02 讲漏传的 transcript.md；filemanager delete 进网盘回收站可恢复）；②本地课程根 00/01/02 旧成品目录（Desktop+data 两份）、仓库 `knowledge-base/organized-content`（老 15 章 51 文件）与 `source-materials`、仓库根无关任务遗留 `_workspace/firecrawl-video`（3.6M）、两份课程 `_workspace`（各 13M）全部移废纸篓（带时间戳、不硬删）；③题答 papers（119 套 JSON）与用户笔记原件（3 份）定性为知识来源原料，从 `_workspace` 归位 `原始资源/papers`、`原始资源/user-notes` 并传网盘，原始资源定为 notes/videos/papers/user-notes 四类；④飞书 108 节点 750 处内部相对链接经 `scripts/wiki_link_resolve.py` 全部转为可点击 wiki 链接，sync 脚本补限流退避与崩溃修复。**遗留待决**：`knowledge-base/lecture-resource-map.json` 按 ADR-012 已被 `_workspace/manifest/course-manifest.json` 取代（后者随工作区清、可 rebuild），但 verify_lecture_map.py 与若干文档仍引用，是否连同旧脚本一并退役待单独确认，本次保留

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

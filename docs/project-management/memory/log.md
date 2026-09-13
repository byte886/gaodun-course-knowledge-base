# 工程记忆 bundle 变更日志（log）

> 只记**记忆层本身**的结构变更（新增/退役/合并 concept、采用决策变化）。
> 业务与代码的完整变更时间线看仓库根 `CHANGELOG.md`；本页不重复业务流水。
> 规则：日期标题 `## YYYY-MM-DD`，最新在最上（倒序）。

## 2026-09-13

- **Update**：`architecture-knowledge-paradigm` 易踩坑补「名师课本地 manifest 读取口径 + 风控期 AI 直接成稿作业法」——`ep3-{subject}-2026/manifest/course-manifest.json` 取 `['knowledge']`、`groups[].code` 是整数非零填充串、`pointIndex[str(pid)]` 取点、章目录＝`NN_`+组名原样；一科选一套体系最完整精讲 OCR 作主干（审计＝王依然上下册、陈岩稿补充、独立课件仅 03/17/18 章），大 OCR 用 awk 定行边界后分段读尽再写、一章一闭环。操作细则同步落到知识生成 SOP 新增 §2.12 与 §2.1 末尾（manifest 读取口径）。来源：审计第 7-12 章连续 24 点成稿实战（code 当字符串比较取不到组、行边界需当场复核等坑）。AI 编译，未标 verified。

## 2026-09-12

- **Update**：`architecture-storage-layout` 按 ADR-020 更新物理课程层——本地/网盘去掉"课程库"中间层（课程直挂 `高顿/CPA/<课程>`、跨课《通用做题思路解析》在 CPA 层），网盘根内插"会计知识库"领域分库层（`/apps/CPA课程归档/会计知识库/高顿/CPA/<课程>`，股票/珠宝知识库平级）；新增硬约束：百度沙箱根名 `/apps/CPA课程归档` 与应用授权绑定、**禁止 API 改名**（实测改名即写操作 31064、改回即恢复），飞书"课程库"是浏览节点不在此列。同步把层级术语"课程库层"改"CPA 层"（泛称"课程库=成品区"保留）。AI 编译，未标 verified。

## 2026-09-10

- **Update**：`workflow-ep3-vod-decryption` 长跑模型从「单路 supervised 串行」补成「单路兜底 vs 多科目节流调度」双模型：多科目总入口 `throttled_ep3_download.sh`（1 生产者 round_robin 串行预取 key + 最多 MAX_PARALLEL 个纯消费者只读缓存下载、nice/taskpolicy 降后台类、自带 caffeinate 防睡眠）；记录三条勿回退硬经验——key 缓存按 profile×阶段独立（共用会被先跑阶段饿死）、只给活跃消费者阶段滚动预取（废弃缓存总数阈值硬跳过）、长跑生产者不 set -e 且计数字段纯数字兜底。来源：会计重点强化被共享缓存饿死漏片的实战定位与修复（离线正则三验证 + 运行时端到端验证）。AI 编译，未标 verified。
- **Update**：`workflow-browser-cdp`「采集不抢用户输入焦点」两层结论再细化：①建标签层 newPage 默认激活→`newBackgroundPage()`（CDP background:true，hidden 下静音+Worker 取 key 不受影响）；②连接授权层——每次新连接弹官方强制授权 sheet、macOS 自动把 Chrome 置前（无法消除），改为**点中即还**：连接前 captureFrontmost 记名传给 `press_allow.applescript`，AXPress 点中「允许」同一刻 System Events `set frontmost` 还回（pressed=false/当前非 Chrome 不动作），实测 Chrome 仅在前台约 0.7s、整个 ~28s 采集期焦点不离开原 App；finally restoreFrontmost 兜底。必须 set frontmost（`tell app activate` 在 node 宿主被静默丢弃、对 Doubao 反切走）；代点间隔维持 800ms 防拥塞。对应 ISSUES I-008、CDP 手册 §4.5。AI 编译，未标 verified。

## 2026-09-09

- **Update**：`workflow-ep3-vod-decryption` 补两条 T3 会计全面精讲批量实战结论：①清晰度只能由 m3u8 URL 鲁棒判——两路 CDN 命名 `glive2-video-resource/.../tc/FHD_xxx`（含 FHD 字样）vs `glive-video-cdn/outputm3u8/<uuid>_1080_xxx`（分辨率后缀、无 FHD），播放器默认就起播 1080 时整段只 init 一次 hls，`includes('FHD')` 会把真 1080 误标 SD、key 已截获却报「未取到 FHD key」稳定漏采 16 讲；capture 改 `classifyQuality`（先 FHD|1080、再 HD|720、余 SD），且分类函数必须在 `page.evaluate` 浏览器作用域内。②ep3 视频长跑必须套 `run_ep3_videos_supervised.sh`（`caffeinate -i` 防 Mac 睡眠/CDP 瞬断导致的零报错静默停摆——裸 nohup 曾停约 8h 仅落 36/261；断点续跑 + 连续 3 轮无增长判 ❌），不裸 nohup、同一时刻只跑一条（共用日常 Chrome）。来源 commit 32e8ac7 + 05 讲修复前后端到端对照。AI 编译，未标 verified。
- **Add**：新增链路 concept `workflow-ep3-vod-decryption`（名师课 ep3/saasType13 平台路由、讲次枚举/getVideoInfo、CDP Worker 截 AES key=32hex 前16字符 ASCII、FHD-1080P、平台 VTT 字幕免 FunASR）与治理 concept `standard-dynamic-observation`（动态交互取证优先于静态逆向/纯接口复现的跨项目方法），并在 index 链路类/治理类登记；正课视频 concept 补"本链路只用于 glive、ep3 走 VTT"分流。来源：ADR-018 + ep3 key 攻坚第五轮双重端到端验证（25/26 考季）。AI 编译，未标 verified（machine-confirmed，待人核）。
- **Update**：工作区收口 concept 补「视频下载/压缩过程件 `.vfetch` 落 `_workspace/<profile>/dl-tmp/`、课程库根不留讲目录」——`fetch_lecture_video.js` 新增 `--work-base`（缺省课程根、向后兼容），动态/串行两条流水线统一指向 dl-tmp，成品仍归 `原始资源/videos/`；根因是 .vfetch 曾建在课程库根、仅靠转写末尾自清，主控中断即永久残留（commit 2b1f892）。

## 2026-09-08

- **Update**：做题链路 concept 补 answerMode=5 表格题双字段提交契约（`userAnswer` + `excelAnswer=JSON.stringify(luckysheet.getAllSheets())`，做题 UI 在独立子应用 sub-tiku.gaodun.com）与错误码分层（token 553649434 / 作答太快 10462203 / 账号级风控 10462222）；结论由 sub-tiku 前端源码逆向 + 三类卷（满分 t1/平台最优 t1/对照）redo 全拦的对照实测得到，细节指针到 exam-workflow §4.3.2/§4.4。
- **Add**：新增治理 concept `standard-debugging-first-principles`（故障排查先验顺序：九成失败是 AI/脚本自身问题、凭证最后怀疑、token 失效须有只读回包硬证据），并在 index 治理类登记；同步更新做题链路与浏览器 CDP 两篇 concept 的 token 自愈描述。
- 来源：会计课 token 失效排查实战（误打端点、刷错课程页、findJwt 排序 bug 均为自身问题）+ 用户约 10 天运行经验。

## 2026-09-07

- **Creation**：建立工程记忆 bundle（ADR-017），初版编译 10 篇 concept——架构 4、链路 4、治理 1、对照索引 1；结论全部从既有 ADR-002/003/005/007/010/012/013/014/015/016、standards 与接口档案编译，未新增事实。
- 初版由 AI 编译，`generated.by=doubao/okf-wiki`、**未标 verified（machine-confirmed，待人核）**；人核通过后再逐篇加 `verified: human:`。
- 校验器 `scripts/okf_validate.py` 自 okf-wiki 技能 vendor 进项目（零第三方依赖），工程自包含、不依赖全局技能。

## 2026-09-10

- **Update（architecture-knowledge-paradigm）**：新增 ADR-019，补「成品编号与著录口径」——知识章目录号取官方 `groups[].code`、跳过预科组不重编号（会计 `01_总论` 已改回 `03_总论`）；讲目录 `NN=idx-1`（开班 00）、忠实平台标题字符、只约束未来不回溯税法；frontmatter type/tags/sources.lecture 著录讲目录的标准档回灌入库脚本与模板。结论由本次会计 vs 税法成品对齐实查得到，AI 初编、未标 verified human。

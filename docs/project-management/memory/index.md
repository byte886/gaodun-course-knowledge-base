---
okf_version: "0.2"
---
# gaodun 工程记忆 bundle（project-memory）

> 这是项目的**跨会话工程记忆入口**：把散落在 ADR / standards / guides 里、跨会话仍有效的稳定结论"编译"成少量高密度 concept。
> 新会话恢复顺序：根 `AGENTS.md`（schema/规则）→ 本页 index（有什么、在哪）→ `CHANGELOG.md`（最近发生什么）→ 按需沿每篇的「来源与下钻」深读原始文档，不要整库灌入。
> 本 bundle 只做"结论 + 指针"，**不复制、不替代** ADR / standards 原文；权威细节以被链接的源文档为准。易变状态（进度、计数、当天日期、SHA）不进本 bundle，需要时实时读台账。

# 架构（Architecture）

* [四地存储分工与仓库版图](concepts/architecture-storage-layout.md) - Git/本地/网盘/飞书各放什么、data 软链与 gitignore 边界、什么才入库
* [统一运行时工作区与 profile 分区](concepts/architecture-runtime-workspace.md) - 唯一 data/_workspace、账号级与课程级正交、收口函数取路径、分级清退
* [课程数据三层解耦与按知识点聚合](concepts/architecture-knowledge-paradigm.md) - 原始资源/知识详解/_workspace 三层、一篇四节、官方 14 组 92 知识点、跨讲聚合
* [静态/动态分离与知识库元数据边界](concepts/architecture-metadata-boundary.md) - docs 静态 vs project-management 动态、学员名/点赞数不进成品、不追求刷满分

# 链路（Workflow）

* [浏览器自动化连接通道](concepts/workflow-browser-cdp.md) - 真实 Chrome 调试端口 + puppeteer-core、接口为主 UI 兜底、禁用内置浏览器
* [做题/试卷采集接口链路](concepts/workflow-exam-paper-pipeline.md) - syllabus→record/redo→submit→AI 批改→回查、JWT、题型与只读/交卷边界
* [视频压缩与音频转写链路](concepts/workflow-video-transcription.md) - H.265 CRF30 压缩、FunASR 本地转写、原始资源分桶
* [飞书同步与单窗口导航](concepts/workflow-feishu-sync.md) - 本地是唯一源头、cite 结构化链接、跨文档必新开是平台事实、左侧目录树单窗口

# 治理（Standard）

* [命名规范与变更分级控制](concepts/standard-naming-change-control.md) - L0/L1/L2 先方案后动、ADR 只增不改、类型词与 snake_case、精简原则、质量门
* [故障排查先验顺序](concepts/standard-debugging-first-principles.md) - 九成失败是自身问题、凭证最后怀疑、token 失效须有只读回包硬证据、交用户登录是最后手段

# 对照索引（Reference）

* [课程 profile 与多课程 ID 对照](concepts/reference-course-profiles.md) - 一门课一张档案卡、glivepro 正课 vs epiphany 名师课、税法/会计各 ID

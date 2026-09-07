# 阶段①资源采集 SOP（视频/转写、讲义/OCR）

> **文档类型**：Task（操作指南）
> **更新频率**：采集流程变更时
> **维护者**：AI自动维护
> **读者**：AI代理

本 SOP 管"怎么把课程的**原始资源**采全、转好、落到课程目录 `原始资源/`"。
- 在四阶段中的位置与校验门：[WORKFLOW.md 阶段①](../../WORKFLOW.md)
- 成品长什么样：[KNOWLEDGE_BASE_TEMPLATE.md](../templates/KNOWLEDGE_BASE_TEMPLATE.md)；目录落点：[DIRECTORY_STRUCTURE.md 第二章](../../DIRECTORY_STRUCTURE.md)
- 哪些算来源：[knowledge-base-sources.md](../knowledge/knowledge-base-sources.md)
- 下游：`paper-manifest-sop.md`（阶段②）

> 分工：模板管成品、sources 管来源可信度、WORKFLOW 管流程位置、本 SOP 管采集动作。

---

## 一、输入与输出

**输入**：官网课程表（syllabus，经日常 Chrome CDP 取得，落 `data/_workspace/<profile>/manifest/course_catalog.json`）；可能已有部分历史下载。

**输出（全部在课程目录 `原始资源/`）**：

```
原始资源/
├── videos/NN_讲题/{video.mp4, transcript.md, transcript.json}
└── notes/NN_模块/{讲义_{名称}.pdf, 讲义_{名称}_OCR.md}
```

资源判别用 syllabus 条目的 discriminator：`live_new`=视频（含 liveId）、`lecture_note`=讲义 PDF、`paper`=试卷（**试卷归阶段②，本阶段不处理**）。

---

## 二、作业步骤

### 步骤0　枚举资源清单、对照存量
1. 读 `course_catalog.json`（或重新走 CDP 取 syllabus），列出全部视频条目、讲义条目；
2. 对照 `原始资源/` 已有产物，得出"待下载/待转写/待OCR/已完成"四类清单，**已完成且校验通过的不重跑**（断点续跑）；
3. 某讲无讲义是正常现象（纯试卷讲/纯视频讲），**不为其硬造空 notes**；混合讲按实际资源建。

### 步骤1　视频下载与压缩
- HLS 流：捕获 AES key → 下分片 → 解密合并 → ffmpeg 压缩 H.265（CRF30）；
- 下载临时落 `data/_workspace/<profile>/tmp/download/NN_讲题/`，成功产物移到 `原始资源/videos/NN_讲题/video.mp4`；
- 详见 [video-processing.md](../tools/video-processing.md)、[document-download.md](../tools/document-download.md)。

### 步骤2　音频转写
- FunASR + VAD 转写，产出面向人的 `transcript.md` 与带时间戳的 `transcript.json`；
- 临时落 `data/_workspace/<profile>/tmp/transcribe/NN_讲题/`，成功后 `transcript.md/.json` 入 `videos/NN_讲题/`、tmp 即清；
- 环境用 `transcription/`（requirements 入库、venv 不入库），详见 [transcription.md](../tools/transcription.md)。

### 步骤3　讲义下载与 OCR
- 下载讲义 PDF 到 `原始资源/notes/NN_模块/讲义_{名称}.pdf`；
- 用 macOS Vision 框架 OCR，产出 `讲义_{名称}_OCR.md`（统一 `_OCR` 后缀）；详见 [ocr.md](../tools/ocr.md)。

### 步骤4　并发调度（按机器能力动态压榨）
- 下载（IO 密集）、压缩（CPU）、转写（CPU，重）、OCR（CPU）可并行；
- 先小样本实测单机各类任务耗时与安全并发度，运行时由总调度**任务完成即上报、即补新任务**，定期巡检仅作异常兜底；
- 方法见 [parallel-processing-guide.md](../performance/parallel-processing-guide.md) 与 [task-planning-and-parallel-scheduling.md](../methodology/task-planning-and-parallel-scheduling.md)。

### 步骤5　完整性校验（阶段①校验门，不过不进阶段②）
- [ ] 视频数 = syllabus 视频条目数；每个 video.mp4 可被 ffprobe 正常读取、非 0 字节；
- [ ] 每个视频都有非空 transcript.md；
- [ ] 讲义 PDF 数 = syllabus 讲义条目数，每份有非空 OCR.md；
- [ ] 目录/命名符合 NAMING 第一~四章；`data/_workspace/<profile>/tmp` 已清；
- [ ] 输出资源清单（各类型数量、缺失项、失败项与原因）。

---

## 三、常见坑

| 坑 | 正确做法 |
|----|----------|
| 把试卷也当本阶段资源下载 | paper 条目归阶段②，本阶段只采视频/讲义 |
| 某讲没讲义就造空目录/标记缺失 | 纯视频/试卷讲无讲义是正常，按 syllabus 实际资源建 |
| 转写/下载临时件散在仓库根或讲目录 | 统一进 `data/_workspace/<profile>/tmp/{download,transcribe}`，成功即清 |
| 重跑时全部重来 | 以校验通过的存量为准，只补缺的（断点续跑） |
| 转写慢就盲目加并发卡死机器 | 先小样本测安全并发度，动态调度（见并行指南） |
| 用内置浏览器取流（无登录态） | 走日常 Chrome 的 CDP 通道，见 [browser-cdp-connect-guide.md](../tools/browser-cdp-connect-guide.md) |

**文档维护**：结构变更改模板、来源变更改 sources、流程变更改 WORKFLOW，本 SOP 只写采集动作。

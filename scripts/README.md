# 脚本索引（Scripts Reference）

> **文档类型**：Reference（参考资料 — 脚本说明）
> **更新频率**：新增/修改脚本时
> **维护者**：AI自动维护
> **读者**：AI代理（执行任务前查脚本用途）和人类（了解脚本功能）

本文档是项目所有脚本的完整索引，按功能分类。每个脚本说明用途、用法、可靠性、相关文档。

---

## 脚本总览（按用途分类，与 `scripts/` 磁盘文件对应；新增脚本须按文末维护规则登记）

| 分类 | 脚本数 | 说明 |
|------|--------|------|
| 做题自动化（旧·UI） | 3 | 单选题、多选题、交卷（UI 点选，接口链路的兜底） |
| 视频处理 | 10 | 单文件下载解密/压缩；CDP 抓 HLS key、单讲下载、分阶段下载/压缩与总控；冲刺点播视频侦查/纯接口下载/转写压缩后处理（scripts/cdp/） |
| 音频转写 | 6 | 单文件、批量、队列并发、单讲 worker、环境搭建 |
| OCR文字提取 | 3 | 单目录批量 OCR、全课程批量、OCR 完整性复核（scripts/ocr/） |
| 百度网盘上传 | 5 | 单文件上传、批量上传、课程上传、整课程并发同步、原始资源(notes/videos)断点补传 |
| 环境与工具 | 9 | Playwright连接、密钥管理、数据符号链接、pre-commit、通用阶段完成监听、长任务守护器、一键进度查询、单课总编排器(run_course_pipeline)、并发标准件(lib/parallel.sh) |
| 检查与验证 | 7 | 目录/知识库结构、命名一致性、Git 卫生、讲次映射校验、papers 按讲视图、课程库逐讲体检 |
| 数据采集 | 2 | 按键捕获、解析采集 |
| 浏览器CDP连接 | 3 | 日常Chrome连接、授权自动点、网络抓包骨架（scripts/cdp/） |
| 高顿做题接口链路 | 12 | 只读侦查、抓大纲/取题、UI对照、纯接口做卷与批量补做、papers 原料只读补采、冲刺 6 卷统一入口（scripts/cdp/） |
| 飞书知识库同步 | 4 | 新结构(14组→92知识点)同步、批量同步建节点、节点内容更新两版 |
| 侦查/PoC 网络采集 | 3 | 持久化浏览器 PoC、Playwright 网络钩子注入与导出（备用/备查路线） |

> **全量对齐（2026-09-05；2026-09-07 增补）**：历史脚本已一次性补登；2026-09-07 多课程/并行化改造新增单课总编排器 `run_course_pipeline.sh` 与并发标准件 `lib/parallel.sh`（见「课程配置」末小节），并同步更新各去硬编码脚本条目。新增脚本必须按文末「维护规则」同步登记，并定期用 `ls scripts/ scripts/cdp scripts/ocr scripts/knowledge scripts/migrate scripts/lib` 核对，避免再次出现"在跑但没上台账"。

---

## 课程配置（多课程支持）

所有课程相关脚本通过 `scripts/course_config.sh` 统一配置，默认指向税法课。**推荐用课程 profile 切换**（`config/courses/<key>.json`，含课程 ID/章组/overview，见该目录 README）：

```bash
# 切换到会计课（shell 用 COURSE_PROFILE，node 用 GAODUN_COURSE_PROFILE，course_config 两者都认）
export COURSE_PROFILE=cpa-accounting-2026
export GAODUN_COURSE_PROFILE=cpa-accounting-2026

# 然后运行任意课程脚本（会自动读取配置）；多数脚本也支持 --profile <key>
bash scripts/sync_raw_resources.sh all
bash scripts/transcribe_parallel.sh        # FunASR 默认串行最优，不传参即并发1
bash scripts/ocr/run_ocr_all.sh --dry
python3 scripts/knowledge/collect_point_questions.py --all
```

**配置变量**：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `COURSE_NAME` | 税法课（蔡俊峻） | 课程名称，用于拼接路径（显式设置优先级高于 profile） |
| `COURSE_LOCAL_ROOT` | `data/高顿/CPA/课程库/$COURSE_NAME` | 仓库内课程根目录 |
| `COURSE_REMOTE_ROOT` | `/apps/CPA课程归档/高顿/CPA/课程库/$COURSE_NAME` | 网盘课程根目录 |
| `COURSE_DESKTOP_ROOT` | `~/Desktop/高顿/CPA/课程库/$COURSE_NAME` | Desktop 源头课程目录 |
| `BAIDU_ENC_PASS` | `lover123` | 百度网盘加密密码 |

**已参数化（读 profile/config 或 env）的脚本**：采集下载线 `cdp/refresh_inventory.js`、`cdp/collect_user_notes.js`、`cdp/fetch_lecture_video.js`、`cdp/gaodun_paper_core.js`；加工线 `transcribe_parallel.sh`、`transcribe_qvideos.sh`、`cdp/encode_all.sh`、`ocr/run_ocr_all.sh`、`sync_raw_resources.sh`、`sync_course_netdisk.sh`、`check_directory_structure.sh`、`progress.sh`；知识线 `knowledge/build_course_overview.py`、`knowledge/collect_point_questions.py`、`knowledge/organize_user_notes.py`、`knowledge/resync_wiki_content.py`、`ocr/verify_ocr.py`。刻意保留专属/一次性的例外见 `docs/development/guides/parallel-toolkit-design.md` §3.4 末表。

### 总编排器与并发标准件

- **`run_course_pipeline.sh <profile> [--dry-run|--from n|--only n|--list]`**：按 `docs/development/project-dag.md` 的 13 节点顺序做单课总调度，阶段 marker 落在 `data/_workspace/$PROFILE/pipeline/<n>.done`（重跑跳过），进入「9 知识库生成」前做 Fan-In 校验。auto 阶段直接调用下列专用脚本，manual/todo 阶段只给指引，**只调度、不含业务逻辑**。首次先 `--dry-run` 走查。
- **`lib/parallel.sh` 的 `parallel_map`**：shell 侧唯一并发标准件，`<NUL任务流> | parallel_map <并发N> <worker命令...>`，底层 `xargs -0 -P`，替代有竞态的自建 mkdir/flock 锁队列。CPU 任务（FunASR/x265）并发度必须实测、默认串行；IO 任务可高并发受限流约束，选型见 `docs/development/performance/parallel-processing-guide.md`。

---

---


---


---

## 二、视频处理（9个）

### `download_decrypt.js` — HLS视频下载解密合并

| 项目 | 说明 |
|------|------|
| **用途** | 下载高顿网站HLS分片视频，AES-128解密，合并为完整MP4 |
| **用法** | `node scripts/download_decrypt.js <m3u8_url> <output.mp4>` |
| **可靠性** | ✅ 高（已验证，支持加密视频） |
| **相关文档** | `docs/development/tools/video-processing.md` |

**原理**：解析m3u8播放列表，下载所有.ts分片，使用AES-128密钥解密，ffmpeg合并为MP4。

---

### `compress.sh` — 视频批量压缩

| 项目 | 说明 |
|------|------|
| **用途** | 使用ffmpeg H.265 CRF30压缩视频，支持单文件和批量目录 |
| **用法** | `bash scripts/compress.sh <input.mp4> <output.mp4>` 或 `bash scripts/compress.sh <input_dir> <output_dir>` |
| **可靠性** | ✅ 高（已验证，压缩比约8:1） |
| **相关文档** | `docs/development/tools/video-processing.md` |

**参数**：libx265 / CRF 30 / preset fast / AAC 96k / hvc1标签 / faststart。
**验证**：压缩后自动检查时长误差<2秒、编码格式、可播放性。

---

### `cdp/capture_video_key.js` — CDP 抓 HLS 流地址与密钥

| 项目 | 说明 |
|------|------|
| **用途** | 经 CDP（puppeteer-core）打开回放页、注入 Worker hook，捕获 m3u8(SD/FHD) 与 AES key；等价旧 Playwright 版 `capture_key.js`，但走主链路（连日常 Chrome、复用登录态） |
| **用法** | `node scripts/cdp/capture_video_key.js "<回放 player?token=URL>" [输出json路径]`，输出 `{quality,m3u8,keyAscii}[]` |
| **可靠性** | ✅ 高（纯采集，只开一个临时静音播放标签触发 worker 流量、抓完即关，不动用户其它页） |
| **相关文档** | `docs/development/tools/video-processing.md`、ADR-010 |

---

### `cdp/fetch_lecture_video.js` — 单讲下载解密合并主控

| 项目 | 说明 |
|------|------|
| **用途** | 取回放 URL → CDP 抓 HLS key → 下 m3u8 取 IV → 下载解密合并为 `merged.ts`（**不做压缩**，压缩交队列脚本）；幂等（已有 video.mp4 跳过）；每讲实时取最新 token（m3u8/authorize token 会过期） |
| **用法** | `node scripts/cdp/fetch_lecture_video.js <idx> [--profile <key>]`（idx=课程表下标，idx1=开班前缀00；课程目录/ID 读 profile，缺省税法） |
| **可靠性** | ✅ 高；产物 `<讲>/.vfetch/manifest.json + merged.ts`（压缩阶段读取） |
| **相关文档** | video-processing.md、ADR-010 |

---

### `cdp/download_all.sh` — 批量「下载阶段」

| 项目 | 说明 |
|------|------|
| **用途** | 逐讲 抓 key→下载解密，只产出 `.vfetch/merged.ts`、不压缩；串行抓 key（同一 Chrome 一次只开一个播放标签，拟人、避免多标签 hls worker 互扰）；网络 IO 为主、几乎不占 CPU，**可与 OCR/压缩并行**；讲间留 4s；断点续跑（已有 video.mp4 或 merged 自动跳过） |
| **用法** | `bash scripts/cdp/download_all.sh [idx ...]`（不给参数遍历 1..39） |
| **可靠性** | ✅ 高 |
| **相关文档** | video-processing.md、WORKFLOW「多任务并发调度」 |

---

### `cdp/encode_all.sh` — 批量「压缩阶段」

| 项目 | 说明 |
|------|------|
| **用途** | 扫描各讲 `.vfetch/manifest.json`，把已下载的 merged.ts 逐个 H.265 压成 video.mp4（compress.sh 自带时长/moov 校验），成功后清分片与 merged；全局同时只允许一个 ffmpeg（x265 吃满核，第二个实例吞吐反降）；断点续跑 |
| **用法** | `bash scripts/cdp/encode_all.sh`（扫一遍压完即退）；`--watch` 守护模式边下边压、等下载结束且全压完才退 |
| **可靠性** | ✅ 高（CPU 密集，与下载阶段错峰） |
| **相关文档** | video-processing.md |

---

### `cdp/fetch_all_videos.sh` — 下载+压缩两段总控

| 项目 | 说明 |
|------|------|
| **用途** | 先跑「下载阶段」再跑「压缩阶段」的串行总入口；若要与其它任务并行调度，可分别手动跑 download_all.sh 与 encode_all.sh |
| **用法** | `bash scripts/cdp/fetch_all_videos.sh [idx ...]` |
| **可靠性** | ✅ 高 |
| **相关文档** | video-processing.md |

---


---

### `cdp/fetch_sprint_video.js` — 冲刺视频纯接口下载器（不加密、并发下 ts 合并）

| 项目 | 说明 |
|------|------|
| **用途** | JWT 调取流接口拿 FHD m3u8 → 并发 12 下载相对分片 → 顺序合并 `.vfetch/merged.ts`（无需 CDP/解密）；幂等，已合并则跳过 |
| **用法** | `node scripts/cdp/fetch_sprint_video.js 1|2|3|all`，产物在 `data/_workspace/<profile>/tmp/download/sprint-videos/<标题>/.vfetch/` |
| **实测** | 单卷约 480 片 / 300MB / 约 24 秒（FHD 126 分钟） |
| **可靠性** | ✅ 高（分片 3 次重试、断点续下） |

---

### `cdp/process_sprint_videos.sh` — 冲刺视频「并行转写 + 串行压缩」后处理

| 项目 | 说明 |
|------|------|
| **用途** | 阶段1：3 个 merged.ts 并行 FunASR 转写（每进程限 5 线程）出 transcript.md/json；阶段2：复用 compress.sh 串行 H.265 压 video.mp4；均断点续跑 |
| **用法** | `bash scripts/cdp/process_sprint_videos.sh`，日志 `logs/sprint_video_process.log` |
| **注意** | macOS 自带 bash 3.2，已用 glob 数组替代 mapfile；压缩阶段全局只允许一个 ffmpeg |
| **可靠性** | ✅ 高 |

---

### `cdp/fetch_question_video_keys.js` — 题目级讲解视频抓 AES key（一次性，需 Chrome）

| 项目 | 说明 |
|------|------|
| **用途** | 题目级视频 encrypt=1、key 不下发（authorize 被鉴权拦，wasm 解密后只在 Worker 内存）；CDP 打开逐题解析页→点封面加载播放器→hook Worker `postMessage`，从 `to_worker.response` 取前 16B ASCII key，落 `data/_workspace/<profile>/papers/qvideo_keys.json` |
| **用法** | `node scripts/cdp/fetch_question_video_keys.js`（卷/大题入口/vid 已在脚本内配置，来自 syllabus_full.json 与 redo） |
| **关键事实** | key 为视频级固定值、跨会话不变，故只需抓一次；hook 必须 evaluateOnNewDocument 注入 |
| **可靠性** | ✅ 高（7/7 一次成功；缺哪个补哪个，已抓自动跳过） |

---

### `cdp/download_question_videos.js` — 题目级视频纯接口下载解密（离线可重跑）

| 项目 | 说明 |
|------|------|
| **用途** | 读 qvideo_keys.json 固定 key，JWT 取 SD m3u8→解析 IV→并发 10 下载→逐片 AES-128-CBC 解密（校验 0x47）→合并 merged.ts；产物 `data/_workspace/<profile>/tmp/download/sprint-videos/题目级讲解/qvideo_<pid>_<entry>_<vid8>/.vfetch/` |
| **用法** | `node scripts/cdp/download_question_videos.js all` 或 `<vid8>`；分片落盘缓存、断点续跑 |
| **实测** | 7 个共 175 分钟 / 约 458MB(SD)，全量下载解密约 40 秒；ffprobe 时长逐一==接口 duration |
| **可靠性** | ✅ 高（分片 3 次重试、解密非 TS 立即报错） |

---

## 三、音频转写（7个）

### `transcribe_pipeline.py` — 单视频音频转写

| 项目 | 说明 |
|------|------|
| **用途** | 从视频提取音频，使用faster-whisper/FunASR转写为文字 |
| **用法** | `python3 scripts/transcribe_pipeline.py <video.mp4> [output.md]` |
| **可靠性** | ✅ 中（依赖模型质量，专业术语可能出错） |
| **相关文档** | `docs/development/tools/transcription.md` |

**输出**：带时间戳的文字稿（Markdown格式）。

---

### `batch_transcribe.sh` — 批量视频转写

| 项目 | 说明 |
|------|------|
| **用途** | 批量转写目录下所有视频，在iTerm中运行可看实时进度 |
| **用法** | `bash scripts/batch_transcribe.sh <input_dir> <output_dir>` |
| **可靠性** | ✅ 中（依赖单文件转写的可靠性） |
| **相关文档** | `docs/development/tools/transcription.md` |

**注意**：必须在iTerm中运行（`bash scripts/batch_transcribe.sh`），不要在后台运行，方便查看进度和异常。

---

### `setup_transcription_env.sh` — 转写环境搭建

| 项目 | 说明 |
|------|------|
| **用途** | 创建Python虚拟环境，安装faster-whisper/FunASR及依赖 |
| **用法** | `bash scripts/setup_transcription_env.sh` |
| **可靠性** | ✅ 高（首次设置后不需要重复运行） |
| **相关文档** | `docs/development/tools/transcription.md` |

**输出**：`.venv-transcribe/` 虚拟环境目录（已在.gitignore中忽略）。

---

### `transcribe_all.sh` — 全课程批量转写（串行）

| 项目 | 说明 |
|------|------|
| **用途** | 对课程库所有讲的 video.mp4 用 FunASR（SenseVoiceSmall+VAD）批量转写；逐讲用独立临时目录调 transcribe_pipeline.py（规避所有视频同名 video.mp4 互相覆盖），完成后拷回 transcript.md/json；断点续传（已有 transcript.md 且 >1000 字自动跳过），单讲失败记录后继续 |
| **用法** | `bash scripts/transcribe_all.sh` |
| **可靠性** | ✅ 高；**CPU 密集**，须在视频「压缩全部完成后」再跑，避免与 x265 叠加争抢/降频 |
| **相关文档** | `docs/development/tools/transcription.md`、ADR-003 |

---

### `transcribe_one.sh` — 单讲转写（并发 worker）

| 项目 | 说明 |
|------|------|
| **用途** | 转写单个讲目录，被 `xargs -P` 并发调用；每个讲只出现一次，天然无竞态 |
| **用法** | `bash scripts/transcribe_one.sh <讲目录绝对路径>` |
| **可靠性** | ✅ 高 |
| **相关文档** | transcription.md |

---

### `transcribe_parallel.sh` — 批量转写（xargs 内核调度，默认串行）

| 项目 | 说明 |
|------|------|
| **用途** | 扫描正课课程库生成 NUL 待转队列，经 `lib/parallel.sh` 的 `parallel_map`（`xargs -0 -P`）内核级调度 `--worker` 自递归，无自建锁竞态；FunASR 实测**串行总吞吐最优**（1 并发 18.5x > 6 并发 14.3x），默认并发 1，可传参覆盖（换机器/模型须按性能指南重测）；单讲失败隔离、不自动 requeue，重跑幂等续（已有 >1000 字 transcript 跳过） |
| **用法** | `bash scripts/transcribe_parallel.sh [并发数N]`（默认 1，对象=正课课程库，读 profile/config） |
| **可靠性** | ✅ 高（内核动态调度 + 幂等断点续跑） |
| **相关文档** | `docs/development/performance/parallel-processing-guide.md`、ADR-003 |

---

### `transcribe_qvideos.sh` — 题目级讲解视频批量转写（默认串行）

| 项目 | 说明 |
|------|------|
| **用途** | 机制同 transcribe_parallel（`parallel_map` + `--worker` 自递归、默认并发 1）；对象是 `data/_workspace/<profile>/tmp/download/sprint-videos/题目级讲解/qvideo_*/video.mp4`（税法冲刺专属数据），临时目录用 vid 目录名唯一化（避免首段前缀都叫 qvideo 撞车），输出 transcript.md/json 到各目录 |
| **用法** | `bash scripts/transcribe_qvideos.sh [并发数N]`（默认 1，已有 >1000 字 transcript 自动跳过） |
| **实测** | FunASR 约 20x 实时；并发度总吞吐以性能指南为准（串行最优，旧默认 6 已收敛） |
| **可靠性** | ✅ 高 |

---

## 四、OCR文字提取（3个）

### `batch_ocr.sh` — 批量PDF/讲义OCR

| 项目 | 说明 |
|------|------|
| **用途** | 使用macOS Vision框架批量提取PDF中的文字，支持图片型PDF |
| **用法** | `bash scripts/batch_ocr.sh <pdf_dir> <output_dir>` |
| **可靠性** | ✅ 中高（macOS原生OCR，文字清晰时准确率高；表格/图表需AI补充） |
| **相关文档** | `docs/development/tools/ocr.md` |

**注意**：表格和图表中的文字OCR可能不完整，需要AI视觉模型补充识别。

---

### `ocr/run_ocr_all.sh` — 全课程批量 OCR

| 项目 | 说明 |
|------|------|
| **用途** | 批量 OCR 课程库全部讲义 PDF（串行，逐个调 batch_ocr.sh）；每处理一个 PDF 前清空 /tmp 分页缓存，避免不同 PDF 断点缓存串用；输出 `docs/<x>.pdf → docs_text/<x>_OCR.md`，已存在且非空则跳过 |
| **用法** | `bash scripts/ocr/run_ocr_all.sh [--dry]` |
| **可靠性** | ✅ 中高（macOS 原生 OCR） |
| **相关文档** | `docs/development/tools/ocr.md` |

---

### `ocr/verify_ocr.py` — OCR 完整性复核（只读）

| 项目 | 说明 |
|------|------|
| **用途** | 逐份比对 `docs/*.pdf` 实际页数与 `docs_text/<名>_OCR.md` 中 `## 第N页` 分节数（允许相等，少于即残缺），输出逐份 OK/残缺清单与汇总 |
| **用法** | `transcription/venv/bin/python scripts/ocr/verify_ocr.py`（残缺时退出码 1） |
| **可靠性** | ✅ 高（PyMuPDF 机械计数） |
| **相关文档** | ocr.md、SOP 步骤0「生成前 verify 前置」 |

---

## 五、百度网盘上传（5个）

### `baidu_upload.py` — 单文件上传到百度网盘

| 项目 | 说明 |
|------|------|
| **用途** | 使用百度网盘API分片上传单个文件 |
| **用法** | `python3 scripts/baidu_upload.py <local_path> <remote_path>` |
| **可靠性** | ✅ 高（已验证，支持大文件分片上传） |
| **相关文档** | `docs/development/api/netdisk-setup.md` |

**注意**：上传时不要通过代理（百度网盘API直连更快）。上传后验证文件大小与本地一致。

---

### `batch_upload.sh` — 批量文件上传

| 项目 | 说明 |
|------|------|
| **用途** | 批量上传目录下所有文件到百度网盘，保持目录结构 |
| **用法** | `bash scripts/batch_upload.sh <local_dir> <remote_dir>` |
| **可靠性** | ✅ 高（依赖baidu_upload.py） |
| **相关文档** | `docs/development/api/netdisk-setup.md` |

---

### `upload_course.sh` — 完整课程上传

| 项目 | 说明 |
|------|------|
| **用途** | 上传一个完整课程目录（视频+讲义+文字稿）到百度网盘对应位置 |
| **用法** | `bash scripts/upload_course.sh <course_name>` |
| **可靠性** | ✅ 中（依赖目录结构规范） |
| **相关文档** | `docs/development/api/netdisk-setup.md` |

---

### `sync_course_netdisk.sh` — 课程目录并发同步网盘

| 项目 | 说明 |
|------|------|
| **用途** | 把一整个课程根按讲并发同步到百度网盘（通用，可复用于会计等其他课程）：xargs -P 并发、断点续传（`logs/netdisk_done/` 标记成功讲、重跑自动跳过）、单讲失败不影响其他讲、百度侧已存在文件走 MD5 秒传；逐讲调用 upload_course.sh 过滤技术过程文件 |
| **用法** | `bash scripts/sync_course_netdisk.sh <本地课程根> <网盘课程根> [并发数=3] [编号正则过滤]`（网盘 IO 建议并发 2–3） |
| **可靠性** | ✅ 高（已用于 S1 39 讲同步；每讲独立日志 `logs/netdisk_<讲>.log`） |
| **相关文档** | `docs/development/api/netdisk-setup.md`、standards 2.2（L1/L2 备份） |

---

### `sync_raw_resources.sh` — 原始资源(notes/videos)断点补传网盘

| 项目 | 说明 |
|------|------|
| **用途** | 阶段④门禁：把课程「原始资源」下的 notes（用户笔记/留言正本/题答解析）与 videos（压缩视频）按讲并发补传到百度网盘。xargs -P 并发、断点续传（`logs/raw_done/{notes,videos}_*.done` 标记成功讲、重跑跳过）、单讲失败不影响其他、百度侧已存在走 MD5 秒传。配合 run_supervised.sh 可脱离 AI 会话自动续跑到底 |
| **用法** | `bash scripts/sync_raw_resources.sh <notes\|videos\|all> [并发数=2]`（网盘 IO 建议并发 2） |
| **可靠性** | ✅ 高（已用于税法课 notes 17/17、videos 39/39；每讲独立日志 `logs/raw_<类型>_batch.log`） |
| **相关文档** | long-task-supervisor-guide.md、finalize-sop.md、standards 2.2（L1/L2 备份） |

---

## 六、环境与工具（6个）


---

### `secrets.sh` — 加密凭证管理

| 项目 | 说明 |
|------|------|
| **用途** | 加密/解密敏感凭证（GitHub Token、百度网盘API密钥等） |
| **用法** | `bash scripts/secrets.sh encrypt <input> <output.enc>` 或 `bash scripts/secrets.sh decrypt <input.enc>` |
| **可靠性** | ✅ 高（OpenSSL AES-256加密） |
| **相关文档** | `docs/development/api/encryption.md` |

**规则**：加密文件（*.enc）可以提交到GitHub，明文文件（*.json, *.txt）在.gitignore中忽略。

---

### `setup_data_symlink.sh` — 数据目录符号链接

| 项目 | 说明 |
|------|------|
| **用途** | 创建/检查 `data/高顿/` 符号链接，指向外部数据目录（默认 `~/Desktop/高顿/`） |
| **用法** | `bash scripts/setup_data_symlink.sh`（创建）或 `bash scripts/setup_data_symlink.sh --check`（检查） |
| **可靠性** | ✅ 高（不同电脑可指向不同路径） |
| **相关文档** | `README.md` 存储分工部分 |

**注意**：`data/` 目录已在.gitignore中忽略，不会提交到GitHub。

---

### `pre-commit` — Git提交前检查

| 项目 | 说明 |
|------|------|
| **用途** | Git 提交前自动检查（检查项与阈值以 git-workflow 9.2 为准）：大文件 >1MB 警告 / >10MB 硬阻止；音视频、PDF 等生成文件误提交警告；敏感信息（明文 password/token/secret/key）警告；新增 .md 未登记 DOCUMENTATION_MAP 或缺头部类型标注警告；暂存 .md 相对链接断链硬阻止；文档类型词不在 7 类白名单（Task/Concept/Reference/Governance/Active/Knowledge/Template）硬阻止；**运行产物/环境/数据误入暂存（命中模式表 ARTIFACT_RE，或被 .gitignore 忽略却 `git add -f` 强塞）硬阻止** |
| **用法** | 安装后每次 `git commit` 自动执行（激活副本位于 `.git/hooks/pre-commit`） |
| **可靠性** | ✅ 高（不依赖读文档，自动执行） |
| **相关文档** | `docs/development/guides/git-workflow.md` 第 9 节 |

**安装**：`cp scripts/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`

---

### `watch_stage_done.sh` — 通用阶段完成事件监听

| 项目 | 说明 |
|------|------|
| **用途** | 零依赖、60 秒轮询：监听某目录下匹配指定模式的文件数量达到预期值时，写完成标记文件并退出。替代人工长间隔巡检，消除"任务已完成但总调度未发现"的空窗（空窗 ≤60 秒）——即"子任务主动上报为主、定期检查仅防异常" |
| **用法** | `bash scripts/watch_stage_done.sh <监听目录> <文件名匹配> <预期数量> <标记文件路径> [检查间隔秒]` |
| **可靠性** | ✅ 高（纯文件计数，无外部依赖） |
| **相关文档** | WORKFLOW「多任务并发调度」 |

---

### `run_supervised.sh` — 长任务守护器（脱离 AI 会话自动续跑）

| 项目 | 说明 |
|------|------|
| **用途** | 解决 AI `run_in_background` 约 8 分钟被回收、且 AI 是请求-响应模式无法被系统进程反向唤醒的问题：用 `nohup ... & disown` 让进程 PPID=1 被 launchd 接管，while 循环反复执行断点续传命令，用完成检测命令判终，连续 3 轮无进展判异常，完成/异常调 osascript 发 macOS 通知。配套「定时唤醒 AI + 临门一脚 + 完成自清理」实现 AI 自动接续 |
| **用法** | `nohup bash scripts/run_supervised.sh <任务名> "<单次命令>" "<完成检测test命令>" > logs/supervisor_<任务名>.log 2>&1 & disown` |
| **可靠性** | ✅ 高（已用于 videos 39 个自动续跑到完成；BSD 兼容：完成统计用 `find -name` 不用 `ls glob`，画进度条前先判数量>0 避开 `seq 1 0`） |
| **相关文档** | docs/development/performance/long-task-supervisor-guide.md（含第七章 AI 自动接续） |

---

### `progress.sh` — 后台长任务一键进度查询（只读）

| 项目 | 说明 |
|------|------|
| **用途** | 一条命令查看后台长任务：进度条、守护器是否存活、正在处理的单元、最近日志；并取最近 9 个 done 标记时间戳与实际文件大小现算合计/单路速率、平均单耗、剩余总量与 ETA、预计完成时刻。只读，不影响任务运行 |
| **用法** | `bash scripts/progress.sh`（已 chmod 755，也可直接 `./scripts/progress.sh`） |
| **可靠性** | ✅ 高（纯文件/日志统计，无外部依赖；ETA 为基于近期完成速率的估算） |
| **相关文档** | long-task-supervisor-guide.md 3.4 节 |

---

## 七、检查与验证（7个）

### `check_directory_structure.sh` — 目录结构检查

| 项目 | 说明 |
|------|------|
| **用途** | 检查本地课程目录结构是否符合规范（高顿/CPA/课程库/课程名/章节名/） |
| **用法** | `bash scripts/check_directory_structure.sh <data_dir>` |
| **可靠性** | ✅ 中高（基于命名规范检查） |
| **相关文档** | `docs/project-management/standards/NAMING_CONVENTION.md` |

---

### `check_kb_structure.sh` — 知识库结构检查

| 项目 | 说明 |
|------|------|
| **用途** | 检查本地知识成品结构是否符合规范（14 组 / 知识点单篇 4 节） |
| **用法** | `bash scripts/check_kb_structure.sh <kb_dir>` |
| **可靠性** | ✅ 中（基于文件命名检查） |
| **相关文档** | `docs/development/knowledge/knowledge-base-organization.md` |

---

### `check_naming_consistency.py` — 命名一致性巡检 / 影响面 / 回归

| 项目 | 说明 |
|------|------|
| **用途** | 按 NAMING 第九章（SSOT）巡检"文档类型↔文件名风格"自洽、客观列出类型复核候选；对 task/test/verification/knowledge-base 下中文文件名提示"段间下划线、日期除外"；改名前 `--impact 老名` 查看引用影响面；整改后 `--regression` 跑自洽+断链回归。所有候选均为警告级、不阻断 |
| **用法** | `python3 scripts/check_naming_consistency.py`（另有 `--impact NAME` / `--regression`） |
| **可靠性** | ✅ 高（风格规则可机械判定；语义判型只列候选、通读后可维持原判，不臆断） |
| **相关文档** | `NAMING_CONVENTION.md` 第九章、`PROJECT_STRUCTURE_MAINTENANCE.md` 第六章 SOP |

---

### `check_git_hygiene.sh` — Git 仓库卫生体检（只读）

| 项目 | 说明 |
|------|------|
| **用途** | 全量只读体检：①已跟踪文件是否混入运行产物（模式表与 pre-commit 的 ARTIFACT_RE 一致）；②未跟踪项分类（像运行产物则提示补 .gitignore，否则提示确认入库）；③被跟踪的 >1MB 大文件；④`.git` 与工作区体积。不改任何文件/暂存区 |
| **用法** | `bash scripts/check_git_hygiene.sh`（发现存量漏网退出码 1、否则 0） |
| **可靠性** | ✅ 高（模式机械匹配；pre-commit 拦增量、本脚本查存量，互补） |
| **相关文档** | `PROJECT_STRUCTURE_MAINTENANCE.md` 2.1、`git-workflow.md` 第 9 节 |

---

### `papers_view.py` — papers 题源按讲只读视图

| 项目 | 说明 |
|------|------|
| **用途** | 遵循 standards 2.2.4「物理集中存、逻辑按讲视图」，由 `paper_index.json` 的 chapter 字段现场 group by 出「每讲几套卷 / 多少题 / paperId」；只读，不落盘、不生成第二份物理副本 |
| **用法** | `python3 scripts/papers_view.py`（全讲概览）；`--lecture 01` 或 `--lecture 增值税`（讲号/关键词）；`--json`（结构化输出供脚本消费） |
| **可靠性** | ✅ 高（实测 34 讲 / 116 套 / 1296 题；chapter 前导空格自动 strip） |
| **相关文档** | standards 2.2.4、ADR-011 |

---

## 八、数据采集（2个）

### `capture_key.js` — 按键捕获

| 项目 | 说明 |
|------|------|
| **用途** | 捕获页面中的加密密钥（用于HLS视频解密） |
| **用法** | `node scripts/capture_key.js <url>` |
| **可靠性** | ⚠️ 中（依赖页面结构，可能需要调整） |
| **相关文档** | `docs/development/tools/video-processing.md` |

---

### `collect_analysis.js` — 解析与用户留言采集

| 项目 | 说明 |
|------|------|
| **用途** | 从做题页面采集官方解析和用户留言精华 |
| **用法** | `node scripts/collect_analysis.js <exam_url>` |
| **可靠性** | ⚠️ 中（依赖页面结构，可能需要滚动加载） |
| **相关文档** | `docs/development/guides/exam-workflow.md` |

**注意**：用户留言可能需要向下滚动才能完整加载，脚本在"笔记"关键词处可能截断。

---

## 九、浏览器 CDP 连接（2个，位于 `scripts/cdp/`）

> 用 puppeteer-core 经 Chrome 144+ 运行时调试通道连接用户**正在使用的日常 Chrome**（默认 Profile、复用登录态、免重启免重登）。选型见 ADR-010，手册见 `docs/development/tools/browser-cdp-connect-guide.md`。依赖在仓库根 `npm install`（node_modules 不入库）。

### `cdp/connectBrowser.js` — 连接日常 Chrome（可复用模块 + 自检）

| 项目 | 说明 |
|------|------|
| **用途** | 读取带 UUID 的 CDP 端点、自动 AXPress 授权、403 退避重试，导出 `connectDailyChrome/findPage/listPages/safeDisconnect` |
| **用法** | `node scripts/cdp/connectBrowser.js`（环境自检：连接→列标签→断开）；业务脚本 `require('./cdp/connectBrowser')` |
| **可靠性** | ✅ 高（已实测，连续连接稳定，1.4~3.6s 连上且保留用户页面） |
| **相关文档** | `docs/development/tools/browser-cdp-connect-guide.md`、ADR-010 |

---

### `cdp/press_allow.applescript` — 自动点「允许远程调试」

| 项目 | 说明 |
|------|------|
| **用途** | 递归遍历 Chrome 控件，对「允许」按钮执行元素级 AXPress（文字在 AXDescription），多屏可靠；无弹窗时无副作用 |
| **用法** | 一般由 connectBrowser.js 自动调用；手工调试：`osascript scripts/cdp/press_allow.applescript` |
| **可靠性** | ✅ 高（需在系统设置授予「辅助功能」权限） |
| **相关文档** | `docs/development/guides/macos-accessibility-automation.md` |

---


---

## 十、高顿做题接口链路（6个，位于 `scripts/cdp/`）

> 「接口为主、UI 兜底」的纯接口做题脚本，契约见 [高顿作业接口档案](../docs/development/api/gaodun-exam-api.md)。报文落 `data/_workspace/<profile>/sniff/`（不入库）。


---


---


---


---


---


---

### `cdp/gaodun_paper_core.js` — 纯接口做卷共享核心（客观 + type5/6 主观）

| 项目 | 说明 |
|------|------|
| **用途** | 被 `api_do_paper.js`/`batch_redo_papers.js` 复用：record→(首次先 create-paper)→redo→平铺答案（type5 父题不答、平铺其 type6 子题；顶层独立 type6 同样处理）→按 `aiCorrect.cpaBotType` 分流（=3 进 AI 批改、=0 未配 AI 只交答案）→最小停留→submit 全量交卷→交卷后并发=3 逐题 correct-ai/cpa：cs=6 走「canon+qual / full / AI 未命中点」三级补全 → best-of-N×4 原样重取 → 仍不满且答案=标准答案则归 aiCeiling→exam-report 两层核对（fullScore / platformDone）。主观答案统一走 `cleanSubjectiveAnswer`（算式主体+点拨精简「依据：」+多小问分点，交卷与首次 AI 批改同版；点拨不全删——六卷实证其含采分点，只删年份政策背景句）。导出 `doPaperViaApi/buildUserAnswers/cleanSubjectiveAnswer/canonAnswer/qualitativeAnswer/findJwt` 等 |
| **答案来源** | 客观取 `questionAnswer.answer`；主观（type5 子题与顶层 type6）从 `questionAnswer.analysis` 提炼（canon 等式句 / qual 点拨定性句 / full 整段兜底），无需本地题库 |
| **可靠性** | ✅ 基础卷 116 张全部达成（109 严格满分 + 7 平台最优）；73 张客观精讲卷一次满分零失败；交卷与 AI 批改解耦（交卷即完成，批改异常只标记不崩）；AI 判分抖动应对见 [flaky-ai-judging.md](../docs/development/guides/flaky-ai-judging.md) |
| **相关文档** | gaodun-exam-api.md §2.3/2.5/2.6/2.7、§3 |

---

### `cdp/api_do_paper.js` — 通用纯接口做卷（单卷，推荐入口）

| 项目 | 说明 |
|------|------|
| **用途** | 从 syllabus 自动解析指定卷的 csItemId/paperId/resourceId，交 gaodun_paper_core 完成取题→交卷→（主观）AI 批改→回查；零 UI 点选 |
| **用法** | `node scripts/cdp/api_do_paper.js <paperId 或 标题关键字> [最小停留秒]`；加 `--no-ai` 只交卷不做主观 AI 批改。如 `node scripts/cdp/api_do_paper.js 82749` |
| **可靠性** | ✅ 客观卷 + 主观大题卷（含顶层独立 type6）；退出码：0=严格满分或平台最优（未配 AI / AI 判分上限不阻断）、4 已交卷但未达平台最优（可补批）、1/2 未交卷成功或异常；**仅限可重做基础卷，冲刺模考排除** |
| **相关文档** | gaodun-exam-api.md §3 |

---

### `cdp/batch_redo_papers.js` — 批量纯接口补做到 100%

- 只读枚举 `papers_inventory.json`+`papers_audit.json` 中「非满分且非冲刺」的卷，逐张交 gaodun_paper_core：record→(首次 create-paper)→redo(取标准答案，平铺 type5 子题与顶层 type6，按 cpaBotType 分流)→按实际题量停留→submit 全量→交卷后并发=3 AI 批改（cs=6 三级补全→best-of-N→aiCeiling）→exam-report 回查；硬排除冲刺模考；`10462203 时间太短` 自动延长 20s；单张失败不中断，结果落 `data/_workspace/<profile>/papers/batch_result_<日期>.json`；卷间停 4s。
- 用法：`node scripts/cdp/batch_redo_papers.js`（dry-run 预览）｜加 `--go` 实跑｜`--go 82174 82175 ...` 指定 paperId｜加 `--no-ai` 只交卷不做主观 AI 批改。
- 支持客观题（type 1/2）与主观题（type5 套 type6、顶层独立 type6，交卷后 AI 批改冲满分）；三态结果：✅严格满分 / 🟡平台最优（题库未配 AI 或 AI 判分上限，答案均已正确提交）/ ⏺已交卷未满分；交卷成功即 progress=1，未达平台最优单独标记可补批，不中断批量。

---

### `cdp/refresh_inventory.js` — 刷新作业基线（只读，不交卷）

| 项目 | 说明 |
|------|------|
| **用途** | 拉 syllabus 枚举全部 paper → 对每张基础卷只读 record 审计（满分/平台最优/非满分/未提交/未做）→ 已交卷但分低的用 `paper/analysis` 只读复核 `inspectSubmitted`：配了 AI 的题须判满、或 cs=6 且"我方答案归一化后≈标准答案"才计 AI 判分上限，未配 AI 不阻断，真答错仍判非满分 → 章节自然顺序写出 `papers_inventory.json`（全量）与 `papers_audit.json`（待做）；硬排除冲刺模考。批量开工前先跑它刷新基线，避免重复做已完成卷 |
| **用法** | `node scripts/cdp/refresh_inventory.js [--profile <key>]`（课程 ID/syllabus 读 profile，缺省税法；约 1–2 分钟，每张间隔 250ms 低频只读） |
| **可靠性** | ✅ 已实测；分类判据见 gaodun-exam-api.md §2.1/2.2/2.10 |
| **相关文档** | gaodun-exam-api.md §2.1、§2.2、§2.2.1、§2.10；判分上限方法论见 guides/flaky-ai-judging.md |

---

### `cdp/fetch_user_space_courses.js` — 拉用户空间全课程清单（开工前盘点，只读）

| 项目 | 说明 |
|------|------|
| **用途** | JWT 直连 `ep-course/.../space/vcourse/pc`，一次返回账号在各 project 下购买/开通的全部课程，提取 vcourseId/saasCourseId/subjectId/开课状态/到期等稳定字段。新开科目（如会计）开工前先跑它拿 saasCourseId（=做题链路 courseId），替代手工找 URL |
| **用法** | `node scripts/cdp/fetch_user_space_courses.js [--print]`；台账 `data/高顿/CPA/账号课程清单.json`（覆盖式、带 fetchedAt，不入库、随网盘备份），原始响应留 `data/_workspace/_account/user-space/user_space_vcourse_<ts>.json` |
| **可靠性** | ✅ 已实测（2026-09-07 拉到 CPA 8 门，会计 saasCourseId=42656）；JWT 过期需先在登录态抓一次带 authentication 的请求刷新 jsonl |
| **相关文档** | gaodun-exam-api.md §1.3、§2.11 |

---

### `cdp/load_profile.js` — 课程档案卡读取器（跨课复用基础件）

| 项目 | 说明 |
|------|------|
| **用途** | 读 `config/courses/<key>.json`，为所有 cdp 脚本提供 courseId(saas)/vcourseId/syllabusId/平台/章组/路径，替代脚本内硬编码；导出 `loadProfile()/primaryIds()/listProfiles()`；换课用参数或环境变量 `GAODUN_COURSE_PROFILE`，缺省回退税法 |
| **用法** | `const {loadProfile,primaryIds}=require('./load_profile')`；命令行自检 `node scripts/cdp/load_profile.js [key]` |
| **可靠性** | ✅ 已建并自检通过（税法/会计两卡、缺省回退、坏卡报错）；Python 版 `knowledge/course_profile.py`、shell 版 `course_config.sh` 同源 |
| **相关文档** | parallel-toolkit-design.md §3、config/courses/README.md |

---

### `cdp/collect_paper_sources.js` — papers 原料只读补采

| 项目 | 说明 |
|------|------|
| **用途** | 线 B 原料补采：把已交卷的 116 张基础卷的题面/选项/标准答案/官方解析/知识点标签/全站正确率，经只读接口 record→paper/analysis 逐张拉出并精简落盘，供末期知识库生成。**纯只读**：不 redo、不建实例、不交卷、不耗 AI 权益、无副作用 |
| **用法** | `node scripts/cdp/collect_paper_sources.js [--all] [paperId...]`（默认只补本地缺失卷，`--all` 强制重拉） |
| **可靠性** | ✅ 高（已采 116 套 / 1296 题）；产物 课程 `data/_workspace/<profile>/papers/<id>.json` + `data/_workspace/<profile>/manifest/paper_index.json`（不入库，物理集中、按讲视图见 papers_view.py） |
| **相关文档** | gaodun-exam-api.md、standards 2.2.4、SOP 步骤1 |

---

### `cdp/do_sprint_paper.js` — 冲刺模考 6 卷统一纯接口做卷入口（3 试卷 + 3 机考）

| 项目 | 说明 |
|------|------|
| **用途** | 冲刺模考专用：record→create/redo→submit→AI 批改（correct-ai/cpa）→exam-report 全接口闭环；客观题用 questionAnswer.answer、主观用 core 的 `cleanSubjectiveAnswer`（算式为主体+点拨精简为「依据：」+多小问分点，交卷与首次 AI 批改同版），按真实记分判定满分（aiPoints），cs=2 不再虚报满分 |
| **用法** | `node scripts/cdp/do_sprint_paper.js s1|s2|s3|m1|m2|m3`（兼容旧参数 1/2/3）；机考自动带 `origin=https://mock-cpa.gaodun.com`；结果落 `data/_workspace/<profile>/papers/exam_result_<paperId>_<ts>.json` |
| **6 卷映射** | s1/s2/s3=86722/86723/86724（glivepro 试卷）；m1/m2/m3=86726/86727/86728（mock-cpa 机考，与试卷同题） |
| **可靠性** | ✅ 高；免费可达最优=客观全对+AI 题尽量满，未配 AI 题（cpaBotType=0）须人工批改、本流程不购买 |
| **相关文档** | gaodun-exam-api.md、任务报告_冲刺模考* |

### `cdp/run_redo_all.sh` — 冲刺 6 卷批量重做入口（顺序跑、独立日志、末尾汇总）

| 项目 | 说明 |
|------|------|
| **用途** | 修复答案生成逻辑后对 6 卷批量重做补全答案；顺序 s1→s2→s3→m1→m2→m3（避免并发风控），每卷调 `do_sprint_paper.js`，末尾汇总各卷最新 exam_result 分数与 answerGaps |
| **用法** | `bash scripts/cdp/run_redo_all.sh`，日志 `logs/sprint_redo_all_<ts>.log`，建议后台 `nohup bash scripts/cdp/run_redo_all.sh > /tmp/redo.log 2>&1 &` |
| **验收线** | 6 卷全部 `answerGaps=0`（答案完整性校验门无缺口）、`objectiveAllRight=true`、`wrong=[]`、`failed=0` |
| **相关** | do_sprint_paper.js、gaodun_paper_core.js（cleanSubjectiveAnswer/pruneBasis/splitAskedBlocks/countAskedSubs）、exam-workflow.md §4.3.1 |

---

## 十一、飞书知识库同步（1个）

> 飞书同步现役脚本。同步以 `finalize-sop.md` 与 lark-cli（lark-wiki/lark-doc skill）为准。


---


---


---

### `sync_wiki_new.sh` — 新结构(课程根→14组→92知识点)同步飞书【现役】

| 项目 | 说明 |
|------|------|
| **用途** | 阶段④门禁现役脚本：按「课程根 → 14 组节点(写 README) → 组下 92 个知识点文档 + 课程全局篇」三层把本地知识详解同步到飞书知识库。断点续传（`logs/wiki_done/<标题>.done` 记 node_token/obj_token，`logs/wiki_node_map.tsv` 记标题→token），同名节点复用不重建，写入 3 次重试；正文经 stdin `cat f \| lark-cli docs +update --content -` 绕开 @file allowlist |
| **用法** | `bash scripts/sync_wiki_new.sh`（课程根/space_id/父节点已内置，换课时改脚本头部常量；可反复续跑） |
| **可靠性** | ✅ 高（已用于税法课 107/107：14 组+92 点+课程全局篇，回读逐组对平） |
| **相关文档** | finalize-sop.md、lark-wiki/lark-doc skill、long-task-supervisor-guide.md |

---


## 十二、知识详解生成（5个，位于 `scripts/knowledge/`）

> 按官方知识点聚合生成知识详解 md 的核心生产脚本。流程：collect_point_questions（按知识点收题）→ render_point_qa（渲染题答解析）→ organize_user_notes（整理学员补充）→ assemble_point（组装成篇）。

### `knowledge/course_profile.py` — 课程档案卡读取器（跨课复用基础件）

| 项目 | 说明 |
|------|------|
| **用途** | 读 `config/courses/<key>.json`，为 knowledge 脚本提供课程目录/章组名/科目信息，替代 `build_course_overview.py` 等脚本内硬编码；导出 `load_profile()/primary_ids()`；换课用参数或 `GAODUN_COURSE_PROFILE`，缺省回退税法 |
| **用法** | `from course_profile import load_profile`；命令行自检 `python3 scripts/knowledge/course_profile.py [key]` |
| **可靠性** | ✅ 已建并自检通过；Node 版 `cdp/load_profile.js`、shell 版 `course_config.sh` 同源 |
| **相关文档** | parallel-toolkit-design.md §3、config/courses/README.md |

---

### `knowledge/collect_point_questions.py` — 按知识点收集题目

| 项目 | 说明 |
|------|------|
| **用途** | 从 papers 原料中按官方知识点标签聚合题目，客观题取顶层、主观题下钻 subQuestionList 小问层 |
| **用法** | `python3 scripts/knowledge/collect_point_questions.py` |
| **可靠性** | ✅ 高（92 知识点全覆盖，含小问层知识点等价归一） |
| **相关文档** | ADR-012、knowledge-detail-build-sop.md |

---

### `knowledge/render_point_qa.py` — 题答解析渲染

| 项目 | 说明 |
|------|------|
| **用途** | 把收集到的题目渲染为「三、题答解析」节，客观题（答案+解析）与主观题（分点答案+点拨）两型；题量为 0 的分类整段不渲染（`if groups:` 保护） |
| **用法** | `python3 scripts/knowledge/render_point_qa.py` |
| **可靠性** | ✅ 高（已根治 0 空小节问题；与 assemble_point.py 的 if groups 逻辑对齐） |
| **相关文档** | ADR-012、KNOWLEDGE_BASE_TEMPLATE.md |

---

### `knowledge/organize_user_notes.py` — 用户笔记整理（四分类+去元数据）

| 项目 | 说明 |
|------|------|
| **用途** | 把原始用户笔记（含学员名/点赞数/日期）按四分类（记忆口诀/易错点辨析/解题技巧/知识补充）整理，每类按赞 Top5 筛选，输出纯知识内容（**不输出学员名/点赞数/用户ID/日期**，元数据仅保留在原始资料中用于溯源） |
| **用法** | `python3 scripts/knowledge/organize_user_notes.py`（课程目录/笔记目录默认读 profile，缺省税法，笔记取 `data/_workspace/<profile>/notes-raw/`；可用 `GAODUN_COURSE_PROFILE` 或 `COURSE_LOCAL_ROOT`/`USER_NOTES_RAW_DIR` 覆盖） |
| **可靠性** | ✅ 高（744 条覆盖 92 篇；已彻底移除元数据输出） |
| **相关文档** | ADR-013、collect_user_notes.js |

---

### `knowledge/assemble_point.py` — 知识点篇组装（四节合一）

| 项目 | 说明 |
|------|------|
| **用途** | 把知识拆解/考试指导/题答解析/学员补充四节组装为一篇知识点 md，写入课程「知识详解/」对应章节目录；`if groups:` 保护空分类不渲染 |
| **用法** | `python3 scripts/knowledge/assemble_point.py` |
| **可靠性** | ✅ 高（92 篇+2 全局篇，已用于税法课全量生成） |
| **相关文档** | ADR-012、knowledge-detail-build-sop.md |

---

## 十三、存量迁移工具（4个，位于 `scripts/migrate/`）

> 为税法课从旧「按讲端到端」结构迁移到新「三层解耦+按知识点聚合」结构而写的一次性工具。新课程不直接套用，通用化属「会计课开工前工具建设」另议。详见 `scripts/migrate/README.md`。

### `migrate/align_m0.py` — M0 存量对齐

| 项目 | 说明 |
|------|------|
| **用途** | 迁移前存量对齐：核对旧按讲目录与新三层结构的资源映射 |
| **用法** | `python3 scripts/migrate/align_m0.py` |
| **可靠性** | ⚠️ 一次性迁移工具，新课程不直接套用 |
| **相关文档** | scripts/migrate/README.md、ADR-012 |

---

### `migrate/build_course_manifest.py` — 构建课程 manifest

| 项目 | 说明 |
|------|------|
| **用途** | 从 syllabus 接口报文 + papers 生成 course-manifest.json（讲↔资源↔知识点完整映射），可 rebuild、可校验 |
| **用法** | `python3 scripts/migrate/build_course_manifest.py` |
| **可靠性** | ⚠️ 一次性工具、为税法课定制（硬编码课程路径、读当时 `data/cdp-sniff` 报文，该目录后经 ADR-016 上移为 `data/_workspace`），非通用生成器，新课程不直接套用 |
| **相关文档** | scripts/migrate/README.md、ADR-012 |

---

### `migrate/migrate_resources.py` — 资源迁移（旧按讲→新三层）

| 项目 | 说明 |
|------|------|
| **用途** | 把旧按讲目录中的 videos/notes/papers 迁移到新三层结构（原始资源/按类型分桶） |
| **用法** | `python3 scripts/migrate/migrate_resources.py` |
| **可靠性** | ⚠️ 一次性迁移工具 |
| **相关文档** | scripts/migrate/README.md、ADR-012 |

---

### `migrate/verify_migration.py` — 迁移总校验

| 项目 | 说明 |
|------|------|
| **用途** | 对照《存量迁移方案》验收清单逐项核验，全绿才判定迁移完成 |
| **用法** | `python3 scripts/migrate/verify_migration.py` |
| **可靠性** | ✅ 高（税法课迁移已全绿通过） |
| **相关文档** | scripts/migrate/README.md、ADR-012 |

---

## 十四、侦查 / PoC 网络采集（3个）

> 路线探索期脚本。现役浏览器链路是 `cdp/connectBrowser.js` 直连日常 Chrome（ADR-010）、现役接口侦查是第十类 cdp 脚本；下列为 PoC 备查与 Playwright 备用采集手段，**非生产链路**。

### `poc_persistent_browser.js` —【PoC】持久化专用 Chrome + 进程外抓包

| 项目 | 说明 |
|------|------|
| **用途** | 可行性验证：脚本自开浏览器/导航/抓包，无需 Extension 授权，独立 profile 存 `data/browser-profile/`，context.on 增量落 JSONL/HAR。**属未采用路线**：现役改走 cdp/connectBrowser 直连用户日常 Chrome 复用登录态，独立 profile 已删，本脚本仅留作路线备查 |
| **用法** | `node scripts/poc_persistent_browser.js`（POC_DURATION_MS 可改常驻时长） |
| **可靠性** | ⚠️ PoC 备查，非现役链路 |
| **相关文档** | ADR-010、browser-cdp-connect-guide.md |

---

### `capture_exam_net.js` — Playwright 网络钩子注入

| 项目 | 说明 |
|------|------|
| **用途** | 在考试页注入 fetch/XHR 网络钩子并 reload（使钩子先于页面脚本生效），把高顿业务请求/响应记录到 `window.__net`；默认只读采集，置 `__netBlockWrite=true` 可阻断写请求，用于"捕获交卷 payload 但不真正发送" |
| **用法** | `npx playwright cli -s=ga run-code scripts/capture_exam_net.js`（页面操作后用 dump_exam_net.js 导出） |
| **可靠性** | ⚠️ 中（备用采集手段；现役接口侦查走 cdp/ 第十类） |
| **相关文档** | gaodun-exam-api.md |

---

### `dump_exam_net.js` — 导出 window.__net 网络数据

| 项目 | 说明 |
|------|------|
| **用途** | 导出 capture_exam_net.js 记录在 `window.__net` 的全部网络数据为 JSON，Shell 侧重定向保存到 `data/`（不入库） |
| **用法** | `npx playwright cli -s=ga run-code scripts/dump_exam_net.js`；可选清空：`... eval "window.__net.length=0"` |
| **可靠性** | ⚠️ 中（与 capture_exam_net.js 配套） |
| **相关文档** | gaodun-exam-api.md |

---

## 脚本使用原则

1. **先查本文档再用脚本**：执行任务前，先在本文档中找到对应脚本，了解用途、用法、可靠性
2. **优先用脚本，不手动写命令**：已有脚本的功能，必须用脚本，不要手动写JavaScript或curl
3. **做题必须用脚本**：`cdp/api_do_paper.js`（单卷）/ `cdp/batch_redo_papers.js`（批量）/ `cdp/do_sprint_paper.js`（冲刺模考），纯接口主链路，禁止手动 UI 点选
4. **批量任务在iTerm中运行**：`batch_transcribe.sh`、`batch_ocr.sh`、`compress.sh`（批量模式）必须在iTerm中运行，不要后台运行
5. **新增脚本必须更新本文档**：新增脚本时，必须在本文档对应分类中添加说明（用途/用法/可靠性/相关文档）

---

## 维护规则

1. **新增脚本时**：在本文档对应分类中添加条目，说明用途、用法、可靠性、相关文档
2. **修改脚本时**：更新本文档中对应条目的用法和可靠性说明
3. **删除脚本时**：从本文档中移除条目，并检查是否有其他文档引用该脚本
4. **定期检查**：每次大阶段完成后，检查本文档与实际脚本是否一致（`ls scripts/` 对比）

---

*本文档是项目脚本的唯一权威索引，所有新增/修改/删除脚本时必须同步更新。*

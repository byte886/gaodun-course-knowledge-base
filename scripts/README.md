# 脚本索引（Scripts Reference）

> **文档类型**：Reference（参考资料 — 脚本说明）
> **更新频率**：新增/修改脚本时
> **维护者**：AI自动维护
> **读者**：AI代理（执行任务前查脚本用途）和人类（了解脚本功能）

本文档是项目所有脚本的完整索引，按功能分类。每个脚本说明用途、用法、可靠性、相关文档。

---

## 脚本总览（已登记 57 个，与 `scripts/` 磁盘文件一一对应）

| 分类 | 脚本数 | 说明 |
|------|--------|------|
| 做题自动化（旧·UI） | 3 | 单选题、多选题、交卷（UI 点选，接口链路的兜底） |
| 视频处理 | 7 | 单文件下载解密/压缩；CDP 抓 HLS key、单讲下载、分阶段下载/压缩与总控（scripts/cdp/） |
| 音频转写 | 6 | 单文件、批量、队列并发、单讲 worker、环境搭建 |
| OCR文字提取 | 3 | 单目录批量 OCR、全课程批量、OCR 完整性复核（scripts/ocr/） |
| 百度网盘上传 | 4 | 单文件上传、批量上传、课程上传、整课程并发同步 |
| 环境与工具 | 5 | Playwright连接、密钥管理、数据符号链接、pre-commit、通用阶段完成监听 |
| 检查与验证 | 7 | 目录/知识库结构、命名一致性、Git 卫生、讲次映射校验、papers 按讲视图、课程库逐讲体检 |
| 数据采集 | 2 | 按键捕获、解析采集 |
| 浏览器CDP连接 | 3 | 日常Chrome连接、授权自动点、网络抓包骨架（scripts/cdp/） |
| 高顿做题接口链路 | 11 | 只读侦查、抓大纲/取题、UI对照、纯接口做卷与批量补做、papers 原料只读补采（scripts/cdp/） |
| 飞书知识库同步 | 3 | 批量同步建节点、节点内容更新两版 |
| 侦查/PoC 网络采集 | 3 | 持久化浏览器 PoC、Playwright 网络钩子注入与导出（备用/备查路线） |

> **全量对齐（2026-09-04）**：历史脚本已一次性补登完毕，上表 57 个与 `scripts/`（顶层 + `cdp/` + `ocr/` 子目录）磁盘文件一一对应。新增脚本必须按文末「维护规则」同步登记，并定期用 `ls scripts/ scripts/cdp scripts/ocr` 核对，避免再次出现"在跑但没上台账"。

---

## 一、做题自动化（3个）

### `answer_option.sh` — 单选题选项点击

| 项目 | 说明 |
|------|------|
| **用途** | 点击单选题的单个选项（A/B/C/D） |
| **用法** | `bash scripts/answer_option.sh C` |
| **可靠性** | ✅ 高（已验证，JavaScript直接点击，不依赖ref） |
| **相关文档** | `docs/development/guides/exam-workflow.md` |

**原理**：通过文本内容匹配选项元素，使用 `element.click()` 直接点击。过滤条件：文本精确匹配、元素可见、top>150（排除导航）、尺寸合理。

---

### `answer_multi.sh` — 多选题选项点击

| 项目 | 说明 |
|------|------|
| **用途** | 点击多选题的多个选项（可传多个参数） |
| **用法** | `bash scripts/answer_multi.sh A B D` |
| **可靠性** | ✅ 高（已验证，解决了ref失效问题） |
| **相关文档** | `docs/development/guides/exam-workflow.md` |

**注意**：多选题点击后不会自动跳题，需要手动点击"下一题"。

---

### `submit_exam.sh` — 交卷并查看成绩

| 项目 | 说明 |
|------|------|
| **用途** | 点击交卷按钮，等待成绩页面加载 |
| **用法** | `bash scripts/submit_exam.sh` |
| **可靠性** | ✅ 高（已验证） |
| **相关文档** | `docs/development/guides/exam-workflow.md` |

**注意**：交卷前必须检查所有题目已作答（打开答题卡确认无未做题）。

---

## 二、视频处理（7个）

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
| **用法** | `node scripts/cdp/fetch_lecture_video.js <idx>`（idx=课程表下标，idx1=开班前缀00） |
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

## 三、音频转写（6个）

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

### `transcribe_parallel.sh` — 队列式多进程并发转写

| 项目 | 说明 |
|------|------|
| **用途** | 待转讲列表写入队列文件，N 个 worker 用 flock 互斥取第一个空闲任务、做完再取（哪个 worker 快就多处理，天然负载均衡），失败讲自动写回队尾重试；单进程实测约占 2 核/3.3GB，本机 20 线程默认并发 6（约 12 核，留余量给 IO/系统） |
| **用法** | `bash scripts/transcribe_parallel.sh [并发数N]`（默认 6） |
| **可靠性** | ✅ 高（动态调度，优于固定分片） |
| **相关文档** | WORKFLOW「多任务并发调度」、ADR-003 |

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

## 五、百度网盘上传（4个）

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

## 六、环境与工具（5个）

### `playwright_connect.sh` — Playwright连接恢复

| 项目 | 说明 |
|------|------|
| **用途** | 检查Playwright连接状态，失败时自动刷新Token并重连 |
| **用法** | `bash scripts/playwright_connect.sh` |
| **可靠性** | ✅ 高（已验证，自动恢复流程） |
| **相关文档** | `docs/development/tools/playwright-cli-guide.md` 第4节 |

**注意**：连接失败时先运行此脚本自动恢复，**禁止直接要求用户手动操作**。

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
| **用途** | 检查本地知识库文档结构是否符合规范（知识拆解.md + 考试指导.md） |
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

### `verify_lecture_map.py` — 讲次课件映射校验 / 重建

| 项目 | 说明 |
|------|------|
| **用途** | 校验 `knowledge-base/lecture-resource-map.json`（ADR-011 跨讲取料路由表）与课程库磁盘一致：结构完整（每讲有条目）、map 逻辑路径在真实目录存在、磁盘标准件反向被 map 收录、`讲义_/课件_` 旧命名件列 legacy；`--rebuild` 保留各讲「课件来源讲次」按磁盘重建文件清单写回 |
| **用法** | `python3 scripts/verify_lecture_map.py`（只校验，不一致退出 1）；加 `--rebuild` 重建写回；`--course-root PATH` 指定课程 |
| **可靠性** | ✅ 高（讲00/01 去重后复验 legacy=0、退出 0；幂等；自动选含 NN_ 目录最多的课程、避开空占位课程） |
| **相关文档** | ADR-011、standards 2.2、`lecture-knowledge-build-sop.md` 步骤0 |

---

### `papers_view.py` — papers 题源按讲只读视图

| 项目 | 说明 |
|------|------|
| **用途** | 遵循 standards 2.2.4「物理集中存、逻辑按讲视图」，由 `paper_index.json` 的 chapter 字段现场 group by 出「每讲几套卷 / 多少题 / paperId」；只读，不落盘、不生成第二份物理副本 |
| **用法** | `python3 scripts/papers_view.py`（全讲概览）；`--lecture 01` 或 `--lecture 增值税`（讲号/关键词）；`--json`（结构化输出供脚本消费） |
| **可靠性** | ✅ 高（实测 34 讲 / 116 套 / 1296 题；chapter 前导空格自动 strip） |
| **相关文档** | standards 2.2.4、ADR-011 |

---

### `check_course_lib.py` — 课程库逐讲标准构成体检（只读）

| 项目 | 说明 |
|------|------|
| **用途** | 逐讲查标准构成与污染：A 线三件套（video.mp4/transcript.md/transcript.json）缺失、PDF 与 OCR 不成对、`讲义_/课件_` 旧命名 legacy、过程文件误入（*.log/*.tmp/*.done/VERIFICATION/SYNC/验证* 等）、未知子目录、docs 内杂项、空讲目录。与 verify_lecture_map 分工：后者管「跨讲取料路由」、本脚本管「单讲自身构成」 |
| **用法** | `python3 scripts/check_course_lib.py`（发现问题退出 1、全干净 0）；`--course-root PATH` 指定课程 |
| **可靠性** | ✅ 高（真实 39 讲全绿退出 0；/tmp 问题夹具 6 类问题全捕获退出 1） |
| **相关文档** | standards 2.2、ADR-011 |

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

## 九、浏览器 CDP 连接（3个，位于 `scripts/cdp/`）

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

### `cdp/sniff_demo.js` — 网络抓包骨架

| 项目 | 说明 |
|------|------|
| **用途** | attach 指定 URL 标签，监听请求/响应（XHR/fetch 取 body），过滤静态噪音，落 JSONL 到 `data/cdp-sniff/`（不入库） |
| **用法** | `node scripts/cdp/sniff_demo.js [URL关键词] [秒数] [--reload]`，如 `node scripts/cdp/sniff_demo.js gaodun 20` |
| **可靠性** | ✅ 高（百度页实测 93 请求、记录 57 条）；真实高顿接口待抓 |
| **相关文档** | `docs/development/tools/browser-cdp-connect-guide.md` |

---

## 十、高顿做题接口链路（11个，位于 `scripts/cdp/`）

> 「接口为主、UI 兜底」的侦查与验证脚本，契约见 [高顿作业接口档案](../docs/development/api/gaodun-exam-api.md)，过程见《任务报告_做题接口侦查与纯接口闭环验证_2026-09-02》。报文落 `data/cdp-sniff/`（不入库）。除 `answer_submit_capture.js` 走 UI 交卷外，其余只读或纯接口。

### `cdp/probe_exam_entry.js` — 只读列课程表做题/考试入口

| 项目 | 说明 |
|------|------|
| **用途** | 解析 class-schedule 页，区分可重做知识点卷（button.ant-btn-link「重新做题」）与正式/模考卷，避免误点 |
| **用法** | `node scripts/cdp/probe_exam_entry.js` |
| **可靠性** | ✅ 高（只读，不点击、不进卷） |
| **相关文档** | gaodun-exam-api.md §2.1 |

---

### `cdp/probe_quiz_dom.js` — 只读探做题页 DOM/iframe

| 项目 | 说明 |
|------|------|
| **用途** | 确认做题页无 iframe、选项为 `div.sub-tiku__question-select-item`、逐题分页、交卷/确认按钮结构 |
| **用法** | `node scripts/cdp/probe_quiz_dom.js`（需已打开一张做题标签） |
| **可靠性** | ✅ 高（只读） |
| **相关文档** | gaodun-exam-api.md §0 |

---

### `cdp/capture_quiz_load.js` — 进卷抓 redo-paper

| 项目 | 说明 |
|------|------|
| **用途** | 在课程表精准点指定可重做卷（最小单卷容器判卷、拒绝正式卷），监听新标签加载期请求/响应落 JSONL |
| **用法** | `node scripts/cdp/capture_quiz_load.js [卡片关键字=计税依据] [等待秒=14]` |
| **可靠性** | ✅ 高（已两次稳定抓到完整 redo-paper） |
| **相关文档** | gaodun-exam-api.md §2.3 |

---

### `cdp/capture_schedule_list.js` — 抓 syllabus 全量大纲

| 项目 | 说明 |
|------|------|
| **用途** | reload 课程表+滚动触发懒加载，抓课程大纲接口（枚举全部作业入口），标注含 paperId/resourceId 的响应 |
| **用法** | `node scripts/cdp/capture_schedule_list.js` |
| **可靠性** | ✅ 高（单接口返回 119 张卷、无分页；大响应上限已设 4MB 防截断） |
| **相关文档** | gaodun-exam-api.md §2.1 |

---

### `cdp/answer_submit_capture.js` — UI 作答+交卷抓包（对照实验）

| 项目 | 说明 |
|------|------|
| **用途** | 实时取 redo-paper 答案后用 UI 逐题点选并交卷，抓 submit-question/submit-paper/exam-report；用于定位 UI 路线不稳根因 |
| **用法** | `node scripts/cdp/answer_submit_capture.js [卡片关键字=计税依据]`（**会真实交一次可重做卷**） |
| **可靠性** | ⚠️ 仅实验用：UI 题序/时序问题会导致错位（实测 1/6），生产走纯接口 |
| **相关文档** | 任务报告 §4 |

---

### `cdp/api_submit_test.js` — 6 题卷纯接口闭环验证

| 项目 | 说明 |
|------|------|
| **用途** | 不做任何 UI 点选，Node 直连 record→redo-paper→submit-paper→exam-report，验证纯接口满分与「最小作答时长」风控 |
| **用法** | `node scripts/cdp/api_submit_test.js`（JWT 从最近抓包自动提取；会真实交一次可重做卷） |
| **可靠性** | ✅ 验证通过（6/6）；通用场景用 `api_do_paper.js` |
| **相关文档** | gaodun-exam-api.md §2.5、任务报告 §5 |

---

### `cdp/gaodun_paper_core.js` — 纯接口做卷共享核心（客观 + type5/6 主观）

| 项目 | 说明 |
|------|------|
| **用途** | 被 `api_do_paper.js`/`batch_redo_papers.js` 复用：record→(首次先 create-paper)→redo→平铺答案（type5 父题不答、平铺其 type6 子题；顶层独立 type6 同样处理）→按 `aiCorrect.cpaBotType` 分流（=3 进 AI 批改、=0 未配 AI 只交答案）→最小停留→submit 全量交卷→交卷后并发=3 逐题 correct-ai/cpa：cs=6 走「canon+qual / full / AI 未命中点」三级补全 → best-of-N×4 原样重取 → 仍不满且答案=标准答案则归 aiCeiling→exam-report 两层核对（fullScore / platformDone）。导出 `doPaperViaApi/buildUserAnswers/canonAnswer/qualitativeAnswer/findJwt` 等 |
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

- 只读枚举 `papers_inventory.json`+`papers_audit.json` 中「非满分且非冲刺」的卷，逐张交 gaodun_paper_core：record→(首次 create-paper)→redo(取标准答案，平铺 type5 子题与顶层 type6，按 cpaBotType 分流)→按实际题量停留→submit 全量→交卷后并发=3 AI 批改（cs=6 三级补全→best-of-N→aiCeiling）→exam-report 回查；硬排除冲刺模考；`10462203 时间太短` 自动延长 20s；单张失败不中断，结果落 `data/cdp-sniff/batch_result_<日期>.json`；卷间停 4s。
- 用法：`node scripts/cdp/batch_redo_papers.js`（dry-run 预览）｜加 `--go` 实跑｜`--go 82174 82175 ...` 指定 paperId｜加 `--no-ai` 只交卷不做主观 AI 批改。
- 支持客观题（type 1/2）与主观题（type5 套 type6、顶层独立 type6，交卷后 AI 批改冲满分）；三态结果：✅严格满分 / 🟡平台最优（题库未配 AI 或 AI 判分上限，答案均已正确提交）/ ⏺已交卷未满分；交卷成功即 progress=1，未达平台最优单独标记可补批，不中断批量。

---

### `cdp/refresh_inventory.js` — 刷新作业基线（只读，不交卷）

| 项目 | 说明 |
|------|------|
| **用途** | 拉 syllabus 枚举全部 paper → 对每张基础卷只读 record 审计（满分/平台最优/非满分/未提交/未做）→ 已交卷但分低的用 `paper/analysis` 只读复核 `inspectSubmitted`：配了 AI 的题须判满、或 cs=6 且"我方答案归一化后≈标准答案"才计 AI 判分上限，未配 AI 不阻断，真答错仍判非满分 → 章节自然顺序写出 `papers_inventory.json`（全量）与 `papers_audit.json`（待做）；硬排除冲刺模考。批量开工前先跑它刷新基线，避免重复做已完成卷 |
| **用法** | `node scripts/cdp/refresh_inventory.js`（约 1–2 分钟，每张间隔 250ms 低频只读） |
| **可靠性** | ✅ 已实测；分类判据见 gaodun-exam-api.md §2.1/2.2/2.10 |
| **相关文档** | gaodun-exam-api.md §2.1、§2.2、§2.2.1、§2.10；判分上限方法论见 guides/flaky-ai-judging.md |

---

### `cdp/collect_paper_sources.js` — papers 原料只读补采

| 项目 | 说明 |
|------|------|
| **用途** | 线 B 原料补采：把已交卷的 116 张基础卷的题面/选项/标准答案/官方解析/知识点标签/全站正确率，经只读接口 record→paper/analysis 逐张拉出并精简落盘，供末期知识库生成。**纯只读**：不 redo、不建实例、不交卷、不耗 AI 权益、无副作用 |
| **用法** | `node scripts/cdp/collect_paper_sources.js [--all] [paperId...]`（默认只补本地缺失卷，`--all` 强制重拉） |
| **可靠性** | ✅ 高（已采 116 套 / 1296 题）；产物 `data/knowledge-source/papers/<id>.json` + `paper_index.json`（不入库，物理集中、按讲视图见 papers_view.py） |
| **相关文档** | gaodun-exam-api.md、standards 2.2.4、SOP 步骤1 |

---

## 十一、飞书知识库同步（3个）

> 旧 15 章时期的批量同步脚本。34 讲重建的飞书同步以 `lecture-knowledge-build-sop.md` 步骤7 与 lark-cli（lark-wiki/lark-doc skill）为准；下列脚本保留用于批量场景，使用前先核对与现行节点结构是否一致。

### `sync_wiki.sh` — 批量同步知识库到飞书（建节点）

| 项目 | 说明 |
|------|------|
| **用途** | 按章号区间，批量把本地 organized-content 同步为飞书 wiki 节点 |
| **用法** | `bash scripts/sync_wiki.sh <起始章号> <结束章号>`，如 `bash scripts/sync_wiki.sh 04 15` |
| **可靠性** | ⚠️ 中（旧 15 章结构，34 讲用前先核对） |
| **相关文档** | WORKFLOW 步骤8、lark-wiki/lark-doc skill |

---

### `update_wiki_content.sh` — 更新飞书节点内容（旧版）

| 项目 | 说明 |
|------|------|
| **用途** | 节点已创建时，按章号区间只更新节点正文内容 |
| **用法** | `bash scripts/update_wiki_content.sh <起始章号> <结束章号>` |
| **可靠性** | ⚠️ 中（旧版，保留备查；更健壮版本见 update_wiki_v2.sh） |
| **相关文档** | WORKFLOW 步骤8 |

---

### `update_wiki_v2.sh` — 批量更新飞书节点内容（v2）

| 项目 | 说明 |
|------|------|
| **用途** | v2 更健壮版本，批量更新已建飞书节点的正文 |
| **用法** | `bash scripts/update_wiki_v2.sh <起始章号> <结束章号>` |
| **可靠性** | ⚠️ 中（34 讲同步优先按 SOP / lark-cli） |
| **相关文档** | WORKFLOW 步骤8 |

---

## 十二、侦查 / PoC 网络采集（3个）

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
3. **做题必须用脚本**：`answer_option.sh` / `answer_multi.sh` / `submit_exam.sh`，禁止手动写ref点击
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

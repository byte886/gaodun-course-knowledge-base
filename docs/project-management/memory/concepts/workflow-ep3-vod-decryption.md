---
type: Workflow
title: 名师课 ep3 视频取流解密与平台字幕链路
description: 名师专业课（ep3/epiphany，saasCourseType=13）区别于正课 glive(16)：讲次叶子枚举→getVideoInfo 取 videoId→live/resource 取 FHD m3u8 与平台 VTT 字幕→CDP 真实播放页 Worker 边界截 AES key（32hex 前16字符 ASCII，非 hex 解码）→本地 aes-128-cbc 解密；平台自带 VTT 字幕免转写，正式一律 1080P。
tags: [ep3, epiphany, video, hls, aes, cdp, vtt, subtitle, workflow, mingshi]
sources:
  - id: adr-018
    resource: ../../decisions/ADR-018-名师课ep3取流解密平台路由与平台字幕替代转写.md
    title: ADR-018 名师课 ep3 取流解密、平台路由与平台字幕替代转写
  - id: adr-010
    resource: ../../decisions/ADR-010-浏览器自动化连接通道与技术栈选型.md
    title: ADR-010 浏览器自动化连接通道与技术栈选型
  - id: video-processing
    resource: ../../../development/tools/video-processing.md
    title: 视频处理详细指南（ep3 小节）
generated: { by: "doubao/okf-wiki", at: "2026-09-09T15:10:00+08:00" }
status: stable
---

# 名师课 ep3 视频取流解密与平台字幕链路

## 一句话结论
账号下两套平台分流：**正课 glive（saasCourseType=16）走旧链**（见 [视频压缩与转写](workflow-video-transcription.md)）；**名师课 ep3/epiphany（saasCourseType=13）走本链路**——讲次枚举 → getVideoInfo 拿 videoId → live/resource 拿 **FHD(1080P)** m3u8 和**平台 VTT 字幕** → CDP 真实播放页在 Worker 边界截 AES key → 复用 download_decrypt 本地解密、ffmpeg `-c copy` 出 mp4；**平台自带 VTT 字幕，ep3 不做 FunASR 转写**。决策依据见 [ADR-018](../../decisions/ADR-018-名师课ep3取流解密平台路由与平台字幕替代转写.md)。

## 平台路由与接口（网关前缀 apigateway.gaodun.com）
- 只读/取流只需 `makeHeaders(jwt)` + `Referer=https://epiphany.gaodun.com/`，**不需要 x_gdssid、不需要 cookie**。
- **讲次枚举**：`/ep-study/front/course/<cid>/syllabus?gradation_id=<g>&syllabus_id=<s>`；章节树在 grad 节点的 `g.syllabus`（全面精讲）或 `g.children`（基础必修），递归到**带 `resource_id` 且无 children 的叶子**（叶子 id=csItemId，路径上首个带 `cs_item_ids/video_total` 的节点 id=chapterId）。
- **getVideoInfo**：`/ep-study/api/v1/front/resource/<rid>?courseId=<cid>&csItemId=<cs>&syllabusId=<sid>&is_show_live=0&isRelatedResource=1`，**四个上下文参数缺一不可**（缺报 10161000）。videoId 取 `result.resource.video_id`（= `sewise.source_id`）；**顶层 `sewise_source_id` 恒为 null 是废弃字段，禁用**；`discriminator==='video'` 判定视频讲次。
- **取流**：`/glive2-vod/api/v1/live/resource?code=<videoId>&res=SD|HD|FHD&lang=zh`，返回各档 m3u8、`result.subtitle`（VTT URL）、duration、encrypt。

## ★ 取 key：唯一可行路线（纯 node / 逆向 wasm 均已证死路）
- **不要**离线复现 `authorize`（各种 bellard/Origin/header/cookie 组合全 `40301`，页面 fetch 被 CORS 拦），**不要**逆向 gdcrypto.wasm（卡在 `__wbindgen_malloc`）。
- 正解（CDP 复用日常 Chrome，见 [浏览器 CDP](workflow-browser-cdp.md)、ADR-010）：打开 learning 播放页 → reload 前 hook `window.Worker` 双向消息 → ep3 调 **`window.gp.play()` 让视频真播**（`gp.video` 在 closed shadow DOM，querySelector 取不到但 `gp.video` 可用；DOM `.click()` 对播放键无效）→ 截主线程回传 `{id,response:Uint8Array(32)}`。
- **AES key 形态（反直觉，易错）**：32 个十六进制字符的**前 16 个字符的 ASCII 字节**（**不是**把 32 串 hex 解码）；IV = m3u8 `IV=0x<32hex>` 的 **hex 解码 16 字节**；算法 `aes-128-cbc` + **`setAutoPadding(false)`**。
- **三档清晰度各有独立 transcodeId → 各有独立 m3u8/key**（subtitle 三档相同、唯一）。正式一律 **FHD-1080P**；切清晰度点 `.gp-setting-quality-item` 含"1080"项（DOM 与 glive 一致），一次播放可同时抓 SD+FHD。key 由 transcodeId 固定、可按 `videoId:res` 缓存，但跨视频不同、每视频取一次（约 26–30s）。

## 平台 VTT 字幕替代本地转写（仅 ep3）
- `live/resource` 的 `result.subtitle` 是完整 VTT URL（域名 video-resource.gaodun.com），**免认证** GET 即标准 WebVTT；抽查不同 encrypt_type/时长视频 100% 有字幕。播放器"字幕开关"只控 UI，与接口取 URL 无关。
- **ep3 不做 FunASR**（省 314.1h 转写工时）；正课 glive 无平台字幕，仍走 FunASR（[视频压缩与转写](workflow-video-transcription.md)），两线并存。
- 产物：`subtitle.vtt`（**原始稿，属原始资源、原样保留**）+ `transcript.md`（去时间轴/相邻去重/200–400 字饱满分段，格式 `# video` + `> 平台字幕(VTT，免转写)|时长|约N字` + `## 第N段`，对齐正课）。

## 脚本与边界
- 薄编排 `scripts/cdp/ep3_download_videos.js`（`--list`/`--learning-url`/批量；默认 FHD；断点续跑、单讲失败不中断、双老师文件名前缀），取 key 复用 `scripts/cdp/capture_video_key.js`（输出**顶层数组** `[{quality,m3u8,keyAscii}]`），解密零改动复用 `scripts/download_decrypt.js`，ffmpeg `-c copy`（FHD 分片本就是 h264/aac，不再重压）。
- 每讲目录 `<NN_讲名>/{video.mp4(1080P),subtitle.vtt,transcript.md,meta.json}`，临时 `_work` 用完即清；成品归课程库"原始资源"（正式落位归 EP3-06）。
- 错误码：553649434=token 失效（须硬证据，见 [故障排查先验顺序](standard-debugging-first-principles.md)）；10161000=getVideoInfo 缺参数；40301=离线取 key 死路、必须走 CDP 播放。
- 完整探路实测（含每轮证据）在过程件 `data/_workspace/_account/ep3-platform-probe.md`（不入库）；平台适配器抽象与其余 5 科推广是 EP3-06（L1）。

## 来源与下钻
- [ADR-018 名师课 ep3 取流解密、平台路由与平台字幕替代转写](../../decisions/ADR-018-名师课ep3取流解密平台路由与平台字幕替代转写.md)
- [ADR-010 浏览器自动化连接通道与技术栈选型](../../decisions/ADR-010-浏览器自动化连接通道与技术栈选型.md)
- [视频处理详细指南（ep3 小节）](../../../development/tools/video-processing.md)
- 关联链路：[浏览器自动化连接通道](workflow-browser-cdp.md)、[视频压缩与音频转写链路（正课）](workflow-video-transcription.md)、[课程 profile 与多课程 ID 对照](reference-course-profiles.md)

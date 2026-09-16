---
type: Workflow
title: 名师课网盘 hevc 整科门控覆盖同步与终态核验
description: 压好的 hevc 上百度网盘替换早期 h264 备份，核心是"整科门控"——一门课全部视频 ffprobe 非 hevc 计数=0 且压缩进程结束才传该科，压缩在跑绝不探测/上传（ready_filter 只挑完整讲、不判编码，编码门在总管/看门侧）；首次 hevc 上传前删该 profile netdisk_done 下非 notes__ 的视频 done（保留讲义标记），rtype=3 同名覆盖、每科一次（.videoreset）；两台各自上传、讲并发 1 + BAIDU_UPLOAD_RATE=1000k（加总≤2MB/s 不占满上行）；网盘真实状态以 verify_netdisk_final.py 递归比对集合+字节大小为准、不信 done，网盘不能 ffprobe，靠"本地 hevc 小 vs 网盘 h264 大"的大小不一致识别旧版。
tags: [netdisk, baidu, hevc, h264, rtype3, done, gate, verify, rate-limit, upload, workflow, mingshi]
sources:
  - id: adr-022
    resource: ../../decisions/ADR-022-名师课双机并行H265重压与整科门控网盘覆盖.md
    title: ADR-022 双机并行 H.265 重压与整科门控网盘覆盖
  - id: adr-020
    resource: ../../decisions/ADR-020-课程存储去课程库层与网盘会计知识库分库及百度沙箱根名不可改.md
    title: ADR-020 网盘分库与沙箱根名不可改
  - id: netdisk-setup
    resource: ../../../development/api/netdisk-setup.md
    title: 百度网盘开放平台 API 文档（OAuth/rtype/错误码）
  - id: finalize-sop
    resource: ../../../development/guides/finalize-sop.md
    title: 阶段④收尾 SOP（步骤1 网盘备份：hevc 整科门控覆盖与双机限速）
  - id: netdisk-verify-sop
    resource: ../../../development/guides/netdisk-final-verification-sop.md
    title: 课程 finalize 终态检查 SOP（网盘终态核验、大小判旧版）
generated: { by: "doubao/okf-wiki", at: "2026-09-16T23:10:00+08:00" }
status: stable
---

# 名师课网盘 hevc 整科门控覆盖同步与终态核验

## 一句话结论

**一门课 100% 压成 hevc 且压缩进程结束后，才整科上传百度网盘、同名覆盖早期 h264**；上传前清掉该科的视频 done 标记强制重传、固定 `rtype=3`，两台各自限速并发 1；**是否真的传成 hevc 只认 `verify_netdisk_final.py` 终态核验、不信 done 标记**。决策见 [ADR-022](../../decisions/ADR-022-名师课双机并行H265重压与整科门控网盘覆盖.md)，门控/覆盖操作见 [finalize-sop.md](../../../development/guides/finalize-sop.md) 步骤 1、终态核验见 [netdisk-final-verification-sop.md](../../../development/guides/netdisk-final-verification-sop.md)，网盘 API/rtype 见 [netdisk-setup.md](../../../development/api/netdisk-setup.md)。

## 整科门控（防 h264 混传，最重要）

- 启动某科视频上传的充要条件：**该科全部 `*_video.mp4` 经 ffprobe 为 hevc（非 hevc 计数=0）且无压缩进程在跑**。压缩在跑时绝不探测/上传该科——压几讲传几讲会让网盘同科 h264/hevc 混杂。
- `scripts/sync_ep3_ready.sh <profile> 1 videos` 的 ready_filter 只挑"完整讲"（每个 `*_meta.json` 有对应非空 `*_video.mp4`）、**不判编码**；所以编码门控必须在调用方（本机 `ep3_local_supervisor.sh`、目标机 `target_netdisk_watch.sh`）实现，不能指望 sync 脚本。
- 链路：`sync_ep3_ready.sh`（读 config 的 localRoot/remoteRoot、挑完整讲）→ `sync_course_netdisk.sh`（xargs -P 并发派生 upload_one）→ `upload_course.sh`（讲内串行逐文件，过滤 transcript.json/*.tmp/*.log/.DS_Store）→ `baidu_upload.py`（precreate/upload/create，分片串行、MD5 秒传、固定 rtype=3）。

## hevc 覆盖早期 h264：清视频 done + rtype=3

- 早期已传过一轮 h264 并留有 done 标记，sync 见 done 会跳过 → 网盘残留 h264。
- 某科全 hevc **首次**上传前跑 `reset_videos_done_once`：删 `data/_workspace/<profile>/logs/netdisk_done/` 下所有**非 `notes__` 前缀**的 `.done`（视频标记），**保留 `notes__` 讲义标记**；每科只清一次，用标志 `data/_workspace/_account/ep3/supervisor/<prof>.videoreset`（目标机在 `netdisk_watch/`）。
- done 文件名前缀是**阶段名**（如"全面精讲"），不是字面"videos"；只有讲义那次前缀是 `notes__`。
- 覆盖靠 `rtype=3`（precreate/create 两步都传，见 netdisk-setup 的 rtype 表）；`ondup` 对上传三步无效，误传会静默产生 `_时间戳` 改名副本。

## 双机各自限速

- 两台分别上传自己负责的科目（目标机会计/财管的 done、看门在目标机本地），互不等待。
- 每台**讲并发=1**、`BAIDU_UPLOAD_RATE=1000k`（只给分片 curl 加 `--limit-rate`，list/mkdir 小请求不限），两台加总 ≤2MB/s，不占满上行、不挤其它应用（用户硬约束）。

## 终态核验：只认 verify、不信 done

- done 只证明"某次上传动作完成"，不证明网盘当前是 hevc。权威核验：`BAIDU_ENC_PASS=… python3 scripts/verify_netdisk_final.py <本地课程根> <网盘课程根>`（递归比对目录/文件集合与**字节大小**，rc=0 才完全一致），`scripts/netdisk_verify_summary.py <核验日志...>` 分类汇总（讲义缺/不一致、视频缺、视频大小不一致、其中网盘是旧大版、缺讲目录、垃圾分片）。
- 网盘文件无法 ffprobe；识别网盘残留 h264 靠大小——本地 hevc 显著小于 h264（实测样本约 1/13），核验"大小不一致且网盘更大（旧大版）"即需 reset 后覆盖重传。
- 已验证：审计 257、战略 129 全 hevc 上云，2026-09-16 核验 rc=0、视频 0 缺/0 大小不一致/0 旧大版。

## 踩坑（勿重犯）

- `sync_course_netdisk.sh` 无论成败都固定打印"失败讲（无 done 标记且本次匹配）:"标题；**真正失败行才是行首恰好 3 空格 + `- `**。判定成功要 `grep -q "本轮结束" && ! grep -qE '^[[:space:]]{3}- '`；只 grep"失败讲"标题恒为假，会导致总管每轮空转重拉、永不 mark_done、并卡死后续科目上传。
- xargs 父 bash 被杀后，上传子进程成**孤儿被 launchd 收养继续派生**。清理分层：①杀顶层 sync_ep3_ready/sync_course →②按 upload_one 匹配杀孤儿 xargs 与 `bash -c` →③杀 upload_course/baidu_upload →④`pgrep -x curl`；全程用进程组 PGID 排除当前 shell 防自匹配，连续两轮计数 0 才算根除。禁 `pkill -f`（会匹配自身命令行自杀）。
- **自动上传清单要覆盖全部负责科目**：本机总管循环曾只列审计/税法/经济法而漏了战略，战略实际靠 2026-09-15 一次性补传传齐 hevc（终态核验零差异）；新增/调整负责科目时必须同步进自动覆盖清单，不能依赖人工补传。
- 网盘沙箱根 `/apps/CPA课程归档` 名与授权绑定、禁止 API 改名（ADR-020）；凭证 `.secrets/baidu_credentials.enc` 用 `BAIDU_ENC_PASS` 解密、不入库。

## 来源与下钻

- [ADR-022 双机并行 H.265 重压与整科门控网盘覆盖](../../decisions/ADR-022-名师课双机并行H265重压与整科门控网盘覆盖.md)
- [ADR-020 网盘分库与沙箱根名不可改](../../decisions/ADR-020-课程存储去课程库层与网盘会计知识库分库及百度沙箱根名不可改.md)
- [百度网盘开放平台 API 文档](../../../development/api/netdisk-setup.md)（OAuth、rtype、错误码、限速实现）
- [阶段④收尾 SOP · 步骤1 网盘备份](../../../development/guides/finalize-sop.md)（hevc 整科门控覆盖、清 done、双机限速、失败判定）
- [课程 finalize 终态检查 SOP](../../../development/guides/netdisk-final-verification-sop.md)（verify_netdisk_final、大小判旧版、补传）
- 关联：[双机 H.265 重压与保活](workflow-video-hevc-compression.md)（门控的上游）、[四地存储分工](architecture-storage-layout.md)

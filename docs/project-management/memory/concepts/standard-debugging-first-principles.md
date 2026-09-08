---
type: Standard
title: 故障排查先验顺序——先怀疑自己，凭证最后怀疑
description: 自动化任务失败九成以上是 AI/脚本自身问题（端点/参数/ID/文件选取/最近改动），真正 token 失效不到一成；排查按自身→环境→凭证硬证据→交用户的顺序，判定 token 失效必须有只读请求返回登录超时码，请求用户登录是最后手段。
tags: [debugging, 排查, token, 先验概率, 凭证, standard]
sources:
  - id: debugging-playbook
    resource: ../../../development/guides/debugging-and-collaboration.md
    title: 问题排查与人机协作方法论 §一.9
  - id: exam-workflow
    resource: ../../../development/guides/exam-workflow.md
    title: 做题/交卷任务执行指南 第六章异常出口
  - id: exam-api
    resource: ../../../development/api/gaodun-exam-api.md
    title: 高顿考试接口档案 1.2 鉴权
generated: { by: "doubao/okf-wiki", at: "2026-09-08T11:40:00+08:00" }
status: stable
---

# 故障排查先验顺序——先怀疑自己，凭证最后怀疑

## 核心结论（约 10 天运行统计）

**自动化任务失败，90% 以上是 AI/脚本自身问题，真正的凭证（token/登录态）失效不到 10%。请求用户登录是最后手段，不是第一反应。**

## 排查顺序（按先验概率从高到低，不跳步）

1. **先查 AI/脚本自身（九成在这）**
   - 端点/域对不对：做题走 `minerva`，不是 `g-study`（曾误打 g-study 404）；
   - 参数与 ID 张冠李戴：别拿税法课 42660 的会话跑会计课 42656；
   - 输入文件选取/排序/过滤：`findJwt` 曾按文件名排序致新 token 被旧文件遮蔽（代码 bug，非过期）；
   - 最近改动、断点续跑是否重扫、日志统计口径。
2. **再查运行环境**：网络/代理、进程存活、依赖与解释器（误用系统 python 缺 funasr）、磁盘内存。
3. **凭证须有硬证据**：发一次真实只读请求、明确返回「登录超时」业务码（高顿 553649434，HTTP 仍 200）才算失效；**不能**凭「请求失败/连续报错/JWT 快到 exp」推断。注意 JWT 的 exp 未到，服务端也可提前使其失效——但反过来，失败也不等于失效，仍以只读回包为准。
4. **最后才交用户**：凭证有硬证据失效、自动刷新（`refresh_auth_token.js`，最多 2 次）也失败、日常 Chrome 也未登录/需验证码时，才暂停交用户。

## 反模式

任务一失败就假设 token 过期、让用户重登——既打扰用户，又用「换 token」动作掩盖真正的代码 bug，换完仍失败还白绕一圈。通用分层排查（分层证伪、最小探针、控制变量、证据分级）见方法论全文。

## 来源与下钻

- [问题排查与人机协作方法论 §一.9](../../../development/guides/debugging-and-collaboration.md)——完整分层排查法、人机分工、反模式清单
- [做题/试卷采集接口链路](./workflow-exam-paper-pipeline.md)——做题异常三出口与 token 自愈
- [高顿考试接口档案 1.2](../../../development/api/gaodun-exam-api.md)——鉴权头、553649434、token 自愈脚本

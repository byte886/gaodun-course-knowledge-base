---
type: Workflow
title: 浏览器自动化连接通道
description: 高顿自动化一律连接用户日常真实 Chrome（运行时远程调试 + puppeteer-core/CDP），复用登录态、不重启不另建 Profile；接口为主、Playwright UI 兜底；禁止用豆包内置浏览器跑高顿任务。
tags: [browser, cdp, puppeteer, 自动化, workflow]
sources:
  - id: adr-010
    resource: ../../decisions/ADR-010-浏览器自动化连接通道与技术栈选型.md
    title: ADR-010 浏览器自动化连接通道与技术栈选型
  - id: connect-guide
    resource: ../../../development/tools/browser-cdp-connect-guide.md
    title: 浏览器 CDP 连接操作手册
  - id: connect-browser
    resource: ../../../../scripts/cdp/connect_browser.js
    title: scripts/cdp/connect_browser.js 连接模块
generated: { by: "doubao/okf-wiki", at: "2026-09-07T20:30:00+08:00" }
status: stable
---

# 浏览器自动化连接通道

## 一句话结论
高顿相关自动化**只连接用户正在用的日常真实 Chrome**，经 Chrome 运行时远程调试通道用 `puppeteer-core` 走 CDP，复用现有登录态（免重启、免独立 Profile、免重登）；业务上"**接口为主、UI 兜底**"。**不要用豆包内置浏览器/内置 bu 栈去跑高顿任务**——那是隔离环境，没有用户登录态。

## 技术选型（ADR-010 实测结论）
- **主**：`puppeteer-core.connect({ browserWSEndpoint: 带 UUID 的端点 })`——唯一在"不重启/不独立 Profile/不重登"前提下稳定拿到完整 CDP 的高级库；`page.on(request/response)`、页面内 `fetch`、`evaluate`、`reload` 均可用。
- **授权弹窗**：每次新连接 Chrome 弹"要允许远程调试吗"，由 macOS 辅助功能（AX）对"允许"做元素级 `AXPress` 代点，连接期持续代点并对偶发握手 403 有限退避重试。
- **兜底**：保留 Playwright 扩展 UI 脚本（`answer_option.sh`/`answer_multi.sh`/`submit_exam.sh`），接口未命中或异常时保证"作业交得上"；主备可同挂一个 Chrome。
- **已证伪/弃用**：Playwright `connectOverCDP`（ws 连上但等不到协议消息，issue #40027）、CLI attach（端点丢 UUID 超时）、`--remote-debugging-port` + 默认 Profile（Chrome 136+ 屏蔽，强制独立 Profile，不符合约束）。

## 操作要点
- 连接/自检/抓包的可复用模块都在 `scripts/cdp/`，入口 `connect_browser.js`（snake_case；旧名 connectBrowser.js 已更名）。
- Node 依赖由仓库根 `package.json` 声明（`puppeteer-core`，**不下载 Chromium**）；`node_modules` 不入库，新机 `npm install` 补足。
- 抓包原始报文落 `data/_workspace/<profile>/sniff/`（见 [统一运行时工作区](architecture-runtime-workspace.md)）。
- 详细连接步骤、授权、排障看连接操作手册，不要凭记忆拼端点。

## 关键方法论（可迁移）
判定"点击后到底怎么导航/有没有生效"必须落在**用户真实感知层**：DOM 的 `target` 属性 ≠ 真实行为（React onclick 统一接管），`dispatchEvent`/`element.click()` 合成事件 `isTrusted=false` 会被拦截；可信结论只能用 CDP `page.mouse.click()`（`isTrusted=true`）观察点击前后标签数与 URL。详见 [飞书同步与单窗口导航](workflow-feishu-sync.md) 的教训。

## 来源与下钻
- [ADR-010 连接通道与技术栈选型](../../decisions/ADR-010-浏览器自动化连接通道与技术栈选型.md)（完整备选对比表、官方来源、实测环境）
- [浏览器 CDP 连接操作手册](../../../development/tools/browser-cdp-connect-guide.md)
- 连接模块 [scripts/cdp/connect_browser.js](../../../../scripts/cdp/connect_browser.js)
- 业务接口见 [做题/试卷采集接口链路](workflow-exam-paper-pipeline.md)。

# 浏览器 CDP 连接手册（连接日常 Chrome）

> **文档类型**：Task（操作指南 — 浏览器 CDP 连接）
> **更新频率**：连接方式或依赖变更时
> **维护者**：AI自动维护 + 用户审核
> **读者**：AI代理（开发工程师）与用户

> 本文讲「如何用 puppeteer-core 经 CDP 连接用户**正在使用的日常 Chrome**（默认 Profile、复用登录态）」。
> 为什么选这条路、各方案对比见 [ADR-010](../../project-management/decisions/ADR-010-浏览器自动化连接通道与技术栈选型.md)；
> 授权弹窗的多屏捕捉/精准点击原理见 [macOS 辅助功能自动化](../guides/macos-accessibility-automation.md)；
> 排查的通用方法论见 [问题排查与人机协作](../guides/debugging-and-collaboration.md)。

---

## 1. 先分清几个技术（概念分层）

它们不是并列竞争关系，而是**自上而下的封装层级**：

```
AI 宿主(Claude/Cursor/豆包) ──MCP/stdio──> chrome-devtools-mcp ──> Puppeteer ──> CDP ──> Chrome
我们的做题程序 ────────────────────────>  puppeteer-core     ──> CDP ──> Chrome   ← 本项目主链路
UI 兜底 ──────────────────────────────>  Playwright 扩展中继 ──────────────────> Chrome   ← 本项目兜底
```

| 名词 | 是什么 | 本项目用途 |
|---|---|---|
| **CDP**（Chrome DevTools Protocol） | Chrome 原生调试协议，最底层；浏览器的网络、页面、运行时能力都经它暴露 | 能力底座 |
| **puppeteer-core** | CDP 的轻量高级封装，**不自带 Chromium**，专门连接已有浏览器 | **主链路连接库** |
| **Playwright** | 另一套跨浏览器自动化封装，内部也用 CDP；本项目现状以「扩展中继」操作 UI | UI 兜底（扩展模式下 CDP 被禁用） |
| **chrome-devtools-mcp** | Google 官方 MCP 服务器，内部用 Puppeteer，把能力包成给 AI 用的 MCP 工具 | 仅开发期交互勘察可选，**不进生产** |
| **运行时远程调试通道** | Chrome 144+ 在 `chrome://inspect` 开启、对已运行浏览器按需开放 CDP 的新通道 | 本项目依赖的通道 |

要点：**CDP 是 Playwright/Puppeteer 的共同底层**；选 Puppeteer 不是因为能力更强，而是它对 Chrome 144+ 这条新通道兼容得最好、且比手写裸 CDP 省事。

### 三种「连浏览器」形态的区别（别走错路）

| 形态 | 是否复用日常登录态 | 说明 |
|---|---|---|
| **运行时通道 + puppeteer-core（本项目）** | 是 | Chrome 已开着、勾着远程调试，直接 attach，免重启/免重登 |
| `launchPersistentContext` + 独立 Profile | 否（首次要登录一次） | 自己启动一个专用 Profile，如 `scripts/poc_persistent_browser.js` |
| 命令行 `--remote-debugging-port` | 默认 Profile 下被 Chrome 136+ 屏蔽 | 必须配非默认 `--user-data-dir`，又回到独立 Profile |

---

## 2. 一次性准备

1. **开启运行时远程调试**（只需一次，会持久化，重启 Chrome 自动恢复）：
   地址栏打开 `chrome://inspect/#remote-debugging` → 勾选启用「远程调试」，看到 `Server running at 127.0.0.1:9222` 即开。
2. **授予辅助功能权限**（自动点授权弹窗需要）：
   「系统设置 → 隐私与安全性 → 辅助功能」中，勾选运行脚本的终端 / 宿主 App。
3. **安装 Node 依赖**（`node_modules` 不入库）：在**仓库根目录**执行
   ```bash
   npm install
   ```
   依赖声明在根 `package.json`（仅 `puppeteer-core`，不下载 Chromium）。

### 新环境如何补足依赖（node_modules 不入库）

- 正常情况：仓库根 `npm install`（按 `package.json`/`package-lock.json` 还原，要求 Node ≥ 18，实测 Node 22）。
- 若 `package.json` 也缺失：按名字从官方恢复——npm 包 **`puppeteer-core`**，官方文档站 **pptr.dev**；检索关键词 `puppeteer-core connect to running chrome browserWSEndpoint`。
- 不建议全局安装：全局包默认不在脚本的 `require` 解析路径（会 `MODULE_NOT_FOUND`），需额外配 `NODE_PATH="$(npm root -g)"`，可复现性差；项目本地安装是标准做法。

---

## 3. 快速开始

```bash
# 1) 环境自检：自动点授权 → 连接日常 Chrome → 打印版本和所有标签 → 干净断开
node scripts/cdp/connect_browser.js

# 2) 抓包演示：抓 URL 含 baidu 的标签、刷新、采集 6 秒，结果落 data/_workspace/_account/auth/*.jsonl
node scripts/cdp/connect_browser.js  # 环境自检：连接→列标签→断开

# 3) 真实抓高顿（默认不刷新页面，避免误动作），先在日常 Chrome 打开并登录做题页
# 业务脚本 require('./cdp/connect_browser') 复用连接
```

可复用模块 `scripts/cdp/`：

| 文件 | 作用 |
|---|---|
| `connect_browser.js` | 连接模块：Chrome 没开自动拉起（选上次/首个 Profile）、读端点、串行自动授权、退避重试、找页、安全断开；直接运行=自检 |
| `press_allow.applescript` | macOS AX 代点「允许」（被连接模块自动调用，一般不用手动跑） |
| `connect_browser.js` | 连接日常 Chrome（可复用模块 + 自检）：读取 CDP 端点、自动 AXPress 授权、403 退避重试 |

在自己的业务脚本里这样用：

```js
const { connectDailyChrome, findPage, safeDisconnect } = require('./cdp/connect_browser');

const browser = await connectDailyChrome();          // Chrome 没开会自动拉起(上次/首个Profile) + 自动授权 + 重试
const page = await findPage(browser, 'glivepro.gaodun.com');
page.on('response', async (res) => { /* 识别取题/交卷/解析接口 */ });
await page.evaluate(async () => (await fetch('/api/...', { method: 'POST', /* 自动带 cookie */ })).json());
await safeDisconnect(browser);                        // 只断开调试，绝关用户页面
```

---

## 4. 连接正确姿势（关键细节）

### 4.1 端点必须带 UUID，且每次动态读取

- 端点写在默认 Profile 的 `DevToolsActivePort` 文件里（macOS：`~/Library/Application Support/Google/Chrome/DevToolsActivePort`），两行：首行端口、次行 `/devtools/browser/<uuid>`。
- **该通道没有 `/json/version`、`/json/list` 发现接口（返回 404 是正常的，不是故障）**；正确端点是带 UUID 的 `ws://127.0.0.1:<port>/devtools/browser/<uuid>`。
- Chrome 每次重启 UUID 可能变，**禁止硬编码**，每次连接前重读文件（模块已封装 `readWSEndpoint()`；也可用环境变量 `CHROME_DEVTOOLS_ACTIVE_PORT` 指向自定义 Profile 的同名文件）。

### 4.2 connect 参数（官方对齐）

| 参数 | 取值 | 原因 |
|---|---|---|
| `browserWSEndpoint` | 带 UUID 的 ws 端点 | 唯一被该通道接受的端点 |
| `defaultViewport` | `null` | 不改变用户真实窗口尺寸 |
| `targetFilter` | `() => true` | 接受全部 target（含扩展 / service worker），避免漏页 |
| `handleDevToolsAsPage` | `true` | **官方点名**兼容 144+ 运行时通道 / DevTools target |
| `protocolTimeout` | 按需（默认 30s） | 单次 CDP 调用超时 |

> 实验性 `connect({channel:'stable'})` 理论上能自动发现端点，但本环境实测报错，故仍显式读 `DevToolsActivePort`。抓网络请求依赖 `networkEnabled`（默认开，不要关）。

### 4.3 授权竞态与自动重试（稳定性关键）

- 每次**新连接** Chrome 都会弹「要允许远程调试吗？」；WebSocket 在点「允许」前挂起，少数情况下在弹窗出现前直接回 **HTTP 403**（竞态）。
- 模块做法：连接/重试期间跑一个**串行授权点击循环**（`startPressLoop`）——同一时刻最多一个 osascript、单次硬超时 2.5s、上一次结束再排下一次、结束即清理在途子进程；握手失败（403/超时）退避 1.2s 重试，默认最多 3 次。
- 「允许」**无法在设置里永久关闭**（Chrome 刻意的显式同意设计），自动代点是标准对策，不是绕过安全。
- **为什么必须「串行 + 只点 sheet」**（本节是踩坑后的定论，原理与数据见 [AX 指南 §5](../guides/macos-accessibility-automation.md)）：
  1. 授权脚本若递归整张 Chrome 窗口，会遍历网页 `AXWebArea` 上万个节点，单次实测耗时 **9.3s**、必然被 2.5s 超时杀掉，表现为「永远点不中」；改为只查窗口的模态 `sheet` 后降到 **0.31s**；
  2. 若用 `setInterval` 不等返回就并发派生 osascript，多个 AppleScript 会在 System Events 里拥塞堆积、全部卡死，表现为「时好时坏」；必须串行；
  3. 点中后 sheet 立即关闭，脚本要点中即停、全程容错，否则会因访问失效元素报错。修复后连续 8 次连接全部成功、osascript 残留恒为 0。

### 4.4 只断开、不关页面

结束时用 `browser.disconnect()`（模块封装为 `safeDisconnect()`），它只断开调试连接，**不会关闭用户的标签和 Chrome**；切勿用 `browser.close()`。

### 4.5 Chrome 没开会自动拉起，Profile 怎么选

`connectDailyChrome()` 默认先调 `ensureChromeRunning()`，因此**日常 Chrome 开没开都能连**：

- **已在运行**：直接连接，不重复开窗；
- **没在运行**：读 `Local State` 决定用哪个 Profile 后用 `open -a "Google Chrome" --args --profile-directory=<目录>` 拉起，轮询等 `DevToolsActivePort` 两行就绪（默认等 25s），再连接。冷启动无人值守实测可自动连上。

Profile 选择规则（`pickProfile()`，可传 `{profile:'Profile 1'}` 强制指定）：

1. 优先 `Local State` 的 `profile.last_used`，即**上次使用的 Profile**；
2. 没有记录（第一次）时取 `info_cache` 的第一个，且存在 `Default` 时优先它；
3. 再不行兜底 `Default`。

> 边界：远程调试勾选是**按 Profile 记忆**的。若选中的 Profile 从未在 `chrome://inspect/#remote-debugging` 勾选过，冷启动后不会开调试端口，`ensureChromeRunning` 会超时报错并提示去勾选（每个 Profile 勾选一次即持久化）。本机现有 Default(jacky)/Profile 1(丽娟)/Profile 4(jack)，`DevToolsActivePort` 位于 user-data-dir 根、不随 Profile 变。

---

## 5. 排障对策（按症状速查）

> 只保留「能指导解决问题」的对策；完整探索过程与数据见[选型实测报告](../../../project-management/task-reports/任务报告_浏览器连接通道选型实测_2026-09-01.md)。

| 症状 | 原因 | 对策 |
|---|---|---|
| 报找不到 `DevToolsActivePort`、或冷启动后等不到端口 | Chrome 没开（模块默认会自动拉起）；或该 Profile 从未勾选远程调试 | 让模块自动拉起；若仍超时，在目标 Profile 的 `chrome://inspect/#remote-debugging` 勾选一次（持久化，见 §4.5） |
| 访问 `127.0.0.1:9222/json/...` 返回 404 | 运行时通道本就无 HTTP 发现接口 | 正常现象，改读 `DevToolsActivePort` 拼带 UUID 的 ws 端点 |
| WebSocket 连上却一直超时、等不到消息 | 用了不带 UUID 的端点，或用 Playwright `connectOverCDP`（当前版本兼容差） | 用带 UUID 端点 + `puppeteer-core`；见 ADR-010 |
| 握手偶发 `Unexpected server response: 403` | 连接与授权弹窗竞态 | 模块已内置退避重试；若仍失败，确认辅助功能权限已授予 |
| 授权弹窗在、却时好时坏甚至一直点不掉 | ①递归进网页 AXWebArea 单次遍历 9s+ 被超时杀；②并发 osascript 在 System Events 拥塞堆积 | 已修复为「只查 sheet + 串行点击循环」；详见 §4.3 与 [AX 指南 §5](../guides/macos-accessibility-automation.md) |
| 弹窗在、但脚本没点掉 | 终端/宿主未获「辅助功能」权限；或想靠坐标点击（对该安全 sheet 无效） | 授予辅助功能权限，用元素级 AXPress（见 [AX 指南](../guides/macos-accessibility-automation.md)） |
| `require('puppeteer-core')` 报 MODULE_NOT_FOUND | 没装依赖 / 用了全局安装却没配 NODE_PATH | 仓库根 `npm install`（见 §2） |
| 页面请求报 `net::ERR_FAILED`、浏览器整体打不开网页但系统网络正常 | 长期运行的 Chrome 代理状态可能卡死（与 CDP 无关） | 重启 Chrome；用 `curl` 对照确认系统网络正常 |
| 多显示器环境点不准/点错 | 误用全局坐标点击 | 改用 AXPress 元素动作，天然与屏幕坐标/多屏解耦 |
| 找不到目标标签 | 标签没打开，或 URL 关键词不匹配 | 先在日常 Chrome 打开并登录目标页；自检脚本会列出全部标签 URL |

---

## 6. 官方资料检索指引（链接可能过时，附关键词）

> 访问/核对日期 2026-09-01；若链接失效，用对应英文关键词检索官方源，并在变更时回写本文。

| 主题 | 链接 | 备用检索关键词 |
|---|---|---|
| Puppeteer 连接选项 | https://pptr.dev/api/puppeteer.connectoptions | `puppeteer ConnectOptions handleDevToolsAsPage targetFilter` |
| Puppeteer 连接已有浏览器 | https://pptr.dev/guides/connection | `puppeteer connect to running browser browserWSEndpoint` |
| Playwright 对该通道的支持现状 | https://github.com/microsoft/playwright/issues/40027 | `playwright 40027 chrome inspect remote debugging` |
| chrome-devtools-mcp（autoConnect/wsEndpoint） | https://github.com/ChromeDevTools/chrome-devtools-mcp | `chrome-devtools-mcp autoConnect wsEndpoint README` |
| Chrome 远程调试端口安全变更 | https://developer.chrome.google.cn/blog/remote-debugging-port | `chrome remote debugging port default profile security` |
| CDP 协议域（Network/Target/Runtime） | https://chromedevtools.github.io/devtools-protocol/ | `chrome devtools protocol Target setAutoAttach Network domain` |
| macOS 辅助功能（AXPress/属性/坐标） | https://developer.apple.com/documentation/applicationservices/axuielement_h | `AXUIElementPerformAction NSAccessibility AXDescription macOS` |

---

## 7. 与现状 Playwright 扩展通道的边界

- **纯接口主链路**：`cdp/api_do_paper.js` / `cdp/batch_redo_papers.js` / `cdp/do_sprint_paper.js`，零 UI 点选；CDP 仅用于 connect_browser 连接日常 Chrome 复用登录态。
- **接口化主链路用本手册的 puppeteer-core 通道**；两条通道可同时 attach 到同一个日常 Chrome，互不冲突。
- 页面内 hook 方案 `scripts/capture_exam_net.js`（经扩展注入 fetch/XHR hook 到 `window.__net`）是另一种采集思路，可作为 CDP 抓包的交叉校验，不替代连接层。

---

**文档维护记录**

| 日期 | 变更内容 | 维护者 |
|------|---------|--------|
| 2026-09-01 | 初始版本：连接日常 Chrome 的概念分层、准备、快速开始、连接姿势、排障、官方检索入口 | AI自动维护 |
| 2026-09-01 | 二次迭代：新增 §4.5 Chrome 未运行自动拉起与 Profile 选择规则；§4.3 授权改为串行点击循环并补「只查 sheet/勿并发」三条定论与 9.3s→0.31s 数据；排障表同步 | AI自动维护 |

# 视频处理详细指南

> **文档类型**：Task（操作指南）
> **更新频率**：工具变更时
> **维护者**：AI自动维护
> **读者**：AI代理

> 本文档详细说明高顿Glive课程回放视频的下载、解密、压缩与归档流程。
> 包含加密方案逆向分析、详细操作步骤、关键陷阱汇总等内容。
> 总体工作流见 `../WORKFLOW.md` 第2节。

## 前置条件

1. **Playwright Extension 模式**：用户 Chrome 已安装 Playwright Extension 并提供 token
   - 连接命令：`PLAYWRIGHT_MCP_EXTENSION_TOKEN=<token> npx playwright cli -s=ga attach --extension=chrome`
   - 会话名：`ga`
2. **Node.js**：用于下载解密脚本（`scripts/download_decrypt.js`）
3. **ffmpeg**：需支持 libx265，路径通常为 `/usr/local/bin/ffmpeg`
4. **iTerm2**：压缩命令在 iTerm 窗口中运行，用户可直接看进度

## 加密方案（核心知识）

### HLS 加密结构

高顿课程回放视频为标准 HLS，m3u8 文件包含加密密钥信息：

```
#EXT-X-KEY:METHOD=AES-128,URI=".../replay/authorize?...",IV=0x...
```

- `.ts` 分片可公开下载，但内容是 AES-128-CBC 加密
- 每个分片用相同 IV 独立解密（标准 HLS 行为）
- 解密时需 `setAutoPadding(false)`

### 密钥获取链路

密钥获取涉及浏览器端的复杂通信：

1. **authorize 接口**：返回 92 字节密文
2. **hls.js Worker**：发 `postMessage({type:"decrypt",...})` 给主线程
3. **主线程 WASM 解密**：解密后返回 32 字节响应
4. **实际 AES key**：响应前 16 字节的原始 ASCII 字符串（不是 hex 解码）

### 关键细节

- **密钥不是 hex 解码**：Worker 返回 32 字节 ASCII hex 字符串，但 hls.js 只读前 16 字节原始字节作为 AES key
- **IV 直接取自 m3u8**：`IV=0x...`，去掉 `0x` 前缀使用
- **每个视频密钥不同**：必须逐个捕获，不能复用
- **m3u8 token 会过期**：批量下载时需定期重新打开播放器获取新 token

详细逆向分析见 `encryption.md`。

## 详细操作流程

### 步骤1：连接浏览器

```bash
PLAYWRIGHT_MCP_EXTENSION_TOKEN=<token> npx playwright cli -s=ga attach --extension=chrome
```

### 步骤2：打开课程表并遍历回放

课程表 URL 格式：`https://glivepro.gaodun.com/course/<course_id>/class-schedule`

- 用 `snapshot`/`find` 找到"看回放"按钮
- **跳过"开班典礼"**（标题含"开班典礼"的场次）
- 点击"看回放"会在新标签页打开播放器（`v-glive.gaodun.com/player?token=...`）
- 切换到新标签页：`npx playwright cli -s=ga tab-select 1`

### 步骤3：捕获 FHD 密钥

在播放器标签页运行 capture_key.js（注入 Worker hook → reload → 播放 → 切换 1080P → 提取密钥）：

```bash
npx playwright cli -s=ga run-code scripts/capture_key.js
```

返回 JSON 包含 `streams` 数组，每项有 `quality`、`m3u8`、`keyAscii`。取 `FHD-1080P` 项。

**注意**：
- 自定义元素标签名（如 `G-3F001E35`）每次加载会变，通过 `.gp-video-wrap` 子元素遍历找 `.video` 属性
- 清晰度按钮 class：`.gp-setting-quality-item`，FHD 选项文本含"1080"
- 如果 FHD 切换后没有新密钥，检查视频是否已在播放（需 seek 到 0 并 play）

### 步骤4：下载 m3u8 和分片

```bash
# 下载 FHD m3u8
curl -s -o playlist.m3u8 "<fhd_m3u8_url>" \
  -H "User-Agent: Mozilla/5.0 ..." -H "Referer: https://v-glive.gaodun.com/"

# 下载+解密+合并全部分片（20并发，支持断点续传）
node scripts/download_decrypt.js playlist.m3u8 merged.ts ./segments <keyAscii> <iv_hex> 20
```

IV 从 m3u8 的 `#EXT-X-KEY` 行提取，去掉 `0x` 前缀。

**验证**：检查每个分片解密后首字节为 0x47（TS sync byte）。

### 步骤5：压缩（必须在 iTerm 中运行，禁止后台运行）

> ⚠️ **强制要求：必须在 iTerm 终端窗口中运行，禁止使用 `&` 后台运行！**
>
> **为什么必须在 iTerm 中运行：**
> 1. 用户可以实时看到 ffmpeg 编码进度（frame、time、speed、bitrate 等）
> 2. 可以及时发现编码错误或异常
> 3. 后台运行可能因进程管理问题导致异常退出（已发生过：输出只有8.3MB不完整）
> 4. 压缩完成后脚本会自动验证时长和可播放性，需要终端输出验证结果
>
> **违反后果：** 如果发现使用后台运行压缩，必须立即停止，删除不完整文件，在 iTerm 中重新运行。

```bash
# ✅ 正确方式：在 iTerm 新标签页中运行（用户可见 ffmpeg 实时进度）
osascript -e "tell application \"iTerm\"
  tell current window
    create tab with default profile
    tell current session
      write text \"cd '<output_dir>'; bash '<skill_dir>/scripts/compress.sh' merged.ts video.mp4 30\"
    end tell
  end tell
end tell"

# ❌ 错误方式：禁止后台运行
# bash compress.sh merged.ts video.mp4 30 &
# nohup bash compress.sh merged.ts video.mp4 30 &
```

**压缩参数**：
- 视频编码：libx265 (H.265)
- CRF：30（课件文字清晰、头像略糊但不影响学习）
- preset：fast（编码速度与压缩率的平衡）
- 音频：AAC 96kbps
- 标签：hvc1（Apple 设备兼容）
- faststart：开启（支持边下边播）

**ffmpeg 进度解读**：
- `frame=98521`：已编码帧数
- `fps=168`：编码速度（帧/秒）
- `q=32.0`：量化参数
- `size=171776KiB`：当前输出大小
- `time=01:48:22.25`：已编码视频时长
- `bitrate=216.4kbits/s`：当前码率
- `speed=11.1x`：编码速度是播放速度的11.1倍
- `elapsed=0:09:45.79`：已用时间

**进度计算**：已编码时长 / 总时长 × 100%

**检查时间约定（必须遵守）**：
- 压缩启动后，**每5分钟检查一次进度**（不要等待10分钟以上）
- 检查内容：ffmpeg进程是否在运行、视频文件大小是否在增长、最新编码时长
- 如果发现ffmpeg进程异常退出（不在运行但文件大小不增长），立即删除不完整文件，在iTerm中重新启动压缩
- 压缩完成后（ffmpeg进程退出且日志显示"encoded"），立即验证视频完整性（时长、编码格式、可播放性）
- **禁止长时间不检查**：已发生过压缩异常退出但未及时发现的情况，浪费了大量时间

压缩完成后 compress.sh 自动验证时长和可播放性。

### 步骤6：下载讲义文档

在课程表页，每个直播场次下有"讲义|"/"课件|"前缀的条目，带"下载"链接。

#### 6.1 后台自动下载（必须遵守）

**⚠️ 约束：必须使用后台自动下载，禁止弹出下载确认对话框。**

此问题已发生多次，必须严格遵守以下流程：

**方法1：关闭Chrome下载询问（推荐，一次性设置）**

1. 打开 Chrome 设置 → 下载内容（chrome://settings/downloads）
2. 关闭"下载前询问每个文件的保存位置"开关
3. **不需要改变默认下载目录**，保持Chrome默认设置即可
4. 设置完成后，后续所有下载都会自动后台进行，不会弹出确认框
5. 下载完成后，按6.2节流程将文件从默认下载目录移动到流程规定的指定位置

**方法2：直接获取下载链接用curl下载（备选）**

如果无法调整Chrome设置，可以通过拦截网络请求获取下载链接，然后用curl下载到指定位置：

```bash
# 1. 点击下载按钮前，开启网络请求监听
# 2. 点击下载按钮，捕获下载请求的URL
# 3. 用curl直接下载到目标目录（不需要后续移动）
curl -L -o "原始资源/notes/NN_模块/讲义_名称.pdf" "下载链接" \
  -H "Cookie: 从浏览器复制" \
  -H "User-Agent: Mozilla/5.0 ..."
```

#### 6.2 下载操作流程

```bash
# 1. 用 snapshot 找到讲义下载按钮的 ref
npx playwright cli -s=ga snapshot | grep -A 3 "讲义\|下载"

# 2. 使用原生 click 命令点击下载按钮（不要用 eval click）
npx playwright cli -s=ga click <ref>

# 3. 等待下载完成（根据文件大小等待，小文件5秒，大文件30秒）
sleep 10

# 4. 检查 ~/Downloads/ 目录中的新文件
ls -lt ~/Downloads/ | head -5

# 5. 移动并重命名到目标目录
mv ~/Downloads/下载的文件.pdf "原始资源/notes/NN_模块/讲义_名称.pdf"
```

**注意事项：**
- 下载按钮可能在折叠的讲义列表中，需要先点击讲次标题展开
- Chrome 下载的临时文件名格式为 `.com.google.Chrome.xxxxx`，下载完成后会自动重命名
- 如果临时文件没有自动重命名，说明下载可能未完成，需要等待或重新下载

#### 6.3 完整性验证（必须执行）

下载完成后，必须验证文件完整性：

```bash
# 1. 检查文件类型
file "原始资源/notes/NN_模块/讲义_名称.pdf"

# 2. 检查PDF页数（macOS）
mdls -name kMDItemNumberOfPages "原始资源/notes/NN_模块/讲义_名称.pdf"

# 3. 检查PDF是否以%%EOF结尾（完整性标记）
tail -c 100 "原始资源/notes/NN_模块/讲义_名称.pdf" | grep -q "%%EOF" && echo "✓ 完整" || echo "⚠️ 可能不完整"

# 4. 对比文件大小与页面显示的大小
ls -lh "原始资源/notes/NN_模块/讲义_名称.pdf"
```

**验证标准：**
- PDF 文件必须有 `%%EOF` 结尾标记
- 文件大小应与页面显示的大小一致（误差 < 5%）
- 页数应合理（讲义通常5-50页，课件通常10-100页）
- 文件类型应为 `PDF document`

**文档格式**：可能是 PDF、PPT、DOC 等，以实际下载为准。下载后用 `file` 命令确认格式。

### 步骤7：目录结构

```
<download_root>/
├── 税法-蔡俊峻/
│   ├── 01_税法全面精讲01-税法总论/
│   │   ├── video.mp4          # 压缩后视频（最终归课程 原始资源/videos/NN_讲题/）
│   │   ├── playlist.m3u8      # m3u8 备份
│   │   ├── segments/          # 解密分片缓存（可删除）
│   │   ├── merged.ts          # 合并后原始TS（可删除）
│   │   └── notes/             # 讲义课件 PDF（最终归课程 原始资源/notes/NN_模块/）
│   ├── 02_.../
│   └── ...
├── 会计-罗翔/
│   └── ...
└── _reports/                  # 任务报告
```

### 步骤8：验证清单

每个视频压缩后必须确认：
- [ ] ffprobe 能正常读取（moov atom 存在）
- [ ] 输出时长与输入时长差 < 2 秒
- [ ] 视频编码为 hevc，分辨率 1920x1080
- [ ] 音频编码为 aac
- [ ] 文件可正常播放（首尾都有画面）

### 步骤9：百度网盘上传（可选）

百度网盘开放平台 REST API 支持文件上传、目录管理（mkdir/move/delete/rename）。
配置和使用见 `netdisk-setup.md`。

## 关键陷阱汇总

### 浏览器与 Playwright

1. **Extension 模式下 CDP 不可用**（"Not allowed"），只能用 Playwright CLI 命令
2. **Worker hook 必须在 reload 前注入**（addInitScript），否则 Worker 已创建无法拦截
3. **ref 是动态的**：每次页面变化后重新 snapshot/find
4. **播放器自定义元素在 closed shadow DOM 内**：通过 `.gp-video-wrap` 子元素的 `.video` 属性访问

### 加密与密钥

5. **密钥不是 hex 解码**：Worker 返回 32 字节 ASCII hex 字符串，但 hls.js 只读前 16 字节原始字节作为 AES key
6. **m3u8 token 会过期**：批量下载时需定期重新打开播放器获取新 token
7. **每个视频密钥不同**：必须逐个捕获，不能复用

### 压缩与处理

8. **课程表 tab 可能因内存崩溃**（ffmpeg 占内存），需重新加载
9. **压缩参数 CRF 30**：经测试课件文字清晰、头像略糊但不影响学习，如需更高质量可降低 CRF（如 28），但体积会增大

### 知识库操作（扩展）

10. **知识库操作必须使用API**：所有知识库操作（创建、更新、删除、移动节点）必须使用lark-cli，不使用Playwright手动操作
11. **站内导航链接用 `<cite>` 内部引用，不用完整 URL**：同步飞书的文档内，指向其他知识库节点的链接一律由 `wiki_link_resolve.py` 转成 `<cite type="doc" doc-id="obj_token"/>`（飞书内当前窗口打开）；完整飞书 URL（`https://.../wiki/[node_token]`）会被渲染成 `target="_blank"` 新标签页，逐层点击会不断开窗、容易迷失，仅外链才用完整 URL。本地源文件仍保留 `./标题.md` 相对链接。
12. **同步后必须执行结构检查**：避免出现重复节点、空节点、错误位置等问题，使用`scripts/check_kb_structure.sh`
13. **具体产出物放对应课程目录**：专项质检（VERIFICATION.md，按需）等放在对应课程目录下，不放在通用目录；做题/同步验证默认并入任务报告、不单独成文
14. **删除节点是异步操作**：`lark-cli wiki +node-delete`是异步的，需要轮询任务状态确认完成

## 相关脚本

| 脚本 | 位置 | 说明 |
|------|------|------|
| 密钥捕获 | `scripts/capture_key.js` | Playwright Worker hook 注入脚本 |
| 下载解密 | `scripts/download_decrypt.js` | HLS分片下载解密合并脚本 |
| 压缩脚本 | `scripts/compress.sh` | ffmpeg H.265压缩脚本 |
| 知识库结构检查 | `scripts/check_kb_structure.sh` | 自动检测重复节点、空节点、链接问题 |

## 参考文档

| 文档 | 位置 | 说明 |
|------|------|------|
| 加密逆向分析 | `docs/development/api/encryption.md` | HLS AES-128 加密详细逆向分析 |
| 百度网盘 | `docs/development/api/netdisk-setup.md` | 百度网盘API配置和使用 |
| 总体工作流 | `../WORKFLOW.md` | 完整工作流（下载→压缩→转写→知识库→做题验证） |
| 知识库组织规范 | `knowledge-base-organization.md` | 知识库结构设计、节点命名规范、父页面规范 |
| 飞书API使用说明 | `feishu-api.md` | wiki节点删除、文档更新、权限设置、常见问题 |

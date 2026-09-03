# 工具文档目录（tools）

> **文档类型**：Reference（参考资料）
> **更新频率**：新增工具或工具变更时
> **维护者**：AI自动维护
> **读者**：AI代理（使用工具前参考）

本目录存放各类工具的使用文档，包括视频处理、音频转写、OCR、Playwright、文档下载等。

---

## 文档清单

| 文档 | 用途 |
|------|------|
| `video-processing.md` | 视频处理：HLS下载解密、ffmpeg压缩参数、验证方法 |
| `transcription.md` | 音频转文字：FunASR环境搭建、参数配置、性能优化 |
| `ocr.md` | OCR文字提取：macOS Vision框架使用、表格图表AI补充 |
| `playwright-cli-guide.md` | Playwright CLI使用：连接浏览器、执行代码、异常处理 |
| `browser-cdp-connect-guide.md` | 浏览器CDP连接：用 puppeteer-core 连接日常Chrome（复用登录态）、自动授权、抓包 |
| `document-download.md` | 文档下载：讲义PDF下载、后台下载方法、验证完整性 |

---

## 使用原则

1. **使用工具前先读对应文档**：了解工具的用途、用法、注意事项
2. **优先用脚本，不手动写命令**：已有脚本的功能，必须用脚本
3. **遇到问题查文档**：工具使用出错时，先查对应文档的故障排除部分
4. **新增工具时更新本文档**：添加新工具文档时，在本文档清单中添加

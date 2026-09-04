# OCR 文字提取

> **文档类型**：Task（操作指南）
> **更新频率**：工具变更时
> **维护者**：AI自动维护
> **读者**：AI代理

本文档记录高顿课程 PDF 讲义的 OCR 文字提取方案，包括 macOS Vision 框架使用、PDF 转图片、以及表格/图表的 AI 视觉补充识别。

## 1. 背景

高顿课件 PDF 多为**图片型 PDF**（PPT 导出为图片），无法直接提取文字，需 OCR。

经检测（税法01，116页）：
- 0页可直接提取文字（每页只有8个乱码字符）
- 116页全部包含图片
- 平均每页139字，符合题目+选项+答案+解析的特征

## 2. 方案：macOS Vision 框架 OCR

### 2.1 工具

- **OCR引擎**：macOS Vision 框架（系统原生免费，中文识别效果好）
- **PDF转图片**：PyMuPDF（200 DPI）
- **批量脚本**：`transcription/batch_ocr.sh`

### 2.2 OCR 二进制编译

Swift 脚本调用 Vision 框架，需编译为二进制：

```bash
# 编译（需指定链接框架）
swiftc -framework Vision -framework AppKit -framework CoreGraphics \
  /tmp/ocr_vision.swift -o /tmp/ocr_vision
```

Swift 脚本核心代码：
```swift
import Vision
import AppKit

func recognizeText(in imagePath: String) -> String {
    guard let image = NSImage(contentsOfFile: imagePath),
          let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        return "ERROR: 无法加载图片"
    }
    
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["zh-Hans", "en-US"]
    request.usesLanguageCorrection = true
    
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])
    
    var lines: [String] = []
    for observation in request.results ?? [] {
        if let candidate = observation.topCandidates(1).first {
            lines.append(candidate.string)
        }
    }
    return lines.joined(separator: "\n")
}
```

### 2.3 性能数据

| 指标 | 数据 |
|------|------|
| 测试样本 | 税法01，116页 |
| 总耗时 | 1分53秒 |
| 每页耗时 | 约1秒 |
| 输出字数 | 16190字 |
| 输出大小 | 41KB |

### 2.4 运行方式

**重要**：OCR 脚本在 iTerm 中直接运行会退出（原因待查），需用后台运行 + iTerm tail -f 显示日志：

```bash
cd transcription
nohup bash batch_ocr.sh > /tmp/ocr_log.txt 2>&1 &
# iTerm 中：tail -f /tmp/ocr_log.txt
```

### 2.5 输出格式

- 合并的 Markdown 文件，每页用 `---` 分隔
- 每页标题：`## 第N页`
- 后处理：修正常见 OCR 错误（如"高顿教意"→"高顿教育"、"高顿教肓"→"高顿教育"）

输出位置：课程目录 `原始资源/notes/NN_模块/讲义_名称_OCR.md`（与讲义 PDF 同名、统一 `_OCR` 后缀）

## 3. 表格和图表处理

### 3.1 已知情况

- **税法01（116页）**：经检查为**纯文字课件**（题目+选项+答案+解析），无复杂表格和图表，OCR 识别效果好
- **后续课程**（如税法其他章节、会计课程）**可能包含表格、公式、图表**

### 3.2 macOS Vision OCR 的局限

| 内容类型 | 识别能力 | 说明 |
|----------|----------|------|
| 纯文字 | ✅ 好 | 中文识别准确率高 |
| 表格 | ⚠️ 有限 | 只能识别出文字，无法保留行列结构 |
| 公式 | ⚠️ 有限 | 识别可能不准确 |
| 图表 | ❌ 差 | 只能识别图表中的文字，无法描述图表内容和数据趋势 |

### 3.3 AI 视觉补充识别方案

遇到表格/公式/图表时，用 AI 视觉识别补充：

1. 将对应 PDF 页面转成图片（PyMuPDF，200 DPI）
2. 用 AI 视觉模型识别：
   - **表格**：识别表格结构并转 Markdown 表格
   - **公式**：识别公式并转 LaTeX
   - **图表**：描述图表内容、数据趋势、关键数据点
3. 将 AI 补充内容合并到 OCR 文字稿中

### 3.4 混合处理流程

```
PDF → 分页转图片 → macOS Vision OCR（批量）
                          ↓
                   检查是否有表格/图表页
                          ↓
              ┌───────────┴───────────┐
              ↓                       ↓
         纯文字页                 表格/图表页
         （OCR结果直接用）      （AI视觉补充识别）
              ↓                       ↓
              └───────────┬───────────┘
                          ↓
                   合并为完整文字稿
```

## 4. 其他格式文档

| 格式 | 提取工具 | 说明 |
|------|----------|------|
| PPT/PPTX | python-pptx | 可直接提取文字 |
| DOC/DOCX | python-docx 或 textutil（macOS） | 可直接提取文字 |
| XLS/XLSX | python-openpyxl | 可直接提取表格数据 |

输出到课程目录 `原始资源/notes/NN_模块/`，统一 `_OCR.md` 后缀、与原讲义同名对应。

## 5. 已知问题

| 问题 | 影响 | 解决方案 |
|------|------|----------|
| iTerm直接运行OCR脚本会退出 | 无法在iTerm中稳定运行 | 改用nohup后台运行+iTerm tail -f |
| "高顿教育"反复识别错误 | 文字稿中有错字 | 后处理sed替换修正 |
| 表格/图表识别有限 | 复杂内容缺失 | AI视觉补充识别 |

## 6. 参考资料

- [Apple Vision Framework Documentation](https://developer.apple.com/documentation/vision)
- [PyMuPDF Documentation](https://pymupdf.readthedocs.io/)

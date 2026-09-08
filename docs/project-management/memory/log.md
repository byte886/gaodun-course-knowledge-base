# 工程记忆 bundle 变更日志（log）

> 只记**记忆层本身**的结构变更（新增/退役/合并 concept、采用决策变化）。
> 业务与代码的完整变更时间线看仓库根 `CHANGELOG.md`；本页不重复业务流水。
> 规则：日期标题 `## YYYY-MM-DD`，最新在最上（倒序）。

## 2026-09-09

- **Update**：工作区收口 concept 补「视频下载/压缩过程件 `.vfetch` 落 `_workspace/<profile>/dl-tmp/`、课程库根不留讲目录」——`fetch_lecture_video.js` 新增 `--work-base`（缺省课程根、向后兼容），动态/串行两条流水线统一指向 dl-tmp，成品仍归 `原始资源/videos/`；根因是 .vfetch 曾建在课程库根、仅靠转写末尾自清，主控中断即永久残留（commit 2b1f892）。

## 2026-09-08

- **Update**：做题链路 concept 补 answerMode=5 表格题双字段提交契约（`userAnswer` + `excelAnswer=JSON.stringify(luckysheet.getAllSheets())`，做题 UI 在独立子应用 sub-tiku.gaodun.com）与错误码分层（token 553649434 / 作答太快 10462203 / 账号级风控 10462222）；结论由 sub-tiku 前端源码逆向 + 三类卷（满分 t1/平台最优 t1/对照）redo 全拦的对照实测得到，细节指针到 exam-workflow §4.3.2/§4.4。
- **Add**：新增治理 concept `standard-debugging-first-principles`（故障排查先验顺序：九成失败是 AI/脚本自身问题、凭证最后怀疑、token 失效须有只读回包硬证据），并在 index 治理类登记；同步更新做题链路与浏览器 CDP 两篇 concept 的 token 自愈描述。
- 来源：会计课 token 失效排查实战（误打端点、刷错课程页、findJwt 排序 bug 均为自身问题）+ 用户约 10 天运行经验。

## 2026-09-07

- **Creation**：建立工程记忆 bundle（ADR-017），初版编译 10 篇 concept——架构 4、链路 4、治理 1、对照索引 1；结论全部从既有 ADR-002/003/005/007/010/012/013/014/015/016、standards 与接口档案编译，未新增事实。
- 初版由 AI 编译，`generated.by=doubao/okf-wiki`、**未标 verified（machine-confirmed，待人核）**；人核通过后再逐篇加 `verified: human:`。
- 校验器 `scripts/okf_validate.py` 自 okf-wiki 技能 vendor 进项目（零第三方依赖），工程自包含、不依赖全局技能。

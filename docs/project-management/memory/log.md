# 工程记忆 bundle 变更日志（log）

> 只记**记忆层本身**的结构变更（新增/退役/合并 concept、采用决策变化）。
> 业务与代码的完整变更时间线看仓库根 `CHANGELOG.md`；本页不重复业务流水。
> 规则：日期标题 `## YYYY-MM-DD`，最新在最上（倒序）。

## 2026-09-07

- **Creation**：建立工程记忆 bundle（ADR-017），初版编译 10 篇 concept——架构 4、链路 4、治理 1、对照索引 1；结论全部从既有 ADR-002/003/005/007/010/012/013/014/015/016、standards 与接口档案编译，未新增事实。
- 初版由 AI 编译，`generated.by=doubao/okf-wiki`、**未标 verified（machine-confirmed，待人核）**；人核通过后再逐篇加 `verified: human:`。
- 校验器 `scripts/okf_validate.py` 自 okf-wiki 技能 vendor 进项目（零第三方依赖），工程自包含、不依赖全局技能。

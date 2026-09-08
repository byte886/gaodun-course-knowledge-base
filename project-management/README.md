# 项目管理（project-management）

> **文档类型**：Reference（治理结构说明）
> **更新频率**：目录结构 / 治理机制变更时
> **维护者**：AI 自动维护
> **读者**：AI 代理 + 用户

## 本目录装什么

只放**跨课全局、需要跨会话持续维护的活态台账**，常驻只有 `active/`：

```
project-management/
└── active/                       # 跨课全局活态台账（仅此两份，不再增加常驻文件）
    ├── TASK_STATUS.md            # 进度视图：项目到哪了、全局里程碑、当前课指针、断点与下一步
    ├── ISSUES.md                 # 问题视图：跨课/机制级 BUG 与风险的生命周期、解法
    └── README.md                 # 两份台账的职责与边界
```

## 单课过程件不在这里（关键分层）

**某一门课生产过程中的一切过程件都是临时件，统一落 `data/_workspace/<course>/`（gitignore、不入库）：**

| 过程件 | 落点 |
|--------|------|
| 工单 / spec / 实时进度台账 | `data/_workspace/<course>/tickets/` |
| 需求表 REQUIREMENTS、BUG 表 BUG_BACKLOG | `data/_workspace/<course>/tickets/` |
| 任务报告、侦查/检查报告 | `data/_workspace/<course>/task-reports/` |
| 日志、断点哨兵、manifest、原始抓取、临时文件 | `data/_workspace/<course>/{logs,manifest,sniff,tmp,...}` |

课程 finalize 后这些过程件本地留底（不入库）；其中**稳定、跨课复用的结论**提炼进下面的静态治理层。

## 与 `docs/project-management/` 的边界（动态 vs 静态）

| 内容 | 位置 | 性质 |
|------|------|------|
| 当前任务状态、全局断点下一步 | `project-management/active/TASK_STATUS.md` | 动态，频繁更新 |
| 跨课/机制级问题与 BUG | `project-management/active/ISSUES.md` | 动态，频繁更新 |
| 标准 / 规范 / SOP（怎么做事的规则） | `docs/project-management/standards/` | 静态，规则变更才改 |
| 架构决策记录 ADR（为什么这么定，只增不改） | `docs/project-management/decisions/` | 半静态，只增不改 |
| 工程记忆 OKF bundle（跨会话稳定结论编译层） | `docs/project-management/memory/` | 静态，稳定结论变化时改 |

> 一句话：**活的、会变的当前态在本目录 `active/`；怎么做事的规则和为什么这么定在 `docs/project-management/`；单门课的生产过程在 `data/_workspace/<course>/`。**

---

**文档维护**：本结构变更时同步更新本文档、`docs/DIRECTORY_STRUCTURE.md` 与 `docs/DOCUMENTATION_MAP.md`。

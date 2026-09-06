# scripts/migrate — 存量迁移一次性工具包（M0–M6）

> **定位：一次性迁移工具，不是常驻运行时。** 这组脚本服务于 2026-09 的「旧按讲目录 → ADR-012 三层桶（原始资源 / 知识详解 / _workspace）」存量迁移，税法课程迁移完成后即封存。**下一门课不直接套用**：它们硬编码了税法课程路径、读取迁移期旧位置（`data/cdp-sniff`、`data/knowledge-source`），只作"老结构怎么转新结构"的参考样例；新课程的同类能力应做成参数化的通用工具。

## 脚本与迁移阶段

| 脚本 | 阶段 | 作用 | 是否改数据 |
|---|---|---|---|
| `align_m0.py` | M0 | 只读对齐：本地按讲存量 ↔ 官网 course_catalog / paper_index，出差异表 | 只读 |
| `build_course_manifest.py` | M1 | 生成 course-manifest 四件套 + `_workspace` 骨架（不搬数据） | 写 `_workspace` |
| `migrate_resources.py` | M2/M3/M4 | 按 manifest 把旧按讲存量 move 进三层结构（`--phase resources/papers/...`，可回滚） | move |
| `verify_migration.py` | M6 | 对照《存量迁移方案》验收清单逐项核验，全绿才算迁移完成 | 只读 |

## 说明

- 迁移方法论与验收清单见 `docs/project-management/存量迁移与course-manifest生成方案.md`；目标结构见 ADR-012 与 `docs/DIRECTORY_STRUCTURE.md`。
- 课程级 `course-manifest.json` 是**过程件**：放课程 `_workspace/manifest/`、可由这些脚本 rebuild、**不入 Git**；入库的是本目录这些"如何生成"的脚本本身。
- 已退役、勿与本目录混淆：旧 `knowledge-base/lecture-resource-map.json` 及其校验脚本 `verify_lecture_map.py` / `check_course_lib.py`（旧按讲取料路由，已被 course-manifest 取代并删除，Git 历史可查）。

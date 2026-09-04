# 阶段②做题交卷与试卷采集 / manifest 生成 SOP

> **文档类型**：Task（操作指南）
> **更新频率**：做题链路或 manifest 结构变更时
> **维护者**：AI自动维护
> **读者**：AI代理

本 SOP 管"怎么通过**接口链路**完成各模式作业、采全题/标准答案/解析，并生成讲↔资源↔知识点的 manifest"。
- 流程位置：[WORKFLOW.md 阶段②](../../WORKFLOW.md)；接口细节：[gaodun-exam-api.md](../api/gaodun-exam-api.md)；做题总览：[exam-workflow.md](./exam-workflow.md)
- 上游：`resource-collection-sop.md`；下游：`knowledge-detail-build-sop.md`

> 答案在**进卷接口**即返回（redo-paper 直接带题面、标准答案、解析），因此本阶段"交卷"是为了帮用户完成作业任务，**不需要再用 UI 做题验证答案**。

---

## 一、接口链路（主通道）

```
syllabus（枚举作业入口/paperId）
  → record（进入学习记录）
  → redo-paper（进卷即得：题面 / 标准答案 / 官方解析）
  → submit-paper（明文 JSON，无 sign/nonce；authentication 为 JWT/HS256，有效期约7天）
  → exam-report（回查：答案被正确接收、分数与预期一致）
```

- 主通道走 HTTP 接口；**UI（日常 Chrome CDP）仅用于登录、首录与接口失败兜底**；登录/验证码/不可逆提交节点暂停交用户。
- 提交有最小作答墙钟时长，须低频拟人；禁止高并发轰炸。

## 二、作业步骤

### 步骤0　枚举全部作业入口
1. 从 syllabus 列出**所有模式**作业的 paper 条目（课后练习、分章真题、知识点测试、强化专题、主观题卷、冲刺模考）；
2. 记录 paperId / resourceId / csItemId / 所属讲次 / 题型构成，形成官网台账 `_workspace/manifest/papers_inventory.json`。
> 用户要求：能拿到作业列表就尽量拿全——UI 能看到所有做题入口，说明接口里就有全部入口 ID。

### 步骤1　进卷取题（采全原料）
- 对每个 paperId 调 redo-paper，原始响应落 `_workspace/papers/{paperId}.json`；
- 字段：`moduleList[].questionList[]`，题面 `title`(HTML)、选项 `selectList`、标准答案 `answer`、解析 `analysis/analysisText`、标签 `knowledgePointList[{id,title}]`、题型 `questionType`。

### 步骤2　题型处理（重点：主观题下钻）
- **客观题（type=1 单选 / 2 多选 / 3 判断）**：答案取顶层 `answer`（多选形如 "A,B,D"）；
- **主观大题（type=5 是容器）必须下钻 `subQuestionList[]`（type=6 小问）**：小问 `answer` 多为"见解析"，**真正算式答案在小问 `analysisText`**；只取大题顶层会漏掉全部答案；
- "帮我批改"消耗有限智能批改权益、已决定**不依赖**；主观答案以解析为准。

### 步骤3　组卷并提交、回查
1. 用进卷返回的**标准答案**组装 submit body（字段名、题型编码、多选格式严格按接口档案）；
2. 验证顺序固定：**只读接口重放 → 可重做/练习卷试提交 → 正式作业**；满足最小墙钟、低频拟人；
3. 提交后调 exam-report 回查：答案被正确接收、分数为满分/平台最优；不一致则告警并回退 UI 兜底，记录原因。

### 步骤4　生成本地索引与 manifest
- `paper_index.json`：list，每条 `{paperId,title,chapter,cls,qCount,file}`，按讲/组聚合用；
- `course-manifest.json`：
  - 讲 ↔ 视频/讲义/试卷 的路由（替代旧 lecture-resource-map，**可 rebuild、随课即变、放 _workspace 不入库**）；
  - **知识点 → 14 模块组的显式映射**（见步骤5）。

### 步骤5　知识点归组（显式映射 + 脚本 assert）
1. 汇总全部 papers 的 `knowledgePointList`（主观题含小问层），官方标签去重；
2. 易混点（名称不含模块字样，如"法律责任""个人综合所得…"）**逐条显式指定归属**，不靠关键词兜底；
3. 特例：id=112376"应纳税额的计算"等价并入"增值税一般计税方法应纳税额的计算"；土地增值税归组10、委托加工/进口消费税归03、非居民企业归04、非居民个人归05；
4. **脚本 assert**：税法基线 14 组点数 6/14/7/12/10/3/5/2/2/7/3/6/8/7＝92，无未归类、无重复。归组规则见 [NAMING 第八章](../../project-management/standards/NAMING_CONVENTION.md) 与 [organization 2.1](../knowledge/knowledge-base-organization.md)。

### 步骤6　冲刺模考（分支，最后做）
- 3 张 48 题冲刺模考是**分支流程**：必须等所有基础作业（步骤0–5）全部完成后才进行；其题/标准答案同样是末期知识来源；
- 处理方式同步骤1–3，结果并入 papers 与 manifest。

---

## 三、阶段②校验门（不过不进阶段③）

- [ ] papers 套数/题数与 papers_inventory 台账一致，无遗漏入口；
- [ ] 每份正式卷 exam-report 为满分/平台最优，异常有记录与兜底；
- [ ] 主观题已全部下钻小问，小问 answer/analysisText 非空；
- [ ] paper_index、course-manifest 生成，归组脚本 assert 通过（92/各组点数）；
- [ ] 全程留存请求/响应快照与日志到 `_workspace/logs`、`sniff`（验证完即清）。

## 四、常见坑

| 坑 | 正确做法 |
|----|----------|
| 只取 type5 顶层（answer 为空）以为没答案 | 下钻 subQuestionList，真答案在小问 analysisText |
| 靠关键词把知识点自动分组 | 易混点显式映射 + 脚本 assert 数量 |
| 直接对正式卷高频 POST | 只读重放→可重做卷→正式，低频拟人、满足墙钟 |
| JWT 过期导致 401 | 从日常 Chrome 会话导出新鉴权，有效期约7天，注意刷新 |
| 冲刺模考提前做 | 它是末期分支，必须在全部基础作业后 |
| 提交后不回查 | 必调 exam-report 核对接收与分数，不一致告警回退 |

**文档维护**：接口字段变更改 gaodun-exam-api，结构变更改模板/规范，本 SOP 只写采集与提交动作。

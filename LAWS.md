# 平台设计原则 · LAWS

> 平台的所有代码都应该能回答一个问题：它体现了哪条原则。
> 原则修订必须走迭代（工单 → 验收 → 账本）。

| 编号 | 名称 | 原则 | 落地位置 |
|------|------|------|----------|
| P1 | 工具先行 | 平台能力一律以标准工具（MCP）暴露给 agent，而不是对话框与文档 | `platform/mcp/core.mjs` |
| P2 | 工单驱动 | 施工以机器可读工单为单位（目标+验收标准），跨 agent 可交接 | `platform/orders/` |
| P3 | 渐进披露 | 岗位文档 = 触发元数据 + 按需加载正文；上下文是预算 | `.zcode/skills/world-builder/` |
| P4 | 护栏内置 | 可编程验收门 + 全程可追溯；FAIL 即打回 | `scripts/accept.mjs` · `platform/roles/auditor.md` |
| P5 | 显式状态机 | 流程是显式的节点/边/条件 + checkpoint 持久化；隐式对话流不可维护 | `platform/PROTOCOL.md` · `docs/ITERATIONS.md` |
| P6 | 契约而非编制 | 角色是契约（目标/输入/输出/禁令），不是人格；一个运行时可身兼多角 | `platform/roles/` |
| P7 | 记忆两层 | 事件流只追加（可审计），知识/任务层可检索（可去重）；改写历史 = 记忆损坏 | `docs/ITERATIONS.md` · `platform/data/` |
| P8 | 爆炸半径最小化 | 工具按危险度分级；'先跑门再合并'是纪律而非美德 | `scripts/accept.mjs` |
| P9 | 自主触发 | 持续构建 = 心跳 + 确定性派单（只派 auto-ok）+ 断点续跑；心跳只发令 | `platform/scheduler.mjs` · `tick.yml` |
| P10 | 可观测一等 | 施工链路必须人类可回放：时间线、施工包、账本详情是控制台一等能力 | `console/` |
| P11 | 核心与传输解耦 | 工具核心不感知传输：stdio 服务本地，HTTP 服务网络与 k8s | `platform/mcp/` · `deploy/k8s/` |
| P12 | 身份即清单 | agent 身份 = 机读清单（能力/工具/权限边界），可注册可审计；forbidden 必填 | `platform/agents.json` |

## 运行时约定

- **LLM 缝隙**：对话经 OpenAI 兼容端点（`LLM_BASE_URL/LLM_MODEL/LLM_API_KEY` 环境变量注入），未配置时返回接入指引——平台不假装智能。
- **运行时态**：任务与会话存 `platform/data/`（不入仓库）；长期记忆只有账本与工单。

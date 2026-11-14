# 平台协议 · The Platform Protocol

> 本仓库是一个 **agent 平台**：人类在控制台上与智能体聊天、下达任务（指挥干活）。
> 本文件是平台宪法；**迭代原则与施工入口见仓库根 `AGENTS.md`**（后续 coding agent 从那里开始）。

## 0. 组成

- **控制台**（`index.html` + `console/`）：对话（与智能体聊天）、任务看板（指挥干活）、
  智能体注册与构建、工单池、迭代账本。
- **运行时**（`platform/mcp/http.mjs`）：一个进程 = 静态控制台 + 任务/对话 API + MCP HTTP 端点。
- **对话能力**：经 OpenAI 兼容端点（env：`LLM_BASE_URL/LLM_MODEL/LLM_API_KEY`）——厂商中立，未配置时返回接入指引。
- **任务**：`platform/data/tasks.json`（运行时态），MCP 工具 `list_tasks/create_task/set_task_status` 对 agent 可见。
- **迭代体系**：工单（`platform/orders/`）+ 验收门（`scripts/accept.mjs`）+ 账本（`docs/ITERATIONS.md`）+ 角色契约（`platform/roles/`）。

## 1. 工单生命周期

```
open ──领单──▶ claimed ──过验收门──▶ delivered
   └────────做不到/缺前提────▶ blocked（记 blocker，可复活）
```

1. `claimed` 写 `claimedBy` + `claimedAt`；`delivered` 写 `deliveredIn` + `acceptedAt`；
   `blocked` 写 blocker。
2. 不得修改他人已领未完成的工单；不得绕过验收门置 delivered。
3. 想做没有工单的事？先立工单。

## 2. 调度与自主触发（P9）

`platform/scheduler.mjs`：回收超时认领（默认 7 天）→ 派发 auto-ok 工单 → 生成施工包
（`platform/dispatch/`，含下一轮迭代号与 runbook）。心跳（`tick.yml`，每日 UTC 01:00）
以 `--dry` 观测运行——CI 只发令，施工交给接入的 agent。

## 3. 验收门（scripts/accept.mjs）

| 门 | 检查 |
|----|------|
| G1 语法 | 全部 JS node --check |
| G2 平台体检 | 工单状态机 / 智能体注册表 / 设计原则 / 调度纪律 / 控制台一致性 / 任务存储（scripts/verify.mjs） |
| G3 平台自检 | MCP stdio 冒烟（12 工具 initialize/tools/call） |
| G4 资产纪律 | 控制台状态 + 四份原则文件齐全合法 |
| G5 账本纪律 | 迭代号唯一升序 |

FAIL 即打回；修改验收门本身需要独立工单并在账本声明。

## 4. MCP 接入

```json
{ "mcpServers": { "the-new-world": {
    "command": "node",
    "args": ["<仓库路径>/platform/mcp/server.mjs"] } } }
```

HTTP（k8s）：`POST http://<svc>/mcp`（Streamable HTTP，单条 JSON-RPC → application/json）。

工具（10）：`list_orders` / `read_order` / `platform_state` / `list_tasks` / `create_task` /
`set_task_status` / `list_agents` / `register_agent` / `run_gates` / `write_ledger` / `close_order` / `dispatch_next`。

## 5. 红线（详版见 AGENTS.md 迭代原则）

零依赖 · 厂商中立 · 账本只追加 · 检查器不可自改 · 宁缺毋滥 · 小步可运行。

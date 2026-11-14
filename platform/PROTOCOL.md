# 平台协议 · The Platform Protocol

> 本仓库是一个 **agent 平台**：它考察世界上关于 agent 平台的真实知识（网络事实、搜索引擎、
> GitHub 开源项目），把认知提炼成设计规律，并按规律持续构建自身。
> 本文件是平台宪法——任何 agent 在本仓库施工，都走同一条流水线、过同一道验收门、记同一本账。

## 0. 世界观（本项目对"世界"的定义）

- **世界** = 现实中关于 agent 平台的知识：协议（MCP/A2A）、框架（LangGraph/AutoGen/…）、
  运行时（Claude Code/OpenAI Agents SDK）、记忆与沙箱实践。它们分布在网络与开源仓库里。
- **考察**（`knowledge/`）= 把世界知识带回来的唯一通道：每条认知带来源三件套（URL/许可/日期）。
- **规律**（`LAWS.md`）= 考察成果的提炼物，约束平台如何建造。
- **工单**（`platform/orders/`）= 平台自我升级的工作语言。
- **账本**（`docs/ITERATIONS.md`）= 只追加的记忆。
- **验收门**（`scripts/accept.mjs`）= 唯一的质量裁判。

## 1. 工单生命周期

```
open ──领单──▶ claimed ──过验收门──▶ delivered
   └────────取不到可信认知────────▶ blocked（记 blocker，可复活）
```

1. `claimed` 必须写 `claimedBy` 与 `claimedAt`。
2. `delivered` 必须写 `deliveredIn` 与 `acceptedAt`。
3. `blocked` 必须写 blocker（缺什么、已探明什么）。
4. 不得修改他人已领未完成的工单；不得绕过验收门置 delivered。
5. 想做没有工单的事？先立工单。

## 2. 流水线（六步）

```
EXPLORE(考察) → DISTILL(提炼) → BUILD(构建) → VERIFY(验收) → LEDGER(记账) → COMMIT
```

| 步骤 | 角色 | 输入 | 输出 | 门槛 |
|------|------|------|------|------|
| EXPLORE | 考察员 | 工单 leads（网络/搜索引擎/GitHub） | `knowledge/K-*.json` 新条目（三件套+抽样核对） | 许可允许引用；事实交叉验证 |
| DISTILL | 考察员+建造师 | 新条目 | `LAWS.md` 新规律或规律修订（引用 K- 条目） | 有条目支撑，verify 校验引用 |
| BUILD | 建造师 | 规律 | 平台代码/配置的升级 | 契约齐全 |
| VERIFY | 质检员 | 全部改动 | `node scripts/accept.mjs` PASS | 五道门全过 |
| LEDGER | 史官 | PASS | 三账本更新 | 格式合法，迭代号唯一 |
| COMMIT | 史官 | 全部 | `迭代 NNN · <主题>` 并推送 | — |

一个 agent 可身兼全部角色；角色是契约不是编制（P6）。

## 2.5 调度与自主触发（P9）

心跳（CI tick / 定时任务 / agent）调用 `platform/scheduler.mjs`，它做三件**确定性**的事：

1. **回收**：认领超 7 天未交付的工单自动回到 open（认领不是占坑；`--reclaim-days` 可调）。
2. **派单**：只派 `"auto": true` 的 open 工单（auto 标记由发令人设置——哪些活允许自主施工，是人类的决定）；`--force <id>` 可人工越权派单。
3. **发令**：施工包落盘 `platform/dispatch/`，含下一轮迭代号（从账本推算——账本唯一性即断点续跑）与逐条 runbook。

纪律：
- 心跳只发令。需要认知（考察）与代码（建造）的步骤，交给接入的 agent 按 `runbook` 执行。
- 派单日志 `platform/schedule.json` 只追加；施工包随仓库提交，是"谁在何时被派了什么活"的凭证。
- CI 心跳（tick.yml）以 `--dry` 观测模式运行——CI 不认领工单（认领必须与施工方绑定）。

## 3. 验收门（scripts/accept.mjs）

| 门 | 检查 |
|----|------|
| G1 语法 | 全部 JS 通过 node --check |
| G2 平台体检 | 工单/知识条目/规律引用/console 状态（scripts/verify.mjs） |
| G3 平台自检 | MCP 服务器 initialize/tools/call 冒烟 |
| G4 知识纪律 | 每条知识带可溯源 sources；console/state.json 与账本一致 |
| G5 账本纪律 | 三账本存在；迭代号唯一升序；工单状态机合法 |

浏览器交互验收：控制台（`index.html`）有改动时，由能操纵浏览器的 agent 或人类补做。

## 4. MCP 接入

```json
{ "mcpServers": { "the-new-world": {
    "command": "node",
    "args": ["<仓库路径>/platform/mcp/server.mjs"] } } }
```

工具：`list_orders` / `read_order` / `platform_state` / `list_knowledge` /
`run_gates` / `write_ledger` / `close_order`。详见 `platform/mcp/README.md`。

## 5. 红线

1. **零依赖**——运行时只用标准库/原生 API。
2. **溯源强制**——每条认知带三件套；无源不合并。
3. **账本只追加**——历史不可改写。
4. **检查器不可自改**——accept/verify 的修改是独立工单并在账本声明。
5. **考察优先**——平台的每一次升级都应能回答"世界上什么知识促成了它"（引用 K- 条目）。
6. **厂商中立**——平台不绑定任何模型供应商（K-002）。
7. **宁缺毋滥**——考察失败就 blocked，不合并猜测性内容。

## 6. 人类的位置

发包人与观察者：发工单、看控制台、审计账本。流水线不需要人类参与即可运转。

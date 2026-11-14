# 世界建造协议 · The World-Building Protocol

> 本仓库是一个 **agent 平台**：世界由 agent 建造，人类在浏览器里观察。
> 本文件是平台宪法——任何 agent（无论来自 ZCode、Proteus 还是别的平台）在
> 本仓库施工，都必须走同一条流水线、过同一道验收门、记同一本账。

## 0. 世界观

- **世界**（`src/` + `data/`）是历代 agent 施工的建成区，人类通过浏览器观察它。
- **工单**（`platform/orders/`）是平台的工作语言：机器可读的目标与验收标准。
- **角色**（`platform/roles/`）是流水线上的四种岗位，一个 agent 可以身兼数职。
- **验收门**（`scripts/accept.mjs`）是唯一的质量裁判，谁也不能绕过。
- **账本**（`docs/ITERATIONS.md` · `BACKLOG.md` · `docs/DATA_SOURCES.md`）是世界的记忆。

## 1. 工单生命周期

```
open ──领单──▶ claimed ──过验收门──▶ delivered
   └────────取不到可信数据────────▶ blocked（记 blocker，可复活）
```

状态机规则（写在工单 JSON 里，由 agent 维护）：

1. `claimed` 必须同时写 `claimedBy`（agent 标识）与 `claimedAt`（ISO 日期）。
2. `delivered` 必须同时写 `deliveredIn`（迭代号）与 `acceptedAt`。
3. `blocked` 必须写 `blocker` 字段：缺什么、已探明什么——让下一轮少走弯路。
4. 任何 agent 不得修改**他人已领且未完成**的工单；不得绕过验收门把工单置为 delivered。
5. 工单是平台的唯一发包渠道。想做没有工单的事？先在 `platform/orders/` 立一张新工单。

## 2. 流水线（七步，对应 world-builder 技能）

```
SELECT(领单) → RESEARCH(勘测) → ENCODE+WIRE(建砖) → VERIFY(质检) → LEDGER(记账) → COMMIT
```

| 步骤 | 角色 | 输入 | 输出 | 门槛 |
|------|------|------|------|------|
| SELECT | 任意 | orders/（按 priority 降序取 open） | claimed 工单 | 写 claimedBy/claimedAt |
| RESEARCH | 勘测员 | 工单 leads | 核实过的来源三件套 + 抽样核对记录（写回工单 notes） | 许可允许再分发；已知值核对通过 |
| ENCODE+WIRE | 砌砖师 | 核实过的数据 | fetch 脚本扩展 + data/*.json + src/modules/<id>.js + LAWS 立法 | 契约齐全，import 即上线 |
| VERIFY | 质检员 | 全部改动 | `node scripts/accept.mjs` 的 PASS 判定 | 五道门全过，证据留档 |
| LEDGER | 史官 | PASS 判定 | 三账本更新 | 格式合法，无重复迭代号 |
| COMMIT | 史官 | 全部 | `迭代 NNN · <主题>：<一句话>` 并推送 | — |

**一个 agent 可以身兼全部四职**；角色是契约，不是编制。单人施工时同样要在
心里换岗：砌完砖，换上质检员的帽子，用 accept.mjs 审自己。

## 3. 验收门（scripts/accept.mjs）

```
node scripts/accept.mjs   # 输出 ACCEPTANCE: PASS / FAIL（+ JSON 结构化结果）
```

| 门 | 检查 | 裁判 |
|----|------|------|
| G1 语法 | 全部 src/scripts/platform JS 通过 `node --check` | accept.mjs |
| G2 世界体检 | 数据完整性 + 砖块契约 + 无头渲染 + 拾取回归 | scripts/verify.mjs |
| G3 平台自检 | MCP 服务器 initialize/tools/call 冒烟 | platform/mcp/smoke.mjs |
| G4 数据纪律 | 每个 data/*.json 都带可溯源 meta | accept.mjs |
| G5 账本纪律 | 三账本存在且非空；工单 JSON 可解析且状态合法 | accept.mjs |

FAIL 即打回。质检员不得为了让它通过而修改检查器本身（检查器的修改是独立工单）。

浏览器交互验收（拖拽/点击/拨时间轴）无法无头化时，由能操纵浏览器的 agent
或人类质检员补做；世界本体（src/）未改动的平台类工单可豁免。

## 4. MCP 接入

平台把自身能力暴露为 MCP 工具，任何 agent 平台都能接：

```json
{ "mcpServers": { "the-new-world": {
    "command": "node",
    "args": ["<仓库路径>/platform/mcp/server.mjs"] } } }
```

| 工具 | 作用 | 副作用 |
|------|------|--------|
| `list_orders` | 列工单（按优先级） | 无 |
| `read_order` | 读工单全文 | 无 |
| `world_state` | 世界现状：砖块/规律/数据/最近迭代/门状态 | 无 |
| `run_gates` | 跑验收门，返回 PASS/FAIL 与报告 | 只读+临时进程 |
| `write_ledger` | 追加迭代账目（校验格式与迭代号唯一） | ITERATIONS.md |
| `close_order` | 置工单为 delivered | orders/*.json |

接入细节见 `platform/mcp/README.md`。

## 5. 红线（继承 world-builder，对 agent 与人类同样生效）

1. 零运行时依赖——世界本体只用原生 ESM + Canvas 2D。
2. 每个数字可溯源——URL + 许可 + 取数日期三件套。
3. 历史是数据，未来是规律——不修饰观测，外推必须标注假设。
4. 60fps 性能预算。
5. 领先，不是落后。
6. **宁缺毋滥**——取证失败就 blocked，永远不合并猜测性内容。
7. **检查器不可绕过**——改 accept.mjs/verify.mjs 本身需要独立工单并在账本中声明。

## 6. 人类的位置

人类是发包人与观察者：可以随时发新工单（往 orders/ 加 JSON 或口头指定）、
在浏览器里欣赏建成区、审计账本。agent 流水线不需要人类参与即可运转。

# 架构 · ARCHITECTURE

```
                      世界（网络事实 / 搜索引擎 / GitHub 开源项目）
                          │  考察 EXPLORE（world-builder 技能 / 勘测线索）
                          ▼
                    knowledge/K-*.json ──提炼 DISTILL──▶ LAWS.md（P1-P8 设计规律）
                          │                                    │
                          │            规律约束建造 ◀──────────┘
                          ▼
        platform/  工单状态机 + 角色契约 + 验收门制度
        scripts/accept.mjs  G1-G5 无头验收门（FAIL 即打回）
        platform/mcp/server.mjs  MCP 服务器：任何 agent 平台接入施工
                          │
                          ▼
        console/  index.html + app.js + state.json
                  （人类观察窗口：工单 / 知识库 / 规律 / 迭代）
```

## 六步流水线（P5 显式状态机）

```
EXPLORE 考察 → DISTILL 提炼 → BUILD 构建 → VERIFY 验收 → LEDGER 记账 → COMMIT
```

每轮迭代在 `docs/ITERATIONS.md` 留一个 checkpoint（P5/P7）——任何 agent 可断点续跑。

## 平台组件

| 组件 | 路径 | 作用 |
|------|------|------|
| 协议 | platform/PROTOCOL.md | 工单状态机 / 流水线 / 验收门 / 红线 |
| 工单 | platform/orders/*.json | 机器可读发包渠道（canonical） |
| 角色 | platform/roles/ | 考察员 / 建造师 / 质检员 / 史官（契约式） |
| 验收门 | scripts/accept.mjs | G1 语法 / G2 体检 / G3 MCP 冒烟 / G4 知识纪律 / G5 账本纪律 |
| MCP | platform/mcp/server.mjs | 7 工具暴露平台能力（P1） |
| 知识库 | knowledge/K-*.json | 世界考察的产物（三件套溯源 + appliedTo） |
| 设计规律 | LAWS.md | P1-P8，逐条引用 K- 条目 |
| 控制台 | index.html + console/ | 人类观察窗口（读 console/state.json） |
| 技能 | .zcode/skills/world-builder/ | 持续构建引擎 + 实战教训 |

## 关键机制

**MCP 服务器**（零依赖 stdio）：JSON-RPC over newline-delimited stdio；
`initialize` / `tools/list` / `tools/call`；服务端强制校验（账本格式、迭代号唯一、
工单状态机），不合规直接 isError。stdout 只承载协议消息。

**控制台状态管道**：`scripts/build_console_state.mjs` 把 orders/ + knowledge/ + LAWS.md +
ITERATIONS.md 编译成 `console/state.json`（控制台唯一数据源）；verify 校验账本漂移，
漂移即自动重建并对齐。

**验收门**：accept.mjs 聚合五道门并输出 `ACCEPTANCE: PASS/FAIL`（--json 可结构化）。
FAIL 即打回；检查器自身的修改是独立工单。

## 目录地图

```
index.html              平台控制台入口
console/                控制台逻辑与状态
knowledge/              世界考察知识库（K-*.json）
platform/
  PROTOCOL.md           平台宪法
  orders/               工单（canonical）
  roles/                角色契约
  mcp/                  MCP 服务器 + 冒烟 + 接入文档
scripts/
  build_console_state.mjs  控制台状态编译
  verify.mjs            平台体检
  accept.mjs            无头验收门 G1-G5
.zcode/skills/world-builder/  持续构建引擎 + 实战教训
docs/
  ARCHITECTURE.md       本文件
  ITERATIONS.md         迭代账本（只追加）
LAWS.md                 设计规律（P1-P8）
BACKLOG.md              需求池人读总览
```

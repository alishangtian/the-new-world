---
name: world-builder
description: the-new-world 仓库的持续构建引擎——考察世界上关于 agent 平台的真实知识（网络事实/搜索引擎/GitHub 开源），提炼成设计规律，按规律升级平台。当用户要求"继续迭代"、"考察/研究 agent 平台的某个主题"、"升级平台"、"加功能"、"修平台问题"，甚至只说"继续"时使用本技能——即使没提"world-builder"。
---

# World Builder · 持续构建引擎

本仓库是一个 **agent 平台**，它靠考察世界来生长：
**世界的知识（网络/搜索/GitHub）→ knowledge/ 知识条目 → LAWS.md 设计规律 → 平台升级。**
本技能驱动这个循环。任何人类或 AI 在本仓库施工，都走同一条流水线。

## 开工前：先读平台状态（顺序固定）

1. `docs/ITERATIONS.md` 最后两轮——平台现状与上轮遗留线索。
2. `platform/orders/`——工单池（接了 MCP 可直接 `list_orders` / `read_order`）。
3. 写代码前读 `.zcode/skills/world-builder/references/lessons.md`——实战教训。

## 迭代循环（六步）

```
EXPLORE → DISTILL → BUILD → VERIFY → LEDGER → COMMIT
```

### 1. EXPLORE 考察世界
- 从工单 `leads` 出发：官方规范/文档 > GitHub 开源仓库 > 搜索引擎交叉验证。
- 输出 `knowledge/K-*.json`：三件套（来源 URL / 许可 / 日期）+ `insight`（认知本体）+
  `appliedTo`（它应该改变本平台的什么）。
- **点开链接核实**：规范版本、仓库名、字段名，不以记忆为准。
- 考察不到可信知识 → 工单转 blocked 记 blocker，本轮中止，不合并猜测性内容。

### 2. DISTILL 提炼规律
- 认知提炼成 `LAWS.md` 的设计规律（P 编号），规律行必须引用 K- 条目作为依据。
- 没有考察条目支撑的"规律"是观点，进不了 LAWS（verify 会拦）。

### 3. BUILD 构建
- 按规律升级平台（platform/、console/、scripts/…），零依赖红线内。
- 改动控制台 → 重跑 `node scripts/build_console_state.mjs`。

### 4. VERIFY 验收（两道门）
```bash
node scripts/accept.mjs      # 门一：G1-G5 无头验收门（接 MCP 可直接 run_gates）
python3 -m http.server 8000  # 门二：浏览器验收控制台（index.html）
```
- 门二检查：各标签页正常、知识筛选可用、数据与账本一致。
- 诊断口：`window.__world` 不存在了；平台问题直接读 accept 输出与页内 console。

### 5. LEDGER 记账
- `docs/ITERATIONS.md` 追加本轮（格式见其顶部模板）；`BACKLOG.md` 与工单状态同步。
- 接了 MCP 可用 `write_ledger` / `close_order`（服务端强制格式与迭代号唯一）。

### 6. COMMIT
- `迭代 NNN · <主题>：<一句话>`，推送 origin/main。下一轮从 EXPLORE 重新开始。

## 完成定义（DoD）

- [ ] 新知识条目：三件套齐 + appliedTo 指向平台具体位置
- [ ] 规律引用链：LAWS 的 P 行引用真实存在的 K- 条目
- [ ] accept.mjs 五门全绿
- [ ] 浏览器验收通过（控制台有改动时）
- [ ] 两账本同步（ITERATIONS + BACKLOG/工单状态）

## 中止规则

考察失败、知识不可信、验收过不了 → 工单 blocked 记 blocker，本轮中止。平台宁缺毋滥。

## 红线

1. 零运行时依赖——标准库 / 原生 Web API 之外的东西需要独立工单论证。
2. 溯源强制——每条认知带三件套；无源不合并。
3. 账本只追加——历史不可改写。
4. 检查器不可自改——accept/verify 的修改是独立工单并登记账本。
5. 厂商中立——平台不绑定任何模型供应商。
6. 领先，不是落后——先看世界上最好的做法，再动手。

## 平台速览（细节见 platform/PROTOCOL.md）

- 工单：`platform/orders/*.json`（canonical）+ `BACKLOG.md`（人读总览）
- 角色：`platform/roles/` 考察员 / 建造师 / 质检员 / 史官（契约，可一人分饰）
- MCP：`platform/mcp/server.mjs`（7 工具）+ `smoke.mjs` 自检
- 验收门：`scripts/accept.mjs`（G1 语法 / G2 平台体检 / G3 MCP 冒烟 / G4 知识纪律 / G5 账本纪律）
- 控制台：根目录 `index.html`（人类观察窗口，数据来自 console/state.json）

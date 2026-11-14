# 迭代账本 · ITERATIONS

> 本项目以迭代为单位生长。每轮迭代在本文件登记一次，格式如下。
> 最新迭代在最下方。下一轮迭代开工前，先读本文件的最后两轮。

```text
## 迭代 NNN · <标题>（<日期>）
- 目标：<一句话>
- 认知来源：<数据集 + URL>
- 产物：<新增/修改的文件清单（概要）>
- 新规律：<LAWS.md 编号>
- 验收证据：<verify.mjs 结果 + 浏览器交互做了什么>
- 提交：<commit hash>
- 遗留线索：<下轮可选的跟进点>
```

---

## 迭代 001 · 初建世界（2026-11-14）

- **目标**：建立世界本体与施工体系——引擎、六块知识砖、交互界面、可溯源数据层、体检与技能。
- **认知来源**：World Bank API（SP.POP.TOTL / NY.GDP.MKTP.CD）、Our World in Data owid/co2-data、
  Natural Earth populated places、topojson/world-atlas、lukes/ISO-3166、i18n-iso-countries（详见 DATA_SOURCES.md）。
- **产物**：
  - 引擎 `src/engine/`（正交投影+可见半球裁剪、太阳星历、序列插值+逻辑斯蒂外推、屏幕反投影拾取）
  - 知识砖块 `src/modules/`：星海 / 大地 / 昼夜 / 生命 / 联结 / 碳
  - 界面 `src/ui/`（砖块面板、时间轴 1960–2050、速度档位、HUD、国别档案卡）
  - 数据层 `data/`（177 国边界、215 国序列、600 城，~1MB 随仓库离线分发）
  - 体检 `scripts/verify.mjs` + 采集 `scripts/fetch_data.py` + CI
- **新规律**：L1–L6（LAWS.md）。
- **验收证据**：浏览器交互验收（旋转/点击国别/时间轴拨动 1960↔2026、灯火与晨昏线随律变化）；
  `verify.mjs` 全绿（含拾取回归 6/6：成都→China、东京→Japan、大西洋→null）。
- **提交**：`02e7765`
- **遗留线索**：国别卡片可实时跟随时间轴刷新；移动端双指缩放可再加惯性。

---

## 迭代 002 · 板块与地震（2026-11-14）

- **目标**：把"地球最活跃的动力学"编码进世界——让 L7 板块律肉眼可见：震中沿板块边界聚集。
- **认知来源**：
  - USGS 地震馈送（近 30 天 M2.5+）：`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson`（公有领域）
  - 板块边界 PB2002（Bird 2003）：`https://github.com/fraxen/tectonicplates`（开源地球科学数据）
- **产物**：`data/quakes.json`、`data/plates.json`、`scripts/fetch_data.py` 新增两源、
  `src/modules/quake.js`（板块边界线 + 震中脉冲，亮度/半径随震级）、`src/main.js` 注册、
  `verify.mjs` 新增本砖契约与数据校验。
- **新规律**：L7 板块律（LAWS.md）——震中聚集于板块边界带（环太平洋带肉眼可验）。
- **验收证据**：`verify.mjs` 全绿；浏览器中板块边界与震中脉冲重合呈现，开关砖块正常。
- **提交**：见 git log。
- **遗留线索**：可加震深维度（深源地震着色）；USGS 30 天窗口可改为拉取更长历史做"地震气候"。

---

## 迭代 003 · agent 平台化（2026-11-14）

- **目标**：把仓库从"技能驱动的迭代项目"升级为 **agent 平台**——任何平台的 agent 都能
  领工单、建砖、过验收门、记账，全程无需人类参与。
- **认知来源**：MCP（Model Context Protocol）开放标准；本仓库迭代 001/002 沉淀的施工法。
- **产物**：
  - `platform/PROTOCOL.md` —— 平台宪法（工单状态机 / 流水线 / 验收门 / 红线）
  - `platform/orders/` —— 9 张机器可读工单（ORD-003…011，含评分/线索/验收标准/状态机）
  - `platform/roles/` —— 四角色契约：勘测员 / 砌砖师 / 质检员 / 史官
  - `scripts/accept.mjs` —— 无头验收门 G1-G5（语法 / 体检 / 平台自检 / 数据纪律 / 账本纪律）
  - `platform/mcp/server.mjs` —— 零依赖 MCP 服务器（6 工具：list_orders / read_order /
    world_state / run_gates / write_ledger / close_order，服务端强制账本格式与工单状态机）
  - `platform/mcp/smoke.mjs` + `README.md` —— 平台自检与接入文档
- **新规律**：无（平台类迭代，世界本体未动）。
- **验收证据**：`accept.mjs` 五道门全 PASS；MCP 冒烟 8/8（握手/工具/工单/世界状态/
  账本校验拦截）；世界本体零改动（src/ 与 data/ 未动，浏览器门豁免）。
- **提交**：见 git log。
- **遗留线索**：让 Proteus 等外部 agent 平台实际接入施工一轮（迭代 004 可从 ORD-004 航线网开始）；
  工单可加"认领超时自动回收"。

---

## 迭代 004 · 转向 agent 平台（2026-11-14）

- **目标**：纠正项目方向——本仓库不是世界模拟器，而是 **agent 平台**；"世界"指现实中
  关于 agent 平台的知识（网络事实/搜索引擎/GitHub 开源），平台靠考察这些知识持续更新自身。
- **认知来源**（本轮考察成果，全部入库 `knowledge/`）：
  - K-001 MCP 2026-07-28 规范（web 原生架构）：blog.modelcontextprotocol.io/posts/2026-07-28
  - K-002 A2A 互操作协议（Linux Foundation）：github.com/a2aproject/a2a
  - K-003 Claude Code 技能/子代理模式：code.claude.com/docs
  - K-004 OpenAI Agents SDK 原语（handoffs/guardrails/tracing）
  - K-005 LangGraph 显式状态图 + checkpoint
  - K-006 AutoGen/CrewAI 角色契约模式
  - K-007 Letta/Mem0 记忆两层模式
  - K-008 E2B 沙箱 + SWE-bench 评估范式
- **产物**：
  - 移除：世界模拟全部内容（src/ 地球引擎与六砖、data/ 地理数据、fetch_data.py、旧 index）
  - 新增：`knowledge/`（8 条可溯源考察条目）、`LAWS.md` 重写（P1–P8 平台设计规律，逐条引用
    K- 条目）、`platform/orders/` 6 张平台工单（调度器/注册表/记忆/互操作/沙箱/评估）、
    `platform/PROTOCOL.md` 重写（考察→提炼→构建→验收→记账→提交）、四角色重写（考察员/建造师/
    质检员/史官）、`console/` + `index.html` 平台控制台（工单/知识库/规律/迭代/接入，零依赖）、
    `scripts/build_console_state.mjs`、verify.mjs 与 accept.mjs G4 适配平台、MCP 工具升级
    （platform_state / list_knowledge）
- **新规律**：P1–P8（LAWS.md，全部有 K- 条目支撑）。
- **验收证据**：accept.mjs 五门全 PASS（语法/平台体检/MCP 冒烟 9 项/知识纪律/账本纪律）；
  控制台浏览器验收（标签页切换/知识筛选/账本一致）。
- **提交**：见 git log。
- **遗留线索**：外部 agent 平台（Proteus）实际接入施工一轮；ORD-012 调度器让平台自主触发。

---

## 迭代 005 · 任务调度器（2026-11-14）

- **目标**：平台获得自主触发能力（P9 立法落地）——心跳发令、确定性派单、断点续跑。
- **认知来源**：K-009（GitHub Actions schedule，POSIX cron/UTC/最小 5 分钟，官方文档核实）+ K-005（显式状态机 + checkpoint）。
- **产物**：
  - `platform/scheduler.mjs`：确定性派单（只派 auto-ok 工单、认领超 7 天自动回收、
    迭代号从账本推算、施工包落盘 platform/dispatch/）
  - `.github/workflows/tick.yml`：每日 UTC 01:00 心跳（--dry 观测模式，CI 只发令不认领）
  - MCP 新工具 `dispatch_next {dry?}`（观测/真实两种模式）
  - 控制台总览新增「自主调度」卡片（auto-ok 待施工数 + 派单历史）
  - 工单新增 `auto` 标记（发令人决定哪些活可自主施工；ORD-012/013 已标记）
  - verify 新增调度纪律门（心跳日志唯一性 / 施工包引用合法性）
- **新规律**：P9 自主触发（LAWS.md，依据 K-005 · K-009）。
- **验收证据**：accept.mjs 五门全 PASS；MCP 冒烟 10 项全过（含 dispatch_next 观测模式）；
  真实派单演示成功——调度器认领 ORD-013 并落盘施工包（迭代号从账本推算）。
- **提交**：见 git log。
- **遗留线索**：tick 心跳目前只观测；接入 agent runner 后可升级为完整自主循环（配合 ORD-015）。

---

## 迭代 006 · 控制台富功能化（2026-11-14）

- **目标**：按 P10 可观测一等，把平台自身的"认知→规律→施工→交付"链路做成可交互的页面能力。
- **认知来源**：K-010（agent 可观测性控制台范式：trace 时间线/span 检查/回放/评估——
  LangSmith、AgentOps、Langfuse、Phoenix 等功能公约数）+ 平台自有数据（knowledge/orders/dispatch/账本）。
- **产物**：
  - 新页「溯源链」：任选考察条目，回放"认知→规律→落地位置"完整链路（K-001→P1→server.mjs 等）
  - 工单页：状态筛选 chips + 施工包视图（调度器 runbook 六步可见）+ auto 标记 + 交付信息
  - 知识库页：主题 chips 筛选 + 认知↔规律交叉跳转（↗ P1/P2…）+ 来源列表
  - 迭代账本页：时间线化（圆点连线，目标/遗留线索详情化）
  - 总览：知识主题分布条形图、MCP 平台能力卡（工具数与清单）、调度器状态卡
  - build_console_state.mjs 重写：迭代详情/施工包/MCP 工具解析/交叉引用全部入 state.json
  - 入口加 cache-busting（v=006）；落地位置渲染去 markdown 反引号
- **新规律**：P10 可观测一等（LAWS.md，依据 K-010）。
- **验收证据**：accept.mjs 五门全 PASS；浏览器逐页演示（溯源链 K-001→P1、知识库筛选+交叉
  chips、工单筛选+施工包、迭代时间线），探针确认路由/筛选/交叉跳转行为正确。
- **提交**：见 git log。
- **遗留线索**：控制台可加"验收门实时状态"（接入 run_gates）；light 主题；工单页内直接领单按钮。

# 需求池 · BACKLOG（人读总览）

> **canonical 是 `platform/orders/*.json`（机器可读工单）**——本表是它的总览视图，
> LEDGER 步骤必须两处同步。评分 = 影响力 / 数据可得 / 规律清晰 / 戏剧性（各 1–5）。
> agent 领单走 world-builder 技能（SELECT 步），或经平台 MCP `list_orders` / `read_order`。

| 工单 | 候选 | 认知来源线索 | 规律草案 | 影/数/律/戏 | 总分 | 状态 |
|------|------|--------------|----------|-------------|------|------|
| 002 | 板块与地震 | USGS 地震馈送 + fraxen/tectonicplates (PB2002) | L7 震中聚集于板块边界带 | 4/5/5/5 | 19 | ✅ 已交付 |
| ORD-004 | 全球机场与航线网 | OpenFlights (jpatokal/openflights) | L5 引力律的实证场：航线 ∝ 城市引力 | 4/5/5/4 | 18 | 🟢 open |
| ORD-009 | 夜间灯光与经济活动 | NASA VIIRS/DMSP（需降采样策略） | L12 候选：灯光总量与 GDP 弹性 ~0.3 | 5/3/4/5 | 17 | 🟢 open |
| ORD-003 | 大河与文明带 | Natural Earth rivers | L8 候选：大河下游与人口密集带共现 | 4/5/4/3 | 16 | 🟢 open |
| ORD-005 | 洋流与热量输运 | NOAA/NODC（数据需甄别） | L9 候选：暖流增温/寒流降温 vs 沿岸人口 | 5/3/4/4 | 16 | 🟢 open |
| ORD-010 | 国际贸易流 | UN Comtrade API（免费层限流） | L5 完全体：双边贸易 vs GDP·GDP/d | 5/3/5/3 | 16 | 🟢 open |
| 008 | 活火山链 | Smithsonian GVP（许可未确认） | L7 姊妹律：火山链与俯冲带重合 | 4/2/5/4 | 15 | ⛔ blocked |
| ORD-006 | 时区与人 | IANA tzdata + timezone-boundary-builder | L10 候选：社会时 vs 太阳时偏差谱 | 3/5/3/3 | 14 | 🟢 open |
| ORD-007 | 语言谱系 | Glottolog（目录型，面数据另寻） | L11 候选：纬度/隔离度-语言多样性 | 4/4/3/3 | 14 | 🟢 open |
| ORD-011 | 铁路网与城市化 | OSM 派生（太重，缺轻量源） | 路网密度阶梯与人均 GDP | 3/2/3/2 | 10 | ⛔ blocked |

## 立项

想加新候选：直接在 `platform/orders/` 新建一张工单 JSON（字段抄现有的），并在本表加一行。
人类发包人也可以口头指定主题，由 agent 立单。

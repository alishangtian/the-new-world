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

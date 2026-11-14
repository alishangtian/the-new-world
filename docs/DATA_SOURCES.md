# 数据来源 · Data Sources

> 本仓库的第一条施工原则：**每一个数字都要能溯源。**
> 数据随仓库提交（离线可用）；重新采集运行 `python3 scripts/fetch_data.py`（可重复、幂等）。

| 数据集 | 来源 | 许可证 | 取数日期 | 转换 |
|--------|------|--------|----------|------|
| 国家边界（110m TopoJSON→GeoJSON） | [topojson/world-atlas](https://github.com/topojson/world-atlas) `countries-110m.json`（边界源自 [Natural Earth](https://www.naturalearthdata.com/)） | MIT / 边界公有领域 | 2026-11-14 | 自研 TopoJSON 弧段解码（delta 还原 + 负索引反转），见 `scripts/fetch_data.py` |
| 人口（1960–2025，逐年） | [World Bank Open Data](https://data.worldbank.org/indicator/SP.POP.TOTL) `SP.POP.TOTL` | CC BY-4.0 | 2026-11-14 | 聚合过滤（剔除 Aggregates），按 ISO 数字码索引 |
| GDP（现价美元，1960–） | [World Bank Open Data](https://data.worldbank.org/indicator/NY.GDP.MKTP.CD) `NY.GDP.MKTP.CD` | CC BY-4.0 | 2026-11-14 | 同上 |
| CO₂ 排放（人均吨 & 全球百万吨） | [Our World in Data: owid/co2-data](https://github.com/owid/co2-data) `co2_per_capita` / `co2` | CC BY-4.0 | 2026-11-14 | CSV 按国别/世界行拆分，1960 年起 |
| ISO 编码映射（数字↔字母↔区域） | [lukes/ISO-3166-Countries-with-Regional-Codes](https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes) | 无明确许可（CC0 样式公开数据表） | 2026-11-14 | 建立 数字码↔alpha3↔alpha2 桥 |
| 国家中文名 | [i18n-iso-countries](https://github.com/michaelwittig/node-i18n-iso-countries) `langs/zh.json` | MIT | 2026-11-14 | alpha2 → 中文名 |
| 城市（600 座，坐标/人口/首都标记） | [Natural Earth populated places](https://www.naturalearthdata.com/downloads/) `ne_10m_populated_places_simple` | 公有领域 | 2026-11-14 | POP_MAX 去重取前 600；主要城市中文名为人工核对表（`CITY_ZH`） |

## 产物

| 文件 | 内容 | 体积 |
|------|------|------|
| `data/earth.json` | 177 国边界（GeoJSON）+ 陆地总廓 | ~305 KB |
| `data/meta.json` | 215 国 × 人口/GDP/CO₂ 时间序列 + 世界聚合 + 中文名 | ~660 KB |
| `data/cities.json` | 600 座城市（经纬度、人口、ISO3、首都标记、中文名） | ~54 KB |

## 引用规范

界面上的每一块砖都在"来源"栏给出可点击的原始链接；
`data/*.json` 的 `meta` 字段携带同样的溯源信息与取数日期。

## 已知边界情况

- 世界银行未收录的政治实体（如索马里兰、北塞浦路斯）在 Natural Earth 中 ISO 码为 `-99`，
  转换脚本对其合成 id（`-99:名称`），渲染正常但无数据档案。
- 科索沃（XKX）有世界银行档案但无 ISO 数字码，仅出现在 `byIso3` 索引。

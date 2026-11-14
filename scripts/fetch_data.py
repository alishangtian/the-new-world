#!/usr/bin/env python3
"""
新世界 · 数据采集脚本（可重复运行）
====================================

把「对现实世界的认知」从网络事实与开源项目中搬运进本仓库。
每一条数据都可以溯源，详见 docs/DATA_SOURCES.md。

数据源（均为公开、可再分发的来源）：
  1. world-atlas (topojson/world-atlas, MIT)        —— 国家边界 TopoJSON (110m)
  2. World Bank Open Data API (CC BY-4.0)           —— 人口 / GDP 时间序列
  3. owid/co2-data (CC BY-4.0, GitHub 开源)         —— CO₂ 排放时间序列
  4. Natural Earth populated places (公有领域)       —— 主要城市坐标与人口
  5. lukes/ISO-3166-Countries-with-Regional-Codes   —— ISO 编码映射
  6. i18n-iso-countries (MIT)                       —— 国家中文名

运行： python3 scripts/fetch_data.py
输出： data/earth.json  data/meta.json  data/cities.json
"""

import csv
import io
import json
import sys
import urllib.request
from datetime import date, datetime, timezone

BASE = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2"
WORLD_ATLAS = f"{BASE}/countries-110m.json"
WB_COUNTRIES = "https://api.worldbank.org/v2/country?format=json&per_page=400"
WB_INDICATOR = "https://api.worldbank.org/v2/country/all/indicator/{code}?format=json&per_page=20000&date=1960:2026"
ISO_CSV = "https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.csv"
ZH_JSON = "https://cdn.jsdelivr.net/npm/i18n-iso-countries@7/langs/zh.json"
CITIES_GEOJSON = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson"
OWID_CO2_CSV = "https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv"

INDICATORS = {
    "pop": "SP.POP.TOTL",       # 人口总数
    "gdp": "NY.GDP.MKTP.CD",    # GDP（现价美元）
}

CITY_TOP_N = 600
YEARS = range(1960, 2027)

# 主要城市中文名（人工核对表；未命中的城市回退英文名）
CITY_ZH = {
    "Tokyo": "东京", "Delhi": "德里", "Shanghai": "上海", "São Paulo": "圣保罗",
    "Mexico City": "墨西哥城", "Cairo": "开罗", "Mumbai": "孟买", "Beijing": "北京",
    "Dhaka": "达卡", "Osaka": "大阪", "New York City": "纽约", "New York": "纽约",
    "Karachi": "卡拉奇", "Buenos Aires": "布宜诺斯艾利斯", "Chongqing": "重庆",
    "Istanbul": "伊斯坦布尔", "Kolkata": "加尔各答", "Manila": "马尼拉", "Lagos": "拉各斯",
    "Rio de Janeiro": "里约热内卢", "Tianjin": "天津", "Kinshasa": "金沙萨",
    "Guangzhou": "广州", "Los Angeles": "洛杉矶", "Moscow": "莫斯科", "Shenzhen": "深圳",
    "Lahore": "拉合尔", "Bangalore": "班加罗尔", "Paris": "巴黎", "Bogotá": "波哥大",
    "Jakarta": "雅加达", "Chennai": "金奈", "Lima": "利马", "Seoul": "首尔",
    "Nagoya": "名古屋", "Hyderabad": "海得拉巴", "London": "伦敦", "Tehran": "德黑兰",
    "Chicago": "芝加哥", "Chengdu": "成都", "Nanjing": "南京", "Wuhan": "武汉",
    "Ho Chi Minh City": "胡志明市", "Luanda": "罗安达", "Ahmedabad": "艾哈迈达巴德",
    "Kuala Lumpur": "吉隆坡", "Xi'an": "西安", "Xian": "西安", "Hong Kong": "香港",
    "Dongguan": "东莞", "Hangzhou": "杭州", "Foshan": "佛山", "Shenyang": "沈阳",
    "Riyadh": "利雅得", "Baghdad": "巴格达", "Santiago": "圣地亚哥", "Surat": "苏拉特",
    "Madrid": "马德里", "Suzhou": "苏州", "Pune": "浦那", "Harbin": "哈尔滨",
    "Houston": "休斯敦", "Dallas": "达拉斯", "Toronto": "多伦多", "Miami": "迈阿密",
    "Belo Horizonte": "贝洛奥里藏特", "Singapore": "新加坡", "Philadelphia": "费城",
    "Atlanta": "亚特兰大", "Fukuoka": "福冈", "Khartoum": "喀土穆", "Barcelona": "巴塞罗那",
    "Johannesburg": "约翰内斯堡", "Saint Petersburg": "圣彼得堡", "Qingdao": "青岛",
    "Dalian": "大连", "Zhengzhou": "郑州", "Hanoi": "河内", "Bangkok": "曼谷",
    "Ankara": "安卡拉", "Berlin": "柏林", "Rome": "罗马", "Sydney": "悉尼",
    "Melbourne": "墨尔本", "Warsaw": "华沙", "Kyiv": "基辅", "Kiev": "基辅",
    "Vienna": "维也纳", "Amsterdam": "阿姆斯特丹", "Brussels": "布鲁塞尔",
    "Stockholm": "斯德哥尔摩", "Oslo": "奥斯陆", "Copenhagen": "哥本哈根",
    "Helsinki": "赫尔辛基", "Dublin": "都柏林", "Lisbon": "里斯本", "Athens": "雅典",
    "Prague": "布拉格", "Budapest": "布达佩斯", "Bucharest": "布加勒斯特",
    "Casablanca": "卡萨布兰卡", "Addis Ababa": "亚的斯亚贝巴", "Nairobi": "内罗毕",
    "Accra": "阿克拉", "Abidjan": "阿比让", "Dakar": "达喀尔", "Algiers": "阿尔及尔",
    "Tunis": "突尼斯", "Dubai": "迪拜", "Doha": "多哈", "Jeddah": "吉达",
    "Tel Aviv": "特拉维夫", "Jerusalem": "耶路撒冷", "Amman": "安曼", "Beirut": "贝鲁特",
    "Damascus": "大马士革", "Islamabad": "伊斯兰堡", "Colombo": "科伦坡",
    "Kathmandu": "加德满都", "Yangon": "仰光", "Phnom Penh": "金边", "Vientiane": "万象",
    "Taipei": "台北", "Ulaanbaatar": "乌兰巴托", "Pyongyang": "平壤", "Almaty": "阿拉木图",
    "Tashkent": "塔什干", "Baku": "巴库", "Tbilisi": "第比利斯", "Yerevan": "埃里温",
    "Kabul": "喀布尔", "Vancouver": "温哥华", "Montreal": "蒙特利尔", "Ottawa": "渥太华",
    "Seattle": "西雅图", "San Francisco": "旧金山", "Denver": "丹佛", "Phoenix": "菲尼克斯",
    "Boston": "波士顿", "Washington": "华盛顿", "Detroit": "底特律", "Havana": "哈瓦那",
    "Caracas": "加拉加斯", "Quito": "基多", "Montevideo": "蒙得维的亚",
    "Brasília": "巴西利亚", "Medellín": "麦德林", "Guadalajara": "瓜达拉哈拉",
    "Monterrey": "蒙特雷", "Cape Town": "开普敦", "Auckland": "奥克兰", "Perth": "珀斯",
    "Brisbane": "布里斯班", "Sapporo": "札幌", "Incheon": "仁川", "Busan": "釜山",
    "Ningbo": "宁波", "Wuxi": "无锡", "Shantou": "汕头", "Guiyang": "贵阳",
    "Nanning": "南宁", "Changchun": "长春", "Taiyuan": "太原", "Lanzhou": "兰州",
    "Urumqi": "乌鲁木齐", "Xiamen": "厦门", "Fuzhou": "福州", "Wenzhou": "温州",
    "Shijiazhuang": "石家庄", "Jinan": "济南", "Hefei": "合肥", "Changsha": "长沙",
    "Kunming": "昆明", "Nanchang": "南昌", "Haikou": "海口", "Macau": "澳门",
}

UA = {"User-Agent": "the-new-world/0.1 (data fetcher; MIT)"}


def fetch(url, as_text=False, attempts=4):
    """带退避重试的抓取——网络事实不会一次就给全。"""
    import time
    last_err = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as r:
                raw = r.read()
            return raw.decode("utf-8") if as_text else raw
        except Exception as e:  # noqa: BLE001
            last_err = e
            wait = 10 * (i + 1)
            print(f"    [retry {i+1}/{attempts}] {url[:60]}… -> {e}，{wait}s 后重试")
            time.sleep(wait)
    raise RuntimeError(f"fetch failed: {url}") from last_err


# ---------------------------------------------------------------- world-atlas
def build_earth():
    """把 TopoJSON 解码回 GeoJSON（实现拓扑共享弧段的 delta 解码）。"""
    topo = json.loads(fetch(WORLD_ATLAS).decode("utf-8"))
    transform = topo.get("transform")
    sx, sy = transform["scale"]
    tx, ty = transform["translate"]
    arcs = []
    for arc in topo["arcs"]:
        pts, x, y = [], 0, 0
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append([round(x * sx + tx, 4), round(y * sy + ty, 4)])
        arcs.append(pts)

    def arc_pts(i):
        return arcs[i] if i >= 0 else arcs[~i][::-1]

    def ring(indices):
        out = []
        for idx in indices:
            pts = arc_pts(idx)
            out.extend(pts if not out else pts[1:])
        if out and out[0] != out[-1]:
            out.append(list(out[0]))
        return out

    def polygon_rings(arcs_lists):
        return [ring(r) for r in arcs_lists]

    countries = []
    seen_ids = {}
    for f in topo["objects"]["countries"]["geometries"]:
        g = dict(type=f["type"], coordinates=None)
        t = f["type"]
        if t == "Polygon":
            g["coordinates"] = polygon_rings(f["arcs"])
        else:
            g["coordinates"] = [polygon_rings(p) for p in f["arcs"]]
        fid = str(f.get("id", ""))
        name = f.get("properties", {}).get("name") or f"未知之地 {fid}"
        if fid in seen_ids:  # NE 中 -99 会撞号（索马里兰等），给合成 id
            fid = f"{fid}:{name}"
        seen_ids[fid] = True
        countries.append({"type": "Feature", "id": fid, "properties": {"name": name},
                          "geometry": g})

    land = topo["objects"]["land"]["geometries"]
    land_polys = []
    for g in land:
        if g["type"] == "Polygon":
            land_polys.append(polygon_rings(g["arcs"]))
        else:
            for p in g["arcs"]:
                land_polys.append(polygon_rings(p))

    earth = {
        "meta": {
            "generator": "scripts/fetch_data.py",
            "source": WORLD_ATLAS,
            "license": "MIT (topojson/world-atlas); 边界数据源自 Natural Earth (公有领域)",
            "retrievedAt": date.today().isoformat(),
        },
        "countries": {"type": "FeatureCollection", "features": countries},
        "land": {"type": "MultiPolygon", "coordinates": land_polys},
    }
    return earth


# ---------------------------------------------------------------- owid co2
def fetch_co2():
    """OWID co2-data -> ({iso3: {year: 人均吨}}, {year: 全球百万吨})。"""
    csv_text = fetch(OWID_CO2_CSV, as_text=True)
    reader = csv.DictReader(io.StringIO(csv_text))
    by_iso3, world = {}, {}
    for r in reader:
        y = int(r["year"])
        if y < 1960:
            continue
        iso = r.get("iso_code") or ""
        pc = r.get("co2_per_capita") or ""
        total = r.get("co2") or ""
        if iso == "OWID_WRL" or r.get("country") == "World":
            if total:
                world[y] = round(float(total), 1)
            continue
        if not iso:
            continue
        if pc:
            by_iso3.setdefault(iso, {})[y] = round(float(pc), 3)
    print(f"  [OWID] CO₂ 国家 {len(by_iso3)}，全球序列 {len(world)} 年")
    return by_iso3, world


# ---------------------------------------------------------------- world bank
def build_meta():
    countries = json.loads(fetch(WB_COUNTRIES, as_text=True))
    rows = countries[1]

    iso_csv = fetch(ISO_CSV, as_text=True)
    reader = csv.DictReader(io.StringIO(iso_csv))
    header = reader.fieldnames
    col = lambda *cands: next(h for h in header if any(c in h.lower() for c in cands))
    c_a2, c_a3, c_num = col("alpha-2"), col("alpha-3"), col("country-code")
    c_region = next(h for h in header if h.lower().startswith("region"))
    num2 = {}   # ISO numeric -> {a2, a3, region}
    a22zh_src = None
    for row in reader:
        num2[row[c_num]] = {"a2": row[c_a2], "a3": row[c_a3], "region": row[c_region] or ""}

    zh_doc = json.loads(fetch(ZH_JSON, as_text=True))
    a22zh = zh_doc.get("countries", zh_doc)

    series = {}
    meta_rows = {}
    for key, code in INDICATORS.items():
        data = json.loads(fetch(WB_INDICATOR.format(code=code), as_text=True))
        n = 0
        for r in data[1] or []:
            v = r.get("value")
            if v is None:
                continue
            iso2 = r["country"]["id"]
            meta_rows.setdefault(iso2, {"iso2": iso2, "name": r["country"]["value"]})
            series.setdefault(iso2, {}).setdefault(key, {})[r["date"]] = v
            n += 1
        print(f"  [WB] {code:16s} -> {n} 行")

    a32num = {m["a3"]: num for num, m in num2.items()}
    by_iso = {}
    by_iso3 = {}
    wb_world = {}
    for c in rows:
        iso2, iso3 = c["iso2Code"], c["id"]  # /country 端点：id 即 ISO3
        is_aggregate = c["region"]["value"] == "Aggregates"
        s = series.get(iso2, {})
        clean = {k: {int(y): (round(v) if k == "pop" else round(v, 3))
                     for y, v in sorted(d.items())} for k, d in s.items()}
        if iso2 == "WLD" or iso3 == "WLD":
            wb_world = clean
            continue
        if is_aggregate:
            continue
        m = num2.get(a32num.get(iso3, ""), {})
        entry = {
            "iso3": iso3,
            "iso2": iso2,
            "name": c["name"],
            "zh": a22zh.get(m.get("a2") or iso2, ""),
            "region": c["region"]["value"],
            **clean,
        }
        num = a32num.get(iso3)
        if num:
            by_iso[num] = entry
        by_iso3[iso3] = num or ""

    co2_by_iso3, co2_world = fetch_co2()
    hit = 0
    for num, e in by_iso.items():
        co2 = co2_by_iso3.get(e["iso3"])
        if co2:
            e["co2"] = co2
            hit += 1
    world = {"pop": wb_world.get("pop", {}), "gdp": wb_world.get("gdp", {}),
             "co2": co2_world}
    zh_count = sum(1 for e in by_iso.values() if e["zh"])
    print(f"  [WB] 国家/地区 {len(by_iso)}，中文名 {zh_count}；CO₂ 命中 {hit}")

    meta = {
        "meta": {
            "generator": "scripts/fetch_data.py",
            "sources": {
                "pop/gdp": "World Bank Open Data API (CC BY-4.0)",
                "co2": "Our World in Data owid/co2-data (CC BY-4.0)",
            },
            "indicators": {
                "pop": "SP.POP.TOTL 人口总数（人）",
                "gdp": "NY.GDP.MKTP.CD GDP（现价美元）",
                "co2": "co2_per_capita 人均 CO₂（吨/人）；world.co2 全球排放（百万吨）",
            },
            "retrievedAt": date.today().isoformat(),
        },
        "byIso": by_iso,
        "byIso3": by_iso3,
        "world": world,
    }
    return meta


# ---------------------------------------------------------------- cities
def build_cities():
    doc = json.loads(fetch(CITIES_GEOJSON).decode("utf-8"))
    picked = {}
    for f in doc["features"]:
        p = f.get("properties", {})
        name = p.get("name")
        pop = p.get("pop_max") or 0
        if not name or pop <= 0:
            continue
        geom = f.get("geometry") or {}
        coords = geom.get("coordinates") or [None, None]
        lon, lat = coords[0], coords[1]
        if lon is None:
            continue
        key = (name, p.get("adm0_a3") or "")
        if key in picked and picked[key]["pop"] >= pop:
            continue
        capital = bool(p.get("adm0cap")) or "Admin-0 capital" in (p.get("featurecla") or "")
        picked[key] = {
            "name": name,
            "zh": CITY_ZH.get(name, ""),
            "iso3": p.get("adm0_a3") or "",
            "lon": round(lon, 3),
            "lat": round(lat, 3),
            "pop": int(pop),
            "cap": 1 if capital else 0,
        }
    cities = sorted(picked.values(), key=lambda c: -c["pop"])[:CITY_TOP_N]
    print(f"  [NE] 城市 {len(cities)} 座（前 5：{', '.join(c['name'] for c in cities[:5])}）")
    return {
        "meta": {
            "generator": "scripts/fetch_data.py",
            "source": CITIES_GEOJSON,
            "license": "Natural Earth 公有领域",
            "retrievedAt": date.today().isoformat(),
            "rule": f"按 POP_MAX 去重后取前 {CITY_TOP_N} 名",
        },
        "cities": cities,
    }


def dump(path, obj):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))
    import os
    print(f"  [✓] {path}  {os.path.getsize(path)/1024:.0f} KB")


def main():
    print("🌍 新世界 · 开始采集现实（这一步把网络事实变成仓库里的砖）")
    print("  1/3 world-atlas 国家边界 -> data/earth.json")
    dump("data/earth.json", build_earth())
    print("  2/3 世界银行指标 -> data/meta.json")
    dump("data/meta.json", build_meta())
    print("  3/3 Natural Earth 城市 -> data/cities.json")
    dump("data/cities.json", build_cities())
    print(f"✅ 完成 {datetime.now(timezone.utc).isoformat(timespec='seconds')}")


if __name__ == "__main__":
    sys.exit(main())

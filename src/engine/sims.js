// 仿真律 —— 本世界的第四条施工规律：历史是数据，未来是规律。
// 时间序列的"过去"完全忠于真实观测；越过最后一个观测点之后，交给 L3 人口律接管。

import { clamp, lerp } from './math3.js';

/** 年份 → 值 的等距查找表，支持线性插值 */
export class Series {
  constructor(map = {}) {
    this.years = Object.keys(map).map(Number).sort((a, b) => a - b);
    this.vals = this.years.map((y) => map[y]);
  }
  get lastYear() { return this.years.length ? this.years[this.years.length - 1] : NaN; }
  get last() { return this.vals.length ? this.vals[this.vals.length - 1] : NaN; }
  at(year) {
    const ys = this.years;
    if (!ys.length) return NaN;
    if (year <= ys[0]) return this.vals[0];
    if (year >= ys[ys.length - 1]) return this.vals[ys.length - 1];
    let lo = 0, hi = ys.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ys[mid] <= year) lo = mid; else hi = mid;
    }
    return lerp(this.vals[lo], this.vals[hi], (year - ys[lo]) / (ys[hi] - ys[lo]));
  }
}

/**
 * L3 人口律（连续形式）：dP/dt = r·P·(1 − P/K)
 * 用离散精确解，任意步长无累积误差。
 */
export function logistic(P, r, K, dtYears) {
  return (P * K) / (P + (K - P) * Math.exp(-r * dtYears));
}

/**
 * 从一条历史序列外推的逻辑斯蒂参数。
 * r = 近 10 年复合增长率；K = 当前人口 × 1.35（承载上限假设，见 LAWS.md L3）。
 */
export function projectionOf(series) {
  const n = series.years.length;
  if (n < 2) return { r: 0, K: NaN, P: NaN, t0: NaN };
  const span = Math.min(10, n - 1);
  const P0 = series.vals[n - 1 - span];
  const P1 = series.vals[n - 1];
  const r = P0 > 0 && P1 > 0 ? Math.log(P1 / P0) / span : 0;
  return { r: clamp(r, -0.02, 0.03), K: P1 * 1.35, P: P1, t0: series.lastYear };
}

export class WorldSim {
  constructor(data) {
    this.countries = new Map(); // 数字 ISO 码 → {pop, gdp, co2, proj}
    for (const [num, e] of Object.entries(data.meta.byIso)) {
      const pop = new Series(e.pop);
      this.countries.set(num, {
        pop, gdp: new Series(e.gdp), co2: new Series(e.co2),
        proj: projectionOf(pop),
      });
    }
    this.worldPop = new Series(data.meta.world.pop);
    this.worldCo2 = new Series(data.meta.world.co2);
    this.worldGdp = new Series(data.meta.world.gdp);
    this.iso3ToNum = data.meta.byIso3;
  }

  /** 世界人口：历史段用真实聚合序列，未来段按各国规律之和放大 */
  popAt(year) {
    if (year <= this.worldPop.lastYear) return this.worldPop.at(year);
    return this.worldPop.last * this.worldGrowthFactor(year);
  }

  worldGrowthFactor(year) {
    let sumProj = 0, sumNow = 0;
    for (const c of this.countries.values()) {
      const P = c.pop.last;
      if (!isFinite(P) || P <= 0) continue;
      sumNow += P;
      sumProj += logistic(c.proj.P, c.proj.r, c.proj.K, year - c.proj.t0);
    }
    return sumNow > 0 ? sumProj / sumNow : 1;
  }

  /** 全球年排放（百万吨 CO₂）；数据只到观测末端，其后保持不变 */
  co2At(year) { return this.worldCo2.at(clamp(year, -Infinity, this.worldCo2.lastYear)); }
  gdpAt(year) { return this.worldGdp.at(clamp(year, -Infinity, this.worldGdp.lastYear)); }

  countryAt(numId, year) {
    const c = this.countries.get(String(numId));
    if (!c) return null;
    return { pop: c.pop.at(year), gdp: c.gdp.at(year), co2: c.co2.at(year), series: c };
  }

  /** 城市规模随所属国人口规律呼吸（简化：全国人口比即城市人口比） */
  cityScale(city, year) {
    const num = this.iso3ToNum[city.iso3];
    const c = num && this.countries.get(num);
    if (!c || !isFinite(c.pop.last) || c.pop.last <= 0) return 1;
    const now = c.pop.at(year);
    return isFinite(now) ? clamp(now / c.pop.last, 0.6, 2.2) : 1;
  }

  /** 国别档案：1960 → 2050 的人口轨迹（历史真实 + 规律外推） */
  projectPop(numId, fromYear, toYear, steps) {
    const c = this.countries.get(String(numId));
    if (!c || !isFinite(c.proj.t0)) return null;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const y = fromYear + (i / steps) * (toYear - fromYear);
      const v = y <= c.proj.t0
        ? c.pop.at(y)
        : logistic(c.proj.P, c.proj.r, c.proj.K, y - c.proj.t0);
      pts.push([y, v]);
    }
    return pts;
  }
}

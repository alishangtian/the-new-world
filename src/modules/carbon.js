// 砖块 · 碳 —— L5 碳律的可视化：高人均排放国戴上"呼吸"的余烬光环。
// 全球总量的时间读数由 hud.js 通过 sims.co2At(year) 呈现； choropleth 见 terra 的碳模式。

import { registerModule } from '../engine/modules.js';
import { rot } from '../engine/math3.js';
import terra from './terra.js';

const TMP = [0, 0, 0];

export default registerModule({
  id: 'carbon',
  name: '碳 · 余烬',
  order: 50,
  laws: [
    'L5 碳律：全球均温响应 ∝ 累计 CO₂ 排放（TCRE，线性气候响应），λ ≈ 0.45°C / 1000 GtC',
    '余烬律：人均年排放 ≥ 8 吨的国家，光环半径 ∝ √人均排放，以 1.6Hz 呼吸',
  ],
  sources: [
    { label: 'Our World in Data: owid/co2-data（CC BY-4.0）', url: 'https://github.com/owid/co2-data' },
    { label: 'IPCC AR6 WGI — 累计碳预算与瞬态气候响应', url: 'https://www.ipcc.ch/report/ar6/wg1/' },
  ],

  _prepare(env) {
    if (!terra.centroids) return false;
    this.hi = [];
    for (const c of terra.centroids) {
      const e = env.data.meta.byIso[c.numId];
      const co2 = e && e.co2 ? Object.values(e.co2).at(-1) : NaN;
      if (isFinite(co2) && co2 >= 8) this.hi.push({ v: c.v, co2 });
    }
    return true;
  },

  render(env) {
    if (!this.hi && !this._prepare(env)) return;
    const { ctx, cx, cy, R, nowSec } = env;
    const scale = R / 300;
    for (let i = 0; i < this.hi.length; i++) {
      const h = this.hi[i];
      const p = rot(env.cam.m, h.v, TMP);
      if (p[2] <= 0.05) continue;
      const x = cx + R * p[0], y = cy - R * p[1];
      const breathe = 0.5 + 0.5 * Math.sin(nowSec * 1.6 + i * 1.7);
      const r = Math.sqrt(h.co2) * scale * 5;
      ctx.strokeStyle = `rgba(255,110,70,${(0.08 + 0.16 * breathe).toFixed(3)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(x, y, r * (0.9 + 0.15 * breathe), 0, 6.2832); ctx.stroke();
    }
  },
});

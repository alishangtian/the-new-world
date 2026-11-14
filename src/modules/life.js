// 砖块 · 生命 —— 600 座真实城市，按 L3 人口律呼吸的灯火。
// 夜面亮、昼面暗；模拟时间拨到 1960，全球灯火随人口"回弱"；拨到 2050，城市越发密集。

import { registerModule } from '../engine/modules.js';
import { rot, ll2v, clamp, dot3 } from '../engine/math3.js';

const TMP = [0, 0, 0];

export default registerModule({
  id: 'life',
  name: '生命 · 城市灯火',
  order: 30,
  laws: [
    'L3 人口律：历史段 = 世界银行数据插值；观测末端之后 = 逻辑斯蒂 dP/dt = r·P·(1−P/K)',
    '灯光律：亮度 ∝ log₁₀(人口) × 当地夜色深度（夜半球亮，昼半球隐）',
  ],
  sources: [
    { label: 'Natural Earth populated places（公有领域，POP_MAX）', url: 'https://www.naturalearthdata.com/downloads/' },
    { label: 'World Bank SP.POP.TOTL（CC BY-4.0）', url: 'https://data.worldbank.org/indicator/SP.POP.TOTL' },
  ],

  _prepare(data) {
    this.cities = data.cities.cities
      .map((c) => ({ ...c, v: ll2v(c.lat, c.lon, [0, 0, 0]) }))
      .sort((a, b) => b.pop - a.pop);
  },

  render(env) {
    if (!this.cities) this._prepare(env.data);
    const { ctx, cx, cy, R, sun, year } = env;
    const cam = env.cam.m; // 注意：旋转需要的是相机矩阵，不是相机对象
    const scale = R / 300;
    const sunCam = rot(cam, sun.v, [0, 0, 0]);

    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.cities.length; i++) {
      const c = this.cities[i];
      const p = rot(cam, c.v, TMP);
      if (p[2] <= 0.02) continue; // 地平线以下
      const night = clamp(-dot3(p, sunCam) * 1.3 + 0.16, 0, 1);
      const alpha = 0.16 + 0.84 * night;
      const grow = env.sims ? env.sims.cityScale(c, year) : 1;
      const size = clamp((0.9 + 2.0 * Math.log10(Math.max(c.pop, 3e4) / 3e4)) * scale * Math.sqrt(grow), 0.6, 9);

      const x = cx + R * p[0];
      const y = cy - R * p[1];
      ctx.fillStyle = `rgba(255,205,130,${(alpha * 0.22).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, size * 2.8, 0, 6.2832); ctx.fill();
      ctx.fillStyle = `rgba(255,233,192,${alpha.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, size, 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // 放大到一定程度，大城市亮起名字
    if (env.cam.zoom >= 2.1) {
      ctx.font = '11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillStyle = 'rgba(255,236,205,0.85)';
      const n = Math.min(this.cities.length, 80);
      for (let i = 0; i < n; i++) {
        const c = this.cities[i];
        const p = rot(cam, c.v, TMP);
        if (p[2] <= 0.05) continue;
        const x = cx + R * p[0];
        const y = cy - R * p[1];
        ctx.fillText(c.zh || c.name, x + size0(c, scale) + 3, y + 3);
      }
    }
  },
});

function size0(c, scale) {
  return clamp((0.9 + 2.0 * Math.log10(Math.max(c.pop, 3e4) / 3e4)) * scale, 0.6, 9);
}

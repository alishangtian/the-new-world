// 砖块 · 板块震脉 —— L7 板块律的可视化：把地震放在板块边界旁边，
// "环太平洋地震带"不再是一句课文，而是眼前 2002 个真实震中沿边界线的聚集。
// 数据是快照（USGS 近 30 天 M2.5+），规律是空间聚集性——本砖不预测地震。

import { registerModule } from '../engine/modules.js';
import { ll2v, rot, clamp } from '../engine/math3.js';

const TMP = [0, 0, 0];

export default registerModule({
  id: 'quake',
  name: '板块 · 震脉',
  order: 45,
  laws: [
    'L7 板块律：全球地震能量的绝大部分释放于板块边界带——震中快照沿 PB2002 边界聚集（环太平洋带肉眼可验）',
    '震级律：释放能量 ∝ 10^(1.5M)；本砖视觉半径 ∝ (M − 2.5)，亮暗随震深与呼吸相位',
  ],
  sources: [
    { label: 'USGS 地震馈送 · 近 30 天 M2.5+（公有领域）', url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.php' },
    { label: 'PB2002 板块边界 · Bird 2003（ODC-BY）', url: 'https://github.com/fraxen/tectonicplates' },
  ],

  _prepare(data) {
    this.bounds = (data.plates.boundaries || []).map((b) => ({
      name: b.name,
      v: new Float32Array(b.pts.length * 3),
    }));
    (data.plates.boundaries || []).forEach((b, i) => {
      b.pts.forEach(([lon, lat], j) => {
        const [x, y, z] = ll2v(lat, lon, [0, 0, 0]);
        this.bounds[i].v[j * 3] = x;
        this.bounds[i].v[j * 3 + 1] = y;
        this.bounds[i].v[j * 3 + 2] = z;
      });
    });
    this.quakes = (data.quakes.quakes || []).map((q, i) => ({
      ...q,
      v: ll2v(q.lat, q.lon, [0, 0, 0]),
      ph: (i * 2.399963229728653) % 6.2832, // 黄金角散列相位——呼吸错落
    }));
  },

  render(env) {
    if (!this.bounds) this._prepare(env.data);
    const { ctx, cx, cy, R, nowSec } = env;
    const m = env.cam.m;
    const scale = R / 300;

    // 板块边界：细暖线，到地平线断笔
    ctx.strokeStyle = 'rgba(255,150,90,0.16)';
    ctx.lineWidth = 0.8;
    for (const b of this.bounds) {
      const n = b.v.length / 3;
      let prevVis = false;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const p = rot(m, [b.v[i * 3], b.v[i * 3 + 1], b.v[i * 3 + 2]], TMP);
        const vis = p[2] > 0;
        const x = cx + R * p[0], y = cy - R * p[1];
        if (vis && !prevVis) ctx.moveTo(x, y);
        else if (vis) ctx.lineTo(x, y);
        prevVis = vis;
      }
      ctx.stroke();
    }

    // 震中：余烬点 + 强震光环，加色混合
    ctx.globalCompositeOperation = 'lighter';
    for (const q of this.quakes) {
      const p = rot(m, q.v, TMP);
      if (p[2] <= 0.02) continue;
      const x = cx + R * p[0], y = cy - R * p[1];
      const breathe = 0.55 + 0.45 * Math.sin(nowSec * 1.2 + q.ph);
      const r = clamp(0.7 + (q.mag - 2.5) * 0.55, 0.7, 6) * scale;
      const a = clamp(0.28 + 0.5 * breathe, 0, 0.85);

      ctx.fillStyle = `rgba(255,120,70,${(a * 0.35).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, 6.2832); ctx.fill();
      ctx.fillStyle = `rgba(255,190,140,${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();

      if (q.mag >= 5) { // 强震光环：M5+ 才值得一个波纹
        const halo = (q.mag - 2.5) * 2.4 * scale * (0.85 + 0.3 * breathe);
        ctx.strokeStyle = `rgba(255,100,60,${(a * 0.5).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, halo, 0, 6.2832); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  },
});

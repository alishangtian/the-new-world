// 砖块 · 联结 —— L4 引力律的可视化：城市间的流动强度 I ∝ Pi·Pj / d²。
// 大圆航线是球面上两点间的最短路径（slerp 插值）；越靠近地平线越透明，绝不会"绕到地球背面"。

import { registerModule } from '../engine/modules.js';
import { ll2v, slerp, dot3, clamp, rot } from '../engine/math3.js';

const HUBS = 80;
const MAX_ARCS = 120;
const PARTNERS = 10;
const TMP = [0, 0, 0];

export default registerModule({
  id: 'links',
  name: '联结 · 引力航线',
  order: 40,
  laws: [
    'L4 引力律：两地流动强度 Iij ∝ Pi·Pj / d²（Zipf 引力模型，贸易与迁徙的经验规律）',
    '航线律：航线取球面大圆（测地线），绘制时按可见性渐隐',
  ],
  sources: [
    { label: 'Gravity model of trade / Zipf 引力模型', url: 'https://en.wikipedia.org/wiki/Gravity_model_of_trade' },
    { label: 'Great-circle distance（测地线）', url: 'https://en.wikipedia.org/wiki/Great-circle_distance' },
  ],

  _prepare(data) {
    const hubs = data.cities.cities.slice(0, HUBS)
      .map((c) => ({ ...c, v: ll2v(c.lat, c.lon, [0, 0, 0]) }));
    // 每个枢纽按引力权重预排伙伴名单（拓扑静态化；强度随仿真年份呼吸）
    this.hubs = hubs;
    this.partners = hubs.map((a, i) => {
      const list = [];
      for (let j = 0; j < hubs.length; j++) {
        if (j === i) continue;
        const b = hubs[j];
        const cosd = clamp(dot3(a.v, b.v), -1, 1);
        const d = Math.acos(cosd); // 球面角距（≈ 弧长/地球半径）
        list.push({ j, w: (a.pop * b.pop) / (d * d + 0.02) });
      }
      list.sort((x, y) => y.w - x.w);
      return list.slice(0, PARTNERS);
    });
    this.arcs = [];
  },

  render(env) {
    if (!this.hubs) this._prepare(env.data);
    const { ctx, cx, cy, R, nowSec } = env;

    // 播种新航线
    while (this.arcs.length < MAX_ARCS) {
      const i = (Math.random() * this.hubs.length) | 0;
      const ps = this.partners[i];
      if (!ps || !ps.length) break;
      const { j } = ps[(Math.random() * ps.length) | 0];
      this.arcs.push({ a: i, b: j, born: nowSec, life: 1.9 + Math.random() * 1.5 });
    }

    const cam = env.cam.m;
    const scale = R / 300;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    for (let k = this.arcs.length - 1; k >= 0; k--) {
      const arc = this.arcs[k];
      const t = (nowSec - arc.born) / arc.life;
      if (t >= 1) { this.arcs.splice(k, 1); continue; }
      const va = this.hubs[arc.a].v;
      const vb = this.hubs[arc.b].v;
      const env1 = Math.sin(Math.PI * t); // 生命包络：淡入淡出
      const SEG = 30;

      // 一条航线一次描边（可见段拼合，穿入背面时断笔）
      let zSum = 0, zCnt = 0;
      let prevVis = false;
      ctx.beginPath();
      for (let s2 = 0; s2 <= SEG; s2++) {
        const p = rot(cam, slerp(va, vb, s2 / SEG, TMP), TMP);
        const x = cx + R * p[0], y = cy - R * p[1], z = p[2];
        const vis = z > 0;
        if (vis && !prevVis) ctx.moveTo(x, y);
        else if (vis) ctx.lineTo(x, y);
        if (vis) { zSum += z; zCnt++; }
        prevVis = vis;
      }
      if (zCnt > 0) {
        const fade = zSum / zCnt;
        ctx.strokeStyle = `rgba(130,225,255,${(env1 * (0.16 + 0.5 * fade)).toFixed(3)})`;
        ctx.lineWidth = (0.9 + Math.log10(this.hubs[arc.b].pop / 1e6) * 0.5) * scale * 0.7;
        ctx.stroke();
      }

      // 脉冲光点
      const ph = rot(cam, slerp(va, vb, t, TMP), TMP);
      if (ph[2] > 0) {
        const px = cx + R * ph[0], py = cy - R * ph[1];
        ctx.fillStyle = `rgba(200,245,255,${(env1 * 0.95).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(px, py, 2.1 * scale * 0.8, 0, 6.2832); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  },
});

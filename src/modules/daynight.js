// 砖块 · 昼夜 —— L1 自转律 + L2 昼夜律的可视化。
// 夜半球不是画上去的阴影，而是几何：晨昏线（与太阳成 90° 的大圆）的可见段，
// 沿地平圆在背阳侧闭合——太阳在哪，黑夜就在哪，分毫不差。

import { registerModule } from '../engine/modules.js';
import { terminatorRing } from '../engine/astro.js';
import { rot, TWO_PI } from '../engine/math3.js';

export default registerModule({
  id: 'daynight',
  name: '昼夜 · 晨昏线',
  order: 20,
  laws: [
    'L1 自转律：地球以恒星日 86164s 自转，直射点每年在 ±23.44°（黄赤交角）间摆动',
    'L2 昼夜律：地表点的太阳天顶余弦 = n̂·ŝ；> 0 为昼，< 0 为夜，晨昏线即 n̂·ŝ = 0',
  ],
  sources: [
    { label: '低精度太阳星历（Meeus, Astronomical Algorithms 简化式）', url: 'https://aa.usno.navy.mil/publications/na' },
    { label: '地球自转与恒星日', url: 'https://en.wikipedia.org/wiki/Earth%27s_rotation' },
  ],

  render(env) {
    const { ctx, cx, cy, R, sun } = env;
    const s = rot(env.cam.m, sun.v, [0, 0, 0]); // 太阳在相机空间

    // 1) 全盘昼夜渐变：向阳侧微暖，背阳侧沉入深蓝
    const len2 = Math.hypot(s[0], s[1]);
    if (len2 > 1e-4) {
      const ux = s[0] / len2, uy = s[1] / len2;
      const g = ctx.createLinearGradient(cx + ux * R, cy - uy * R, cx - ux * R, cy + uy * R);
      g.addColorStop(0, 'rgba(255,214,140,0.14)');
      g.addColorStop(0.5, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(2,6,20,0.5)');
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TWO_PI); ctx.clip();
      ctx.fillStyle = g;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();
    }

    // 2) 几何夜半球
    if (s[2] < 0) {
      // 太阳在地球背后：整个可见面都是夜
      ctx.fillStyle = 'rgba(3,8,24,0.62)';
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TWO_PI); ctx.fill();
      return;
    }

    const ring = terminatorRing(sun.v);
    const cam = env.cam.m;
    const pts = [];
    for (let i = 0; i < ring.length / 3; i++) {
      const vx = ring[i * 3], vy = ring[i * 3 + 1], vz = ring[i * 3 + 2];
      const z = cam[6] * vx + cam[7] * vy + cam[8] * vz;
      if (z >= 0) {
        pts.push(cx + R * (cam[0] * vx + cam[1] * vy + cam[2] * vz),
                 cy - R * (cam[3] * vx + cam[4] * vy + cam[5] * vz));
      }
    }
    if (pts.length < 2) return;

    // 夜区 = 晨昏线可见段 + 背阳侧地平弧
    const a0 = Math.atan2(pts[1] - cy, pts[0] - cx);
    const a1 = Math.atan2(pts[pts.length - 1] - cy, pts[pts.length - 2] - cx);
    const via = Math.atan2(-s[1], -s[0]); // 背阳点方向
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TWO_PI); ctx.clip();
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    arcThrough(ctx, cx, cy, R, a1, a0, via);
    ctx.closePath();
    const ng = ctx.createRadialGradient(cx + s[0] * R * 0.2, cy - s[1] * R * 0.2, R * 0.1, cx, cy, R * 1.05);
    ng.addColorStop(0, 'rgba(4,10,30,0.42)');
    ng.addColorStop(1, 'rgba(2,5,18,0.72)');
    ctx.fillStyle = ng;
    ctx.fill();

    // 3) 晨昏线本体：柔和的辉光
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.strokeStyle = 'rgba(255,196,110,0.22)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,214,150,0.55)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  },
});

/** 从 aFrom 到 aTo 画圆弧，并保证经过 via 方向 */
function arcThrough(ctx, cx, cy, R, aFrom, aTo, via) {
  const mod = (a) => ((a % TWO_PI) + TWO_PI) % TWO_PI;
  const dTotal = mod(aTo - aFrom);
  const dVia = mod(via - aFrom);
  ctx.arc(cx, cy, R, aFrom, aTo, dVia > dTotal);
}

// 砖块 · 大地 —— 177 个国家的真实边界（Natural Earth 110m，经 world-atlas 打包）。
// 渲染核心：正交投影 + 可见半球裁剪。任何一段边界越过地平线时，
// 用二分法在球面上找到精确的出/入点，再沿地平圆补一段弧——保证没有穿透地球的"穿越线"。

import { registerModule } from '../engine/modules.js';
import { DEG, TWO_PI, clamp } from '../engine/math3.js';

// 数据映射（choropleth 色带）：对数刻度贴合真实分布的数量级跨度
const RAMPS = {
  pop: { stops: ['#1b2350', '#39457f', '#8a6bb1', '#e08c5a', '#ffd166'],
         t: (v) => Math.log10(Math.max(v, 1e4) / 1e4) / Math.log10(1.45e9 / 1e4) },
  gdp: { stops: ['#0f2f3a', '#1d5b57', '#2f9077', '#5ad0a0', '#a9f5cd'],
         t: (v) => Math.log10(Math.max(v, 300) / 300) / Math.log10(1.4e5 / 300) },
  co2: { stops: ['#141b33', '#3a2c47', '#7a3b4f', '#c74a3c', '#ff8c42'],
         t: (v) => Math.log10(Math.max(v, 0.05) / 0.05) / Math.log10(24 / 0.05) },
};
const MISSING = 'rgba(46,58,94,0.92)';
const BASE = '#223054';

function rampColor(stops, t) {
  t = clamp(t, 0, 1);
  const x = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = stops[i], b = stops[i + 1];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}
const hexStops = (s) => s.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

export default registerModule({
  id: 'terra',
  name: '大地 · 疆界',
  order: 10,
  laws: ['L2 透镜律：正交投影把球面映到圆盘，越界边界二分求交、沿地平圆闭合'],
  sources: [
    { label: 'topojson/world-atlas (MIT) · 边界源自 Natural Earth（公有领域）', url: 'https://github.com/topojson/world-atlas' },
  ],

  // ------------------------------------------------------------ 预计算
  _prepare(data) {
    this.feats = data.earth.countries.features.map((f) => {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      const rings = [];
      let gx = 0, gy = 0, gz = 0, cnt = 0;
      for (const poly of polys) {
        for (const ring of poly) {
          const v = new Float32Array(ring.length * 3);
          for (let i = 0; i < ring.length; i++) {
            const φ = ring[i][1] * DEG, λ = ring[i][0] * DEG;
            const c = Math.cos(φ);
            v[i * 3] = c * Math.cos(λ);
            v[i * 3 + 1] = c * Math.sin(λ);
            v[i * 3 + 2] = Math.sin(φ);
            gx += v[i * 3]; gy += v[i * 3 + 1]; gz += v[i * 3 + 2]; cnt++;
          }
          rings.push(v);
        }
      }
      const cl = Math.hypot(gx, gy, gz) || 1;
      return {
        f,
        numId: /^\d+$/.test(String(f.id)) ? String(f.id) : null,
        rings,
        centroid: [gx / cl, gy / cl, gz / cl],
        name: f.properties.name,
      };
    });
    this.byFeature = new Map(this.feats.map((p) => [p.f, p]));
    this.centroids = this.feats.filter((p) => p.numId).map((p) => ({ numId: p.numId, v: p.centroid }));

    // 经纬网（30° 间隔）
    this.grat = [];
    for (let lon = -180; lon < 180; lon += 30) {
      const pts = [];
      for (let lat = -80; lat <= 80; lat += 4) pts.push(this._v(lat, lon));
      this.grat.push(Float32Array.from(pts.flat()));
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts = [];
      for (let lon = -180; lon <= 180; lon += 4) pts.push(this._v(lat, lon));
      this.grat.push(Float32Array.from(pts.flat()));
    }
    this._ready = true;
  },

  _v(lat, lon) {
    const φ = lat * DEG, λ = lon * DEG;
    return [Math.cos(φ) * Math.cos(λ), Math.cos(φ) * Math.sin(λ), Math.sin(φ)];
  },

  // ------------------------------------------------------------ 每帧
  render(env) {
    if (!this._ready) this._prepare(env.data);
    const { ctx, cx, cy, R, mode } = env;

    // 大气辉光
    const glow = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.18);
    glow.addColorStop(0, 'rgba(96,168,255,0)');
    glow.addColorStop(0.45, 'rgba(96,168,255,0.13)');
    glow.addColorStop(1, 'rgba(96,168,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.18, 0, TWO_PI); ctx.fill();

    // 海洋
    const oc = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.08, cx, cy, R);
    oc.addColorStop(0, '#133765');
    oc.addColorStop(0.55, '#0a1e40');
    oc.addColorStop(1, '#050d22');
    ctx.fillStyle = oc;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TWO_PI); ctx.fill();

    // 盘内裁剪：此后的一切都不会溢出地球
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TWO_PI); ctx.clip();

    // 经纬网
    ctx.beginPath();
    for (const g of this.grat) traceRing(env, g);
    ctx.strokeStyle = 'rgba(140,180,255,0.06)';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // 陆地（choropleth）
    const ramp = RAMPS[mode];
    const stops = ramp ? hexStops(ramp.stops) : null;
    for (const p of this.feats) {
      ctx.fillStyle = stops ? this._color(env, p, ramp, stops) : (p.name === 'Antarctica' ? '#26334f' : BASE);
      ctx.beginPath();
      let any = false;
      for (const ring of p.rings) any = traceRing(env, ring) || any;
      if (any) {
        ctx.fill();
        ctx.strokeStyle = p === env.hover || p === env.selected
          ? 'rgba(140,220,255,0.85)' : 'rgba(150,190,255,0.12)';
        ctx.lineWidth = p === env.hover || p === env.selected ? 1.2 : 0.6;
        ctx.stroke();
      }
    }

    // 边缘亮弧（limb）
    ctx.strokeStyle = 'rgba(160,210,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R - 0.5, 0, TWO_PI); ctx.stroke();

    ctx.restore();
  },

  _color(env, p, ramp, stops) {
    if (p === env.hover) return '#3b4a7a';
    if (p === env.selected) return '#49619b';
    const rec = env.sims && p.numId ? env.sims.countryAt(p.numId, env.year) : null;
    let v = NaN;
    if (ramp === RAMPS.pop) v = rec && rec.pop;
    else if (ramp === RAMPS.gdp) v = rec && rec.gdp && rec.pop ? rec.gdp / rec.pop : NaN;
    else if (ramp === RAMPS.co2) v = rec && rec.co2;
    if (!isFinite(v) || v <= 0) return MISSING;
    return rampColor(stops, ramp.t(v));
  },
});

// ---------------------------------------------------------- 可见半球裁剪
function camZ(cam, vx, vy, vz) {
  return cam[6] * vx + cam[7] * vy + cam[8] * vz;
}

/** 把一条球面环描到当前路径上；返回是否产生了可见片段 */
function traceRing(env, rv) {
  const { ctx, cx, cy, R } = env;
  const cam = env.cam.m;
  const n = rv.length / 3;

  // 找一个背面点作为扫描起点，保证每个可见段都有明确的入边/出边
  let i0 = -1;
  for (let i = 0; i < n; i++) {
    if (camZ(cam, rv[i * 3], rv[i * 3 + 1], rv[i * 3 + 2]) < 0) { i0 = i; break; }
  }

  if (i0 < 0) { // 整环可见：直连
    for (let i = 0; i < n; i++) {
      const vx = rv[i * 3], vy = rv[i * 3 + 1], vz = rv[i * 3 + 2];
      const sx = cx + R * (cam[0] * vx + cam[1] * vy + cam[2] * vz);
      const sy = cy - R * (cam[3] * vx + cam[4] * vy + cam[5] * vz);
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    return true;
  }

  let any = false;
  let cur = null;
  let pvx = 0, pvy = 0, pvz = 0;

  const enter = (b) => {
    cur = { pts: [b[0], b[1]], entryAng: Math.atan2(b[1] - cy, b[0] - cx) };
  };
  const leave = (b) => {
    cur.pts.push(b[0], b[1]);
    emitRun(env, cur, Math.atan2(b[1] - cy, b[0] - cx));
    cur = null;
  };

  for (let k = 0; k <= n; k++) {
    const j = (i0 + k) % n;
    const vx = rv[j * 3], vy = rv[j * 3 + 1], vz = rv[j * 3 + 2];
    const vis = camZ(cam, vx, vy, vz) >= 0;
    const sx = cx + R * (cam[0] * vx + cam[1] * vy + cam[2] * vz);
    const sy = cy - R * (cam[3] * vx + cam[4] * vy + cam[5] * vz);

    if (k > 0) {
      if (vis) {
        if (!cur) enter(limb(env, pvx, pvy, pvz, vx, vy, vz)); // 从背面进入
        cur.pts.push(sx, sy);
        any = true;
      } else if (cur) {
        leave(limb(env, pvx, pvy, pvz, vx, vy, vz)); // 从正面离开
      }
    }
    pvx = vx; pvy = vy; pvz = vz;
  }
  if (cur) { emitRun(env, cur, cur.entryAng ?? 0); } // 兜底（不应发生）
  return any;
}

function emitRun(env, run, exitAng) {
  const { ctx, cx, cy, R } = env;
  const pts = run.pts;
  if (pts.length < 4) return;
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (run.entryAng != null) limbArc(ctx, cx, cy, R, exitAng, run.entryAng);
  ctx.closePath();
}

/** 沿地平圆走短弧（入点 ↔ 出点的正确闭合段） */
function limbArc(ctx, cx, cy, R, aFrom, aTo) {
  let d = (aTo - aFrom) % TWO_PI;
  if (d < 0) d += TWO_PI;
  ctx.arc(cx, cy, R, aFrom, aTo, d > Math.PI);
}

/** 可见点 a 与隐藏点 b 之间，球面插值求地平线交点的屏幕坐标 */
function limb(env, avx, avy, avz, bvx, bvy, bvz) {
  const cam = env.cam.m;
  let lo = 0, hi = 1;
  for (let i = 0; i < 10; i++) {
    const t = (lo + hi) / 2;
    const x = avx + (bvx - avx) * t, y = avy + (bvy - avy) * t, z = avz + (bvz - avz) * t;
    if (camZ(cam, x, y, z) >= 0) lo = t; else hi = t;
  }
  const t = lo;
  const x = avx + (bvx - avx) * t, y = avy + (bvy - avy) * t, z = avz + (bvz - avz) * t;
  const l = Math.hypot(x, y, z) || 1;
  return [
    env.cx + env.R * (cam[0] * x + cam[1] * y + cam[2] * z) / l,
    env.cy - env.R * (cam[3] * x + cam[4] * y + cam[5] * z) / l,
  ];
}

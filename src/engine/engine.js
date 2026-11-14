// 引擎 —— 时间、镜头与画布的心跳。
// 职责：驱动模拟时钟、管理相机旋转/缩放/惯性、把投影好的坐标交给砖块绘制、
//       以及把屏幕点击反投影回经纬度做国别拾取。

import { cameraMatrix, rot, rotT, clamp, yearOf, msOfYear, DEG } from './math3.js';
import { subsolar } from './astro.js';

const SPEEDS = {
  real: 1000,            // 1 秒 = 1 秒
  day: 86400000,         // 1 秒 = 1 天
  month: 2629800000,     // 1 秒 = 1 平均月
  year: 31557600000,     // 1 秒 = 1 平均年
  decade: 315576000000,  // 1 秒 = 10 年
};

export class Engine {
  constructor(canvas, data) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.data = data;
    this.sims = null; // main.js 注入 WorldSim

    this.cam = { lon0: 104, lat0: 30, zoom: 1, m: new Float64Array(9) };
    cameraMatrix(this.cam.lon0, this.cam.lat0, this.cam.m);

    this.time = { simMs: Date.now(), speedMs: SPEEDS.year, speedKey: 'year', playing: true, year: yearOf(Date.now()) };
    this.mode = 'natural';           // natural | pop | gdp | co2
    this.hover = null;               // 悬停的国家要素
    this.selected = null;            // 点击选中的国家要素

    this.modules = [];               // [{mod, enabled}]
    this.errors = [];                // 隔离的砖块故障记录
    this.onHover = null;             // UI 钩子
    this.onPick = null;
    this.onTime = null;

    this._drag = null;
    this._inertia = { vx: 0, vy: 0 };
    this._pointers = new Map();
    this._pinchD = 0;
    this._hoverPick = { x: 0, y: 0, need: false, t: 0 };
    this._pickIndex = null;
    this._fps = 60;

    this._resize();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this._resize()).observe(canvas);
    this._bind();
    this._last = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  }

  addModule(mod, enabled = true) {
    this.modules.push({ mod, enabled: enabled && mod.enabled !== false });
    this.modules.sort((a, b) => a.mod.order - b.mod.order);
  }

  setEnabled(id, en) {
    const e = this.modules.find((m) => m.mod.id === id);
    if (e) e.enabled = en;
  }

  setMode(mode) { this.mode = mode; }

  setSpeed(key) {
    if (key === 'pause') {
      this.time.playing = false;
    } else {
      this.time.playing = true;
      this.time.speedMs = SPEEDS[key] || 1000;
      this.time.speedKey = key;
    }
    if (key === 'real') this.time.speedKey = 'real';
    this.onTime && this.onTime(this.time);
  }

  setYear(y) { this.time.simMs = msOfYear(y); this.onTime && this.onTime(this.time); }
  goNow() { this.time.simMs = Date.now(); this.onTime && this.onTime(this.time); }

  // ------------------------------------------------------------ 视口与输入
  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.dpr = dpr;
    this.w = w; this.h = h;
    this.cx = w / 2;
    this.cy = h * 0.52; // 视觉重心略低，给标题留呼吸感
    this.baseR = Math.min(w, h) * 0.365;
  }

  rotateBy(dLon, dLat) {
    this.cam.lon0 = ((this.cam.lon0 + dLon + 540) % 360) - 180;
    this.cam.lat0 = clamp(this.cam.lat0 + dLat, -85, 85);
    cameraMatrix(this.cam.lon0, this.cam.lat0, this.cam.m);
  }

  /** 正式设定镜头（自动重算旋转矩阵） */
  setView(lon0, lat0, zoom) {
    if (isFinite(lon0)) this.cam.lon0 = ((lon0 + 540) % 360) - 180;
    if (isFinite(lat0)) this.cam.lat0 = clamp(lat0, -85, 85);
    if (isFinite(zoom)) this.setZoom(zoom);
    cameraMatrix(this.cam.lon0, this.cam.lat0, this.cam.m);
  }

  setZoom(z) { this.cam.zoom = clamp(z, 0.8, 9); }

  _bind() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this._pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (this._pointers.size === 1) {
        this._drag = { x: e.clientX, y: e.clientY, moved: 0 };
        this._inertia.vx = 0; this._inertia.vy = 0;
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (this._pointers.has(e.pointerId)) this._pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (this._pointers.size === 2) { // 双指缩放
        const [a, b] = [...this._pointers.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (this._pinchD) this.setZoom(this.cam.zoom * (d / this._pinchD));
        this._pinchD = d;
        return;
      }
      if (this._drag && e.buttons) {
        const dx = e.clientX - this._drag.x;
        const dy = e.clientY - this._drag.y;
        this._drag.x = e.clientX; this._drag.y = e.clientY;
        this._drag.moved += Math.abs(dx) + Math.abs(dy);
        this.rotateBy(-dx * 0.24 / this.cam.zoom, dy * 0.24 / this.cam.zoom);
        this._inertia.vx = dx; this._inertia.vy = dy;
      } else {
        this._hoverPick.x = e.clientX; this._hoverPick.y = e.clientY; this._hoverPick.need = true;
      }
    });
    const up = (e) => {
      this._pointers.delete(e.pointerId);
      this._pinchD = 0;
      if (this._drag && this._drag.moved < 5) this._click(e.clientX, e.clientY);
      if (this._pointers.size === 0) this._drag = null;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', () => {
      this._hoverPick.need = false;
      if (this.hover) { this.hover = null; this.onHover && this.onHover(null); }
    });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.setZoom(this.cam.zoom * Math.exp(-e.deltaY * 0.0012));
    }, { passive: false });
  }

  _click(x, y) {
    this.selected = this._pick(x, y);
    this.onPick && this.onPick(this.selected);
  }

  // ------------------------------------------------------------ 拾取（屏幕 → 经纬度 → 国家）
  _pick(px, py) {
    const R = this.baseR * this.cam.zoom;
    const x = (px - this.cx) / R;
    const y = (this.cy - py) / R;
    const r2 = x * x + y * y;
    if (r2 > 1) return null;
    const z = Math.sqrt(1 - r2);
    const geo = rotT(this.cam.m, [x, y, z]);
    const lat = Math.asin(clamp(geo[2], -1, 1)) / DEG;
    const lon = Math.atan2(geo[1], geo[0]) / DEG;
    this._ensurePickIndex();
    for (const p of this._pickIndex) {
      if (polyContains(p.polys, lon, lat)) return p.f;
    }
    return null;
  }

  _ensurePickIndex() {
    if (this._pickIndex) return;
    this._pickIndex = buildPickIndex(this.data.earth.countries.features);
  }

  // ------------------------------------------------------------ 主循环
  _loop(t) {
    const dt = Math.min((t - this._last) / 1000, 0.1) || 0.016;
    this._last = t;
    this._fps = this._fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;

    if (this.time.playing) this.time.simMs += this.time.speedMs * dt;
    this.time.year = yearOf(this.time.simMs);

    if (!this._drag) { // 惯性衰减
      const iv = this._inertia;
      if (Math.abs(iv.vx) > 0.05 || Math.abs(iv.vy) > 0.05) {
        this.rotateBy(-iv.vx * 0.045 / this.cam.zoom, iv.vy * 0.045 / this.cam.zoom);
        iv.vx *= 0.92; iv.vy *= 0.92;
      }
    }

    if (this._hoverPick.need && t - this._hoverPick.t > 60) {
      this._hoverPick.t = t;
      this._hoverPick.need = false;
      const hit = this._pick(this._hoverPick.x, this._hoverPick.y);
      if (hit !== this.hover) {
        this.hover = hit;
        this.onHover && this.onHover(hit);
      }
    }

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    const env = this._env(t);
    for (const entry of this.modules) {
      if (!entry.enabled) continue;
      try {
        entry.mod.render(env);
      } catch (err) {
        // 单砖故障隔离：一块认知砖出错，不能拖垮整个世界
        entry.enabled = false;
        this.errors.push({ id: entry.mod.id, message: String(err && err.stack || err) });
        console.error(`[砖块 ${entry.mod.id} 渲染失败，已隔离]`, err);
      }
    }

    requestAnimationFrame((tt) => this._loop(tt));
  }

  _env(t) {
    return {
      ctx: this.ctx, w: this.w, h: this.h,
      cx: this.cx, cy: this.cy, R: this.baseR * this.cam.zoom,
      cam: this.cam, time: this.time, year: this.time.year, simMs: this.time.simMs,
      sun: subsolar(this.time.simMs), // 太阳直射点：每帧算一次，各砖共用（L1 自转律）
      data: this.data, sims: this.sims, mode: this.mode,
      hover: this.hover, selected: this.selected,
      fps: this._fps, nowSec: t / 1000, engine: this,
    };
  }

  /** 地理单位向量 → 屏幕 {x, y, z}（z>0 表示在正面上） */
  projectVec(v, out = [0, 0, 0]) {
    const c = rot(this.cam.m, v, [0, 0, 0]);
    out[0] = this.cx + this.baseR * this.cam.zoom * c[0];
    out[1] = this.cy - this.baseR * this.cam.zoom * c[1];
    out[2] = c[2];
    return out;
  }
}

// ---------------------------------------------------------------- 拾取辅助（导出供体检脚本回归测试）
export function buildPickIndex(features) {
  const prep = [];
  for (const f of features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const flat = polys.map((poly) => poly.map((ring) => {
      const a = new Float32Array(ring.length * 2);
      for (let i = 0; i < ring.length; i++) { a[i * 2] = ring[i][0]; a[i * 2 + 1] = ring[i][1]; }
      return a;
    }));
    prep.push({ f, polys: flat });
  }
  return prep;
}

export function pickAt(index, lon, lat) {
  for (const p of index) {
    if (polyContains(p.polys, lon, lat)) return p.f;
  }
  return null;
}

function ringContains(ring, x, y) {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polyContains(polys, lon, lat) {
  // polys: [poly][ring] = 扁平 Float32Array([lon0, lat0, lon1, lat1, ...])
  for (const poly of polys) {
    if (!ringContains(poly[0], lon, lat)) continue;
    let inHole = false;
    for (let h = 1; h < poly.length; h++) if (ringContains(poly[h], lon, lat)) { inHole = true; break; }
    if (!inHole) return true;
  }
  return false;
}

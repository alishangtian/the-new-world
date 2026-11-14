// 三维小工具 —— 本世界的一切旋转、投影与插值都从这里开始。
// 约定：地理单位向量 v = [x, y, z]，x 指向 (0°E, 0°N)，y 指向 (90°E, 0°N)，z 指向北极。
// 相机空间：x 右，y 上，z 朝观察者；屏幕 sy = cy - R * vy（画布 y 轴向下）。

export const DEG = Math.PI / 180;
export const TWO_PI = Math.PI * 2;
export const MS_PER_YEAR = 365.2425 * 86400000; // 平均儒略年

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;

/** 经纬度（度）→ 地理单位向量 */
export function ll2v(latDeg, lonDeg, out = [0, 0, 0]) {
  const φ = latDeg * DEG;
  const λ = lonDeg * DEG;
  const c = Math.cos(φ);
  out[0] = c * Math.cos(λ);
  out[1] = c * Math.sin(λ);
  out[2] = Math.sin(φ);
  return out;
}

/** 地理单位向量 → 经纬度（度） */
export function v2ll(v) {
  return {
    lat: Math.asin(clamp(v[2], -1, 1)) / DEG,
    lon: Math.atan2(v[1], v[0]) / DEG,
  };
}

/**
 * 相机矩阵 M = Ry(lat0 - π/2) · Rz(-lon0)（行主序 3×3）。
 * 把地理单位向量旋转到相机空间：正对的经纬度 (lon0, lat0) 映射到 z 轴正方向。
 */
export function cameraMatrix(lon0Deg, lat0Deg, m = new Float64Array(9)) {
  const λ0 = -lon0Deg * DEG;
  const t1 = lat0Deg * DEG - Math.PI / 2;
  const c1 = Math.cos(t1), s1 = Math.sin(t1);
  const c2 = Math.cos(λ0), s2 = Math.sin(λ0);
  m[0] = c1 * c2; m[1] = -c1 * s2; m[2] = s1;
  m[3] = s2;      m[4] = c2;       m[5] = 0;
  m[6] = -s1 * c2; m[7] = s1 * s2; m[8] = c1;
  return m;
}

/** v' = M · v（地理 → 相机） */
export function rot(m, v, out = [0, 0, 0]) {
  out[0] = m[0] * v[0] + m[1] * v[1] + m[2] * v[2];
  out[1] = m[3] * v[0] + m[4] * v[1] + m[5] * v[2];
  out[2] = m[6] * v[0] + m[7] * v[1] + m[8] * v[2];
  return out;
}

/** v' = Mᵀ · v（相机 → 地理，旋转矩阵的逆即转置） */
export function rotT(m, v, out = [0, 0, 0]) {
  out[0] = m[0] * v[0] + m[3] * v[1] + m[6] * v[2];
  out[1] = m[1] * v[0] + m[4] * v[1] + m[7] * v[2];
  out[2] = m[2] * v[0] + m[5] * v[1] + m[8] * v[2];
  return out;
}

export function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function normalize(v, out = [0, 0, 0]) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  out[0] = v[0] / l; out[1] = v[1] / l; out[2] = v[2] / l;
  return out;
}

/** 单位向量球面插值（大圆航线） */
export function slerp(a, b, t, out = [0, 0, 0]) {
  const d = clamp(dot3(a, b), -1, 1);
  const th = Math.acos(d);
  if (th < 1e-5) return normalize([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], out);
  const s = Math.sin(th);
  const w1 = Math.sin((1 - t) * th) / s;
  const w2 = Math.sin(t * th) / s;
  return normalize([a[0] * w1 + b[0] * w2, a[1] * w1 + b[1] * w2, a[2] * w1 + b[2] * w2], out);
}

/** 儒略毫秒 → 浮点年（1970.0 = 1970-01-01） */
export const yearOf = (ms) => ms / MS_PER_YEAR + 1970;
/** 浮点年 → 儒略毫秒 */
export const msOfYear = (year) => (year - 1970) * MS_PER_YEAR;

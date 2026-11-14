// 历法与太阳 —— L1 自转律的天文学实现。
// 低精度太阳星历（Meeus《Astronomical Algorithms》简化式），误差 < 0.5°，本世界足够。
// 这里只有纯粹的规律，没有数据——太阳的位置是被"算"出来的，不是查表查出来的。

import { DEG, ll2v } from './math3.js';

const OBLIQ = 23.439 * DEG; // 黄赤交角（地球倾斜，四季之源）

/**
 * 给定纪元毫秒，返回太阳直射点。
 * @returns {{lat:number, lon:number, v:number[]}} 直射点纬经度（度）与地理单位向量
 */
export function subsolar(ms) {
  const d = ms / 86400000 - 10957.5;                          // J2000 历元起的天数
  const g = (357.529 + 0.98560028 * d) * DEG;                 // 平近点角
  const q = (280.459 + 0.98564736 * d) * DEG;                 // 平黄经
  const L = q + 1.915 * DEG * Math.sin(g) + 0.02 * DEG * Math.sin(2 * g); // 真黄经
  const lat = Math.asin(Math.sin(OBLIQ) * Math.sin(L)) / DEG; // 太阳赤纬 = 直射点纬度
  const ra = Math.atan2(Math.cos(OBLIQ) * Math.sin(L), Math.cos(L));      // 赤经
  let gmst = (280.46061837 + 360.98564736629 * d) % 360;      // 格林尼治恒星时
  if (gmst < 0) gmst += 360;
  let lon = ra / DEG - gmst;                                  // 直射点经度 = 赤经 - 恒星时
  lon = ((lon + 540) % 360) - 180;
  return { lat, lon, v: ll2v(lat, lon, [0, 0, 0]) };
}

/**
 * 晨昏线：与太阳向量成 90° 的大圆（L2 昼夜律的几何边界）。
 * @returns {Float32Array} 地理单位向量环（steps 个三元组）
 */
export function terminatorRing(sunV, steps = 96) {
  const ref = Math.abs(sunV[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  // u ⊥ sun：取 sun 与参考轴的叉积并归一化
  let ux = sunV[1] * ref[2] - sunV[2] * ref[1];
  let uy = sunV[2] * ref[0] - sunV[0] * ref[2];
  let uz = sunV[0] * ref[1] - sunV[1] * ref[0];
  const ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul; uy /= ul; uz /= ul;
  // w = sun × u，自动单位化
  const wx = sunV[1] * uz - sunV[2] * uy;
  const wy = sunV[2] * ux - sunV[0] * uz;
  const wz = sunV[0] * uy - sunV[1] * ux;
  const pts = new Float32Array(steps * 3);
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    pts[i * 3] = c * ux + s * wx;
    pts[i * 3 + 1] = c * uy + s * wy;
    pts[i * 3 + 2] = c * uz + s * wz;
  }
  return pts;
}

// 砖块 · 星海 —— 背景不是装饰，是世界的时间舞台。
// 固定种子的程序化星空：各向同性、不同频率呼吸，让自转与时间流动可感。

import { registerModule } from '../engine/modules.js';

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default registerModule({
  id: 'cosmos',
  name: '星海 · 舞台',
  order: 0,
  laws: ['背景律：恒星各向同性随机分布，亮度以不同频率呼吸——时间由此可感'],
  sources: [{ label: '程序化生成（固定种子 20261114，确定性可复现）', url: 'https://github.com/alishangtian/the-new-world' }],

  _make(env) {
    const rnd = mulberry32(20261114);
    const n = Math.round((env.w * env.h) / 2400);
    this.stars = Array.from({ length: n }, () => ({
      x: rnd(), y: rnd(),
      r: 0.4 + rnd() * 1.5,
      a: 0.2 + rnd() * 0.65,
      f: 0.3 + rnd() * 1.7,
      p: rnd() * Math.PI * 2,
    }));
    this._w = env.w; this._h = env.h;
  },

  render(env) {
    if (!this.stars || this._w !== env.w || this._h !== env.h) this._make(env);
    const { ctx } = env;
    ctx.fillStyle = '#dfe9ff';
    for (const s of this.stars) {
      ctx.globalAlpha = s.a * (0.62 + 0.38 * Math.sin(env.nowSec * s.f + s.p));
      ctx.fillRect(s.x * env.w, s.y * env.h, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  },
});

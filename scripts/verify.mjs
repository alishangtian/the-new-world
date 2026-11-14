#!/usr/bin/env node
// 世界体检 —— 无头渲染冒烟测试 + 数据/契约校验。CI 与发布前必跑。
// 用法：node scripts/verify.mjs
// 原则：一块认知砖出错，必须在合并前暴露，而不是留给浏览器里的用户。

import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const fail = (msg) => { failures++; console.error('  ✗ ' + msg); };
const ok = (msg) => console.log('  ✓ ' + msg);

// ---------------------------------------------------------------- 数据
console.log('[1/3] 数据完整性');
const loadJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
let earth, meta, cities;
try {
  earth = loadJson('data/earth.json');
  meta = loadJson('data/meta.json');
  cities = loadJson('data/cities.json');
  ok('data/*.json 均可解析');
} catch (e) {
  fail('数据不可读：' + e.message);
  process.exit(1);
}

if (earth.countries?.features?.length >= 150) ok(`国家边界 ${earth.countries.features.length} 国`);
else fail('国家边界数量异常');

let popCountries = 0, popWithCo2 = 0;
for (const e of Object.values(meta.byIso)) {
  if (e.pop && Object.keys(e.pop).length) popCountries++;
  if (e.co2 && Object.keys(e.co2).length) popWithCo2++;
}
if (popCountries >= 180) ok(`人口序列覆盖 ${popCountries} 国`);
else fail(`人口序列覆盖不足：${popCountries}`);
if (popWithCo2 >= 150) ok(`CO₂ 序列覆盖 ${popWithCo2} 国`);
else fail(`CO₂ 序列覆盖不足：${popWithCo2}`);
if (cities.cities?.length >= 400) ok(`城市 ${cities.cities.length} 座`);
else fail('城市数量不足');

for (const f of earth.countries.features) {
  if (!f.properties?.name) fail(`要素缺少名称：id=${f.id}`);
  const rings = f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat();
  for (const ring of rings) {
    const [lon, lat] = ring[0] || [];
    if (!isFinite(lon) || !isFinite(lat)) { fail(`要素 ${f.properties.name} 存在非法坐标`); break; }
  }
}

const worldPopLast = Object.keys(meta.world.pop || {}).sort((a, b) => a - b).at(-1);
if (worldPopLast) ok(`世界人口序列至 ${worldPopLast} 年`);
else fail('世界人口序列缺失');

// ---------------------------------------------------------------- 砖块契约
console.log('[2/3] 知识砖块契约');
const MODULE_FILES = ['cosmos', 'terra', 'daynight', 'life', 'links', 'carbon'];
const modules = [];
for (const name of MODULE_FILES) {
  try {
    const mod = (await import(join(ROOT, 'src/modules', `${name}.js`))).default;
    modules.push(mod);
    if (!mod.id || !mod.name || typeof mod.render !== 'function') fail(`${name}: 契约字段缺失`);
    else if (!Array.isArray(mod.sources) || mod.sources.some((s) => !/^https?:\/\//.test(s.url || '')))
      fail(`${name}: 来源缺少合法 URL`);
    else ok(`${mod.name}（${mod.id}）· ${mod.laws.length} 条规律 · ${mod.sources.length} 个来源`);
  } catch (e) {
    fail(`${name}.js 无法导入：${e.message.split('\n')[0]}`);
  }
}

// ---------------------------------------------------------------- 无头渲染
console.log('[3/3] 无头渲染（3 帧/砖）');
const { cameraMatrix } = await import(join(ROOT, 'src/engine/math3.js'));
const { subsolar } = await import(join(ROOT, 'src/engine/astro.js'));
const { WorldSim } = await import(join(ROOT, 'src/engine/sims.js'));

const noop = () => {};
function makeCtx() {
  const target = {
    canvas: { width: 640, height: 640 },
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  };
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      return (t[k] = noop); // 任何画布方法都安全地不做事
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

const data = { earth, meta, cities };
const sims = new WorldSim(data);
const cam = { lon0: 100, lat0: 30, zoom: 1.2, m: cameraMatrix(100, 30) };
const simMs = Date.now();
const baseEnv = {
  w: 640, h: 640, cx: 320, cy: 333, R: 234,
  cam, sims, data, mode: 'natural', hover: null, selected: null,
  fps: 60, nowSec: 1.0, engine: {},
  time: { simMs, speedMs: 1, speedKey: 'real', playing: false, year: sims ? 2026 : 2026 },
  year: 2026.87,
  sun: subsolar(simMs),
};
baseEnv.engine.projectVec = (v) => [320, 333, 1];

for (const mod of modules) {
  const env = { ...baseEnv, ctx: makeCtx() };
  try {
    mod.render(env);
    mod.render(env);
    const env2 = { ...baseEnv, ctx: makeCtx(), mode: 'pop', nowSec: 2.5 };
    mod.render(env2);
    ok(`${mod.id} 三帧渲染无异常`);
  } catch (e) {
    fail(`${mod.id} 渲染抛错：${e.message.split('\n')[0]}`);
  }
}

// ---------------------------------------------------------------- 拾取回归
console.log('[3.5/3] 国别拾取回归（教训：射线法必须吃扁平坐标）');
try {
  const { buildPickIndex, pickAt } = await import(join(ROOT, 'src/engine/engine.js'));
  const index = buildPickIndex(earth.countries.features);
  const cases = [
    { lon: 104.06, lat: 30.57, zh: '成都', expect: 'China' },
    { lon: 116.4, lat: 39.9, zh: '北京', expect: 'China' },
    { lon: 139.69, lat: 35.69, zh: '东京', expect: 'Japan' },
    { lon: 77.2, lat: 28.6, zh: '德里', expect: 'India' },
    { lon: -47.9, lat: -15.8, zh: '巴西利亚', expect: 'Brazil' },
    { lon: 0, lat: 0, zh: '大西洋', expect: null },
  ];
  let hitOk = 0;
  for (const c of cases) {
    const f = pickAt(index, c.lon, c.lat);
    const got = f ? f.properties.name : null;
    if (got === c.expect) hitOk++;
    else fail(`拾取 ${c.zh} 期望 ${c.expect} 实得 ${got}`);
  }
  if (hitOk === cases.length) ok(`拾取 ${hitOk}/${cases.length} 点全部命中`);
} catch (e) {
  fail('拾取回归不可执行：' + e.message.split('\n')[0]);
}

// ---------------------------------------------------------------- 汇总
const size = (...ps) => ps.reduce((a, p) => a + statSync(join(ROOT, p)).size, 0) / 1024;
console.log(`\n数据体积：${size('data/earth.json', 'data/meta.json', 'data/cities.json').toFixed(0)} KB（随仓库离线分发）`);

if (failures) {
  console.error(`\n✗ 体检未通过：${failures} 项`);
  process.exit(1);
}
console.log('\n✓ 世界体检通过：数据可溯源、契约完整、渲染无异常');

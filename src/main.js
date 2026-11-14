// 点火 —— 把数据、规律与砖块装进引擎。
// 数据在仓库里随代码一起提交（离线可用）；需要更新时重跑 scripts/fetch_data.py。

import { Engine } from './engine/engine.js';
import { WorldSim } from './engine/sims.js';
import { getModules } from './engine/modules.js';

// 砖块：import 即注册（施工规律之二：一块砖一个文件）
import './modules/cosmos.js';
import './modules/terra.js';
import './modules/daynight.js';
import './modules/life.js';
import './modules/links.js';
import './modules/quake.js';
import './modules/carbon.js';

import { initPanel } from './ui/panel.js';
import { initHud } from './ui/hud.js';
import { initTooltip } from './ui/tooltip.js';

const loader = document.getElementById('loader');

async function j(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}

boot().catch((err) => {
  loader.innerHTML = `<div class="err"><h2>无法加载世界</h2>
    <p>${String(err.message || err)}</p>
    <p>请通过 HTTP 访问仓库根目录：</p>
    <code>python3 -m http.server 8000</code>
    <p>然后打开 <a href="http://localhost:8000">http://localhost:8000</a></p></div>`;
  loader.classList.remove('done');
});

async function boot() {
  const t0 = performance.now();
  const [earth, meta, cities, quakes, plates] = await Promise.all([
    j('data/earth.json'),
    j('data/meta.json'),
    j('data/cities.json'),
    j('data/quakes.json'),
    j('data/plates.json'),
  ]);
  const data = { earth, meta, cities, quakes, plates };

  const engine = new Engine(document.getElementById('world'), data);
  engine.sims = new WorldSim(data);
  for (const m of getModules()) engine.addModule(m);

  initPanel(engine, document.getElementById('panel'), getModules());
  initHud(engine, document.getElementById('hud'), document.getElementById('timeline'));
  initTooltip(engine, document.getElementById('tooltip'), document.getElementById('card'));

  window.__world = engine; // 诊断口

  loader.classList.add('done');
  console.log(`🌍 新世界点火完成：${getModules().length} 块知识砖 · ${(performance.now() - t0).toFixed(0)}ms`);
}

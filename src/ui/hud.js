// HUD 与时间轴 —— 世界的脉搏：模拟时刻、世界人口、年度排放、太阳直射点；
// 以及操纵时间的方向盘：播放/暂停、流速、1960→2050 时间轴、观察模式。

import { subsolar } from '../engine/astro.js';

const SPEEDS = [
  { key: 'real', label: '实时' },
  { key: 'day', label: '1天/秒' },
  { key: 'month', label: '1月/秒' },
  { key: 'year', label: '1年/秒' },
  { key: 'decade', label: '10年/秒' },
];
const MODES = [
  { key: 'natural', label: '观察' },
  { key: 'pop', label: '人口' },
  { key: 'gdp', label: '经济' },
  { key: 'co2', label: '碳' },
];
const fmtDate = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});
const fmtPop = (p) => (p >= 1e8 ? (p / 1e8).toFixed(2) + ' 亿' : p >= 1e4 ? (p / 1e4).toFixed(0) + ' 万' : String(Math.round(p)));

export function initHud(engine, hudMount, tlMount) {
  // ---- HUD
  hudMount.innerHTML = `
    <div class="stat"><label>模拟时刻</label><b id="h-date">—</b></div>
    <div class="stat"><label>世界人口</label><b id="h-pop">—</b></div>
    <div class="stat"><label>年度 CO₂ 排放</label><b id="h-co2">—</b></div>
    <div class="stat"><label>太阳直射点</label><b id="h-sun">—</b></div>
    <div class="stat tiny" id="h-foot"></div>`;

  const $ = (id) => document.getElementById(id);
  const hDate = $('h-date'), hPop = $('h-pop'), hCo2 = $('h-co2'), hSun = $('h-sun'), hFoot = $('h-foot');

  // ---- 时间轴
  tlMount.innerHTML = `
    <div class="tl-row">
      <button class="btn" id="tl-play" title="播放 / 暂停">⏸</button>
      <div class="tl-speeds">
        ${SPEEDS.map((s) => `<button class="btn spd" data-k="${s.key}">${s.label}</button>`).join('')}
      </div>
      <span class="tl-year" id="tl-year">—</span>
      <button class="btn" id="tl-now">回到现在</button>
    </div>
    <input type="range" id="tl-range" min="1960" max="2050" step="0.1" value="2026">
    <div class="tl-row tl-modes">
      ${MODES.map((m) => `<button class="btn mode" data-k="${m.key}">${m.label}</button>`).join('')}
      <span class="tl-tip">拖拽旋转 · 滚轮缩放 · 点击国家查看档案</span>
    </div>`;

  const play = $('tl-play'), range = $('tl-range'), tlYear = $('tl-year');
  const spdBtns = [...tlMount.querySelectorAll('.spd')];
  const modeBtns = [...tlMount.querySelectorAll('.mode')];
  let scrubbing = false;

  const syncButtons = () => {
    play.textContent = engine.time.playing ? '⏸' : '▶';
    for (const b of spdBtns) b.classList.toggle('active', b.dataset.k === engine.time.speedKey);
    for (const b of modeBtns) b.classList.toggle('active', b.dataset.k === engine.mode);
  };

  play.addEventListener('click', () => engine.setSpeed(engine.time.playing ? 'pause' : (engine.time.speedKey || 'real')));
  for (const b of spdBtns) b.addEventListener('click', () => engine.setSpeed(b.dataset.k));
  for (const b of modeBtns) b.addEventListener('click', () => { engine.setMode(b.dataset.k); syncButtons(); });
  $('tl-now').addEventListener('click', () => engine.goNow());
  range.addEventListener('pointerdown', () => { scrubbing = true; });
  window.addEventListener('pointerup', () => { scrubbing = false; });
  range.addEventListener('input', () => engine.setYear(parseFloat(range.value)));

  engine.onTime = syncButtons;
  syncButtons();

  // ---- 脉搏：每 150ms 刷新读数
  setInterval(() => {
    const t = engine.time;
    hDate.textContent = fmtDate.format(new Date(t.simMs)) + ' UTC';
    const pop = engine.sims ? engine.sims.popAt(t.year) : NaN;
    hPop.textContent = isFinite(pop) ? fmtPop(pop) : '—';
    const co2 = engine.sims ? engine.sims.co2At(t.year) : NaN;
    hCo2.textContent = isFinite(co2) ? (co2 / 100).toFixed(0) + ' 亿吨 / 年' : '—';
    const ss = subsolar(t.simMs);
    hSun.textContent = `${Math.abs(ss.lat).toFixed(1)}°${ss.lat >= 0 ? 'N' : 'S'} ${Math.abs(ss.lon).toFixed(1)}°${ss.lon >= 0 ? 'E' : 'W'}`;
    hFoot.innerHTML = `${Math.round(engine._fps)} fps · 离线可用 · 零依赖`;
    tlYear.textContent = String(Math.floor(t.year));
    if (!scrubbing) range.value = String(Math.min(2050, Math.max(1960, t.year)));
  }, 150);
};

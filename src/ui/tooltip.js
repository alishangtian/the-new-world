// 悬浮提示与国别档案 —— 点击任何国家，看这个国家的真实数据与它的未来轨迹。

export function initTooltip(engine, tip, card) {
  // 提示框跟随指针
  document.addEventListener('pointermove', (e) => {
    if (tip.classList.contains('hidden')) return;
    const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 12);
    const y = Math.min(e.clientY + 16, window.innerHeight - tip.offsetHeight - 12);
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  });

  const fmtPop = (p) => (p >= 1e8 ? (p / 1e8).toFixed(2) + ' 亿' : p >= 1e4 ? (p / 1e4).toFixed(0) + ' 万' : '—');
  const numIdOf = (f) => (/^\d+$/.test(String(f.id)) ? String(f.id) : null);
  const headline = (f) => {
    const num = numIdOf(f);
    const rec = engine.sims && num ? engine.sims.countryAt(num, engine.time.year) : null;
    if (!rec) return null;
    if (engine.mode === 'gdp' && rec.gdp && rec.pop) return ['人均 GDP', '$' + Math.round(rec.gdp / rec.pop).toLocaleString('zh-CN')];
    if (engine.mode === 'co2' && isFinite(rec.co2)) return ['人均 CO₂', rec.co2.toFixed(1) + ' 吨'];
    if (isFinite(rec.pop)) return ['人口', fmtPop(rec.pop)];
    return null;
  };
  const zhOf = (f) => {
    const num = numIdOf(f);
    const e = num && engine.data.meta.byIso[num];
    return (e && e.zh) || '';
  };

  engine.onHover = (f) => {
    if (!f) { tip.classList.add('hidden'); return; }
    const head = headline(f);
    tip.innerHTML = `<b>${zhOf(f) || f.properties.name}</b><span>${f.properties.name}</span>` +
      (head ? `<em>${head[0]} · ${head[1]}</em>` : '');
    tip.classList.remove('hidden');
  };

  engine.onPick = (f) => {
    if (!f) { card.classList.add('hidden'); return; }
    const num = numIdOf(f);
    const e = num && engine.data.meta.byIso[num];
    const rec = engine.sims && num ? engine.sims.countryAt(num, engine.time.year) : null;
    const y = Math.floor(engine.time.year);
    const gdpPc = rec && rec.gdp && rec.pop ? rec.gdp / rec.pop : NaN;
    card.innerHTML = `
      <button class="close" title="关闭">✕</button>
      <h3>${zhOf(f) || f.properties.name} <small>${f.properties.name}</small></h3>
      <p class="region">${e ? e.region : '暂无世界银行档案'}</p>
      <div class="stats">
        <div><label>人口 ${y}</label><b>${rec && isFinite(rec.pop) ? fmtPop(rec.pop) : '—'}</b></div>
        <div><label>GDP ${y}</label><b>${rec && isFinite(rec.gdp) ? '$' + (rec.gdp / 1e12).toFixed(1) + ' 万亿' : '—'}</b></div>
        <div><label>人均 GDP</label><b>${isFinite(gdpPc) ? '$' + Math.round(gdpPc).toLocaleString('zh-CN') : '—'}</b></div>
        <div><label>人均 CO₂</label><b>${rec && isFinite(rec.co2) ? rec.co2.toFixed(1) + ' 吨' : '—'}</b></div>
      </div>
      <canvas width="272" height="76"></canvas>
      <p class="note">实线：世界银行历史人口；虚线：L3 人口律外推（→2050）。</p>
      ${e ? `<p class="src">来源：<a href="https://data.worldbank.org/country/${encodeURIComponent(e.iso3)}" target="_blank" rel="noopener">World Bank · ${e.iso3}</a></p>` : ''}`;
    card.classList.remove('hidden');
    card.querySelector('.close').addEventListener('click', () => {
      card.classList.add('hidden');
      engine.selected = null;
    });

    // 人口轨迹：历史实线 + 规律外推虚线
    const cv = card.querySelector('canvas');
    const c2 = cv.getContext('2d');
    const pts = engine.sims && num ? engine.sims.projectPop(num, 1960, 2050, 110) : null;
    if (!pts) return;
    const t0 = rec.series.proj.t0;
    const vmax = Math.max(...pts.map((p) => p[1])) * 1.08;
    const X = (yy) => 4 + ((yy - 1960) / 90) * (cv.width - 10);
    const Y = (v) => cv.height - 6 - (v / vmax) * (cv.height - 14);
    c2.strokeStyle = 'rgba(148,180,255,0.25)';
    c2.lineWidth = 1;
    c2.beginPath(); c2.moveTo(X(1960), cv.height - 6); c2.lineTo(X(2050), cv.height - 6); c2.stroke();
    c2.lineWidth = 1.6;
    c2.strokeStyle = 'rgba(110,231,255,0.95)';
    c2.beginPath();
    let drawing = false;
    for (const [yy, v] of pts) {
      if (yy <= t0) { const px = X(yy), py = Y(v); drawing ? c2.lineTo(px, py) : c2.moveTo(px, py); drawing = true; }
    }
    c2.stroke();
    c2.setLineDash([4, 4]);
    c2.strokeStyle = 'rgba(255,209,102,0.95)';
    c2.beginPath();
    drawing = false;
    for (const [yy, v] of pts) {
      if (yy >= t0) { const px = X(yy), py = Y(v); drawing ? c2.lineTo(px, py) : c2.moveTo(px, py); drawing = true; }
    }
    c2.stroke();
    c2.setLineDash([]);
  };
}

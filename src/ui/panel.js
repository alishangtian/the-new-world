// 左侧面板 —— 知识砖块的目录。每块砖的规律与来源都摊开给人类看：
// 世界不是黑盒，每一个数字都能点进原始出处。

export function initPanel(engine, mount, modules) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const rows = modules.map((m) => `
    <section class="brick" data-id="${esc(m.id)}">
      <header>
        <label class="switch">
          <input type="checkbox" data-id="${esc(m.id)}" ${m.enabled !== false ? 'checked' : ''}>
          <span class="knob"></span>
        </label>
        <h3>${esc(m.name)}</h3>
      </header>
      <ul class="laws">${m.laws.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      <p class="sources">
        ${m.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ↗</a>`).join('')}
      </p>
    </section>`).join('');

  mount.innerHTML = `
    <h2>知识砖块 <span>${modules.length}</span></h2>
    <p class="hint">每一块砖 = 一份可溯源的认知 + 一组可运行的规律。开关即拆装世界。</p>
    ${rows}
    <footer>
      <p>本世界零依赖、离线可运行。数据采集脚本可重跑：
        <code>python3 scripts/fetch_data.py</code></p>
      <a href="https://github.com/alishangtian/the-new-world" target="_blank" rel="noopener">GitHub · the-new-world ↗</a>
    </footer>`;

  mount.addEventListener('change', (e) => {
    const id = e.target.dataset && e.target.dataset.id;
    if (id) engine.setEnabled(id, e.target.checked);
  });
}

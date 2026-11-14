// the-new-world · 控制台逻辑 —— 只消费 console/state.json（由 build_console_state.mjs 编译）。
// 零依赖：原生 ESM + DOM。人类观察平台的窗口：工单 / 知识库 / 设计规律 / 迭代账本。

const app = document.getElementById('app');
const foot = document.getElementById('foot-state');
const state = await (await fetch('./console/state.json')).json();

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const statusChip = (s) => `<span class="chip ${esc(s)}">${esc({ open: 'open 待领', claimed: 'claimed 施工中', delivered: 'delivered 已交付', blocked: 'blocked 受阻' }[s] || s)}</span>`;

foot.textContent = `平台状态：${state.counts.ordersOpen}/${state.counts.orders} 工单待领 · ${state.counts.knowledge} 条世界考察 · ${state.counts.laws} 条设计规律 · ${state.counts.iterations} 轮迭代`;

// ---------------------------------------------------------------- 总览
function renderOverview() {
  const next = state.orders.find((o) => o.status === 'open');
  const last = state.iterations[state.iterations.length - 1];
  app.innerHTML = `
    <div class="grid cols-3">
      <div class="glass card">
        <h3>工单池</h3>
        <div class="big">${state.counts.ordersOpen}<span style="font-size:14px;color:var(--muted)"> / ${state.counts.orders}</span></div>
        <div class="sub">待领 / 总数。agent 通过 MCP <code>list_orders</code> 领单施工。</div>
        <div class="chips">
          ${['open', 'claimed', 'blocked', 'delivered'].map((s) => {
            const n = state.orders.filter((o) => o.status === s).length;
            return n ? `<span class="chip ${s}">${{open:'待领',claimed:'施工中',blocked:'受阻',delivered:'已交付'}[s]} × ${n}</span>` : '';
          }).join('')}
        </div>
      </div>
      <div class="glass card">
        <h3>世界考察</h3>
        <div class="big">${state.counts.knowledge}</div>
        <div class="sub">条来自真实世界的认知（MCP / A2A / 主流框架 / 记忆 / 沙箱），每条可溯源。</div>
        <div class="chips">${[...new Set(state.knowledge.map((k) => k.topic))].map((t) => `<span class="topic">${esc(t)}</span>`).join('')}</div>
      </div>
      <div class="glass card">
        <h3>设计规律</h3>
        <div class="big">${state.counts.laws}</div>
        <div class="sub">条平台规律，每条引用考察条目为依据（P1–P${state.counts.laws}）。规律约束建造，建造更新平台。</div>
      </div>
    </div>
    <div class="grid cols-2" style="margin-top:14px">
      <div class="glass card">
        <h3>下一张待领工单</h3>
        ${next ? `<p style="font-size:14px;margin:6px 0"><b>${esc(next.id)}</b> · ${esc(next.title)}</p>
          <div class="sub">${esc(next.goal)}</div>
          <div class="chips"><span class="chip open">优先级 ${next.priority}</span>${next.auto === true ? '<span class="chip claimed">auto-ok · 调度器可派</span>' : ''}</div>` : '<div class="sub">池中已无待领工单——发包或考察新候选。</div>'}
      </div>
      <div class="glass card">
        <h3>最近迭代</h3>
        <p style="font-size:14px;margin:6px 0"><b>迭代 ${last.n}</b> · ${esc(last.title)}</p>
        <div class="sub">账本只追加（P7）：完整履历见「迭代账本」标签。</div>
      </div>
    </div>
    ${state.scheduler ? `<div class="glass card" style="margin-top:14px">
      <h3>自主调度（P9）</h3>
      <div class="sub">心跳 tick.yml 每日 UTC 01:00 调用调度器：回收超时认领 → 派发 auto-ok 工单 → 生成施工包。</div>
      <div class="chips">
        <span class="chip claimed">auto-ok 待施工 × ${state.scheduler.autoOpen.length}</span>
        <span class="chip delivered">历史派单 × ${state.scheduler.dispatches}</span>
        ${state.scheduler.autoOpen.map((o) => `<span class="chip open">${esc(o.id)} ${esc(o.title)}</span>`).join('')}
      </div>
    </div>` : ''}`;
}

// ---------------------------------------------------------------- 工单
let orderDetailId = null;
function renderOrders() {
  const d = state.orders.find((o) => o.id === orderDetailId);
  app.innerHTML = `
    <div class="glass" style="padding:16px 18px">
      <div class="section-title">工单池 · agent 的发包渠道</div>
      <table>
        <tr><th>工单</th><th>标题</th><th>规律候选</th><th>优先级</th><th>状态</th></tr>
        ${state.orders.map((o) => `
          <tr class="click" data-id="${esc(o.id)}">
            <td>${esc(o.id)}</td>
            <td>${esc(o.title)}</td>
            <td style="color:var(--muted)">${esc((o.lawDraft || '').slice(0, 42))}${(o.lawDraft || '').length > 42 ? '…' : ''}</td>
            <td>${o.priority}</td>
            <td>${statusChip(o.status)}</td>
          </tr>`).join('')}
      </table>
      ${d ? `<div class="glass detail">
        <button class="close" id="close-order">✕</button>
        <h3>${esc(d.id)} · ${esc(d.title)} ${statusChip(d.status)}</h3>
        <div class="row"><b>目标</b>${esc(d.goal)}</div>
        <div class="row"><b>考察线索</b></div>
        <ul>${(d.leads || []).map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.source)} ↗</a>（${esc(l.license || '许可待核实')}）</li>`).join('')}</ul>
        <div class="row"><b>规律候选</b>${esc(d.lawDraft || '')}</div>
        <div class="row"><b>验收标准</b></div>
        <ul>${(d.acceptance || []).map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
        ${d.notes ? `<div class="row"><b>notes</b>${esc(d.notes)}</div>` : ''}
        ${d.claimedBy ? `<div class="row"><b>施工方</b>${esc(d.claimedBy)} @ ${esc(d.claimedAt)}</div>` : ''}
      </div>` : ''}
    </div>`;
  app.querySelectorAll('tr.click').forEach((tr) =>
    tr.addEventListener('click', () => { orderDetailId = tr.dataset.id; renderOrders(); }));
  const close = document.getElementById('close-order');
  if (close) close.addEventListener('click', () => { orderDetailId = null; renderOrders(); });
}

// ---------------------------------------------------------------- 知识库
let knowledgeQuery = '';
function renderKnowledge() {
  const q = knowledgeQuery.trim().toLowerCase();
  const list = state.knowledge.filter((k) =>
    !q || [k.title, k.topic, k.insight, k.appliedTo].join(' ').toLowerCase().includes(q));
  app.innerHTML = `
    <div class="glass" style="padding:16px 18px">
      <div class="section-title">知识库 · 从世界带回来的认知</div>
      <div class="toolbar">
        <input id="kq" placeholder="搜索认知 / 主题 / 应用位置…" value="${esc(knowledgeQuery)}">
        <span class="sub" style="font-size:11px;color:var(--muted)">${list.length} / ${state.knowledge.length} 条 · 每条可溯源</span>
      </div>
      <div class="grid cols-2">
        ${list.map((k) => `
          <div class="glass kcard">
            <span class="topic">${esc(k.topic)}</span>
            <h3>${esc(k.id)} · ${esc(k.title)}</h3>
            <div class="meta">考察日期 ${esc(k.date)}</div>
            <p>${esc(k.insight)}</p>
            <div class="apply">${esc(k.appliedTo)}</div>
            <div class="srcs">
              ${(k.sources || []).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">◆ ${esc(s.title)} ↗</a>`).join('')}
            </div>
          </div>`).join('') || '<div class="sub" style="padding:10px">无匹配条目</div>'}
      </div>
    </div>`;
  const input = document.getElementById('kq');
  input.addEventListener('input', () => { knowledgeQuery = input.value; renderKnowledge(); const i = document.getElementById('kq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); });
}

// ---------------------------------------------------------------- 规律
function renderLaws() {
  app.innerHTML = `
    <div class="glass" style="padding:16px 18px">
      <div class="section-title">设计规律 · 从世界知识提炼，约束平台建造</div>
      <table>
        <tr><th>编号</th><th>名称</th><th>规律</th><th>落地位置</th><th>依据</th></tr>
        ${state.laws.map((l) => `
          <tr>
            <td><b style="color:var(--gold)">${esc(l.id)}</b></td>
            <td>${esc(l.name)}</td>
            <td style="line-height:1.7">${esc(l.law)}</td>
            <td style="color:var(--muted);font-size:12px">${esc(l.where)}</td>
            <td><a href="#/knowledge" data-goto-k="${esc(l.evidence)}" style="color:var(--accent)">${esc(l.evidence)} ↗</a></td>
          </tr>`).join('')}
      </table>
      <p class="note">提炼纪律：没有考察条目支撑的"规律"是观点，进不了这张表；规律修订必须走迭代并登记账本。</p>
    </div>`;
  app.querySelectorAll('[data-goto-k]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    knowledgeQuery = a.dataset.gotoK;
    location.hash = '#/knowledge';
  }));
}

// ---------------------------------------------------------------- 迭代
function renderIterations() {
  app.innerHTML = `
    <div class="glass" style="padding:16px 18px">
      <div class="section-title">迭代账本 · 只追加的平台记忆（P7）</div>
      <table>
        <tr><th>轮次</th><th>主题</th></tr>
        ${state.iterations.map((it) => `
          <tr><td><b style="color:var(--gold)">迭代 ${it.n}</b></td><td>${esc(it.title)}</td></tr>`).join('')}
      </table>
      <p class="note">完整条目（目标/来源/产物/验收证据）见 <a href="https://github.com/alishangtian/the-new-world/blob/main/docs/ITERATIONS.md" target="_blank" rel="noopener" style="color:var(--accent)">docs/ITERATIONS.md ↗</a>。账本只追加：改写历史 = 记忆损坏。</p>
    </div>`;
}

// ---------------------------------------------------------------- 接入
function renderJoin() {
  app.innerHTML = `
    <div class="grid cols-2">
      <div class="glass card">
        <h3>MCP 接入 · 让任何 agent 领单施工</h3>
        <pre class="code">{
  "mcpServers": {
    "the-new-world": {
      "command": "node",
      "args": ["&lt;仓库路径&gt;/platform/mcp/server.mjs"]
    }
  }
}</pre>
        <div class="sub">工具：list_orders / read_order / platform_state / list_knowledge / run_gates / write_ledger / close_order</div>
      </div>
      <div class="glass card">
        <h3>协议与角色</h3>
        <div class="sub" style="font-size:13px;line-height:2">
          <a href="https://github.com/alishangtian/the-new-world/blob/main/platform/PROTOCOL.md" target="_blank" rel="noopener" style="color:var(--accent)">platform/PROTOCOL.md ↗</a> —— 平台宪法（工单状态机 / 流水线 / 验收门 / 红线）<br>
          platform/roles/ —— 考察员 / 建造师 / 质检员 / 史官（契约，可一人分饰）<br>
          .zcode/skills/world-builder/ —— 持续迭代技能（ZCode 内自动触发）<br>
          scripts/accept.mjs —— 无头验收门 G1-G5
        </div>
      </div>
      <div class="glass card">
        <h3>六步流水线</h3>
        <pre class="code">EXPLORE 考察（网络事实 / 搜索引擎 / GitHub 开源）
DISTILL 提炼（认知 → knowledge/ → 设计规律）
BUILD   构建（按规律升级平台）
VERIFY  验收（accept.mjs 五道门）
LEDGER  记账（只追加账本）
COMMIT  提交（迭代叙事）</pre>
      </div>
      <div class="glass card">
        <h3>红线</h3>
        <div class="sub" style="font-size:13px;line-height:2">
          零依赖 · 溯源强制 · 账本只追加 · 检查器不可自改 · 考察优先 · 厂商中立 · 宁缺毋滥
        </div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------- 路由
const renderers = { overview: renderOverview, orders: renderOrders, knowledge: renderKnowledge, laws: renderLaws, iterations: renderIterations, join: renderJoin };
function route() {
  const tab = (location.hash || '#/overview').replace('#/', '').split('?')[0];
  (renderers[tab] || renderOverview)();
  document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
}
window.addEventListener('hashchange', route);
route();

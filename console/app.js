// the-new-world · 控制台逻辑 —— 只消费 console/state.json（由 build_console_state.mjs 编译）。
// 迭代 006 起：溯源链 / 时间线 / 施工包视图 / 状态与主题筛选 / 认知↔规律交叉跳转。
// 零依赖：原生 ESM + DOM。

const app = document.getElementById('app');
const foot = document.getElementById('foot-state');
let state = await (await fetch('./console/state.json', { cache: 'no-store' })).json();

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const chip = (cls, text) => `<span class="chip ${cls}">${esc(text)}</span>`;
const STATUS_LABEL = { open: '待领', claimed: '施工中', delivered: '已交付', blocked: '受阻' };
const statusChip = (s) => chip(s, STATUS_LABEL[s] || s);
const refreshBtn = `<button class="btn-ghost" id="btn-refresh" title="重新编译并加载平台状态">⟳ 刷新状态</button>`;
document.querySelector('.brand p').insertAdjacentHTML('afterend', '');

foot.innerHTML = `平台状态：${state.counts.ordersOpen}/${state.counts.orders} 工单待领 · ${state.counts.knowledge} 条世界考察 · ${state.counts.laws} 条设计规律 · ${state.counts.iterations} 轮迭代 · ${state.counts.mcpTools} 个 MCP 工具 &nbsp; ${refreshBtn}`;

// ---------------------------------------------------------------- 总览
function renderOverview() {
  const next = state.orders.find((o) => o.status === 'open');
  const last = state.iterations[state.iterations.length - 1];
  const maxTopic = Math.max(...state.topics.map((t) => t.count), 1);
  const lawById = Object.fromEntries(state.laws.map((l) => [l.id, l]));

  app.innerHTML = `
    <div class="grid cols-3">
      <div class="glass card">
        <h3>工单池</h3>
        <div class="big">${state.counts.ordersOpen}<span style="font-size:14px;color:var(--muted)"> / ${state.counts.orders}</span></div>
        <div class="sub">待领 / 总数。agent 通过 MCP <code>list_orders</code> 领单施工。</div>
        <div class="chips">
          ${['open', 'claimed', 'blocked', 'delivered'].map((s) => {
            const n = state.orders.filter((o) => o.status === s).length;
            return n ? chip(s, `${STATUS_LABEL[s]} × ${n}`) : '';
          }).join('')}
        </div>
      </div>
      <div class="glass card">
        <h3>世界考察</h3>
        <div class="big">${state.counts.knowledge}</div>
        <div class="sub">条来自真实世界的认知（协议 / 框架 / 编排 / 记忆 / 沙箱 / 可观测），每条可溯源。</div>
        <div class="bars">
          ${state.topics.map((t) => `
            <div class="bar-row"><span class="bar-label">${esc(t.topic)}</span>
              <div class="bar-track"><div class="bar-fill" style="width:${Math.round((t.count / maxTopic) * 100)}%"></div></div>
              <span class="bar-num">${t.count}</span>
            </div>`).join('')}
        </div>
      </div>
      <div class="glass card">
        <h3>设计规律</h3>
        <div class="big">${state.counts.laws}</div>
        <div class="sub">条平台规律（P1–P${state.counts.laws}），每条引用考察条目为依据。<br>链路可在「溯源链」页回放。</div>
        <div class="chips">${state.laws.map((l) => `<a class="chip lawchip" href="#/trace?p=${l.id}">${l.id} ${esc(l.name)}</a>`).join('')}</div>
      </div>
    </div>
    <div class="grid cols-3" style="margin-top:14px">
      <div class="glass card">
        <h3>下一张待领工单</h3>
        ${next ? `<p style="font-size:14px;margin:6px 0"><b>${esc(next.id)}</b> · ${esc(next.title)}</p>
          <div class="sub">${esc(next.goal)}</div>
          <div class="chips"><span class="chip open">优先级 ${next.priority}</span>${next.auto === true ? chip('claimed', 'auto-ok · 调度器可派') : ''}</div>`
        : '<div class="sub">池中已无待领工单——发包或考察新候选。</div>'}
      </div>
      <div class="glass card">
        <h3>最近迭代</h3>
        <p style="font-size:14px;margin:6px 0"><b>迭代 ${last.n}</b> · ${esc(last.title)}</p>
        <div class="sub">${esc(last.goal)}</div>
      </div>
      <div class="glass card">
        <h3>平台能力（MCP）</h3>
        <div class="big">${state.counts.mcpTools}</div>
        <div class="sub">个工具暴露给任意 agent 平台。</div>
        <div class="chips">${state.mcpTools.map((t) => `<span class="chip claimed">${esc(t.name)}</span>`).join('')}</div>
      </div>
    </div>
    ${state.scheduler ? `<div class="glass card" style="margin-top:14px">
      <h3>自主调度（P9）</h3>
      <div class="sub">心跳 tick.yml 每日 UTC 01:00 调用调度器：回收超时认领 → 派发 auto-ok 工单 → 生成施工包。</div>
      <div class="chips">
        ${chip('claimed', `auto-ok 待施工 × ${state.scheduler.autoOpen.length}`)}
        ${chip('delivered', `历史派单 × ${state.scheduler.dispatches}`)}
        ${state.scheduler.autoOpen.map((o) => chip('open', `${o.id} ${o.title}`)).join('')}
        ${state.scheduler.lastTick ? chip('', `上一跳 @ ${esc(state.scheduler.lastTick.at.slice(0, 16)).replace('T', ' ')}`) : ''}
      </div>
    </div>` : ''}`;
}

// ---------------------------------------------------------------- 工单
let orderFilter = 'all';
let orderDetailId = null;
function renderOrders() {
  const list = state.orders.filter((o) => orderFilter === 'all' || o.status === orderFilter);
  const d = state.orders.find((o) => o.id === orderDetailId);
  const packs = state.dispatches;
  app.innerHTML = `
    <div class="glass" style="padding:16px 18px">
      <div class="section-title">工单池 · agent 的发包渠道</div>
      <div class="toolbar">
        ${['all', 'open', 'claimed', 'blocked', 'delivered'].map((s) =>
          `<button class="btn-ghost fchip ${orderFilter === s ? 'active' : ''}" data-f="${s}">${s === 'all' ? '全部' : STATUS_LABEL[s]} · ${s === 'all' ? state.orders.length : state.orders.filter((o) => o.status === s).length}</button>`).join('')}
      </div>
      <table>
        <tr><th>工单</th><th>标题</th><th>优先级</th><th>状态</th></tr>
        ${list.map((o) => `
          <tr class="click ${o.id === orderDetailId ? 'sel' : ''}" data-id="${esc(o.id)}">
            <td><b>${esc(o.id)}</b>${o.auto === true ? ' <span class="topic" style="margin:0">auto</span>' : ''}</td>
            <td>${esc(o.title)}</td>
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
        ${d.deliveredIn ? `<div class="row"><b>交付于</b>迭代 ${esc(d.deliveredIn)}（${esc(d.acceptedAt)}）</div>` : ''}
      </div>` : ''}
      ${packs.length ? `<div class="section-title" style="margin-top:18px">施工包 · 调度器发出的"下一步做什么"（P9）</div>
      <div class="grid cols-2">
        ${packs.map((p) => `
          <div class="glass kcard">
            <span class="topic">迭代 ${esc(p.iteration)}</span>
            <h3>${esc(p.orderId)} · ${esc(p.title)}</h3>
            <div class="meta">签发 ${esc(p.createdAt.slice(0, 16)).replace('T', ' ')}</div>
            <ol class="runbook">${p.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
          </div>`).join('')}
      </div>` : ''}
    </div>`;
  app.querySelectorAll('tr.click').forEach((tr) =>
    tr.addEventListener('click', () => { orderDetailId = tr.dataset.id; renderOrders(); }));
  app.querySelectorAll('.fchip').forEach((b) =>
    b.addEventListener('click', () => { orderFilter = b.dataset.f; renderOrders(); }));
  const close = document.getElementById('close-order');
  if (close) close.addEventListener('click', () => { orderDetailId = null; renderOrders(); });
}

// ---------------------------------------------------------------- 知识库
let knowledgeQuery = '';
let knowledgeTopic = 'all';
function renderKnowledge() {
  const q = knowledgeQuery.trim().toLowerCase();
  const lawById = Object.fromEntries(state.laws.map((l) => [l.id, l]));
  const list = state.knowledge.filter((k) =>
    (knowledgeTopic === 'all' || k.topic === knowledgeTopic) &&
    (!q || [k.title, k.topic, k.insight, k.appliedTo].join(' ').toLowerCase().includes(q)));
  app.innerHTML = `
    <div class="glass" style="padding:16px 18px">
      <div class="section-title">知识库 · 从世界带回来的认知</div>
      <div class="chips" style="margin-bottom:12px">
        <button class="btn-ghost fchip ${knowledgeTopic === 'all' ? 'active' : ''}" data-t="all">全部 · ${state.knowledge.length}</button>
        ${state.topics.map((t) => `<button class="btn-ghost fchip ${knowledgeTopic === t.topic ? 'active' : ''}" data-t="${esc(t.topic)}">${esc(t.topic)} · ${t.count}</button>`).join('')}
      </div>
      <div class="toolbar">
        <input id="kq" placeholder="搜索认知 / 应用位置…" value="${esc(knowledgeQuery)}">
        <span class="sub" style="font-size:11px;color:var(--muted)">${list.length} / ${state.knowledge.length} 条 · 每条可溯源</span>
      </div>
      <div class="grid cols-2">
        ${list.map((k) => {
          const supporting = state.laws.filter((l) => l.kids.includes(k.id));
          return `
          <div class="glass kcard">
            <span class="topic">${esc(k.topic)}</span>
            <h3>${esc(k.id)} · ${esc(k.title)}</h3>
            <div class="meta">考察日期 ${esc(k.date)} · ${supporting.length ? `支撑规律 ${supporting.map((l) => l.id).join(' / ')}` : '（尚未被规律引用）'}</div>
            <p>${esc(k.insight)}</p>
            <div class="apply">${esc(k.appliedTo)}</div>
            ${supporting.length ? `<div class="chips" style="margin-top:10px">${supporting.map((l) => `<a class="chip lawchip" href="#/laws" data-goto-law="${l.id}">↗ ${l.id} ${esc(l.name)}</a>`).join('')}</div>` : ''}
            <div class="srcs">
              ${(k.sources || []).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">◆ ${esc(s.title)} ↗</a>`).join('')}
            </div>
          </div>`;
        }).join('') || '<div class="sub" style="padding:10px">无匹配条目</div>'}
      </div>
    </div>`;
  const input = document.getElementById('kq');
  input.addEventListener('input', () => { knowledgeQuery = input.value; renderKnowledge(); const i = document.getElementById('kq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); });
  app.querySelectorAll('.fchip[data-t]').forEach((b) => b.addEventListener('click', () => { knowledgeTopic = b.dataset.t; renderKnowledge(); }));
  app.querySelectorAll('[data-goto-law]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    sessionStorage.setItem('highlight-law', a.dataset.gotoLaw);
    location.hash = '#/laws';
  }));
}

// ---------------------------------------------------------------- 设计规律
function renderLaws() {
  const hl = sessionStorage.getItem('highlight-law');
  app.innerHTML = `
    <div class="glass" style="padding:16px 18px">
      <div class="section-title">设计规律 · 从世界知识提炼，约束平台建造</div>
      <table>
        <tr><th>编号</th><th>名称</th><th>规律</th><th>落地位置</th><th>依据</th></tr>
        ${state.laws.map((l) => `
          <tr class="${hl === l.id ? 'sel' : ''}">
            <td><b style="color:var(--gold)">${esc(l.id)}</b></td>
            <td>${esc(l.name)}</td>
            <td style="line-height:1.7">${esc(l.law)}</td>
            <td style="color:var(--muted);font-size:12px">${esc(l.where)}</td>
            <td>${l.kids.map((kid) => `<a href="#/trace?k=${kid}" data-goto-k="${kid}" style="color:var(--accent);margin-right:6px">${kid} ↗</a>`).join('')}</td>
          </tr>`).join('')}
      </table>
      <p class="note">提炼纪律：没有考察条目支撑的"规律"是观点，进不了这张表；规律修订必须走迭代并登记账本。点击依据可回放溯源链。</p>
    </div>`;
  app.querySelectorAll('[data-goto-k]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    location.hash = `#/trace?k=${a.dataset.gotoK}`;
  }));
  if (hl) { sessionStorage.removeItem('highlight-law'); const tr = app.querySelector('tr.sel'); tr && tr.scrollIntoView({ block: 'center' }); }
}

// ---------------------------------------------------------------- 溯源链（P10）
let traceK = null;
function renderTrace(params) {
  traceK = params?.k || traceK || state.knowledge[0]?.id;
  const k = state.knowledge.find((x) => x.id === traceK) || state.knowledge[0];
  const supporting = state.laws.filter((l) => l.kids.includes(k.id));
  app.innerHTML = `
    <div class="glass" style="padding:16px 18px">
      <div class="section-title">溯源链 · 认知 → 规律 → 落地（P10 可观测一等）</div>
      <div class="toolbar">
        <select id="trace-select" class="sel-k">
          ${state.knowledge.map((x) => `<option value="${esc(x.id)}" ${x.id === k.id ? 'selected' : ''}>${esc(x.id)} · ${esc(x.title)}</option>`).join('')}
        </select>
        <span class="sub" style="font-size:11px;color:var(--muted)">选一条考察认知，回放它如何变成平台的一部分</span>
      </div>
      <div class="trace">
        <div class="t-node glass kcard">
          <span class="topic">${esc(k.topic)}</span>
          <h3>${esc(k.id)} · ${esc(k.title)}</h3>
          <div class="meta">考察日期 ${esc(k.date)}</div>
          <p>${esc(k.insight)}</p>
          <div class="srcs">${(k.sources || []).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">◆ ${esc(s.title)} ↗</a>`).join('')}</div>
        </div>
        <div class="t-arrow">↓ 提炼</div>
        ${supporting.length ? supporting.map((l) => `
          <div class="t-node glass card">
            <h3><b style="color:var(--gold)">${esc(l.id)}</b> · ${esc(l.name)}</h3>
            <div class="sub" style="line-height:1.8;margin-top:6px">${esc(l.law)}</div>
            <div class="chips" style="margin-top:8px">${chip('', `落地：${esc(l.where)}`)}</div>
          </div>
          <div class="t-arrow">↓ 落地</div>`) : `<div class="t-node glass card"><div class="sub">该认知尚未被提炼为规律（合法：知识可以先于规律存在）。</div></div><div class="t-arrow">↓</div>`}
        <div class="t-node glass card">
          <h3>落地位置</h3>
          <div class="sub" style="font-size:13px;line-height:2">
            ${supporting.flatMap((l) => l.where.replace(/`/g, '').split(' · ')).map((w) => `<code>${esc(w)}</code>`).join(' ')}
          </div>
          <div class="chips" style="margin-top:8px">
            ${(k.appliedTo.match(/[\w./-]+\.(?:mjs|js|md|json|html|yml)/g) || []).map((f) => chip('delivered', f)).join('')}
          </div>
        </div>
      </div>
    </div>`;
  document.getElementById('trace-select').addEventListener('change', (e) => { traceK = e.target.value; renderTrace({ k: traceK }); });
}

// ---------------------------------------------------------------- 迭代账本
function renderIterations() {
  app.innerHTML = `
    <div class="glass" style="padding:16px 18px">
      <div class="section-title">迭代账本 · 只追加的平台记忆（P7）</div>
      <div class="timeline">
        ${[...state.iterations].reverse().map((it) => `
          <div class="tl-item">
            <div class="tl-dot"></div>
            <div class="tl-body glass kcard">
              <h3>迭代 ${it.n} · ${esc(it.title)} <span class="meta" style="font-weight:400">${esc(it.date)}</span></h3>
              <p style="margin-top:6px">${esc(it.goal)}</p>
              ${it.clue ? `<div class="note" style="margin-top:6px">遗留线索：${esc(it.clue)}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>
      <p class="note">完整条目见 <a href="https://github.com/alishangtian/the-new-world/blob/main/docs/ITERATIONS.md" target="_blank" rel="noopener" style="color:var(--accent)">docs/ITERATIONS.md ↗</a>。账本只追加：改写历史 = 记忆损坏。</p>
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
        <div class="sub">配置即接入。工具清单见右侧（从 platform/mcp/server.mjs 源码解析，能力即代码）。</div>
      </div>
      <div class="glass card">
        <h3>平台工具（${state.mcpTools.length}）</h3>
        <table>
          ${state.mcpTools.map((t) => `<tr><td style="white-space:nowrap"><b style="color:var(--accent)">${esc(t.name)}</b></td><td style="color:var(--muted);font-size:12px;line-height:1.6">${esc(t.description)}</td></tr>`).join('')}
        </table>
      </div>
      <div class="glass card">
        <h3>六步流水线（P5）</h3>
        <pre class="code">EXPLORE 考察（网络事实 / 搜索引擎 / GitHub 开源）
DISTILL 提炼（认知 → knowledge/ → 设计规律）
BUILD   构建（按规律升级平台）
VERIFY  验收（accept.mjs 五道门）
LEDGER  记账（只追加账本）
COMMIT  提交（迭代叙事）</pre>
      </div>
      <div class="glass card">
        <h3>协议与角色</h3>
        <div class="sub" style="font-size:13px;line-height:2">
          <a href="https://github.com/alishangtian/the-new-world/blob/main/platform/PROTOCOL.md" target="_blank" rel="noopener" style="color:var(--accent)">platform/PROTOCOL.md ↗</a> —— 平台宪法<br>
          platform/roles/ —— 考察员 / 建造师 / 质检员 / 史官<br>
          platform/scheduler.mjs —— 心跳派单（P9）<br>
          scripts/accept.mjs —— 无头验收门 G1-G5
        </div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------- 智能体（P12）
let agentLive = null; // null=未探测；true=HTTP MCP 可用；false=静态回退
let agentsList = null;
async function mcpCall(method, params) {
  const r = await fetch('./mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }) });
  if (!r.ok) throw new Error(`MCP HTTP 不可达 (${r.status})`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  const callResult = j.result;
  if (callResult?.isError) throw new Error(callResult.content?.[0]?.text || '工具执行失败');
  return callResult.content[0].text;
}
async function getAgents() {
  if (agentLive !== false) {
    try {
      agentsList = JSON.parse(await mcpCall('tools/call', { name: 'list_agents', arguments: {} }));
      agentLive = true;
      return agentsList;
    } catch { agentLive = false; }
  }
  return state.agents || [];
}

function renderAgents() {
  app.innerHTML = `
    <div class="grid cols-2">
      <div class="glass card">
        <h3>构建智能体 <span style="font-size:11px;color:var(--muted);font-weight:400">P12 身份即清单</span></h3>
        <div class="form" id="agent-form">
          <div class="frow"><label>名称 *</label><input id="af-name" placeholder="巡逻员 · Patrol"></div>
          <div class="frow"><label>ID *</label><input id="af-id" placeholder="patrol-01"></div>
          <div class="frow"><label>角色</label><select id="af-role">${state.roles.map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}<option value="custom">custom · 自定义</option></select></div>
          <div class="frow"><label>工具授予</label><div class="chips" id="af-tools">
            ${state.mcpTools.map((t) => `<label class="chip toolpick"><input type="checkbox" value="${esc(t.name)}"> ${esc(t.name)}</label>`).join('')}
          </div></div>
          <div class="frow"><label>说明</label><input id="af-note" placeholder="可选"></div>
          <div class="chips"><button class="btn-ghost" id="af-submit" style="border-color:rgba(110,231,255,.5);color:var(--accent)">⚙ 注册智能体</button></div>
          <div class="sub" id="af-result"></div>
        </div>
      </div>
      <div class="glass card">
        <h3>注册表 <span id="ag-mode" class="topic" style="margin:0"></span></h3>
        <div id="ag-list" class="sub" style="font-size:12px">加载中…</div>
      </div>
    </div>
    <div class="glass card" style="margin-top:14px">
      <h3>角色契约（platform/roles/）</h3>
      <div class="chips">${state.roles.map((r) => chip('', `${esc(r.name)} · ${r.id}.md`)).join('')}</div>
      <div class="sub">角色是契约而非编制（P6）：一个 agent 可身兼多角；构建 = 把契约实例化为机读清单（P12）。</div>
    </div>`;

  const listEl = document.getElementById('ag-list');
  const modeEl = document.getElementById('ag-mode');
  const renderList = (agents) => {
    modeEl.textContent = agentLive ? '实时 · 经 MCP HTTP' : '快照 · 静态托管（构建请用 MCP HTTP）';
    listEl.innerHTML = `<table>
      <tr><th>ID</th><th>名称</th><th>角色</th><th>工具</th><th>状态</th></tr>
      ${agents.map((a) => `<tr>
        <td><b style="color:var(--accent)">${esc(a.id)}</b></td>
        <td>${esc(a.name)}</td>
        <td>${esc(a.role)}</td>
        <td style="color:var(--muted);font-size:11px">${(a.tools || []).length} 项</td>
        <td>${statusChip(a.status)}</td>
      </tr>`).join('')}
    </table>`;
  };
  getAgents().then(renderList);

  document.getElementById('af-submit').addEventListener('click', async () => {
    const name = document.getElementById('af-name').value.trim();
    const id = document.getElementById('af-id').value.trim();
    const role = document.getElementById('af-role').value;
    const tools = [...document.querySelectorAll('#af-tools input:checked')].map((i) => i.value);
    const note = document.getElementById('af-note').value.trim();
    const result = document.getElementById('af-result');
    if (!agentLive) {
      const payload = { id, name, role, tools, permissions: { write: [], forbidden: ['scripts/accept.mjs', 'scripts/verify.mjs'] }, note };
      result.innerHTML = `<span style="color:var(--gold)">静态托管模式：把下面的 JSON 加入 platform/agents.json 并提交</span>
        <pre class="code" style="margin-top:8px">${esc(JSON.stringify(payload, null, 2))}</pre>`;
      return;
    }
    try {
      const out = await mcpCall('tools/call', { name: 'register_agent', arguments: { id, name, role, tools, note } });
      result.innerHTML = `<span style="color:var(--green)">✓ ${esc(out)}</span>`;
      agentsList = JSON.parse(await mcpCall('tools/call', { name: 'list_agents', arguments: {} }));
      renderList(agentsList);
    } catch (err) {
      result.innerHTML = `<span style="color:var(--red)">✗ ${esc(String(err.message).slice(0, 160))}</span>`;
    }
  });
}

// ---------------------------------------------------------------- 路由
const renderers = { overview: renderOverview, orders: renderOrders, knowledge: renderKnowledge, agents: renderAgents, laws: renderLaws, trace: renderTrace, iterations: renderIterations, join: renderJoin };
function route() {
  const raw = (location.hash || '#/overview').replace('#/', '');
  const [tab, query] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(query || ''));
  (renderers[tab] || renderOverview)(params);
  document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
}
document.getElementById('btn-refresh').addEventListener('click', async (e) => {
  e.target.textContent = '⟳ 刷新中…';
  state = await (await fetch('./console/state.json', { cache: 'no-store' })).json();
  e.target.textContent = '⟳ 刷新状态';
  route();
});
window.addEventListener('hashchange', route);
route();

// the-new-world · 控制台 —— agent 平台的生产力界面。
// 核心两页：对话（与智能体聊天，LLM 经 OpenAI 兼容端点）与任务（指挥智能体干活）。
// 其余页：智能体注册表 / 工单 / 迭代账本 / 总览 / 接入。数据：/api/*（实时）+ state.json（快照）。

const app = document.getElementById('app');
const foot = document.getElementById('foot-state');
let state = await (await fetch('./console/state.json', { cache: 'no-store' })).json();
let config = { llmConfigured: false, model: null };
try { config = await (await fetch('./api/config', { cache: 'no-store' })).json(); } catch { /* 静态托管 */ }
try { config.agents = (await (await fetch('./api/agents', { cache: 'no-store' })).json()).agents; } catch { config.agents = null; }

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const chip = (cls, text) => `<span class="chip ${cls}">${esc(text)}</span>`;
const STATUS_LABEL = { open: '待领', claimed: '施工中', delivered: '已交付', blocked: '受阻', pending: '待办', working: '进行中', done: '已完成', cancelled: '已取消', idle: '空闲' };
const statusChip = (s) => chip(s, STATUS_LABEL[s] || s);

foot.innerHTML = `平台状态：${state.counts.ordersOpen}/${state.counts.orders} 工单待领 · ${state.counts.knowledge ?? 0} 项平台资产 · ${state.counts.iterations} 轮迭代 · ${state.counts.mcpTools} 个 MCP 工具 · ${config.llmConfigured ? `模型已接入（${esc(config.model)}）` : '模型未接入'} &nbsp; <button class="btn-ghost" id="btn-refresh">⟳ 刷新</button>`;

// ---------------------------------------------------------------- 对话
let chatAgentId = null;
function renderChat() {
  const agents = config.agents || state.agents || [];
  if (!chatAgentId) chatAgentId = agents[0]?.id || null;
  const agent = agents.find((a) => a.id === chatAgentId);
  app.innerHTML = `
    ${config.llmConfigured ? '' : `<div class="glass card" style="margin-bottom:14px;border-color:rgba(255,209,102,.4)">
      <b style="color:var(--gold)">模型未接入</b><span class="sub">—— 对话需要一个 OpenAI 兼容端点（Ollama / vLLM / LM Studio / 云厂商）。
      本机 Ollama 示例：<code>LLM_BASE_URL=http://host.docker.internal:11434/v1  LLM_MODEL=<模型名></code>，
      k8s 部署用 <code>kubectl set env</code> 注入。配置后刷新即生效。</span></div>`}
    <div class="chat-layout">
      <div class="glass card chat-agents">
        <h3>智能体</h3>
        ${agents.map((a) => `
          <div class="agent-row ${a.id === chatAgentId ? 'sel' : ''}" data-agent="${esc(a.id)}">
            <b>${esc(a.name)}</b>
            <div class="sub">${esc(a.role)} · ${statusChip(a.status)}</div>
          </div>`).join('')}
      </div>
      <div class="glass card chat-main">
        <h3>${agent ? esc(agent.name) : '选择一个智能体'} <span class="sub">${agent ? `授予工具 ${esc((agent.tools || []).join(', ')) || '无'}` : ''}</span></h3>
        <div class="chat-msgs" id="chat-msgs"><div class="sub">加载会话…</div></div>
        <div class="chat-input">
          <input id="chat-in" placeholder="${config.llmConfigured ? '输入消息，回车发送…' : '模型未接入——仍可发送，将收到接入指引'}">
          <button class="btn-ghost" id="chat-send" style="border-color:rgba(110,231,255,.5);color:var(--accent)">发送</button>
        </div>
      </div>
    </div>`;

  app.querySelectorAll('.agent-row').forEach((el) => el.addEventListener('click', () => {
    chatAgentId = el.dataset.agent;
    renderChat();
  }));

  const msgs = document.getElementById('chat-msgs');
  const renderMsgs = (messages) => {
    msgs.innerHTML = (messages || []).length
      ? messages.map((m) => `<div class="msg ${m.role}"><div class="bubble">${esc(m.content)}</div></div>`).join('')
      : '<div class="sub" style="padding:20px;text-align:center">还没有对话——发第一条消息开始。</div>';
    msgs.scrollTop = msgs.scrollHeight;
  };
  fetch(`./api/chat?agentId=${encodeURIComponent(chatAgentId)}`, { cache: 'no-store' })
    .then((r) => r.json()).then((d) => renderMsgs(d.messages)).catch(() => renderMsgs([]));

  const send = async () => {
    const input = document.getElementById('chat-in');
    const text = input.value.trim();
    if (!text || !chatAgentId) return;
    input.value = '';
    renderMsgs([...(window.__lastMsgs || []), { role: 'user', content: text }]);
    try {
      const r = await fetch('./api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: chatAgentId, message: text }) });
      const d = await r.json();
      const session = await (await fetch(`./api/chat?agentId=${encodeURIComponent(chatAgentId)}`, { cache: 'no-store' })).json();
      window.__lastMsgs = session.messages;
      renderMsgs(session.messages);
    } catch (e) {
      renderMsgs([{ role: 'assistant', content: `⚠ ${e.message}` }]);
    }
  };
  window.__lastMsgs = [];
  fetch(`./api/chat?agentId=${encodeURIComponent(chatAgentId)}`, { cache: 'no-store' }).then((r) => r.json()).then((d) => { window.__lastMsgs = d.messages || []; renderMsgs(d.messages); }).catch(() => {});
  document.getElementById('chat-send').addEventListener('click', send);
  document.getElementById('chat-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
}

// ---------------------------------------------------------------- 任务
async function renderTasks() {
  let tasks = [];
  try { tasks = (await (await fetch('./api/tasks', { cache: 'no-store' })).json()).tasks; } catch { /* 静态托管 */ }
  const agents = config.agents || state.agents || [];
  const agentName = (id) => (agents.find((a) => a.id === id) || {}).name || id || '平台';
  const cols = ['pending', 'working', 'done'];
  const LABEL = { pending: '待办', working: '进行中', done: '已完成' };
  app.innerHTML = `
    <div class="glass card" style="margin-bottom:14px">
      <h3>下达任务 · 指挥智能体干活</h3>
      <div class="task-form">
        <input id="tk-title" placeholder="任务标题，如：巡检一轮验收门">
        <select id="tk-agent">${agents.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}<option value="">平台通用</option></select>
        <input id="tk-desc" placeholder="描述（可选）">
        <button class="btn-ghost" id="tk-add" style="border-color:rgba(110,231,255,.5);color:var(--accent)">＋ 下达</button>
      </div>
    </div>
    <div class="grid cols-3">
      ${cols.map((s) => `
        <div class="glass card">
          <h3>${LABEL[s]} <span style="color:var(--muted);font-size:12px">× ${tasks.filter((t) => t.status === s).length}</span></h3>
          ${tasks.filter((t) => t.status === s).map((t) => `
            <div class="task-card">
              <b>${esc(t.id)}</b> · ${esc(t.title)}
              <div class="sub">指派：${esc(agentName(t.agentId))}${t.desc ? ' · ' + esc(t.desc) : ''}</div>
              <div class="chips">
                ${s !== 'pending' ? `<button class="btn-ghost tmove" data-id="${t.id}" data-s="pending">← 待办</button>` : ''}
                ${s !== 'working' ? `<button class="btn-ghost tmove" data-id="${t.id}" data-s="working">→ 进行中</button>` : ''}
                ${s !== 'done' ? `<button class="btn-ghost tmove" data-id="${t.id}" data-s="done">✓ 完成</button>` : ''}
              </div>
            </div>`).join('') || '<div class="sub">空</div>'}
        </div>`).join('')}
    </div>`;
  document.getElementById('tk-add').addEventListener('click', async () => {
    const title = document.getElementById('tk-title').value.trim();
    if (!title) return;
    await fetch('./api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, agentId: document.getElementById('tk-agent').value || null, desc: document.getElementById('tk-desc').value.trim() }) });
    renderTasks();
  });
  app.querySelectorAll('.tmove').forEach((b) => b.addEventListener('click', async () => {
    await fetch(`./api/tasks/${b.dataset.id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: b.dataset.s }) });
    renderTasks();
  }));
}

// ---------------------------------------------------------------- 总览 / 工单 / 智能体 / 迭代 / 接入
function renderOverview() {
  const next = state.orders.find((o) => o.status === 'open');
  const last = state.iterations.at(-1);
  app.innerHTML = `
    <div class="grid cols-3">
      <div class="glass card"><h3>智能体</h3><div class="big">${(config.agents || state.agents || []).length}</div><div class="sub">个注册智能体，可对话、可领任务。</div></div>
      <div class="glass card"><h3>任务看板</h3><div class="big" id="ov-tasks">…</div><div class="sub" id="ov-tasks-sub">任务通过 MCP 工具对 agent 可见（list_tasks / create_task）。</div></div>
      <div class="glass card"><h3>工单池</h3><div class="big">${state.counts.ordersOpen}<span style="font-size:14px;color:var(--muted)"> / ${state.counts.orders}</span></div><div class="sub">coding agent 的迭代工单（AGENTS.md 规定的迭代原则）。</div></div>
    </div>
    <div class="grid cols-2" style="margin-top:14px">
      <div class="glass card"><h3>最近迭代</h3><p style="font-size:14px;margin:6px 0"><b>迭代 ${last.n}</b> · ${esc(last.title)}</p><div class="sub">${esc(last.goal)}</div></div>
      <div class="glass card"><h3>对话能力</h3><div class="sub" style="font-size:13px;line-height:2">${config.llmConfigured
        ? `✓ 已接入模型：<b>${esc(config.model)}</b>（OpenAI 兼容端点）。在「对话」页与智能体真实聊天。`
        : '⚠ 未接入模型——在「对话」页发消息会收到接入指引。支持任何 OpenAI 兼容端点（Ollama / vLLM / LM Studio / 云厂商）。'}</div></div>
    </div>`;
  fetch('./api/tasks', { cache: 'no-store' }).then((r) => r.json()).then((d) => {
    const el = document.getElementById('ov-tasks');
    if (el) el.textContent = d.tasks.length;
    const sub = document.getElementById('ov-tasks-sub');
    if (sub) sub.textContent = `待办 ${d.tasks.filter((t) => t.status === 'pending').length} · 进行中 ${d.tasks.filter((t) => t.status === 'working').length} · 已完成 ${d.tasks.filter((t) => t.status === 'done').length}`;
  }).catch(() => { const el = document.getElementById('ov-tasks'); if (el) el.textContent = '需平台运行时'; });
}

let orderFilter = 'all';
let orderDetailId = null;
function renderOrders() {
  const list = state.orders.filter((o) => orderFilter === 'all' || o.status === orderFilter);
  const d = state.orders.find((o) => o.id === orderDetailId);
  app.innerHTML = `
    <div class="glass" style="padding:16px 18px">
      <div class="section-title">工单池 · 给 coding agent 的迭代发包（迭代原则见仓库 AGENTS.md）</div>
      <div class="toolbar">
        ${['all', 'open', 'claimed', 'blocked', 'delivered'].map((s) =>
          `<button class="btn-ghost fchip ${orderFilter === s ? 'active' : ''}" data-f="${s}">${s === 'all' ? '全部' : STATUS_LABEL[s]} · ${s === 'all' ? state.orders.length : state.orders.filter((o) => o.status === s).length}</button>`).join('')}
      </div>
      <table>
        <tr><th>工单</th><th>标题</th><th>优先级</th><th>状态</th></tr>
        ${list.map((o) => `<tr class="click ${o.id === orderDetailId ? 'sel' : ''}" data-id="${esc(o.id)}">
          <td><b>${esc(o.id)}</b>${o.auto === true ? ' <span class="topic" style="margin:0">auto</span>' : ''}</td>
          <td>${esc(o.title)}</td><td>${o.priority}</td><td>${statusChip(o.status)}</td></tr>`).join('')}
      </table>
      ${d ? `<div class="glass detail"><button class="close" id="close-order">✕</button>
        <h3>${esc(d.id)} · ${esc(d.title)} ${statusChip(d.status)}</h3>
        <div class="row"><b>目标</b>${esc(d.goal)}</div>
        <div class="row"><b>考察线索</b></div><ul>${(d.leads || []).map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.source)} ↗</a></li>`).join('')}</ul>
        <div class="row"><b>验收标准</b></div><ul>${(d.acceptance || []).map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
        ${d.notes ? `<div class="row"><b>notes</b>${esc(d.notes)}</div>` : ''}
      </div>` : ''}
    </div>`;
  app.querySelectorAll('tr.click').forEach((tr) => tr.addEventListener('click', () => { orderDetailId = tr.dataset.id; renderOrders(); }));
  app.querySelectorAll('.fchip').forEach((b) => b.addEventListener('click', () => { orderFilter = b.dataset.f; renderOrders(); }));
  const c = document.getElementById('close-order'); if (c) c.addEventListener('click', () => { orderDetailId = null; renderOrders(); });
}

function renderAgents() {
  const agents = config.agents || state.agents || [];
  app.innerHTML = `
    <div class="grid cols-2">
      <div class="glass card">
        <h3>构建智能体 <span style="font-size:11px;color:var(--muted);font-weight:400">P12 身份即清单</span></h3>
        <div class="form">
          <div class="frow"><label>名称 *</label><input id="af-name" placeholder="巡逻员 · Patrol"></div>
          <div class="frow"><label>ID *</label><input id="af-id" placeholder="patrol-01"></div>
          <div class="frow"><label>角色</label><select id="af-role">${state.roles.map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}<option value="custom">custom · 自定义</option></select></div>
          <div class="frow"><label>工具授予</label><div class="chips" id="af-tools">${state.mcpTools.map((t) => `<label class="chip toolpick"><input type="checkbox" value="${esc(t.name)}"> ${esc(t.name)}</label>`).join('')}</div></div>
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
      <div class="sub">角色是契约而非编制（P6）。构建 = 把契约实例化为机读清单；对话与任务在「对话」「任务」页进行。</div>
    </div>`;
  const listEl = document.getElementById('ag-list');
  const modeEl = document.getElementById('ag-mode');
  const mcpAvailable = config.mcpHttp !== false; // 经 http.mjs 服务时可用
  const renderList = (agents) => {
    modeEl.textContent = mcpAvailable ? '实时 · 经 MCP HTTP' : '快照 · 静态托管';
    listEl.innerHTML = `<table><tr><th>ID</th><th>名称</th><th>角色</th><th>工具</th><th>状态</th></tr>
      ${agents.map((a) => `<tr><td><b style="color:var(--accent)">${esc(a.id)}</b></td><td>${esc(a.name)}</td><td>${esc(a.role)}</td>
        <td style="color:var(--muted);font-size:11px">${(a.tools || []).length} 项</td><td>${statusChip(a.status || 'idle')}</td></tr>`).join('')}</table>`;
  };
  renderList(agents);
  const mcpCall = async (name, args) => {
    const r = await fetch('./mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }) });
    const j = await r.json();
    if (j.result?.isError) throw new Error(j.result.content[0].text);
    return j.result.content[0].text;
  };
  document.getElementById('af-submit').addEventListener('click', async () => {
    const name = document.getElementById('af-name').value.trim();
    const id = document.getElementById('af-id').value.trim();
    const role = document.getElementById('af-role').value;
    const tools = [...document.querySelectorAll('#af-tools input:checked')].map((i) => i.value);
    const note = document.getElementById('af-note').value.trim();
    const result = document.getElementById('af-result');
    try {
      const out = await mcpCall('register_agent', { id, name, role, tools, note });
      result.innerHTML = `<span style="color:var(--green)">✓ ${esc(out)}</span>`;
      const fresh = JSON.parse(await mcpCall('list_agents', {}));
      renderList(fresh);
    } catch (err) {
      const payload = { id, name, role, tools, permissions: { write: [], forbidden: ['scripts/accept.mjs', 'scripts/verify.mjs'] }, note };
      result.innerHTML = `<span style="color:var(--gold)">静态托管模式：把 JSON 加入 platform/agents.json 并提交</span>
        <pre class="code" style="margin-top:8px">${esc(JSON.stringify(payload, null, 2))}</pre>`;
    }
  });
}

function renderIterations() {
  app.innerHTML = `
    <div class="glass" style="padding:16px 18px">
      <div class="section-title">迭代账本 · 只追加的平台记忆（P7）</div>
      <div class="timeline">
        ${[...state.iterations].reverse().map((it) => `
          <div class="tl-item"><div class="tl-dot"></div>
            <div class="tl-body glass kcard">
              <h3>迭代 ${it.n} · ${esc(it.title)} <span class="meta" style="font-weight:400">${esc(it.date)}</span></h3>
              <p style="margin-top:6px">${esc(it.goal)}</p>
              ${it.clue ? `<div class="note" style="margin-top:6px">遗留线索：${esc(it.clue)}</div>` : ''}
            </div></div>`).join('')}
      </div>
      <p class="note">完整条目见 docs/ITERATIONS.md。账本只追加：改写历史 = 记忆损坏。</p>
    </div>`;
}

function renderJoin() {
  app.innerHTML = `
    <div class="grid cols-2">
      <div class="glass card">
        <h3>MCP 接入 · 让任何 agent 使用平台</h3>
        <pre class="code">stdio（本地 agent）：
{ "mcpServers": { "the-new-world": {
    "command": "node",
    "args": ["&lt;仓库&gt;/platform/mcp/server.mjs"] } } }

HTTP（网络 agent / k8s）：
POST http://&lt;服务地址&gt;/mcp</pre>
      </div>
      <div class="glass card">
        <h3>平台工具（${state.mcpTools.length}）</h3>
        <table>${state.mcpTools.map((t) => `<tr><td style="white-space:nowrap"><b style="color:var(--accent)">${esc(t.name)}</b></td><td style="color:var(--muted);font-size:12px">${esc(t.description)}</td></tr>`).join('')}</table>
      </div>
      <div class="glass card">
        <h3>迭代原则（给后续 coding agent）</h3>
        <div class="sub" style="font-size:13px;line-height:2">
          入口：<b>仓库根 AGENTS.md</b>（读它再动代码）。<br>
          流程：领工单 → 施工 → accept.mjs 五门 → 记账 → 提交。<br>
          详细协议：platform/PROTOCOL.md。
        </div>
      </div>
      <div class="glass card">
        <h3>红线</h3>
        <div class="sub" style="font-size:13px;line-height:2">零依赖 · 厂商中立 · 溯源强制 · 账本只追加 · 检查器不可自改 · 宁缺毋滥</div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------- 路由
const renderers = { overview: renderOverview, chat: renderChat, tasks: renderTasks, orders: renderOrders, agents: renderAgents, iterations: renderIterations, join: renderJoin };
function route() {
  const raw = (location.hash || '#/chat').replace('#/', '');
  const [tab, query] = raw.split('?');
  (renderers[tab] || renderChat)(Object.fromEntries(new URLSearchParams(query || '')));
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

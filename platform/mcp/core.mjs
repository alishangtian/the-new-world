// MCP 核心 —— 平台工具与 JSON-RPC 消息处理，与传输方式无关（P11）。
// 两个薄壳共用本核心：server.mjs（stdio，服务本地 agent）与 http.mjs（HTTP，服务网络 agent / k8s）。

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ORDERS = join(ROOT, 'platform', 'orders');
const LEDGER = join(ROOT, 'docs', 'ITERATIONS.md');

// ---------------------------------------------------------------- 平台读数
export const listOrders = () => readdirSync(ORDERS).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(ORDERS, f), 'utf8')))
  .sort((a, b) => (b.priority || 0) - (a.priority || 0));

const findOrder = (id) => listOrders().find((o) => o.id === id);

const platformState = () => {
  const knowledgeDir = join(ROOT, 'knowledge');
  const knowledge = existsSync(knowledgeDir)
    ? readdirSync(knowledgeDir).filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(join(knowledgeDir, f), 'utf8')))
        .sort((a, b) => a.id.localeCompare(b.id))
    : [];

  const laws = (readFileSync(join(ROOT, 'LAWS.md'), 'utf8').match(/^\| (P\d+) \|/gm) || []).length;
  const iter = readFileSync(LEDGER, 'utf8');
  const nums = [...iter.matchAll(/^## 迭代 (\d+) · (.+)$/gm)].map((m) => ({ n: Number(m[1]), title: m[2] }));

  const orders = listOrders();
  const by = (s) => orders.filter((o) => o.status === s).length;
  return {
    platform: { knowledge: knowledge.length, laws, iterations: nums.length, lastIteration: nums.at(-1) },
    orders: { open: by('open'), claimed: by('claimed'), blocked: by('blocked'), delivered: by('delivered') },
    knowledgeTopics: [...new Set(knowledge.map((k) => k.topic))],
    nextByPriority: orders.find((o) => o.status === 'open') || null,
  };
};

const listKnowledge = ({ topic } = {}) => {
  const dir = join(ROOT, 'knowledge');
  if (!existsSync(dir)) return [];
  let list = readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
  if (topic) list = list.filter((k) => (k.topic || '').includes(topic) || (k.id || '') === topic);
  return list
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((k) => ({ id: k.id, date: k.date, topic: k.topic, title: k.title, insight: k.insight, appliedTo: k.appliedTo, sources: k.sources }));
};

const runGates = () => {
  const r = spawnSync('node', ['scripts/accept.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 240000 });
  const out = `${r.stdout || ''}`;
  return {
    pass: r.status === 0,
    verdict: out.includes('ACCEPTANCE: PASS') ? 'PASS' : 'FAIL',
    report: out.trim().split('\n').slice(-40).join('\n'),
  };
};

const writeLedger = ({ iteration_id, entry_markdown }) => {
  if (!iteration_id || !entry_markdown) throw new Error('需要 iteration_id 与 entry_markdown');
  const head = entry_markdown.trim().split('\n')[0];
  if (!head.startsWith(`## 迭代 ${iteration_id} `)) {
    throw new Error(`条目首行必须以 "## 迭代 ${iteration_id} " 开头，实得："${head.slice(0, 40)}"`);
  }
  const text = readFileSync(LEDGER, 'utf8');
  if (new RegExp(`^## 迭代 ${iteration_id} `, 'm').test(text)) throw new Error(`迭代 ${iteration_id} 已登记，账本只追加不覆写`);
  writeFileSync(LEDGER, `${text.replace(/\s*$/, '\n')}\n---\n\n${entry_markdown.trim()}\n`);
  return { appended: `## 迭代 ${iteration_id}`, lines: entry_markdown.trim().split('\n').length };
};

const closeOrder = ({ id, delivered_in }) => {
  const order = findOrder(id);
  if (!order) throw new Error(`工单不存在: ${id}`);
  if (order.status === 'delivered') throw new Error(`${order.id} 已是 delivered`);
  const f = readdirSync(ORDERS).find((x) => JSON.parse(readFileSync(join(ORDERS, x), 'utf8')).id === order.id);
  order.status = 'delivered';
  order.deliveredIn = String(delivered_in || '').trim() || null;
  order.acceptedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(join(ORDERS, f), JSON.stringify(order, null, 2) + '\n');
  return { closed: order.id, deliveredIn: order.deliveredIn };
};

const dispatchNext = ({ dry } = {}) => {
  const args = ['platform/scheduler.mjs', '--json'];
  if (dry) args.push('--dry');
  const r = spawnSync('node', args, { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0 && !r.stdout) throw new Error(`调度器失败: ${(r.stderr || '').slice(0, 200)}`);
  try { return JSON.parse(r.stdout); } catch { return { raw: (r.stdout || r.stderr || '').trim() }; }
};

// ---------------------------------------------------------------- 智能体注册表（P12 身份即清单）
const AGENTS = join(ROOT, 'platform', 'agents.json');
const KNOWN_ROLES = new Set(['explorer', 'builder', 'auditor', 'chronicler', 'custom']);

const loadRegistry = () => JSON.parse(readFileSync(AGENTS, 'utf8'));
const listAgents = () => loadRegistry().agents
  .map((a) => ({ id: a.id, name: a.name, role: a.role, tools: a.tools, status: a.status, lastContribution: a.lastContribution }));

const registerAgent = ({ id, name, role, tools, note } = {}) => {
  const toolNames = new Set(TOOLS.map((t) => t.name)); // 惰性求值：TOOLS 在本模块后段定义
  if (!/^[a-z][a-z0-9-]{2,30}$/.test(id || '')) throw new Error(`id 非法（小写字母开头，3-31 位 [a-z0-9-]）: ${id}`);
  if (!name || String(name).length > 40) throw new Error('需要 name（≤40 字符）');
  if (!KNOWN_ROLES.has(role)) throw new Error(`未知角色 ${role}（可选：${[...KNOWN_ROLES].join('/')}）`);
  const bad = (tools || []).filter((t) => !toolNames.has(t));
  if (bad.length) throw new Error(`未知工具: ${bad.join(',')}`);
  const reg = loadRegistry();
  if (reg.agents.some((a) => a.id === id)) throw new Error(`id 已存在: ${id}`);
  const contract = role !== 'custom' ? `platform/roles/${role}.md` : null;
  reg.agents.push({
    id, name, role,
    contract: contract || null,
    runtime: 'external',
    transport: ['stdio', 'http'],
    tools: tools || [],
    permissions: { write: [], forbidden: ['scripts/accept.mjs', 'scripts/verify.mjs'] },
    status: 'idle',
    lastContribution: { iteration: null, note: note || '注册于运行时' },
  });
  reg.updatedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(AGENTS, JSON.stringify(reg, null, 2) + '\n');
  return { registered: id, tools: tools || [], note: '容器内注册为运行时态；固化请走工单+提交' };
};

// ---------------------------------------------------------------- 工具清单
export const TOOLS = [
  { name: 'list_orders', description: '列出平台工单（按优先级降序）。SELECT 步骤的起点：领一张 open 工单施工。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'read_order', description: '读一张工单全文（目标/考察线索/验收标准/notes）。',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string', description: '工单号，如 ORD-012' } }, additionalProperties: false } },
  { name: 'platform_state', description: '平台现状：知识条目数/设计规律数/迭代履历/工单分布/下一张待领工单。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'list_knowledge', description: '列出知识库——考察世界（网络/搜索引擎/GitHub）带回的 agent 平台认知，每条含来源与落地位置。可按 topic 过滤。',
    inputSchema: { type: 'object', properties: { topic: { type: 'string', description: '按主题过滤，如 协议互操作' } }, additionalProperties: false } },
  { name: 'run_gates', description: '跑无头验收门（语法/平台体检/自检/知识纪律/账本纪律），返回 PASS/FAIL 与报告。质检员步骤的唯一裁判。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'write_ledger', description: '向 docs/ITERATIONS.md 追加一轮迭代账目（账本只追加；迭代号必须唯一且与条目首行一致）。',
    inputSchema: { type: 'object', required: ['iteration_id', 'entry_markdown'],
      properties: { iteration_id: { type: 'string', description: '如 005' },
                    entry_markdown: { type: 'string', description: '完整条目，首行格式 "## 迭代 NNN · 标题（日期）"' } },
      additionalProperties: false } },
  { name: 'close_order', description: '把工单置为 delivered（须先过 run_gates 的 PASS）。',
    inputSchema: { type: 'object', required: ['id', 'delivered_in'],
      properties: { id: { type: 'string' }, delivered_in: { type: 'string', description: '所在迭代号，如 005' } },
      additionalProperties: false } },
  { name: 'dispatch_next', description: '调用平台调度器：回收超时认领、派发下一张 auto-ok 工单并生成施工包。dry=true 只观测不落盘。',
    inputSchema: { type: 'object', properties: { dry: { type: 'boolean', description: '观测模式（默认 false）' } }, additionalProperties: false } },
  { name: 'list_agents', description: '列出注册的智能体（角色/工具/状态/最近贡献）——P12 身份即清单。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'register_agent', description: '注册一个智能体到 platform/agents.json（校验 id/角色/工具白名单）。',
    inputSchema: { type: 'object', required: ['id', 'name', 'role'],
      properties: { id: { type: 'string', description: '小写 [a-z0-9-]，如 patrol-01' },
                    name: { type: 'string', description: '展示名，如 巡逻员 · Patrol' },
                    role: { type: 'string', enum: ['explorer', 'builder', 'auditor', 'chronicler', 'custom'] },
                    tools: { type: 'array', items: { type: 'string' }, description: '授予的平台工具名（必须是已存在的 MCP 工具）' },
                    note: { type: 'string' } },
      additionalProperties: false } },
];

const handlers = {
  list_orders: () => listOrders().map((o) => ({ id: o.id, title: o.title, status: o.status, priority: o.priority, goal: o.goal, scores: o.scores })),
  read_order: ({ id }) => { const o = findOrder(id); if (!o) throw new Error(`工单不存在: ${id}`); return o; },
  platform_state: platformState,
  list_knowledge: listKnowledge,
  run_gates: runGates,
  write_ledger: writeLedger,
  close_order: closeOrder,
  dispatch_next: dispatchNext,
  list_agents: listAgents,
  register_agent: registerAgent,
};

/**
 * 处理一条 JSON-RPC 消息（与传输无关）。
 * @returns {object|null} 响应对象；通知类消息返回 null（不回应）
 */
export async function handleRpcMessage(msg) {
  const { id, method, params } = msg;
  const fail = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
  if (method === 'initialize') {
    return { jsonrpc: '2.0', id, result: {
      protocolVersion: params?.protocolVersion || '2024-11-05',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'the-new-world', version: '0.7.0', title: 'agent 平台（考察世界 · 持续构建）' },
    } };
  }
  if (method === 'ping') return { jsonrpc: '2.0', id, result: {} };
  if (method === 'tools/list') return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  if (method === 'tools/call') {
    const name = params?.name;
    const fn = handlers[name];
    if (!fn) return fail(-32602, `未知工具: ${name}`);
    try {
      const out = await fn(params?.arguments || {});
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: typeof out === 'string' ? out : JSON.stringify(out, null, 2) }] } };
    } catch (e) {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `ERROR: ${e.message}` }], isError: true } };
    }
  }
  if (id !== undefined) return fail(-32601, `未知方法: ${method}`);
  return null;
}

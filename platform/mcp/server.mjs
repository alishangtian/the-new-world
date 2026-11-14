#!/usr/bin/env node
// the-new-world · 平台 MCP 服务器（零依赖，stdio 传输）
// 把世界建造平台的能力暴露为 MCP 工具，任何 agent 平台都能接入施工。
//
// 接入：{ "mcpServers": { "the-new-world": {
//            "command": "node", "args": ["<仓库>/platform/mcp/server.mjs"] } } }
//
// 工具：list_orders / read_order / world_state / run_gates / write_ledger / close_order
// 纪律：本服务器只动 orders/ 与 docs/ITERATIONS.md；世界本体（src/data）由 agent
//       按协议手工施工，验收交给 scripts/accept.mjs（run_gates 只调用，不绕过）。

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ORDERS = join(ROOT, 'platform', 'orders');
const LEDGER = join(ROOT, 'docs', 'ITERATIONS.md');
const log = (...a) => process.stderr.write(['[the-new-world-mcp]', ...a, '\n'].join(' '));

// ---------------------------------------------------------------- 平台读数
const listOrders = () => readdirSync(ORDERS)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(ORDERS, f), 'utf8')))
  .sort((a, b) => (b.priority || 0) - (a.priority || 0));

const findOrder = (id) => listOrders().find((o) => o.id === id || f2id(o) === id || o.id === id.replace(/\.json$/, ''));
const f2id = (o) => o.id;
const today = () => new Date().toISOString().slice(0, 10);

const worldState = () => {
  const modDir = join(ROOT, 'src', 'modules');
  const bricks = readdirSync(modDir).filter((f) => f.endsWith('.js')).map((f) => {
    const t = readFileSync(join(modDir, f), 'utf8');
    const grab = (re) => (t.match(re) || [])[1];
    const srcs = (t.match(/url:\s*'([^']+)'/g) || []).map((s) => s.slice(6, -1));
    return {
      id: grab(/id:\s*'([^']+)'/),
      name: grab(/name:\s*'([^']+)'/),
      order: Number(grab(/order:\s*(\d+)/) || 0),
      laws: (t.match(/'L\d+[^']*'/g) || []).length,
      sources: srcs.length,
    };
  }).sort((a, b) => a.order - b.order);

  const laws = (readFileSync(join(ROOT, 'LAWS.md'), 'utf8').match(/^\| L\d+ \|/gm) || []).length;
  const iter = readFileSync(LEDGER, 'utf8');
  const nums = [...iter.matchAll(/^## 迭代 (\d+) · (.+)$/gm)].map((m) => ({ n: Number(m[1]), title: m[2] }));
  const data = readdirSync(join(ROOT, 'data')).filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: f, kb: Math.round(statSync(join(ROOT, 'data', f)).size / 1024) }));

  const orders = listOrders();
  const by = (s) => orders.filter((o) => o.status === s).length;
  return {
    world: { bricks: bricks.length, laws, iterations: nums.length, lastIteration: nums.at(-1) },
    dataFiles: data,
    orders: { open: by('open'), claimed: by('claimed'), blocked: by('blocked'), delivered: by('delivered') },
    nextByPriority: orders.find((o) => o.status === 'open') || null,
  };
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
  const path = join(ORDERS, f);
  order.status = 'delivered';
  order.deliveredIn = String(delivered_in || '').trim() || null;
  order.acceptedAt = today();
  writeFileSync(path, JSON.stringify(order, null, 2) + '\n');
  return { closed: order.id, deliveredIn: order.deliveredIn };
};

// ---------------------------------------------------------------- 工具定义
const TOOLS = [
  { name: 'list_orders', description: '列出世界建造工单（按优先级降序）。SELECT 步骤的起点。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'read_order', description: '读一张工单全文（目标/来源线索/验收标准/notes）。',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string', description: '工单号，如 ORD-003' } }, additionalProperties: false } },
  { name: 'world_state', description: '世界现状：砖块/规律/数据/迭代履历/工单分布/下一张待领工单。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'run_gates', description: '跑无头验收门（语法/体检/平台自检/数据纪律/账本纪律），返回 PASS/FAIL 与报告。质检员步骤的唯一裁判。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'write_ledger', description: '向 docs/ITERATIONS.md 追加一轮迭代账目（账本只追加；迭代号必须唯一且与条目首行一致）。',
    inputSchema: { type: 'object', required: ['iteration_id', 'entry_markdown'],
      properties: { iteration_id: { type: 'string', description: '如 004' },
                    entry_markdown: { type: 'string', description: '完整条目，首行格式 "## 迭代 NNN · 标题（日期）"' } },
      additionalProperties: false } },
  { name: 'close_order', description: '把工单置为 delivered（须先过 run_gates 的 PASS）。',
    inputSchema: { type: 'object', required: ['id', 'delivered_in'],
      properties: { id: { type: 'string' }, delivered_in: { type: 'string', description: '所在迭代号，如 004' } },
      additionalProperties: false } },
];

const handlers = {
  list_orders: () => listOrders().map((o) => ({ id: o.id, title: o.title, status: o.status, priority: o.priority, goal: o.goal, scores: o.scores })),
  read_order: ({ id }) => { const o = findOrder(id); if (!o) throw new Error(`工单不存在: ${id}`); return o; },
  world_state: worldState,
  run_gates: runGates,
  write_ledger: writeLedger,
  close_order: closeOrder,
};

// ---------------------------------------------------------------- JSON-RPC (stdio)
const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

const dispatch = async (msg) => {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    return reply(id, {
      protocolVersion: params?.protocolVersion || '2024-11-05',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'the-new-world', version: '0.3.0', title: '世界建造平台' },
    });
  }
  if (method === 'ping') return reply(id, {});
  if (method === 'tools/list') return reply(id, { tools: TOOLS });
  if (method === 'tools/call') {
    const name = params?.name;
    const fn = handlers[name];
    if (!fn) return fail(id, -32602, `未知工具: ${name}`);
    try {
      const out = await fn(params?.arguments || {});
      return reply(id, { content: [{ type: 'text', text: typeof out === 'string' ? out : JSON.stringify(out, null, 2) }] });
    } catch (e) {
      return reply(id, { content: [{ type: 'text', text: `ERROR: ${e.message}` }], isError: true });
    }
  }
  if (id !== undefined) fail(id, -32601, `未知方法: ${method}`);
};

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  const s = line.trim();
  if (!s) return;
  let msg;
  try { msg = JSON.parse(s); } catch { return fail(null, -32700, 'JSON 解析失败'); }
  Promise.resolve(dispatch(msg)).catch((e) => {
    log('handler error:', e.message);
    if (msg.id !== undefined) fail(msg.id, -32603, String(e.message || e));
  });
});
rl.on('close', () => process.exit(0));

if (!existsSync(LEDGER)) {
  log('警告：未找到 docs/ITERATIONS.md——请在仓库根目录运行本服务器');
}
log(`the-new-world 平台已就绪（仓库: ${ROOT}）`);

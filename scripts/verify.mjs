#!/usr/bin/env node
// 平台体检 —— 工单/智能体/调度/控制台一致性校验。被 accept.mjs 的 G2 门与 CI 调用。

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const fail = (msg) => { failures++; console.error('  ✗ ' + msg); };
const ok = (msg) => console.log('  ✓ ' + msg);
const loadJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// ---------------------------------------------------------------- 工单状态机
console.log('[1/4] 工单状态机');
const STATUS = new Set(['open', 'claimed', 'delivered', 'blocked']);
const orderFiles = readdirSync(join(ROOT, 'platform/orders')).filter((f) => f.endsWith('.json'));
const orders = orderFiles.map((f) => {
  try {
    const o = loadJson(join('platform/orders', f));
    if (!STATUS.has(o.status)) throw new Error(`非法状态 ${o.status}`);
    if (o.status === 'claimed' && (!o.claimedBy || !o.claimedAt)) throw new Error('claimed 缺 claimedBy/claimedAt');
    if (o.status === 'blocked' && !o.blocker && !/blocker/i.test(o.notes || '')) throw new Error('blocked 缺 blocker 说明');
    if (o.status === 'delivered' && !o.deliveredIn) throw new Error('delivered 缺 deliveredIn');
    if (!Array.isArray(o.acceptance) || !o.acceptance.length) throw new Error('缺验收标准');
    if (!Array.isArray(o.leads) || !o.leads.length) throw new Error('缺考察线索');
    for (const l of o.leads) if (!/^https?:\/\//.test(l.url || '')) throw new Error(`线索 URL 非法: ${l.url}`);
    return o;
  } catch (e) {
    fail(`${f}: ${e.message.split('\n')[0]}`);
    return null;
  }
}).filter(Boolean);
if (orders.length === orderFiles.length) ok(`${orders.length} 张工单状态机合法，线索均可溯源`);
const openCount = orders.filter((o) => o.status === 'open').length;
if (openCount) ok(`open 工单 ${openCount} 张（SELECT 的池子）`);
else console.log('  · 提示：池中已无 open 工单（合法状态）');

// ---------------------------------------------------------------- 智能体注册表
console.log('[2/4] 智能体注册表（P12 身份即清单）');
try {
  const reg = loadJson('platform/agents.json');
  const { TOOLS } = await import(join(ROOT, 'platform/mcp/core.mjs'));
  const toolNames = new Set(TOOLS.map((t) => t.name));
  const ids = reg.agents.map((a) => a.id);
  if (new Set(ids).size !== ids.length) fail('智能体 id 重复');
  let roleOk = 0;
  for (const a of reg.agents) {
    if (!/^[a-z][a-z0-9-]{2,30}$/.test(a.id)) fail(`智能体 id 非法: ${a.id}`);
    if (a.role !== 'custom') {
      const cf = a.contract ? join(ROOT, a.contract) : null;
      if (!cf || !existsSync(cf)) { fail(`${a.id}: 契约文件不存在`); continue; }
      roleOk++;
    }
    const bad = (a.tools || []).filter((t) => !toolNames.has(t));
    if (bad.length) fail(`${a.id}: 授予了不存在的工具 ${bad.join(',')}`);
    if (!a.permissions?.forbidden?.length) fail(`${a.id}: 缺 forbidden 权限边界（P12）`);
  }
  if (roleOk >= 4) ok(`注册表 ${reg.agents.length} 个智能体（${roleOk} 个带契约文件），工具白名单全部合法`);
} catch (e) {
  fail('注册表: ' + e.message.split('\n')[0]);
}

// ---------------------------------------------------------------- A2A 互操作
console.log('[3.2/4] A2A 互操作（ORD-015）');
try {
  const a2a = await import(join(ROOT, 'platform/a2a.mjs'));
  // 1. 状态映射完整性：每个工单状态都必须有 A2A state
  const STATES = ['open', 'claimed', 'delivered', 'blocked'];
  const fixtures = STATES.map((s) => ({ id: 'ORD-000', status: s, title: 'x', goal: 'x', priority: 1, acceptance: [], leads: [] }));
  const states = fixtures.map((f) => a2a.orderToTask(f).status.state);
  const legal = new Set(['submitted', 'working', 'completed', 'failed']);
  if (!states.every((s) => legal.has(s))) fail(`状态映射越界: ${states.join(',')}`);
  else ok('工单状态 → A2A state 映射完整（submitted/working/completed/failed）');
  // 2. Agent Card 形状
  const card = a2a.agentCard({ baseUrl: 'http://x', mcpTools: [{}] });
  for (const k of ['name', 'description', 'url', 'version', 'capabilities', 'skills']) {
    if (card[k] == null) fail(`Agent Card 缺字段 ${k}`);
  }
  if (card.skills.length < 3) fail('Agent Card skills 不足 3 个');
  ok(`Agent Card 形状合法（${card.skills.length} skills，version ${card.version}）`);
  // 3. 入站映射校验（纯函数：拒空任务、拒非法 acceptance 透传）
  try { a2a.taskToOrderDraft({}); fail('空任务未被拒绝'); }
  catch { ok('入站空任务被正确拒绝'); }
  const draft = a2a.taskToOrderDraft({ title: '外部任务', description: 'd', metadata: { source: 'verify', acceptance: ['a1'] } });
  if (draft.status !== 'open' || !draft.leads.length) fail('入站映射字段不合法');
  else ok('入站任务 → 工单草稿映射合法');
} catch (e) {
  fail('A2A: ' + e.message.split('\n')[0]);
}

// ---------------------------------------------------------------- 设计原则
console.log('[3/4] 设计原则');
const lawRows = read('LAWS.md').match(/^\| P\d+ \|.+$/gm) || [];
if (lawRows.length >= 10) ok(`LAWS.md ${lawRows.length} 条设计原则在册`);
else fail('设计原则不足 10 条（原则是平台的骨架，缺了要补）');

// ---------------------------------------------------------------- 调度纪律
console.log('[3.5/4] 调度纪律（P9）');
try {
  const schedPath = join(ROOT, 'platform/schedule.json');
  if (existsSync(schedPath)) {
    const ticks = JSON.parse(readFileSync(schedPath, 'utf8'));
    const ids = ticks.map((t) => t.id);
    if (new Set(ids).size !== ids.length) throw new Error('心跳日志 id 重复');
    for (const t of ticks) {
      if (!t.id || !t.type || isNaN(Date.parse(t.at))) throw new Error('心跳条目缺 id/type/at');
      if (!['dispatch', 'reclaim'].includes(t.type)) throw new Error(`未知心跳类型 ${t.type}`);
    }
    const dispDir = join(ROOT, 'platform/dispatch');
    if (existsSync(dispDir)) {
      const orderIds = new Set(orders.map((o) => o.id));
      const packets = readdirSync(dispDir).filter((f) => f.endsWith('.json'));
      for (const f of packets) {
        const p = JSON.parse(readFileSync(join(dispDir, f), 'utf8'));
        if (!p.order || !orderIds.has(p.order.id)) throw new Error(`施工包 ${f} 引用未知工单`);
        if (!p.runbook || !p.iteration) throw new Error(`施工包 ${f} 缺 runbook/iteration`);
      }
      ok(`心跳日志 ${ticks.length} 条 + 施工包 ${packets.length} 份合法`);
    } else ok(`心跳日志 ${ticks.length} 条合法（尚无施工包）`);
  } else ok('调度器尚未产生心跳（合法）');
} catch (e) {
  fail('调度纪律: ' + e.message.split('\n')[0]);
}

// ---------------------------------------------------------------- 控制台状态与任务存储
console.log('[4/4] 控制台状态一致性');
try {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('node', ['scripts/build_console_state.mjs'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('state 重建失败: ' + r.stderr.slice(0, 200));
  const state = JSON.parse(readFileSync(join(ROOT, 'console/state.json'), 'utf8'));
  const fresh = {
    orders: orders.length,
    agents: (JSON.parse(readFileSync(join(ROOT, 'platform/agents.json'), 'utf8'))).agents.length,
    laws: lawRows.length,
    iterations: (read('docs/ITERATIONS.md').match(/^## 迭代 \d+/gm) || []).length,
  };
  const c = state.counts || {};
  const mism = Object.entries(fresh).filter(([k, v]) => c[k] !== v);
  if (mism.length) throw new Error('重建后仍不一致: ' + mism.map(([k, v]) => `${k}≠${v}`).join(', '));
  ok(`state 一致（${fresh.orders} 工单 / ${fresh.agents} 智能体 / ${fresh.laws} 原则 / ${fresh.iterations} 迭代）`);
  if (existsSync(join(ROOT, 'platform/data/tasks.json'))) {
    const tasks = JSON.parse(readFileSync(join(ROOT, 'platform/data/tasks.json'), 'utf8')).tasks;
    for (const t of tasks) if (!['pending', 'working', 'done', 'cancelled'].includes(t.status)) throw new Error(`任务 ${t.id} 非法状态`);
    ok(`任务看板 ${tasks.length} 条状态合法`);
  } else ok('任务看板尚无数据（合法）');
} catch (e) {
  fail('控制台状态: ' + e.message.split('\n')[0]);
}

// ---------------------------------------------------------------- AGENTS.md（迭代原则）
try {
  const a = read('AGENTS.md');
  if (!/迭代原则/.test(a) || a.length < 1500) throw new Error('迭代原则不完整');
  ok('AGENTS.md 迭代原则在册');
} catch (e) {
  fail('AGENTS.md: ' + e.message.split('\n')[0]);
}

if (failures) {
  console.error(`\n✗ 平台体检未通过：${failures} 项`);
  process.exit(1);
}
console.log('\n✓ 平台体检通过：工单合法、智能体有据、原则在册、状态一致');

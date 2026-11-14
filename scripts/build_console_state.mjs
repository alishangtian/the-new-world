#!/usr/bin/env node
// 控制台状态构造器 —— 把平台资产编译成 console/state.json（控制台唯一数据源）。
// 迭代 006 起：状态含迭代详情/施工包/MCP 工具/认知↔规律交叉引用（P10 可观测一等）。

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// ---- 工单
const orders = readdirSync(join(ROOT, 'platform/orders'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(read(join('platform/orders', f))))
  .sort((a, b) => (b.priority || 0) - (a.priority || 0));

// ---- 知识条目
const knowledge = readdirSync(join(ROOT, 'knowledge'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(read(join('knowledge', f))))
  .sort((a, b) => a.id.localeCompare(b.id));

// ---- 设计规律（依据列可含多条 K- 引用）
const laws = (read('LAWS.md').match(/^\| P\d+ \|.+$/gm) || [])
  .map((row) => {
    const cols = row.split('|').map((s) => s.trim()).filter((s) => s.length);
    const [id, name, law, where, evidence] = cols;
    const kids = row.match(/K-\d+/g) || [];
    return { id, name, law, where, evidence, kids };
  });

// ---- 迭代账本（详情化：目标 + 遗留线索）
const iterText = read('docs/ITERATIONS.md');
const blocks = iterText.split(/\n---\n/).filter((b) => b.includes('## 迭代'));
const iterations = blocks.map((block) => {
  const head = block.match(/^## 迭代 (\d+) · (.+?)（(.+?)）$/m) || [];
  const pick = (label) => (block.match(new RegExp(`- \\*\\*${label}\\*\\*：(.+)`, 'm')) || [])[1] || '';
  return {
    n: Number(head[1] || 0),
    title: head[2] || '',
    date: head[3] || '',
    goal: pick('目标').slice(0, 160),
    clue: pick('遗留线索').slice(0, 200),
  };
}).filter((i) => i.n).sort((a, b) => a.n - b.n);

// ---- 施工包 + 心跳
const dispatchDir = join(ROOT, 'platform', 'dispatch');
const dispatches = existsSync(dispatchDir)
  ? readdirSync(dispatchDir).filter((f) => f.endsWith('.json'))
      .map((f) => {
        const d = JSON.parse(read(join('platform/dispatch', f)));
        return { id: d.id, iteration: d.iteration, orderId: d.order?.id, title: d.order?.title, steps: d.runbook?.steps || [], createdAt: d.createdAt };
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  : [];
const ticks = existsSync(join(ROOT, 'platform', 'schedule.json'))
  ? JSON.parse(read('platform/schedule.json'))
  : [];

// ---- MCP 工具（从服务器源码解析——能力即代码）
const serverSrc = read('platform/mcp/server.mjs');
const toolsBlock = (serverSrc.match(/const TOOLS = \[([\s\S]*?)\n\];/) || [])[1] || '';
const mcpTools = [...toolsBlock.matchAll(/name:\s*'([a-z_]+)',\s*description:\s*'([^']+)'/g)]
  .map((m) => ({ name: m[1], description: m[2] }));

// ---- 认知 ↔ 规律交叉引用
const crossRefs = {};
for (const k of knowledge) {
  crossRefs[k.id] = laws.filter((l) => l.kids.includes(k.id)).map((l) => l.id);
}

const topics = [...new Set(knowledge.map((k) => k.topic))].map((t) => ({ topic: t, count: knowledge.filter((k) => k.topic === t).length }));

const state = {
  generatedAt: new Date().toISOString(),
  counts: {
    orders: orders.length,
    ordersOpen: orders.filter((o) => o.status === 'open').length,
    knowledge: knowledge.length,
    laws: laws.length,
    iterations: iterations.length,
    dispatches: dispatches.length,
    mcpTools: mcpTools.length,
  },
  orders,
  knowledge,
  laws,
  iterations,
  dispatches,
  ticks,
  mcpTools,
  crossRefs,
  topics,
};

if (existsSync(join(ROOT, 'platform', 'schedule.json'))) {
  const ticksList = JSON.parse(read('platform/schedule.json'));
  state.scheduler = {
    autoOpen: orders.filter((o) => o.status === 'open' && o.auto === true).map((o) => ({ id: o.id, title: o.title, priority: o.priority })),
    lastTick: ticksList.at(-1) || null,
    dispatches: ticksList.filter((t) => t.type === 'dispatch').length,
  };
}

writeFileSync(join(ROOT, 'console', 'state.json'), JSON.stringify(state, null, 2));
console.log(`console/state.json: ${orders.length} 工单 · ${knowledge.length} 知识 · ${laws.length} 规律 · ${iterations.length} 迭代 · ${dispatches.length} 施工包 · ${mcpTools.length} MCP 工具`);

#!/usr/bin/env node
// 控制台状态构造器 —— 把平台资产（工单/智能体/迭代/施工包/MCP 工具）编译成 console/state.json。
// 控制台动态功能（对话/任务）走 /api/*；本文件提供静态快照兜底与总览数据。

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

// ---- 智能体与角色
const agents = existsSync(join(ROOT, 'platform/agents.json'))
  ? JSON.parse(read('platform/agents.json')).agents
  : [];
const roles = readdirSync(join(ROOT, 'platform/roles')).filter((f) => f.endsWith('.md')).map((f) => {
  const t = read(join('platform/roles', f));
  const h = (t.match(/^# 角色 · (.+)$/m) || [])[1] || f;
  return { id: f.replace(/\.md$/, ''), name: h.trim() };
});

// ---- 设计原则（LAWS.md 表格：| 编号 | 名称 | 原则 | 落地位置 |）
const laws = (read('LAWS.md').match(/^\| P\d+ \|.+$/gm) || [])
  .map((row) => {
    const cols = row.split('|').map((s) => s.trim()).filter((s) => s.length);
    const [id, name, law, where] = cols;
    return { id, name, law, where };
  });

// ---- 迭代账本（详情化）
const blocks = read('docs/ITERATIONS.md').split(/\n---\n/).filter((b) => b.includes('## 迭代'));
const iterations = blocks.map((block) => {
  const head = block.match(/^## 迭代 (\d+) · (.+?)（(.+?)）$/m) || [];
  const pick = (label) => (block.match(new RegExp(`- \\*\\*${label}\\*\\*：(.+)`, 'm')) || [])[1] || '';
  return {
    n: Number(head[1] || 0), title: head[2] || '', date: head[3] || '',
    goal: pick('目标').slice(0, 160), clue: pick('遗留线索').slice(0, 200),
  };
}).filter((i) => i.n).sort((a, b) => a.n - b.n);

// ---- 施工包与心跳
const dispatchDir = join(ROOT, 'platform', 'dispatch');
const dispatches = existsSync(dispatchDir)
  ? readdirSync(dispatchDir).filter((f) => f.endsWith('.json'))
      .map((f) => {
        const d = JSON.parse(read(join('platform/dispatch', f)));
        return { id: d.id, iteration: d.iteration, orderId: d.order?.id, title: d.order?.title, steps: d.runbook?.steps || [], createdAt: d.createdAt };
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  : [];
const ticks = existsSync(join(ROOT, 'platform', 'schedule.json')) ? JSON.parse(read('platform/schedule.json')) : [];

// ---- MCP 工具（从核心源码解析——能力即代码）
const coreSrc = read('platform/mcp/core.mjs');
const toolsBlock = (coreSrc.match(/export const TOOLS = \[([\s\S]*?)\n\];/) || [])[1] || '';
const mcpTools = [...toolsBlock.matchAll(/name:\s*'([a-z_]+)',\s*description:\s*'([^']+)'/g)]
  .map((m) => ({ name: m[1], description: m[2] }));

const state = {
  generatedAt: new Date().toISOString(),
  counts: {
    orders: orders.length,
    ordersOpen: orders.filter((o) => o.status === 'open').length,
    agents: agents.length,
    laws: laws.length,
    iterations: iterations.length,
    dispatches: dispatches.length,
    mcpTools: mcpTools.length,
  },
  orders,
  agents,
  roles,
  laws,
  iterations,
  dispatches,
  mcpTools,
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
console.log(`console/state.json: ${orders.length} 工单 · ${agents.length} 智能体 · ${laws.length} 原则 · ${iterations.length} 迭代 · ${dispatches.length} 施工包 · ${mcpTools.length} MCP 工具`);

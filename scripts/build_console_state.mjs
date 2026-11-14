#!/usr/bin/env node
// 控制台状态构造器 —— 把平台资产（工单/知识/规律/账本）编译成 console/state.json。
// 控制台是零依赖静态页：只读这一个 JSON。verify 会校验 state 与账本一致。

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// 工单
const orders = readdirSync(join(ROOT, 'platform/orders'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(ROOT, 'platform/orders', f), 'utf8')))
  .sort((a, b) => (b.priority || 0) - (a.priority || 0));

// 知识条目
const knowledge = readdirSync(join(ROOT, 'knowledge'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(ROOT, 'knowledge', f), 'utf8')))
  .sort((a, b) => a.id.localeCompare(b.id));

// 设计规律（LAWS.md 表格：| 编号 | 名称 | 规律 | 落地位置 | 依据 |）
const laws = (read('LAWS.md').match(/^\| (P\d+) \| (.+?) \| (.+?) \| (.+?) \| (K-\d+) \|$/gm) || [])
  .map((row) => {
    const [, id, name, law, where, kid] = row.split('|').map((s) => s.trim());
    return { id, name, law, where, evidence: kid };
  });

// 迭代账目
const iterations = (read('docs/ITERATIONS.md').match(/^## 迭代 (\d+) · (.+?)（/gm) || [])
  .map((row) => {
    const [, n, title] = row.match(/^## 迭代 (\d+) · (.+?)（/).map((s) => s);
    return { n: Number(n), title };
  });

const state = {
  generatedAt: new Date().toISOString(),
  counts: {
    orders: orders.length,
    ordersOpen: orders.filter((o) => o.status === 'open').length,
    knowledge: knowledge.length,
    laws: laws.length,
    iterations: iterations.length,
  },
  orders,
  knowledge,
  laws,
  iterations,
};

const out = join(ROOT, 'console', 'state.json');
writeFileSync(out, JSON.stringify(state, null, 2));
console.log(`console/state.json: ${orders.length} 工单 · ${knowledge.length} 知识 · ${laws.length} 规律 · ${iterations.length} 迭代`);

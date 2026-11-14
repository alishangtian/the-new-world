#!/usr/bin/env node
// 平台体检 —— 数据/契约/一致性校验。被 scripts/accept.mjs 的 G2 门与 CI 调用。
// 用法：node scripts/verify.mjs
// 原则：平台的每一次升级，都必须能通过这里的一次体检。

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const fail = (msg) => { failures++; console.error('  ✗ ' + msg); };
const ok = (msg) => console.log('  ✓ ' + msg);
const loadJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// ---------------------------------------------------------------- 工单
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
if (openCount) ok(`open 工单 ${openCount} 张（下一轮 SELECT 的池子）`);
else console.log('  · 提示：池中已无 open 工单——发包或考察新候选（合法状态，非失败）');

// ---------------------------------------------------------------- 知识条目
console.log('[2/4] 知识库（世界考察的产物）');
const kFiles = readdirSync(join(ROOT, 'knowledge')).filter((f) => f.endsWith('.json'));
const knowledge = kFiles.map((f) => {
  try {
    const k = loadJson(join('knowledge', f));
    if (!/^K-\d+$/.test(k.id)) throw new Error(`非法 id: ${k.id}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k.date || '')) throw new Error('缺合法考察日期');
    if (!k.topic || !k.title) throw new Error('缺 topic/title');
    if (!k.insight || k.insight.length < 30) throw new Error('insight 过薄（认知不是摘抄）');
    if (!k.appliedTo || k.appliedTo.length < 15) throw new Error('缺 appliedTo——没有应用到平台的知识不收');
    const srcs = k.sources || [];
    if (!srcs.length) throw new Error('缺 sources');
    for (const s of srcs) if (!/^https?:\/\//.test(s.url || '')) throw new Error(`来源 URL 非法: ${s.url}`);
    return k;
  } catch (e) {
    fail(`${f}: ${e.message.split('\n')[0]}`);
    return null;
  }
}).filter(Boolean);
const dupIds = knowledge.map((k) => k.id).filter((id, i, a) => a.indexOf(id) !== i);
if (dupIds.length) fail(`知识 id 重复: ${dupIds.join(',')}`);
else if (knowledge.length >= 5) ok(`${knowledge.length} 条考察认知，全部可溯源且已标注应用位置`);

// ---------------------------------------------------------------- 规律引用
console.log('[3/4] 设计规律引用链');
const lawsText = read('LAWS.md');
const lawRows = lawsText.match(/^\| P\d+ \|.+$/gm) || [];
const kIds = new Set(knowledge.map((k) => k.id));
let cited = 0;
for (const row of lawRows) {
  // 依据列可含多条引用（如 "K-005 · K-009"），逐个校验
  const kids = (row.match(/K-\d+/g) || []);
  if (!kids.length) { fail(`规律行缺依据条目: ${row.slice(0, 40)}…`); continue; }
  const bad = kids.filter((kid) => !kIds.has(kid));
  if (bad.length) { fail(`规律引用了不存在的条目: ${bad.join(',')}`); continue; }
  cited++;
}
if (cited === lawRows.length && cited >= 5) ok(`${cited} 条设计规律全部有考察条目支撑`);
const orphanK = knowledge.filter((k) => !lawsText.includes(k.id));
if (orphanK.length) console.log(`  · 提示：${orphanK.length} 条知识尚未被规律引用（合法——知识可以先于规律存在）`);

// ---------------------------------------------------------------- 调度纪律
console.log('[3.5/4] 调度纪律（P9）');
try {
  const schedPath = join(ROOT, 'platform/schedule.json');
  if (existsSync(schedPath)) {
    const ticks = JSON.parse(readFileSync(schedPath, 'utf8'));
    if (!Array.isArray(ticks)) throw new Error('schedule.json 必须是数组（只追加日志）');
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
    } else {
      ok(`心跳日志 ${ticks.length} 条合法（尚无施工包）`);
    }
  } else {
    ok('调度器尚未产生心跳（合法：心跳由 tick/agent 触发）');
  }
} catch (e) {
  fail('调度纪律: ' + e.message.split('\n')[0]);
}

// ---------------------------------------------------------------- 控制台状态
console.log('[4/4] 控制台状态一致性');
let state = null;
try {
  state = JSON.parse(readFileSync(join(ROOT, 'console/state.json'), 'utf8'));
  const fresh = {
    orders: orders.length,
    knowledge: knowledge.length,
    laws: lawRows.length,
    iterations: (readFileSync(join(ROOT, 'docs/ITERATIONS.md'), 'utf8').match(/^## 迭代 \d+/gm) || []).length,
  };
  const c = state.counts || {};
  const mism = Object.entries(fresh).filter(([k, v]) => c[k] !== v);
  if (mism.length) {
    // 允许旧 state，但必须能重建：现场重建一次再校验
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync('node', ['scripts/build_console_state.mjs'], { cwd: ROOT, encoding: 'utf8' });
    if (r.status !== 0) throw new Error('state 重建失败: ' + r.stderr.slice(0, 200));
    const rebuilt = JSON.parse(readFileSync(join(ROOT, 'console/state.json'), 'utf8'));
    const still = Object.entries(fresh).filter(([k, v]) => (rebuilt.counts || {})[k] !== v);
    if (still.length) throw new Error('重建后仍不一致: ' + still.map(([k, v]) => `${k}≠${v}`).join(', '));
    ok(`state 已自动重建并对齐（${Object.values(fresh).join('/')}）`);
  } else {
    ok(`state 一致（${fresh.orders} 工单 / ${fresh.knowledge} 知识 / ${fresh.laws} 规律 / ${fresh.iterations} 迭代）`);
  }
} catch (e) {
  fail('控制台状态: ' + e.message.split('\n')[0]);
}

if (failures) {
  console.error(`\n✗ 平台体检未通过：${failures} 项`);
  process.exit(1);
}
console.log('\n✓ 平台体检通过：工单合法、知识可溯源、规律有据、状态一致');

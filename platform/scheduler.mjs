#!/usr/bin/env node
// 平台调度器 —— P9 自主触发的确定性决策件。
// 心跳（CI tick / 定时任务 / agent）调用它，它只做三件确定性的事：
//   1. 回收：认领超时（默认 7 天）且未交付的工单 → 回到 open（认领不是占坑）；
//   2. 派单：从 open 且 auto-ok 的工单里取最高优先级，置 claimed（claimedBy=scheduler）；
//   3. 发令：把下一轮迭代的施工包写进 platform/dispatch/，供接入的 agent 消费。
// 它不做任何需要认知与代码的事——那是 world-builder 技能 + agent 的职责（P9）。
//
// 用法：
//   node platform/scheduler.mjs --dry            # 只决策不落盘（心跳观测模式）
//   node platform/scheduler.mjs                  # 真实派单
//   node platform/scheduler.mjs --force ORD-014  # 越过 auto 标记派指定工单（人工发令）
//   node platform/scheduler.mjs --json           # 结构化输出

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // 本文件位于 platform/ 下
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const asJson = args.includes('--json');
const forceIdx = args.indexOf('--force');
const force = forceIdx >= 0 ? args[forceIdx + 1] : null;
const reclaimDays = Number(args[args.indexOf('--reclaim-days') + 1]) || 7;

const ORDER_DIR = join(ROOT, 'platform', 'orders');
const DISPATCH_DIR = join(ROOT, 'platform', 'dispatch');
const TICKS = join(ROOT, 'platform', 'schedule.json');
const LEDGER = join(ROOT, 'docs', 'ITERATIONS.md');
const DAY = 86400000;

const now = new Date();
const nowISO = now.toISOString();
const read = (p) => readFileSync(p, 'utf8');

// ------------------------------------------------ 工单
const loadOrders = () => readdirSync(ORDER_DIR).filter((f) => f.endsWith('.json'))
  .map((f) => ({ _file: f, ...JSON.parse(read(join(ORDER_DIR, f))) }));
const saveOrder = (o) => {
  const { _file, ...rest } = o;
  writeFileSync(join(ORDER_DIR, _file), JSON.stringify(rest, null, 2) + '\n');
};

// ------------------------------------------------ 心跳日志（只追加）
const tickLog = [];
if (existsSync(TICKS)) tickLog.push(...JSON.parse(read(TICKS)));
const tick = (entry) => {
  tickLog.push(entry);
  if (!dry) writeFileSync(TICKS, JSON.stringify(tickLog, null, 2) + '\n');
};

// ------------------------------------------------ 1. 回收超时认领
const reclaimed = [];
for (const o of loadOrders()) {
  if (o.status !== 'claimed' || !o.claimedAt) continue;
  const ageDays = (now.getTime() - new Date(o.claimedAt).getTime()) / DAY;
  if (ageDays <= reclaimDays) continue;
  if (dry) { reclaimed.push({ id: o.id, would: 'reclaim' }); continue; }
  o.status = 'open';
  o.notes = `${o.notes || ''}\n[调度器 ${nowISO}] 认领超 ${Math.floor(ageDays)} 天未交付，自动回收（原认领方：${o.claimedBy}）`.trim();
  o.claimedBy = null;
  o.claimedAt = null;
  saveOrder(o);
  tick({ id: `reclaim-${o.id}-${nowISO}`, type: 'reclaim', orderId: o.id, at: nowISO });
  reclaimed.push({ id: o.id, reclaimed: true });
}

// ------------------------------------------------ 2. 选单
let target = null;
if (force) {
  target = loadOrders().find((o) => o.id === force || o._file.startsWith(force));
  if (!target) throw new Error(`--force: 工单不存在 ${force}`);
  if (target.status === 'delivered') throw new Error(`${target.id} 已交付`);
  if (target.status === 'claimed' && !dry) throw new Error(`${target.id} 已被认领（${target.claimedBy}）；如需强派请先回收`);
} else {
  target = loadOrders()
    .filter((o) => o.status === 'open' && o.auto === true)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0] || null;
}

if (!target) {
  const out = {
    dispatched: false,
    reason: '没有可派发的 auto-ok 工单（发令人可在工单里加 "auto": true，或用 --force 指定）',
    reclaimed,
  };
  if (asJson) console.log(JSON.stringify(out, null, 2));
  else console.log(`⚠ ${out.reason}`);
  process.exit(0);
}

// ------------------------------------------------ 3. 迭代号（账本唯一性 = 断点续跑的锚）
const ledger = read(LEDGER);
const nums = [...ledger.matchAll(/^## 迭代 (\d+)/gm)].map((m) => Number(m[1]));
const nextIteration = String(Math.max(0, ...nums) + 1).padStart(3, '0');

// ------------------------------------------------ 4. 施工包
const packetId = `dispatch-${nextIteration}-${target.id}-${now.toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;
const packet = {
  id: packetId,
  createdAt: nowISO,
  iteration: nextIteration,
  dry,
  order: target,
  runbook: {
    skill: '.zcode/skills/world-builder/SKILL.md（严格按其六步循环执行）',
    steps: [
      'EXPLORE：沿 order.leads 考察世界（网络/搜索引擎/GitHub），产出 knowledge/K-*.json',
      'DISTILL：LAWS.md 立法（引用 K- 条目）',
      'BUILD：按规律升级平台（零依赖红线）',
      'VERIFY：node scripts/accept.mjs 五门全 PASS',
      'LEDGER：docs/ITERATIONS.md 追加本轮（迭代号见本包 iteration 字段）；close_order',
      'COMMIT：迭代 ' + nextIteration + ' · ' + target.title + '，推送',
    ],
  },
};

if (!dry) {
  // 认领
  target.status = 'claimed';
  target.claimedBy = 'scheduler (auto)';
  target.claimedAt = nowISO;
  saveOrder(target);
  mkdirSync(DISPATCH_DIR, { recursive: true });
  writeFileSync(join(DISPATCH_DIR, `${packetId}.json`), JSON.stringify(packet, null, 2) + '\n');
  tick({ id: packetId, type: 'dispatch', orderId: target.id, iteration: nextIteration, at: nowISO });
}

const out = {
  dispatched: true,
  dry,
  iteration: nextIteration,
  orderId: target.id,
  title: target.title,
  packet: dry ? '(dry 模式不落盘)' : `platform/dispatch/${packetId}.json`,
  reclaimed,
};
if (asJson) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`📣 ${dry ? '[dry] 将派发' : '已派发'}：迭代 ${nextIteration} ← ${target.id} ${target.title}`);
  if (reclaimed.length) console.log(`♻ 回收超时认领 ${reclaimed.length} 张`);
  if (!dry) console.log(`📦 施工包：platform/dispatch/${packetId}.json（接入的 agent 按包内 runbook 执行）`);
}

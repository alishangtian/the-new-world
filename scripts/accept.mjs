#!/usr/bin/env node
// 无头验收门 —— 质检员的唯一武器，agent 平台的质量裁判。
// 用法：node scripts/accept.mjs [--json]
// 五道门：G1 语法 / G2 世界体检 / G3 平台自检 / G4 数据纪律 / G5 账本纪律
// 输出 ACCEPTANCE: PASS / FAIL。exit 0 = PASS。

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gates = [];
const jsonOut = process.argv.includes('--json');

const run = (label, fn) => {
  const t0 = Date.now();
  try {
    const detail = fn();
    gates.push({ gate: label, pass: true, detail, ms: Date.now() - t0 });
    console.log(`  ✓ ${label} (${Date.now() - t0}ms)`);
    return true;
  } catch (e) {
    gates.push({ gate: label, pass: false, detail: String(e.message || e), ms: Date.now() - t0 });
    console.error(`  ✗ ${label}: ${String(e.message || e).split('\n')[0]}`);
    return false;
  }
};
const sh = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', timeout: 180000 });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} -> exit ${r.status}\n${(r.stderr || r.stdout || '').slice(-600)}`);
  return r.stdout;
};

// ---------------------------------------------------------------- G1 语法
let g1 = run('G1 语法', () => {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name === 'node_modules' || name.startsWith('.')) continue;
        walk(p);
      } else if (name.endsWith('.js') || name.endsWith('.mjs')) files.push(p);
    }
  };
  walk(join(ROOT, 'console'));
  walk(join(ROOT, 'scripts'));
  walk(join(ROOT, 'platform'));
  for (const f of files) {
    const r = spawnSync('node', ['--check', f], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`${f}: ${r.stderr.slice(0, 300)}`);
  }
  return `${files.length} 个 JS 文件语法全过`;
});

// ---------------------------------------------------------------- G2 世界体检
let g2 = run('G2 平台体检', () => sh('node', ['scripts/verify.mjs']).split('\n').filter((l) => l.includes('✓')).length + ' 项检查全过');

// ---------------------------------------------------------------- G3 平台自检
let g3 = run('G3 平台自检 (MCP 冒烟)', () => sh('node', ['platform/mcp/smoke.mjs']).split('\n').filter((l) => l.trim()).pop());

// ---------------------------------------------------------------- G4 知识纪律
let g4 = run('G4 知识纪律', () => {
  const dir = join(ROOT, 'knowledge');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const bad = [];
  for (const f of files) {
    const doc = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const srcs = doc && doc.sources;
    if (!Array.isArray(srcs) || !srcs.length) bad.push(`${f}: 缺 sources`);
    else for (const s of srcs) if (!/^https?:\/\//.test(s.url || '')) bad.push(`${f}: 来源 URL 非法`);
    if (!doc.appliedTo) bad.push(`${f}: 缺 appliedTo（知识必须落到平台）`);
  }
  const state = statSync(join(ROOT, 'console/state.json'));
  if (Date.now() - state.mtimeMs > 7 * 86400000) bad.push('console/state.json 超过 7 天未重建');
  if (bad.length) throw new Error(bad.join('; '));
  return `${files.length} 条知识全部可溯源且标注应用位置`;
});

// ---------------------------------------------------------------- G5 账本纪律
let g5 = run('G5 账本纪律', () => {
  const must = ['docs/ITERATIONS.md', 'BACKLOG.md', 'LAWS.md'];
  for (const f of must) {
    const text = readFileSync(join(ROOT, f), 'utf8');
    if (text.trim().length < 100) throw new Error(`${f} 空或缺内容`);
  }
  const iter = readFileSync(join(ROOT, 'docs/ITERATIONS.md'), 'utf8');
  const nums = [...iter.matchAll(/^## 迭代 (\d+)/gm)].map((m) => Number(m[1]));
  if (!nums.length) throw new Error('ITERATIONS.md 没有任何迭代条目');
  if (new Set(nums).size !== nums.length) throw new Error('迭代号重复');
  if (nums.some((n, i) => i > 0 && n <= nums[i - 1])) throw new Error('迭代号未按升序登记');

  const statuses = new Set(['open', 'claimed', 'delivered', 'blocked']);
  const ordersDir = join(ROOT, 'platform/orders');
  let count = 0;
  for (const f of readdirSync(ordersDir).filter((x) => x.endsWith('.json'))) {
    const o = JSON.parse(readFileSync(join(ordersDir, f), 'utf8'));
    count++;
    if (!statuses.has(o.status)) throw new Error(`${f}: 非法状态 ${o.status}`);
    if (o.status === 'claimed' && (!o.claimedBy || !o.claimedAt)) throw new Error(`${f}: claimed 缺 claimedBy/claimedAt`);
    if (o.status === 'blocked' && !o.blocker && !/blocker/i.test(o.notes || '')) throw new Error(`${f}: blocked 缺 blocker 说明`);
    if (o.status === 'delivered' && !o.deliveredIn) throw new Error(`${f}: delivered 缺 deliveredIn`);
  }
  return `账本齐全，${nums.length} 轮迭代升序无重复，${count} 张工单状态合法`;
});

// ---------------------------------------------------------------- 汇总
const pass = g1 && g2 && g3 && g4 && g5;
const verdict = {
  verdict: pass ? 'PASS' : 'FAIL',
  gates: gates.map(({ gate, pass: p, detail, ms }) => ({ gate, pass: p, detail, ms })),
  finishedAt: new Date().toISOString(),
};

console.log('\n' + (pass ? 'ACCEPTANCE: PASS' : 'ACCEPTANCE: FAIL'));
if (jsonOut) console.log(JSON.stringify(verdict, null, 2));
process.exit(pass ? 0 : 1);

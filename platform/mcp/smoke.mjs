#!/usr/bin/env node
// 平台自检 —— 用真实的 JSON-RPC 消息过一遍 MCP 服务器。
// 不调用任何有副作用的工具（write_ledger / close_order 只测校验失败路径）。
// 被 scripts/accept.mjs 的 G3 门调用；CI 亦直接运行。

import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SERVER = join(ROOT, 'platform', 'mcp', 'server.mjs');

const child = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'pipe'] });
const pending = new Map();
let buffer = '';
let nextId = 1;

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let nl;
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch { /* 非 JSON 输出忽略 */ }
  }
});
child.stderr.on('data', () => { /* 服务器日志，忽略 */ });

const call = (method, params, { timeoutMs = 15000 } = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  const timer = setTimeout(() => reject(new Error(`${method} 超时`)), timeoutMs);
  pending.set(id, (msg) => {
    clearTimeout(timer);
    if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
    else resolve(msg.result);
  });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
});

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

try {
  const init = await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } });
  check('initialize 握手', !!init.serverInfo?.name, init.serverInfo?.name);
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const tools = await call('tools/list', {});
  const names = tools.tools.map((t) => t.name);
  const want = ['list_orders', 'read_order', 'platform_state', 'list_knowledge', 'run_gates', 'write_ledger', 'close_order'];
  check('tools/list 完整', want.every((w) => names.includes(w)), names.join(', '));

  const orders = await call('tools/call', { name: 'list_orders', arguments: {} });
  const list = JSON.parse(orders.content[0].text);
  check('list_orders 返回工单', Array.isArray(list) && list.length >= 6, `${list.length} 张`);

  const state = JSON.parse((await call('tools/call', { name: 'platform_state', arguments: {} })).content[0].text);
  check('platform_state 知识库>=8', state.platform.knowledge >= 8, `${state.platform.knowledge} 知识 / ${state.platform.laws} 律 / ${state.platform.iterations} 轮迭代`);
  check('platform_state 下一张工单', !!state.nextByPriority?.id, state.nextByPriority?.id);

  const kn = JSON.parse((await call('tools/call', { name: 'list_knowledge', arguments: {} })).content[0].text);
  const allTraced = kn.every((k) => Array.isArray(k.sources) && k.sources.length && k.appliedTo);
  check('list_knowledge 全部可溯源', kn.length >= 8 && allTraced, `${kn.length} 条`);

  const one = JSON.parse((await call('tools/call', { name: 'read_order', arguments: { id: 'ORD-012' } })).content[0].text);
  check('read_order 读全文', one.id === 'ORD-012' && Array.isArray(one.acceptance), one.title);

  const disp = JSON.parse((await call('tools/call', { name: 'dispatch_next', arguments: { dry: true } })).content[0].text);
  check('dispatch_next 观测模式', typeof disp.dispatched === 'boolean', disp.dispatched ? `将派 ${disp.orderId}` : disp.reason);

  const bad = await call('tools/call', { name: 'write_ledger', arguments: { iteration_id: '999', entry_markdown: '## 错误格式' } });
  check('write_ledger 校验拦截', bad.isError === true, '格式非法被拒');

  const dup = await call('tools/call', { name: 'write_ledger', arguments: { iteration_id: '002', entry_markdown: '## 迭代 002 · 重复（2026-01-01）' } });
  check('write_ledger 迭代号唯一', dup.isError === true, '重复被拒');
} catch (e) {
  check('冒烟流程', false, String(e.message).split('\n')[0]);
}

child.kill();
const pass = checks.every((c) => c.ok);
console.log(pass ? 'SMOKE: PASS' : 'SMOKE: FAIL');
process.exit(pass ? 0 : 1);

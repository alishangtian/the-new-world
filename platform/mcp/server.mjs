#!/usr/bin/env node
// the-new-world · MCP stdio 薄壳 —— 与 http.mjs 共用 core.mjs（P11 核心与传输解耦）。
// 接入：{ "mcpServers": { "the-new-world": {
//            "command": "node", "args": ["<仓库>/platform/mcp/server.mjs"] } } }

import readline from 'node:readline';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { handleRpcMessage, ROOT } from './core.mjs';

const log = (...a) => process.stderr.write(['[the-new-world-mcp]', ...a, '\n'].join(' '));
const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  const s = line.trim();
  if (!s) return;
  let msg;
  try { msg = JSON.parse(s); } catch { return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON 解析失败' } }); }
  Promise.resolve(handleRpcMessage(msg))
    .then((resp) => { if (resp) send(resp); })
    .catch((e) => {
      log('handler error:', e.message);
      if (msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: String(e.message || e) } });
    });
});
rl.on('close', () => process.exit(0));

if (!existsSync(join(ROOT, 'docs', 'ITERATIONS.md'))) {
  log('警告：未找到 docs/ITERATIONS.md——请在仓库根目录运行本服务器');
}
log('the-new-world 平台已就绪（stdio / 仓库: ' + ROOT + '）');

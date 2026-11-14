#!/usr/bin/env node
// the-new-world · MCP HTTP 薄壳 —— 与 server.mjs（stdio）共用 core.mjs（P11）。
// 一个进程提供两种面：
//   GET  /          平台控制台（静态：index.html + console/）
//   GET  /healthz   健康探针（k8s liveness/readiness）
//   POST /mcp       MCP Streamable HTTP 端点：POST 单条 JSON-RPC → application/json 单响应
//                   （纯通知回 202。规范：
//                    https://modelcontextprotocol.io/specification/2025-03-26/basic/transports）

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { handleRpcMessage, ROOT } from './core.mjs';

const PORT = Number(process.env.PORT ?? 3000);
const WEB_ROOT = resolve(join(ROOT, '.')); // 控制台与平台资产都在仓库根

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

async function fileAt(path) {
  try {
    const info = await stat(path);
    return info.isFile() ? { path, size: info.size } : undefined;
  } catch { return undefined; }
}

async function resolveFile(urlPath) {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  const base = join(WEB_ROOT, rel);
  if (base !== WEB_ROOT && !base.startsWith(WEB_ROOT + sep)) return undefined; // 防目录穿越
  return (await fileAt(base)) ?? (await fileAt(`${base}.html`)) ?? (await fileAt(join(base, 'index.html')));
}

function sendFile(req, res, file) {
  const type = MIME[extname(file.path).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': file.size, 'Cache-Control': 'no-cache' });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file.path).pipe(res);
}

async function handleMcp(req, res) {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', async () => {
    let msg;
    try { msg = JSON.parse(body); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON 解析失败' } }));
    }
    const resp = await handleRpcMessage(msg).catch((e) => ({
      jsonrpc: '2.0', id: msg.id ?? null, error: { code: -32603, message: String(e.message || e) },
    }));
    if (!resp) { // 纯通知：规范允许 202 无 body
      res.writeHead(202).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(resp));
  });
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = url.pathname;

  if (pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', platform: 'the-new-world', ts: new Date().toISOString() }));
  }
  if (pathname === '/mcp' && req.method === 'POST') return handleMcp(req, res);
  if (pathname === '/mcp') {
    res.writeHead(405, { Allow: 'POST' }).end();
    return;
  }

  const file = await resolveFile(pathname);
  if (file) return sendFile(req, res, file);
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`the-new-world http: console=/  mcp=POST /mcp  healthz=/healthz  on 0.0.0.0:${PORT} (root: ${WEB_ROOT})`);
});

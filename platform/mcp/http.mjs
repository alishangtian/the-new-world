#!/usr/bin/env node
// the-new-world · MCP HTTP 薄壳 —— 与 server.mjs（stdio）共用 core.mjs（P11）。
// 一个进程提供两种面：
//   GET  /          平台控制台（静态：index.html + console/）
//   GET  /healthz   健康探针（k8s liveness/readiness）
//   POST /mcp       MCP Streamable HTTP 端点：POST 单条 JSON-RPC → application/json 单响应
//                   （纯通知回 202。规范：
//                    https://modelcontextprotocol.io/specification/2025-03-26/basic/transports）

import { createReadStream, readFileSync, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { handleRpcMessage, ROOT, TOOLS } from './core.mjs';
import { listTasks, createTask, setTaskStatus, getSession, appendMessages } from '../data-store.mjs';
import { agentCard, orderToTask, listOrders, intakeTask } from '../a2a.mjs';

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

// ---------------------------------------------------------------- LLM 缝隙（厂商中立）
// 任何 OpenAI 兼容 /chat/completions 端点：Ollama / vLLM / LM Studio / 云厂商。
// 平台是编排层——智能由外部模型提供；未配置时对话返回接入指引而非假装智能。
const LLM_BASE_URL = process.env.LLM_BASE_URL || '';
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || '';

async function llmChat(system, history, userMsg) {
  if (!LLM_BASE_URL || !LLM_MODEL) return null;
  const r = await fetch(LLM_BASE_URL.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(LLM_API_KEY ? { Authorization: `Bearer ${LLM_API_KEY}` } : {}) },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: userMsg }],
    }),
  });
  if (!r.ok) throw new Error(`LLM 端点 ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? null;
}

function systemPromptFor(agentId) {
  const reg = existsSync(join(ROOT, 'platform', 'agents.json'))
    ? JSON.parse(readFileSync(join(ROOT, 'platform', 'agents.json'), 'utf8'))
    : { agents: [] };
  const a = reg.agents.find((x) => x.id === agentId);
  const roleDoc = a && a.role !== 'custom' ? join(ROOT, 'platform', 'roles', `${a.role}.md`) : null;
  const contract = roleDoc && existsSync(roleDoc)
    ? `\n你的岗位契约（必须遵守）：\n${readFileSync(roleDoc, 'utf8').slice(0, 1200)}`
    : '';
  return [
    `你是 the-new-world agent 平台上的智能体${a ? `「${a.name}」（${a.id}）` : ''}。`,
    '平台原则：零依赖、溯源强制、账本只追加、宁缺毋滥。',
    a && a.tools?.length ? `你被授予的工具：${a.tools.join(', ')}（agent 可通过 MCP 调用）。` : '',
    contract,
  ].filter(Boolean).join('\n');
}

const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj, null, 2)); };

async function handleApi(req, res, pathname, url) {
  // 每个分支自行响应后返回 true（已接管）；未匹配返回 false 交回静态服务。
  if (req.method === 'GET' && pathname === '/api/config') {
    json(res, 200, { llmConfigured: !!(LLM_BASE_URL && LLM_MODEL), model: LLM_MODEL || null });
    return true;
  }
  if (req.method === 'GET' && pathname === '/api/agents') {
    const reg = existsSync(join(ROOT, 'platform', 'agents.json'))
      ? JSON.parse(readFileSync(join(ROOT, 'platform', 'agents.json'), 'utf8')) : { agents: [] };
    json(res, 200, { agents: reg.agents });
    return true;
  }
  if (pathname === '/api/tasks') {
    if (req.method === 'GET') { json(res, 200, { tasks: listTasks() }); return true; }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        try { json(res, 200, createTask(JSON.parse(body || '{}'))); }
        catch (e) { json(res, 400, { error: e.message }); }
      });
      return true; // 异步响应，主循环停止
    }
  }
  const statusMatch = pathname.match(/^\/api\/tasks\/([\w-]+)\/status$/);
  if (statusMatch && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try { json(res, 200, setTaskStatus(statusMatch[1], JSON.parse(body || '{}').status)); }
      catch (e) { json(res, 400, { error: e.message }); }
    });
    return true;
  }
  if (pathname === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', async () => {
      try {
        const { agentId, message } = JSON.parse(body || '{}');
        if (!agentId || !message || !String(message).trim()) throw new Error('需要 agentId 与非空 message');
        const session = getSession(agentId);
        const history = session.messages.slice(-20).map((m) => ({ role: m.role, content: m.content }));
        let reply;
        let llmUsed = true;
        try {
          reply = await llmChat(systemPromptFor(agentId), history, message);
        } catch (e) {
          reply = `⚠ 模型端点异常：${e.message}`;
          llmUsed = false;
        }
        if (reply === null) {
          reply = [
            '⚠ 平台尚未接入模型——对话能力需要一个 OpenAI 兼容端点（Ollama / vLLM / LM Studio / 云厂商均可）。',
            '接入方法：',
            '  • 本机 Ollama：LLM_BASE_URL=http://host.docker.internal:11434/v1  LLM_MODEL=<模型名>',
            '  • k8s：kubectl -n the-new-world set env deployment/the-new-world LLM_BASE_URL=… LLM_MODEL=…',
            '配置后重启服务，再次发消息即可真实对话。',
          ].join('\n');
          llmUsed = false;
        }
        appendMessages(agentId, [
          { role: 'user', content: message },
          { role: 'assistant', content: reply },
        ]);
        json(res, 200, { reply, llmUsed });
      } catch (e) {
        json(res, 400, { error: e.message });
      }
    });
    return true; // 异步响应，主循环停止
  }
  if (pathname === '/api/chat' && req.method === 'GET') {
    json(res, 200, getSession(url.searchParams.get('agentId')));
    return true;
  }
  // ---- A2A 互操作（ORD-015）：发现（agent card）→ 交接（任务对象）→ 凭证（工单状态机）
  if (req.method === 'GET' && (pathname === '/.well-known/agent-card.json' || pathname === '/.well-known/agent.json')) {
    json(res, 200, agentCard({ baseUrl: `http://${req.headers.host || 'localhost'}`, mcpTools: TOOLS }));
    return true;
  }
  if (pathname === '/a2a/tasks') {
    if (req.method === 'GET') {
      json(res, 200, { tasks: listOrders().map((o) => orderToTask(o)) });
      return true;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        try { json(res, 200, orderToTask(intakeTask(JSON.parse(body || '{}')))); }
        catch (e) { json(res, 400, { error: e.message }); }
      });
      return true;
    }
  }
  const a2aMatch = pathname.match(/^\/a2a\/tasks\/(ORD-\d+)$/);
  if (a2aMatch && req.method === 'GET') {
    const order = listOrders().find((o) => o.id === a2aMatch[1]);
    if (!order) { json(res, 404, { error: `工单不存在: ${a2aMatch[1]}` }); return true; }
    json(res, 200, orderToTask(order));
    return true;
  }
  return false;
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
  if (pathname.startsWith('/api/') || pathname.startsWith('/a2a') || pathname.startsWith('/.well-known/')) {
    const handled = await handleApi(req, res, pathname, url);
    if (handled) return;
  }

  const file = await resolveFile(pathname);
  if (file) return sendFile(req, res, file);
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`the-new-world http: console=/  mcp=POST /mcp  api=/api/*  healthz=/healthz  on 0.0.0.0:${PORT} (root: ${WEB_ROOT})`);
});

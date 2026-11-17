// A2A 互操作层 —— 平台作为 A2A Server 暴露：外部 agent 可发现本平台（Agent Card）、
// 以 A2A 任务对象读写工单（发现→交接→凭证，P2 的平台间形态）。
// 映射是纯函数（可测）；写入路径只经过工单状态机（复用 PROTOCOL 约束）。
//
// 规范依据：A2A Task 状态 submitted/working/completed/failed/canceled；
// Agent Card 挂 /.well-known/agent-card.json（v0.3+，兼容旧 /.well-known/agent.json）。
// https://github.com/a2aproject/A2A

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname ?? '.', '..'); // 本文件位于 platform/ 下
const ORDERS_DIR = join(ROOT, 'platform', 'orders');

const read = (p) => readFileSync(p, 'utf8');

// ------------------------------------------------------------ 状态映射（工单 ↔ A2A Task）
const ORDER_TO_TASK_STATE = {
  open: 'submitted',
  claimed: 'working',
  delivered: 'completed',
  blocked: 'failed',
};

/** 工单 → A2A 任务对象（纯函数） */
export function orderToTask(order, { baseUrl = '' } = {}) {
  return {
    id: order.id,
    contextId: `the-new-world:${order.id}`,
    status: {
      state: ORDER_TO_TASK_STATE[order.status] || 'submitted',
      message: order.status === 'blocked' ? (order.notes || 'blocked').slice(0, 300)
             : order.status === 'delivered' ? `delivered in iteration ${order.deliveredIn || '?'}`
             : order.status === 'claimed' ? `claimed by ${order.claimedBy || '?'}`
             : `open · priority ${order.priority ?? '?'}`,
    },
    title: order.title,
    description: order.goal || '',
    metadata: {
      kind: 'the-new-world/order',
      priority: order.priority ?? null,
      acceptance: order.acceptance || [],
      leads: (order.leads || []).map((l) => l.url),
      claimedBy: order.claimedBy || null,
      deliveredIn: order.deliveredIn || null,
      resource: `${baseUrl}/api/orders/${order.id}`.replace('//api', '/api'),
    },
  };
}

/** 入站 A2A 任务 → 工单草稿（纯函数，不落盘） */
export function taskToOrderDraft(task = {}) {
  const title = String(task.title || task.description || '').trim().slice(0, 120);
  if (!title) throw new Error('A2A 任务缺少 title/description');
  const acceptance = Array.isArray(task.metadata?.acceptance) && task.metadata.acceptance.length
    ? task.metadata.acceptance.map(String)
    : [`外部 A2A 任务（来源: ${String(task.metadata?.source || 'unspecified')}）完成后关闭`];
  // 工单 schema 强制 leads 非空：外部任务未带线索时按来源合成一条（许可由发包方负责）
  const leads = (task.metadata?.leads || []).map((u) => ({ source: String(u), url: String(u), license: '外部任务，许可由发包方负责' }));
  if (!leads.length) {
    leads.push({
      source: `A2A 入站任务（source: ${String(task.metadata?.source || 'unspecified')}）`,
      url: String(task.metadata?.sourceUrl || 'https://github.com/a2aproject/A2A'),
      license: '外部任务，许可由发包方负责',
    });
  }
  return {
    id: task.id && /^ORD-\d{3}$/.test(task.id) ? task.id : null, // 入站任务不指定 ORD 号，由平台分配
    title,
    goal: String(task.description || title).slice(0, 300),
    status: 'open',
    priority: Number(task.metadata?.priority) || 10,
    acceptance,
    leads,
    lawDraft: task.metadata?.lawDraft || '',
    claimedBy: null, claimedAt: null, deliveredIn: null,
    notes: `来自 A2A 入站任务${task.id ? `（远端 id: ${task.id}）` : ''}`,
  };
}

// ------------------------------------------------------------ Agent Card
/** 生成 Agent Card（平台能力自描述）。skills = 平台对外的可交互面 */
export function agentCard({ baseUrl = '', mcpTools = [] } = {}) {
  const openOrders = listOrders().filter((o) => o.status === 'open').length;
  return {
    name: 'the-new-world',
    description: 'agent 平台：人类指挥智能体干活、聊天。本端点供外部 agent 发现平台、读写迭代工单（A2A 任务对象）。',
    url: baseUrl,
    version: '0.10.0',
    protocolVersion: '0.2.4',
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],
    skills: [
      {
        id: 'order-discovery',
        name: '迭代工单发现',
        description: `列出平台迭代工单（当前 open ${openOrders} 张）——外部 agent 可领取并按 runbook 施工`,
        tags: ['orders', 'iteration', 'the-new-world'],
      },
      {
        id: 'order-intake',
        name: '任务发包接入',
        description: '外部 agent 可向平台提交 A2A 任务，平台将其转化为迭代工单进入流水线',
        tags: ['intake', 'tasks'],
      },
      {
        id: 'mcp-tools',
        name: 'MCP 工具面',
        description: `同平台另有 ${mcpTools.length} 个 MCP 工具（任务/对话/验收门/账本），stdio 与 HTTP 双传输`,
        tags: ['mcp', 'tools'],
      },
    ],
  };
}

// ------------------------------------------------------------ 工单读写（复用状态机）
export function listOrders() {
  return readdirSync(ORDERS_DIR).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(read(join(ORDERS_DIR, f))))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

function nextOrderId() {
  const nums = listOrders().map((o) => Number((o.id || '').replace('ORD-', '')) || 0);
  return `ORD-${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`;
}

/** 入站 A2A 任务落盘为工单（唯一写路径，走工单 schema） */
export function intakeTask(task = {}) {
  const draft = taskToOrderDraft(task);
  const order = { ...draft, id: draft.id || nextOrderId() };
  const path = join(ORDERS_DIR, `${order.id}-${order.title.replace(/[^\w\u4e00-\u9fa5-]+/g, '-').slice(0, 24) || 'untitled'}.json`);
  writeFileSync(path, JSON.stringify(order, null, 2) + '\n');
  return order;
}

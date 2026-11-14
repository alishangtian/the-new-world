// 平台运行时数据存储 —— 任务与对话会话（platform/data/ 下，运行时态，不入仓库）。
// 边界（P7 记忆两层）：这里的暂存是"工作记忆"；只有账本与工单才是长期记忆。

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data');
const ensure = () => mkdirSync(DATA_DIR, { recursive: true });

function loadJson(file, fallback) {
  ensure();
  const p = join(DATA_DIR, file);
  if (!existsSync(p)) return fallback;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; }
}
function saveJson(file, obj) {
  ensure();
  writeFileSync(join(DATA_DIR, file), JSON.stringify(obj, null, 2) + '\n');
}

// ------------------------------------------------ 任务（指挥智能体干活）
const TASK_STATUSES = ['pending', 'working', 'done', 'cancelled'];
let taskSeq = 0;

export function listTasks() {
  const d = loadJson('tasks.json', { tasks: [] });
  taskSeq = Math.max(taskSeq, ...d.tasks.map((t) => Number(t.id.slice(2)) || 0));
  return d.tasks.sort((a, b) => a.id.localeCompare(b.id));
}
export function createTask({ title, agentId = null, desc = '' }) {
  if (!title || !String(title).trim()) throw new Error('需要任务标题');
  const tasks = listTasks();
  taskSeq += 1;
  const t = {
    id: `T-${String(taskSeq).padStart(3, '0')}`,
    title: String(title).trim().slice(0, 120),
    agentId, desc: String(desc || '').slice(0, 500),
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  tasks.push(t);
  saveJson('tasks.json', { tasks });
  return t;
}
export function setTaskStatus(id, status) {
  if (!TASK_STATUSES.includes(status)) throw new Error(`非法状态 ${status}（可选 ${TASK_STATUSES.join('/')}）`);
  const tasks = listTasks();
  const t = tasks.find((x) => x.id === id);
  if (!t) throw new Error(`任务不存在: ${id}`);
  t.status = status;
  t.updatedAt = new Date().toISOString();
  saveJson('tasks.json', { tasks });
  return t;
}

// ------------------------------------------------ 对话会话（与智能体聊天）
export function getSession(agentId) {
  const d = loadJson('chat.json', { sessions: {} });
  return d.sessions[agentId] || { agentId, messages: [], updatedAt: null };
}
export function appendMessages(agentId, messages) {
  const d = loadJson('chat.json', { sessions: {} });
  const s = d.sessions[agentId] || { agentId, messages: [], updatedAt: null };
  s.messages.push(...messages.map((m) => ({ ...m, ts: new Date().toISOString() })));
  if (s.messages.length > 200) s.messages = s.messages.slice(-200); // 会话窗口截断
  s.updatedAt = new Date().toISOString();
  d.sessions[agentId] = s;
  saveJson('chat.json', { sessions: d.sessions });
  return s;
}
export const taskStatuses = TASK_STATUSES;

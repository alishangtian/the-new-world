# AGENTS.md — 给在本仓库工作的所有 coding agent

> 你正在迭代的这是一个 **agent 平台**：人类在控制台上与智能体聊天、给它们下达任务。
> 平台本体是编排层（注册表 / 任务 / 工单 / 验收门 / 账本 / MCP）；智能由外部 OpenAI 兼容模型承担——平台不绑定任何供应商。

## 迭代原则（规定 · 必须遵守）

1. **小步可运行**：一轮迭代交付一个能通过验收门的完整功能，不合并半成品。
2. **零运行时依赖**：只用 Node 标准库与原生 Web API。引入任何依赖需要独立工单论证。
3. **厂商中立**：模型能力一律经 OpenAI 兼容端点（env 注入 `LLM_BASE_URL/LLM_API_KEY/LLM_MODEL`），代码里不出现供应商专名。
4. **账本只追加**：`docs/ITERATIONS.md` 是平台的记忆，每轮迭代登记一条（格式见文件顶部模板），永不改写历史。
5. **验收门不可绕过**：`node scripts/accept.mjs` 五门全绿才算完成；修改验收门本身需要独立工单并在账本声明。
6. **溯源与边界**：智能体注册表（`platform/agents.json`）每条身份必须写明工具授予与 `forbidden` 边界。
7. **宁缺毋滥**：做不到就开 `blocked` 工单说明原因，不写假装能用的代码。
8. **先读后写**：改代码前读 `docs/ITERATIONS.md` 最后两轮和 `.zcode/skills/world-builder/references/lessons.md`。

## 迭代流程

```
1. 读状态：docs/ITERATIONS.md 最后两轮 + platform/orders/ 工单池
2. 领单：open 工单置 claimed（写 claimedBy/claimedAt），或新建工单
3. 施工：遵循 platform/roles/ 对应角色契约
4. 验收：node scripts/accept.mjs  →  五门全绿
5. 记账：docs/ITERATIONS.md 追加 + BACKLOG.md/工单状态同步
6. 提交：迭代 NNN · <主题>，推送 origin/main
```

## 结构地图

```
index.html + console/     控制台（对话 / 任务 / 智能体 / 工单 / 迭代 / 接入）
platform/
  mcp/  core.mjs（工具核心）+ server.mjs（stdio）+ http.mjs（HTTP：控制台+API+/mcp）
  data-store.mjs          任务与会话存储（platform/data/，运行时态不入仓库）
  orders/                 迭代工单（机器可读）
  roles/                  角色契约：考察员/建造师/质检员/史官
  agents.json             智能体注册表（P12）
  scheduler.mjs           心跳派单（P9）
  PROTOCOL.md             平台协议（工单状态机/验收门）
deploy/k8s/               本机 k8s 部署清单（Namespace/Deployment/Service）
scripts/                  accept.mjs 验收门 · verify.mjs 体检 · build_console_state.mjs
LAWS.md                   平台设计原则 P1-P12
.zcode/skills/world-builder/  持续构建技能 + 实战教训（references/lessons.md）
```

## 运行与验收

```bash
python3 -m http.server 8000        # 本地静态预览（无 API 功能）
node platform/mcp/http.mjs         # 完整平台（控制台 + 任务 + 对话 + MCP，端口 3000）
node scripts/accept.mjs            # 验收门（每轮迭代必跑）
```

环境变量（对话功能）：`LLM_BASE_URL`（OpenAI 兼容端点，如 `http://host.docker.internal:11434/v1`）、`LLM_MODEL`、`LLM_API_KEY`（可选）。

## 当前能力与已知边界

- ✅ 对话（OpenAI 兼容端点接入后真实聊天）、任务看板（下达/流转，MCP 工具对 agent 可见）、
  智能体注册与构建、工单与验收门、账本、心跳派单、k8s 部署
- ⚠️ 运行时数据（任务/会话）存在容器/本地 `platform/data/`，不跨实例持久——持久化是迭代方向
- ⚠️ agent 执行循环（LLM 自动调工具）尚未实现——对话页聊天是自由对话，任务执行靠 coding agent 接工单

# 架构 · ARCHITECTURE

```
        人类 ──指挥/聊天──▶ 控制台（index.html + console/）
                                │ fetch /api/*（对话·任务·智能体·配置）
                                ▼
                    platform/mcp/http.mjs（运行时，一个进程三张脸）
                    ├── 静态控制台
                    ├── /api/tasks  /api/chat  /api/agents  /api/config
                    ├── POST /mcp   MCP Streamable HTTP（10 工具）
                    └── GET /healthz
                                │  LLM 缝隙（OpenAI 兼容端点，env 注入）
                                ▼
                    外部模型（Ollama / vLLM / LM Studio / 云厂商）
                    外部 coding agent（经 MCP 领工单迭代平台）

  数据：platform/data/（任务·会话，运行时态）
        platform/orders/ + agents.json + LAWS.md + docs/ITERATIONS.md（资产，入仓库）
```

## 分层原则

| 层 | 位置 | 规则 |
|----|------|------|
| 核心层 | platform/mcp/core.mjs | 12 个工具 + JSON-RPC 处理，不感知传输（P11） |
| 传输层 | server.mjs（stdio）/ http.mjs（HTTP） | 薄壳；stdio 服务本地 agent，HTTP 服务 k8s 与网络 agent |
| 界面层 | console/ | 只消费 /api/* 与 state.json，零依赖 |
| 数据层 | platform/data/（运行时）+ 资产文件（仓库） | 工作记忆与长期记忆分离（P7） |
| 治理层 | AGENTS.md · PROTOCOL.md · accept.mjs · 账本 | 迭代原则与验收门（P4/P5/P8） |

## 对话链路

```
POST /api/chat {agentId, message}
→ 会话历史（data-store，近 20 条）
→ system prompt = 智能体身份 + 角色契约（platform/roles/）
→ OpenAI 兼容 /chat/completions（LLM_BASE_URL/LLM_MODEL env）
→ 回复落会话 → 返回 {reply, llmUsed}
未配置端点：返回接入指引（平台不假装智能）。
```

## 任务链路

```
控制台「任务」页 / MCP create_task
→ platform/data/tasks.json（pending）
→ 指派智能体领取（MCP list_tasks）→ 状态流转（working/done）
→ 看板实时呈现
```

## k8s 部署

deploy/k8s/：Namespace + Deployment（/healthz 探针 + 资源限额 + LLM env）+ Service。
k3d 需 `k3d image import` 导入镜像；本机访问用 port-forward，长期入口建议 Ingress。

## 目录地图

```
index.html + console/          控制台（对话/任务/智能体/工单/迭代/接入）
platform/
  mcp/core.mjs                 工具核心（12 工具 + JSON-RPC）
  mcp/server.mjs               stdio 传输（本地 agent）
  mcp/http.mjs                 HTTP 传输 + 控制台服务（k8s 入口进程）
  mcp/smoke.mjs                冒烟自检
  scheduler.mjs                心跳派单（P9）
  data-store.mjs               任务/会话存储
  data/                        运行时数据（不入仓库）
  agents.json                  智能体注册表（P12）
  orders/                      工单
  roles/                       角色契约
  PROTOCOL.md                  平台协议
deploy/k8s/                    k8s 清单与文档
scripts/                       accept（验收门）/ verify（体检）/ build_console_state
AGENTS.md                      迭代原则与施工入口（coding agent 先读这里）
LAWS.md                        设计原则 P1-P12
docs/ITERATIONS.md             迭代账本（只追加）
BACKLOG.md                     工单总览
.zcode/skills/world-builder/   持续构建技能 + 实战教训
```

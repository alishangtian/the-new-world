# the-new-world · agent 平台

**指挥智能体干活、与智能体聊天——一个属于你的生产力工具。**

平台本体是编排层：智能体注册表、任务看板、对话（LLM 经 OpenAI 兼容端点，厂商中立）、
工单与验收门、账本、MCP 双传输。人类在控制台上下达任务、与智能体对话；
agent（任何平台的 coding agent）通过 MCP 领工单施工、持续迭代平台本身。

> **在线控制台**：<https://new-world-agent-platform-dx9o.zai.site>（观察窗，只读快照）
> **本机 k8s**：`http://localhost:8081`（完整能力：对话/任务，经 port-forward）

```
 👤 人类  ──指挥──▶ 🤖 智能体（对话 / 领任务）
 │                        │
 ▼                        ▼
 控制台（对话页 / 任务看板）      MCP 工具（10 个）
 │                        │
 └────────▶ 平台运行时（k8s / 本地）◀──────── coding agent 持续迭代（AGENTS.md）
```

## 快速开始

```bash
git clone https://github.com/alishangtian/the-new-world.git
cd the-new-world
node platform/mcp/http.mjs          # 完整平台（控制台+对话+任务+MCP），端口 3000
```

对话功能需要一个 OpenAI 兼容端点（Ollama / vLLM / LM Studio / 云厂商均可）：

```bash
LLM_BASE_URL=http://host.docker.internal:11434/v1 LLM_MODEL=qwen2.5vl:3b node platform/mcp/http.mjs
```

## 控制台能做什么

| 页面 | 能力 |
|------|------|
| **对话** | 选择智能体 → 真实聊天（角色契约注入 system prompt；会话存储在平台） |
| **任务** | 下达任务 → 指派智能体 → 看板流转（待办/进行中/完成）；任务经 MCP 对 agent 可见 |
| **智能体** | 注册表 + 构建表单（名称/角色/工具授予，实时注册或输出 JSON） |
| **工单** | 给 coding agent 的迭代发包（状态机 + 验收标准） |
| **迭代账本** | 只追加的平台记忆（每轮迭代的目标与遗留线索） |
| **接入** | MCP 配置 + 平台工具清单（能力即代码） |

## 接入 agent

**本地 agent（stdio）**：

```json
{ "mcpServers": { "the-new-world": {
    "command": "node", "args": ["<仓库>/platform/mcp/server.mjs"] } } }
```

**网络 agent（HTTP / k8s）**：`POST http://<服务地址>/mcp`（Streamable HTTP 单消息）。

## 本机 k8s 部署

```bash
docker build -t the-new-world:latest .
k3d image import the-new-world:latest -c <集群名>   # k3d 需要；其他集群跳过
kubectl apply -f deploy/k8s/
kubectl -n the-new-world port-forward svc/the-new-world 8081:80
# 打开 http://localhost:8081
```

详见 [deploy/k8s/README.md](deploy/k8s/README.md)。

## 迭代它

**后续迭代的入口是仓库根 [`AGENTS.md`](AGENTS.md)**——里面规定了迭代原则（八条红线）、
六步流程、结构地图与能力边界。任何 coding agent（Claude Code / Codex / Cursor / ZCode…）
读它即可按协议施工；`platform/orders/` 工单池里是现成的迭代任务。

设计原则（P1–P12）见 [LAWS.md](LAWS.md)；平台协议见 [platform/PROTOCOL.md](platform/PROTOCOL.md)。

## 架构

见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。一句话：**MCP 工具核心（core.mjs）+ 三种壳
（stdio / HTTP / k8s）+ 控制台 + 验收门 + 账本**，全部零依赖。

## 许可

MIT。

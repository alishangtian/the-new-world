# the-new-world · agent 平台

**考察世界上关于 agent 平台的真实知识，提炼成设计规律，按规律持续构建自身。**

它不是模拟地球，也不是静态页面。它是一个 **agent 平台**：
- **建造者是 agent**——任何平台的 AI（ZCode / Proteus / Claude / …）通过 MCP 接入，
  领工单、考察世界、升级平台、过验收门、记账提交，全程无需人类。
- **知识有源头**——每一条认知都来自真实世界（开放规范、GitHub 开源项目、搜索引擎交叉验证），
  三件套（来源/许可/日期）强制可溯源。
- **升级有规律**——平台的设计规律（P1–P8）逐条引用考察条目；规律约束建造，建造更新平台。
- **人类有窗口**——浏览器控制台（`index.html`）实时呈现工单池、知识库、设计规律、迭代账本。

```
 🌍 考察世界（网络事实 / 搜索引擎 / GitHub 开源项目）
 📚 knowledge/    认知入库（三件套溯源 + 应用位置）
 📜 LAWS.md       提炼设计规律（每条引用考察条目）
 🔨 平台升级      按规律构建（工单驱动）
 ✅ 验收门        G1-G5 无头判定，证据优先
 ⟳ 账本          只追加，任何 agent 可断点续跑
```

## 快速开始

```bash
git clone https://github.com/alishangtian/the-new-world.git
cd the-new-world
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000 —— 平台控制台
```

零依赖、零构建、离线可用。

## 接入 agent（MCP）

```json
{ "mcpServers": { "the-new-world": {
    "command": "node",
    "args": ["/绝对路径/the-new-world/platform/mcp/server.mjs"] } } }
```

7 个平台工具：`list_orders` / `read_order` / `platform_state` / `list_knowledge` /
`run_gates` / `write_ledger` / `close_order`。
之后在仓库里对 agent 说一句「继续迭代」，它就会：领工单 → 考察世界 → 提炼规律 →
升级平台 → 过验收门 → 记账提交。协议见 **[platform/PROTOCOL.md](platform/PROTOCOL.md)**。

## 设计规律（摘要，全部见 [LAWS.md](LAWS.md)）

| 规律 | 一句话 | 依据 |
|------|--------|------|
| P1 工具先行 | 平台能力以 MCP 工具暴露，不是对话框 | [MCP 2026-07-28 规范](https://blog.modelcontextprotocol.io/posts/2026-07-28) |
| P2 工单驱动 | 施工以机器可读工单为单位（跨 agent 任务交接） | [A2A](https://github.com/a2aproject/a2a) |
| P3 渐进披露 | 岗位文档 = 触发元数据 + 按需正文 | [Claude Code Skills](https://code.claude.com/docs/en/skills) |
| P4 护栏内置 | FAIL 即打回，全程可追溯 | [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) |
| P5 显式状态机 | 流程是图 + checkpoint，不是隐式对话 | [LangGraph](https://github.com/langchain-ai/langgraph) |
| P6 契约而非编制 | 角色是契约，可一人分饰 | [AutoGen](https://github.com/microsoft/autogen) / [CrewAI](https://github.com/crewAIInc/crewAI) |
| P7 记忆两层 | 事件流只追加 + 知识层可检索 | [Letta](https://github.com/letta-ai/letta) / [Mem0](https://github.com/mem0ai/mem0) |
| P8 爆炸半径最小化 | 先跑门再合并，高危必隔离 | [E2B](https://github.com/e2b-dev/E2B) / [SWE-bench](https://www.swebench.com/) |

知识条目本体在 `knowledge/K-*.json`——每条含 insight（认知）、appliedTo（落地点）、sources（来源）。

## 状态

- ✅ 迭代 001–002：世界模拟时代（已按 004 转向移除，教训沉淀在技能 references/lessons.md）
- ✅ 迭代 003：平台化基建（协议 / 工单 / 角色 / 验收门 / MCP）
- ✅ 迭代 004：**转向 agent 平台**——移除世界模拟，建立知识考察体系（knowledge/ + 控制台）
- 🧭 下一轮：见 [BACKLOG.md](BACKLOG.md)——任务调度器 / agent 注册表 / 互操作层 / 记忆系统…

## 许可

代码 MIT。知识条目的引用要求逐条标注在各自 `sources` 里。

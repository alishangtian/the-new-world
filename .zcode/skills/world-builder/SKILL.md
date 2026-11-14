---
name: world-builder
description: the-new-world 仓库的持续构建引擎——本仓库是 agent 平台（人类指挥智能体干活、聊天）。当用户要求"继续迭代"、"加功能"、"修平台问题"、开发平台能力，甚至只说"继续"时使用本技能，按 AGENTS.md 的迭代原则施工——即使没提"world-builder"。
---

# World Builder · 持续构建引擎

本仓库是一个 **agent 平台**（人类指挥智能体干活、聊天，生产力工具）。
你的职责是按 `AGENTS.md`（仓库根，迭代原则的法定入口）迭代它。

## 开工顺序

1. 读 `AGENTS.md`——迭代原则（8 条）与流程，这是宪法。
2. 读 `docs/ITERATIONS.md` 最后两轮 + `platform/orders/` 工单池。
3. 改代码前读 `.zcode/skills/world-builder/references/lessons.md`（十条实战教训）。

## 六步循环

```
SELECT 领单（orders/，claimed+claimedBy/claimedAt）
→ BUILD 施工（遵循 platform/roles/ 角色契约；对话/任务/控制台/MCP 均属平台面）
→ VERIFY 验收（node scripts/accept.mjs 五门全绿）
→ LEDGER 记账（docs/ITERATIONS.md 追加 + BACKLOG 同步）
→ COMMIT 提交（迭代 NNN · 主题，推送）
```

## 迭代方向参考（让"指挥 agent 干活、聊天"更好用）

任务执行循环（LLM 自动调 MCP 工具）· 会话持久化（k8s PVC）· A2A 互操作 ·
工具沙箱 · 评估基准 · 服务端工具权限过滤 · Ingress 稳定入口。

## 验收与提交

```bash
node scripts/accept.mjs   # 五门全绿才算完成
git commit -m "迭代 NNN · <主题>：<一句话>" && git push
```

## 红线

零依赖 · 厂商中立（OpenAI 兼容端点 env 注入）· 账本只追加 · 检查器不可自改 ·
溯源强制 · 宁缺毋滥 · 小步可运行。详见 `AGENTS.md`。

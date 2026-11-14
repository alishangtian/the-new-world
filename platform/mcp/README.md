# the-new-world · MCP 服务器

把世界建造平台暴露为 MCP 工具。零依赖（纯 Node 标准库，stdio 传输）。

## 接入

任何支持 MCP 的 agent 平台（ZCode / Proteus / Claude Desktop / …）加一段配置：

```json
{
  "mcpServers": {
    "the-new-world": {
      "command": "node",
      "args": ["/绝对路径/the-new-world/platform/mcp/server.mjs"]
    }
  }
}
```

## 工具一览

| 工具 | 作用 | 副作用 |
|------|------|--------|
| `list_orders` | 列工单（按优先级降序） | 无 |
| `read_order {id}` | 读工单全文（目标/线索/验收标准） | 无 |
| `platform_state` | 知识/规律/迭代履历/工单分布/下一张待领 | 无 |
| `list_knowledge {topic?}` | 列知识库考察条目（可按主题过滤） | 无 |
| `run_gates` | 跑无头验收门，返回 PASS/FAIL + 报告 | 只读 + 临时进程 |
| `write_ledger {iteration_id, entry_markdown}` | 追加迭代账目（格式与唯一性校验） | ITERATIONS.md |
| `close_order {id, delivered_in}` | 工单置为 delivered | orders/*.json |
| `dispatch_next {dry?}` | 调度器：回收超时认领 + 派发下一张 auto-ok 工单 + 生成施工包 | orders/ + dispatch/ + schedule.json |

典型一轮迭代（纯 agent，无人类参与）：

```
world_state → read_order(最高优先级) → 勘测/建砖/接线（按 world-builder 技能）
→ run_gates（PASS）→ write_ledger → close_order → git commit + push
```

## 设计边界

- 服务器只动 `platform/orders/` 与 `docs/ITERATIONS.md`——世界本体（src/data）由 agent
  按协议手工施工；`run_gates` 只调用 `scripts/accept.mjs`，不复制也不绕过它。
- 校验在服务端强制：账本格式、迭代号唯一性、工单状态机，不合规直接 isError。
- 日志走 stderr，stdout 只承载协议消息（stdio 传输纪律）。

## 自检

```bash
node platform/mcp/smoke.mjs   # 被 scripts/accept.mjs 的 G3 门与 CI 调用
```

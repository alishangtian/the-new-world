# 贡献指南 · 如何给世界添一块砖

本仓库欢迎两种贡献：**新的知识砖块** 与 **更好的数据/规律**。流程对人类与 AI 一视同仁。

## 快速开始

```bash
git clone https://github.com/alishangtian/the-new-world.git
cd the-new-world
python3 -m http.server 8000        # 打开 http://localhost:8000（必须 HTTP）
```

可选：更新数据（需要联网，产物会覆盖 data/ 下文件）

```bash
python3 scripts/fetch_data.py      # 可重复运行
node scripts/verify.mjs            # 体检
```

## 添加一块知识砖（10 分钟版）

1. **取证**：找到权威数据源（世界银行 / OWID / GitHub 开源项目），确认许可证允许再分发。
   把转换逻辑写进 `scripts/fetch_data.py`，产物落 `data/`，来源写进 `docs/DATA_SOURCES.md`。
2. **建砖**：复制 `src/modules/links.js` 的骨架（或阅读技能 `.zcode/skills/world-builder/SKILL.md`
   里的完整模板），新建 `src/modules/<id>.js`，在 `src/main.js` 加一行 import。
3. **立法**：实现的规律登记 `LAWS.md`；简化假设写进"诚实声明"；砖块 `laws`/`sources` 字段填好。
4. **验收**：`node scripts/verify.mjs` 全绿 → 起 HTTP 服务在浏览器里开关这块砖、拖拽、点击、拨时间轴。
5. **提交**：`砖 · <主题>：<一句话>`。

## 规则

- 零运行时依赖：不引入任何框架/库（Node 工具链仅用于采集与体检脚本）。
- 每个数字可溯源：界面点得到来源，仓库查得到许可与取数日期。
- 历史是数据，未来是规律：不修饰观测值；外推必须标注假设。
- 性能预算 60fps：拖慢帧率的砖块先优化绘制方式，而不是砍数据。
- 一块砖出错只下线自己（引擎已做故障隔离），但不允许明知有错合并。

## AI 协作者

本仓库内置 `world-builder` 技能（`.zcode/skills/world-builder/`）——
在 ZCode 中于本仓库内要求"新增一个世界模块"等即会自动加载施工手册；
`references/lessons.md` 记录了初建时踩过的全部坑，动代码前值得一读。

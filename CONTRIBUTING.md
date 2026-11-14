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

## 如何贡献：运行一轮迭代

本项目的贡献单位是「迭代」。完整规程以 `.zcode/skills/world-builder/SKILL.md` 为准，
概要如下（七步，顺序执行）：

1. **SELECT**：从 `BACKLOG.md` 取候选，或由 issue/讨论指定主题；一轮 = 一块砖。
2. **RESEARCH**：取证（开放 API / GitHub 开源 / 搜索交叉验证），记录 URL + 许可 + 取数日期；
   抽样核对已知值；取不到可信数据就中止并在 BACKLOG 记 blocker。
3. **ENCODE**：转换逻辑进 `scripts/fetch_data.py`，产物进 `data/`（随仓库提交）。
4. **WIRE**：新建 `src/modules/<id>.js`（契约见 `src/engine/modules.js`），`main.js` 加 import；
   规律登记 `LAWS.md`。
5. **VERIFY**：`node scripts/verify.mjs` 全绿 + 浏览器交互验收（起服务、开关砖、拖/点/拨）。
6. **LEDGER**：`docs/ITERATIONS.md` 追加一轮，`BACKLOG.md` 勾选，`docs/DATA_SOURCES.md` 登记。
7. **COMMIT**：`迭代 NNN · <主题>：<一句话>`，推送。

踩坑先读 `.zcode/skills/world-builder/references/lessons.md`——十条教训，每条都真实发生过。

## 规则

- 零运行时依赖：不引入任何框架/库（Node 工具链仅用于采集与体检脚本）。
- 每个数字可溯源：界面点得到来源，仓库查得到许可与取数日期。
- 历史是数据，未来是规律：不修饰观测值；外推必须标注假设。
- 性能预算 60fps：拖慢帧率的砖块先优化绘制方式，而不是砍数据。
- 一块砖出错只下线自己（引擎已做故障隔离），但不允许明知有错合并。

## AI 协作者

本仓库的 `world-builder` 技能是**持续迭代引擎**：在本仓库内说「继续迭代」「加一块砖」
「更新数据」等即会自动加载并驱动一轮完整迭代。历史迭代见 `docs/ITERATIONS.md`，
下一轮从 `BACKLOG.md` 选题。

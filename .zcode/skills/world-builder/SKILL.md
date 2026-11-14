---
name: world-builder
description: the-new-world 仓库的持续迭代引擎——每次被要求"继续/迭代/新增/扩展世界"、"加一块砖"、"更新数据"、"再做一个"，甚至只是在本仓库说"继续"时，运行一轮完整的迭代循环：选题→取证→编码→接线→验收→记账→提交。本仓库是持续迭代的项目，一切页面与数据都是迭代的产物；没有说"world-builder"也要用本技能。
---

# World Builder · 持续迭代引擎

本仓库是一个**持续迭代的项目**：它对现实世界的认知以"迭代"为单位生长，
每轮迭代产出一块可溯源的知识砖并合并进世界。任何页面、数据、文档都只是
历次迭代的产物——**本技能才是项目的第一交付物**，它保证任何一个人（或 AI）
在不了解历史对话的情况下，也能驱动下一轮迭代。

## 开工前：先读世界当前的状态（顺序固定）

1. 读 `docs/ITERATIONS.md` 的**最后两轮**——世界现在长什么样、上轮留了什么线索。
2. 读 `BACKLOG.md`——需求池与优先级。
3. 动手写代码前读 `.zcode/skills/world-builder/references/lessons.md`——十条实战教训，每条都浪费过一轮调试。

## 迭代循环（七步，顺序执行，不许跳步）

```
SELECT → RESEARCH → ENCODE → WIRE → VERIFY → LEDGER → COMMIT
```

### 1. SELECT 选题
- 用户指定了主题 → 直接用。
- 没指定 → 从 `BACKLOG.md` 取最高优先级的候选。
- 一轮迭代 = **一块砖**（一个可独立验收的认知单元）。不允许多砖混着半成品合并。

### 2. RESEARCH 取证（认知来自真实世界）
- 来源优先级：官方开放 API > GitHub 开源数据项目 > 权威网页事实（搜索引擎交叉验证）。
- 每个数据集记录三件事：**来源 URL、许可证、取数日期**。
- 先抽样核对 2–3 个已知值（例如"中国 2024 人口 ≈ 14.09 亿"），再全量转换。
- 取不到可信数据的候选 → 停止本轮，在 `BACKLOG.md` 该项下记录 blocker，**不合并猜测性内容**。

### 3. ENCODE 编码（认知进代码）
- 数据转换逻辑写进 `scripts/fetch_data.py`（幂等、可重复运行），产物落 `data/*.json`（随仓库提交，世界必须离线可用）。
- 贵的几何预计算（单位向量、质心）；数据形状先在 fetch 脚本里收窄成砖块易消费的最小形态。

### 4. WIRE 接线（一块砖一个文件）
- 新模块 `src/modules/<id>.js`，遵守契约（`src/engine/modules.js` 注释）：
  `id / name / order / laws / sources / render(env)`，`src/main.js` 加一行 import 即上线。
- 面板、开关由 UI 依据砖块静态描述自动生成——砖块不碰 DOM。
- 实现的规律登记 `LAWS.md`（公式/依据/简化假设），砖块 `laws` 数组与之呼应。

### 5. VERIFY 验收（两道门，都不可跳）
```bash
node scripts/verify.mjs        # 门一：数据完整性 + 砖块契约 + 无头渲染 + 拾取回归，全绿
python3 -m http.server 8000    # 门二：浏览器交互验收
```
- 浏览器里实际操作：开关新砖、拖拽旋转、点击国家、拨时间轴；`window.__world` 是诊断口
  （`engine.errors` 看被隔离的故障；离屏 canvas 单渲某块砖数像素可定位"无错误无画面"类问题）。
- 帧率显著下降 → 先合批/预计算，不许砍数据交差。

### 6. LEDGER 记账（迭代以账本为准）
- `docs/ITERATIONS.md` 追加一轮（格式见该文件顶部模板）：目标/来源/产物/新规律/验收证据/提交号/遗留线索。
- `BACKLOG.md` 勾掉已完成项；`docs/DATA_SOURCES.md` 登记新数据集。

### 7. COMMIT 提交
- 提交信息用砖块叙事：`迭代 NNN · <主题>：<一句话>`。
- 推送到 `origin/main`。本轮结束；下一轮从 SELECT 重新开始。

## 完成定义（DoD，逐条过）

- [ ] 数据可溯源：URL + 许可证 + 取数日期三件套齐
- [ ] 离线可用：新数据随仓库提交，`file` 之外无任何运行时请求
- [ ] 规律入册：LAWS.md 有编号，简化假设诚实标注
- [ ] `verify.mjs` 全绿
- [ ] 浏览器交互验收通过（亲眼看到砖在工作，且拖/点/拨不坏）
- [ ] 账本三件套已更新（ITERATIONS / BACKLOG / DATA_SOURCES）

## 中止规则

取证失败、数据不可信、或验收过不了 → 本轮中止：
在 `BACKLOG.md` 记录 blocker 与已探明的事实，不合并任何半成品。世界宁缺毋滥。

## 项目运行规律（红线，任何时候不许破）

1. **零运行时依赖**——原生 ESM + Canvas 2D，不引框架不引库。
2. **每个数字可溯源**——界面点得到来源，仓库查得到许可。
3. **历史是数据，未来是规律**——不修饰观测值；外推必须标注为假设。
4. **60fps 性能预算**。
5. **领先，不是落后**——实现方式先问"这个领域现在最好的做法是什么"。

## 新砖骨架（复制即用）

```js
import { registerModule } from '../engine/modules.js';
import { ll2v, rot } from '../engine/math3.js';
const TMP = [0, 0, 0];

export default registerModule({
  id: '<id>', name: '<中文名 · 副题>', order: 60,
  laws: ['L? <规律名>：<公式>（简化假设）'],
  sources: [{ label: '<数据集>（许可）', url: 'https://…' }],
  _prepare(data) { this.items = data.<key>.map((d) => ({ ...d, v: ll2v(d.lat, d.lon, [0, 0, 0]) })); },
  render(env) {
    if (!this.items) this._prepare(env.data);
    const { ctx, cx, cy, R } = env, m = env.cam.m;   // rot 要 cam.m 矩阵，不是相机对象
    for (const it of this.items) {
      const p = rot(m, it.v, TMP);
      if (p[2] <= 0.02) continue;
      ctx.beginPath(); ctx.arc(cx + R * p[0], cy - R * p[1], 2, 0, 6.2832); ctx.fill();
    }
  },
});
```

然后：LAWS.md 立法 → verify.mjs 全绿 → 浏览器验收 → 记账 → 提交。

---
name: world-builder
description: 在 the-new-world 仓库中构建与扩展"用代码堆砌的现实世界"——查证网络与开源数据、以知识砖块编码世界认知、登记运行规律、在浏览器交互验收。当用户要求新增世界模块/数据层/运行规律、更新数据、修复世界渲染问题、或运行/验收 the-new-world 时使用——即使没有明说"world-builder"。
---

# World Builder · 世界施工手册

本仓库是一个"用代码堆砌的现实世界"：真实数据是砖，简洁规律是梁，浏览器交互是窗。
你的任务是延续这套施工法，让世界持续长大——每一块新砖都要能溯源、能运行、能被看见。

## 施工流程（六步，缺一不可）

### 1. 选题：找到一块值得砌的砖
现实世界的任何一个系统都可以入世界：洋流、季风、板块、贸易流、语言谱系、疾病传播……
选的标准：**有公开权威数据 + 有简洁规律可写 + 有可视化戏剧性**。三者缺一，换一块。

### 2. 取证：认知必须来自真实世界
- 优先级：官方 API（世界银行、OWID）> GitHub 开源数据项目（Natural Earth、world-atlas）> 权威网页事实（用搜索交叉验证）。
- 每个数据集记录三件事：**来源 URL、许可证、取数日期**——写进 `docs/DATA_SOURCES.md` 与数据的 `meta` 字段。
- 数据转换逻辑写进 `scripts/fetch_data.py`（可重复运行、幂等），产物提交进 `data/`——世界必须离线可用。
- 先小样本验证数据形状（抽 2-3 个已知值核对，如"中国 2024 人口 ≈ 14.09 亿"），再全量转换。

### 3. 建砖：一个文件一块砖
- 新模块 = `src/modules/<id>.js`，遵守契约（id/name/order/laws/sources/render，见 `src/engine/modules.js` 注释）。
- 在 `src/main.js` 加一行静态 import——import 即注册，注册即上线。
- 砖块不得直接操作 DOM；面板、开关由 `src/ui/panel.js` 依据砖块静态描述自动生成。
- 需要新数据形态时扩展 `data/`，由 `scripts/fetch_data.py` 产出。
- 预计算贵的几何（单位向量、质心），渲染每帧只做投影与绘制。

### 4. 立法：规律要写进 LAWS.md
砖块实现的每条规律（公式、现实依据 URL、简化假设）登记到 `LAWS.md`，并在砖块的 `laws` 数组中呼应。
**历史是数据，未来是规律**——观测末端之前插值忠于数据，之后才允许规律外推；外推参数必须如实标注为假设。

### 5. 上浏览器验收（不可跳过）
```bash
python3 -m http.server 8000   # 仓库根目录；必须走 HTTP，file:// 加载不了数据
```
- 用浏览器打开 http://localhost:8000 ，截图确认视觉，再实际交互：开关该砖、拖拽旋转、点击国家、拨动时间轴。
- Canvas 问题优先页内探针定位：`window.__world` 暴露了引擎，可evaluate 单独渲染某块砖到离屏 canvas 数像素。
- 常见坑见 `references/lessons.md`（本仓库施工中真实踩过的坑，先读它再动手）。

### 6. 体检与提交
```bash
node scripts/verify.mjs   # 数据完整性 + 砖块契约 + 无头渲染 + 拾取回归
```
- 体检全绿才允许提交。新数据源要同步更新 `docs/DATA_SOURCES.md`。
- 提交信息用"砖块叙事"：`砖 · 洋流：加入 25 条主要洋流路径（NOAA）`。

## 质量红线（领域领先，不是落后）

1. **零运行时依赖**：原生 ESM + Canvas 2D，不引框架不引库；离线打开也能跑。
2. **每个数字可溯源**：界面上点得到来源链接，仓库里查得到许可证。
3. **诚实标注假设**：外推、简化、静态化的地方明说，不冒充观测事实。
4. **性能预算 60fps**：新增砖块若拖慢帧率，先预计算/合批，而非降低数据量。
5. **规律优先于特效**：先问"这条视觉背后是哪条现实规律"，答不上来就别加。

## 新砖块骨架（可直接复制）

```js
// 砖块 · <名称> —— <一句话：它把现实的哪一面编码进世界>
import { registerModule } from '../engine/modules.js';
import { ll2v, rot } from '../engine/math3.js';

const TMP = [0, 0, 0];

export default registerModule({
  id: '<id>',
  name: '<中文名 · 副题>',
  order: 60,                       // 层序：星海0 / 大地10 / 昼夜20 / 生命30 / 联结40 / 碳50
  laws: ['L? <规律名>：<公式或关系>（简化假设）'],
  sources: [{ label: '<数据集名>（许可）', url: 'https://…' }],

  _prepare(data) {                 // 首帧惰性预计算，别在 render 里重复做
    this.items = data.xxx.map((d) => ({ ...d, v: ll2v(d.lat, d.lon, [0, 0, 0]) }));
  },

  render(env) {
    if (!this.items) this._prepare(env.data);
    const { ctx, cx, cy, R, cam } = env;
    const m = cam.m;               // 注意：rot 要的是矩阵 cam.m，不是相机对象
    for (const it of this.items) {
      const p = rot(m, it.v, TMP);
      if (p[2] <= 0.02) continue;  // 地平线以下不画
      ctx.fillStyle = 'rgba(…)';
      ctx.beginPath(); ctx.arc(cx + R * p[0], cy - R * p[1], 2, 0, 6.2832); ctx.fill();
    }
  },
});
```

完成后：LAWS.md 登记 → verify.mjs 全绿 → 浏览器截图验收 → 提交。

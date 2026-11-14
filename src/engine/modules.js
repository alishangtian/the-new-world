// 模块注册表 —— 本世界的第二条施工规律：一块砖一个文件，注册即上线。
//
// 知识砖块契约（缺一不可，CI 会校验）：
//   id      唯一标识
//   name    展示名（中文）
//   order   渲染层序（小的先画）
//   laws    该砖块实现/遵循的运行规律（与 LAWS.md 呼应）
//   sources 认知来源 [{label, url}] —— 每一个数字都要能溯源
//   render(env) 每帧绘制；env 由引擎注入（画布、镜头、时间、数据、仿真器）
//   enabled 是否启用（面板开关控制，默认 true）
// 砖块不得直接操作 DOM —— 界面由 ui/panel.js 依据静态描述自动生成。

const registry = [];

export function registerModule(mod) {
  if (!mod || !mod.id || !mod.name || typeof mod.render !== 'function') {
    throw new Error(`模块不符合契约: ${mod && mod.id || '(无名)'}`);
  }
  mod.laws = mod.laws || [];
  mod.sources = mod.sources || [];
  mod.enabled = mod.enabled !== false;
  registry.push(mod);
  registry.sort((a, b) => a.order - b.order);
  return mod;
}

export const getModules = () => registry;

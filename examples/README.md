# Axial2.5D Examples

标准 TypeScript 示例应用：单页面 + 左侧导航列表，通过 hash 路由切换 4 个演示。

## 📁 目录结构

```
examples/
├── index.html            # 应用外壳（导航列表 + 演示容器）
├── style.css             # 导航与各演示共享样式
├── main.ts               # hash 路由器（#/standalone、#/framework …）
├── demos/
│   ├── types.ts          # Demo 接口契约
│   ├── standalone.ts     # 纯 Canvas 2D 多图层演示（零框架代码）
│   ├── framework.ts      # 手动集成框架组件（Game + 控制器 + 渲染钩子）
│   ├── phase5.ts         # 模块系统自动装配（Phase 5）
│   └── phase6.ts         # 配置系统 + 多 tile 实体自动拆分（Phase 6）
└── README.md             # 本文件
```

## 🚀 运行

```bash
npm run dev
# 浏览器自动打开 http://localhost:3001/examples/index.html
```

点击左侧导航切换演示，也可直接访问 hash 地址：

| 演示 | 地址 | 说明 |
|------|------|------|
| Standalone | `#/standalone` | 手写投影/视差/相机，展示框架自动化的基线 |
| Framework | `#/framework` | 手动接线 LayerManager、CameraController、OcclusionSystem 等 |
| Phase 5 · Modules | `#/phase5` | ModuleManager 自动装配 + UI 绑定 + 滑块配置 |
| Phase 6 · Multi-Tile | `#/phase6` | 大体积建筑自动拆分为多个渲染单元 |

## 🧩 Demo 契约

每个演示实现 `demos/types.ts` 中的 `Demo` 接口：

```ts
export interface Demo {
  id: string;                                 // hash 路由 id
  title: string;                              // 导航列表显示名
  description: string;                        // 导航列表描述
  mount(container: HTMLElement): () => void;  // 挂载，返回清理函数
}
```

- `mount` 在容器内构建 DOM、启动游戏循环；
- 返回的清理函数在切换演示时调用（停止 RAF、销毁 InputManager、移除事件监听）；
- 路由器会清空容器 DOM，因此各演示内的元素 `id` 互不冲突。

### 添加新演示

1. 在 `demos/` 新建 `my-demo.ts`，导出实现 `Demo` 接口的对象；
2. 在 `main.ts` 中 import 并加入 `demos` 数组；
3. 完成 — 导航项与路由自动生成。

## 🆚 演示对比

| 演示 | 框架 | 模块系统 | 多 tile 实体 | 用途 |
|------|:----:|:--------:|:------------:|------|
| standalone.ts | ❌ | ❌ | ❌ | 理解底层原理 |
| framework.ts | ✅ | ❌ | ❌ | 学习手动集成 |
| phase5.ts | ✅ | ✅ | ❌ | 学习模块系统 |
| phase6.ts | ✅ | ✅ | ✅ | 学习配置系统与多 tile |

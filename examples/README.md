# Axial2.5D Examples

示例分为两类：**HTML 示例**（直接在浏览器运行）和 **TypeScript 示例**（需要编译）。

## 📁 目录结构

```
examples/
├── html/                    # HTML 示例（直接在浏览器打开）
│   ├── standalone.html      # 独立演示 - 完整功能，无需编译
│   └── framework.html       # 框架示例 - 使用框架 API
├── ts/                      # TypeScript 示例（需要编译）
│   ├── demo.ts              # 基础演示
│   ├── game-demo.ts         # 完整游戏演示
│   └── advanced-demo.ts     # 高级功能演示
└── README.md                # 本文件
```

## 🌐 HTML 示例

### standalone.html
**特点：** 完整功能演示，无需编译，直接在浏览器打开
- 5 层视差滚动
- 动态云朵
- 建筑渲染
- 完整交互控制

**运行方式：**
```bash
npm run server
# 访问 http://localhost:3000
```

### framework.html
**特点：** 使用框架 API 编写，展示正确的集成方式
- 导入框架模块
- 使用 LayerManager
- 适合学习框架用法

**运行方式：**
```bash
npm run dev
# 访问 http://localhost:3001/examples/html/framework.html
```

## 💻 TypeScript 示例

### demo.ts
基础演示，展示框架核心功能。

**运行方式：**
```bash
npm run demo
```

### game-demo.ts
完整游戏演示，包含实体、输入、UI 等系统。

**运行方式：**
```bash
# 编译后运行
npm run build
node dist/examples/game-demo.js
```

### advanced-demo.ts
高级功能演示，展示图层、相机、渲染等高级特性。

**运行方式：**
```bash
npm run build
node dist/examples/advanced-demo.js
```

## 🚀 快速开始

**推荐新手：** 从 `html/framework.html` 开始，了解框架 API 用法。

**快速体验：** 运行 `npm run server` 访问 `standalone.html` 体验完整功能。

**开发者：** 查看 `ts/` 目录中的 TypeScript 示例，学习如何在项目中使用框架。

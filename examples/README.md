# Axial2.5D Examples

示例分为两类：**HTML 示例**（直接在浏览器运行）和 **TypeScript 示例**（需要编译）。

## 📁 目录结构

```
examples/
├── html/                    # HTML 示例（直接在浏览器打开）
│   ├── standalone.html      # 独立演示 - 完整功能，无需编译
│   └── framework.html       # 框架示例 - 使用框架 API
├── ts/                      # TypeScript 示例（需要编译）
│   └── demo.ts              # 基础演示
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
- Vite 热重载，开发体验好

**运行方式：**
```bash
npm run dev
# 访问 http://localhost:3001/examples/html/framework.html
```

## 💻 TypeScript 示例

### demo.ts
基础演示，展示框架核心功能（Node.js 环境运行）。

**运行方式：**
```bash
npm run demo
```

## 🚀 快速开始

| 目的 | 推荐示例 | 命令 |
|------|----------|------|
| **快速体验** | `standalone.html` | `npm run server` |
| **学习框架** | `framework.html` | `npm run dev` |
| **Node.js 集成** | `demo.ts` | `npm run demo` |

## 🎯 示例对比

| 示例 | 编译 | 环境 | 用途 |
|------|------|------|------|
| standalone.html | ❌ | 浏览器 | 完整功能演示 |
| framework.html | ✅ (Vite) | 浏览器 | 学习框架 API |
| demo.ts | ✅ (tsc) | Node.js | 服务端/CLI 集成 |

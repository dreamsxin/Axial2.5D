# Axial2.5D

基于 Canvas 2D API 的 2.5D 等距/二测游戏框架。

A Canvas 2D API isometric/dimetric game framework.

## 📁 项目结构 Project Structure

```
Axial2.5D/
├── src/                          # 框架源代码 Framework Source
│   ├── core/                     # 核心模块 Core
│   │   ├── Projection.ts         # 投影变换 Projection
│   │   ├── IsoCamera.ts          # 相机系统 Camera
│   │   ├── CanvasRenderer.ts     # 渲染器 Renderer
│   │   ├── Layer.ts              # 图层类 Layer
│   │   ├── LayerManager.ts       # 图层管理器 Layer Manager
│   │   ├── Game.ts               # 游戏主类 Game
│   │   └── types.ts              # 类型定义 Types
│   ├── world/                    # 世界管理 World
│   │   ├── GridSystem.ts         # 网格系统 Grid
│   │   ├── GridLines.ts          # 网格线 Grid Lines
│   │   ├── EntityManager.ts      # 实体管理 Entity
│   │   ├── PathFinder.ts         # 寻路系统 Pathfinding
│   │   ├── IsoPrimitive.ts       # 3D 几何体基类 Primitives
│   │   ├── IsoBox.ts             # 3D 盒子/建筑 Boxes
│   │   └── IsoSprite.ts          # 精灵/角色 Sprites
│   ├── input/                    # 输入处理 Input
│   │   └── InputManager.ts       # 输入管理器 Input
│   ├── ui/                       # UI 系统 UI
│   │   └── UIManager.ts          # UI 管理器 UI Manager
│   ├── debug/                    # 调试工具 Debug
│   │   └── DebugSystem.ts        # 调试系统 Debug
│   ├── scene/                    # 场景管理 Scene
│   │   └── SceneManager.ts       # 场景管理器 Scene Manager
│   ├── resource/                 # 资源管理 Resource
│   │   └── ResourceManager.ts    # 资源管理器 Resource
│   ├── utils/                    # 工具类 Utils
│   │   └── EventBus.ts           # 事件总线 Event Bus
│   └── index.ts                  # 主入口 Entry Point
├── examples/                     # 示例 Examples
│   ├── demo-standalone.html      # 独立演示（无需编译）Standalone Demo
│   ├── web-example.html          # 框架示例（使用 API）Framework Example ⭐
│   ├── demo.ts                   # Node.js 演示 CLI Demo
│   ├── game-demo.ts              # 完整游戏演示 Game Demo
│   └── advanced-demo.ts          # 高级功能演示 Advanced Demo
├── public/                       # 静态资源 Static Assets
│   └── assets/                   # 图片/音频等 Assets
├── server/                       # 服务器 Server
│   └── demo-server.js            # HTTP 服务器 HTTP Server
├── tests/                        # 测试 Tests
│   └── index.ts                  # 单元测试 Unit Tests
├── docs/                         # 文档 Documentation
├── dist/                         # 编译输出 Build Output (generated)
├── package.json                  # 项目配置 Package Config
├── tsconfig.json                 # TypeScript 配置 TS Config
└── README.md                     # 项目说明 Documentation
```

## 🚀 快速开始 Quick Start

### 方式 1：开发模式（推荐）Development Mode

```bash
# 安装依赖
npm install

# 启动开发服务器（自动打开框架示例）
npm run dev

# 浏览器访问：http://localhost:3001
```

**特点：**
- 使用框架 API 编写的正式示例
- 展示正确的集成方式
- 适合学习和参考

### 方式 2：独立演示 Standalone Demo

```bash
# 启动演示服务器
npm run server

# 浏览器访问：http://localhost:3000
```

**特点：**
- 独立 HTML 文件，无需编译
- 包含所有功能的交互式演示
- 适合快速体验和测试

### 方式 3：命令行演示 CLI Demo

```bash
# 运行基础演示
npm run demo

# 运行测试
npm run test
```

## 📖 使用框架 Using the Framework

### 1. 安装 Installation

```bash
npm install axial-2-5d
```

### 2. 基础示例 Basic Example

```typescript
import { Game, LayerManager, Projection } from 'axial-2-5d';

// 创建游戏实例
const game = new Game({
  width: 800,
  height: 600,
  projection: {
    type: 'isometric',
    viewAngle: 45
  }
});

// 创建地图
const mapData = {
  width: 12,
  height: 12,
  tileW: 50,
  tileH: 50,
  tiles: [] // 填充地图数据
};

// 初始化游戏
game.init(mapData);

// 创建图层系统
const layers = game.layerManager.createStandardLayers(0, 2000, 5, {
  zIndexStep: 30,        // Z 轴间距
  parallaxRange: 0.7,    // 视差范围 (0.0-1.0)
  foregroundAlpha: 0.6   // 前景透明度
});

// 启动游戏
game.start();
```

### 3. 图层系统 Layer System

```typescript
// 创建 5 个图层，深度范围 0-2000
const layers = layerManager.createStandardLayers(0, 2000, 5, {
  // 前景透明度（Layer 4）
  foregroundAlpha: 0.6,
  
  // 背景透明度（Layer 0）
  backgroundAlpha: 1.0,
  
  // Z 轴间距（每层偏移像素）
  zIndexStep: 30,
  
  // 视差范围系数（0.0-1.0）
  // Layer 0 = 30%, Layer 4 = 30% + range
  parallaxRange: 0.7,
  
  // 背景基础视差（默认 30%）
  backgroundParallax: 0.3
});

// 图层属性
layers.forEach(layer => {
  console.log(`Layer ${layer.id}:`);
  console.log(`  Depth: ${layer.depthMin} - ${layer.depthMax}`);
  console.log(`  Parallax: ${(layer.parallaxFactor * 100).toFixed(0)}%`);
  console.log(`  Alpha: ${(layer.alpha * 100).toFixed(0)}%`);
  console.log(`  Z-Offset: ${layer.zIndexOffset}px`);
});
```

### 4. 实体管理 Entity Management

```typescript
import { IsoBox, IsoCharacter } from 'axial-2-5d';

// 创建 3D 建筑
const building = new IsoBox('house', 5, 5, 80, 80, 60);
building.setFaceColors([
  '#f5deb3', // top
  '#deb887', // front-right
  '#cd853f', // front-left
  '#b8860b', // back-right
  '#daa520', // back-left
  '#8b4513'  // bottom
]);
entityManager.addEntity(building);

// 创建角色
const player = new IsoCharacter('hero', 3, 3, 'hero_sprite', {
  width: 32,
  height: 48,
  anchorY: 1.0
});
entityManager.addEntity(player);
```

### 5. 相机控制 Camera Controls

```typescript
// 跟随玩家
game.centerCameraOnEntity('player');

// 手动设置位置
game.setCameraPosition(100, 200);

// 缩放
game.renderer.camera.zoom(1.1);  // 放大
game.renderer.camera.zoom(0.9);  // 缩小

// 平移
game.renderer.camera.pan(50, 30);
```

## 🎮 配置选项 Configuration

### 投影类型 Projection Types

**等距投影 Isometric:**
```typescript
{
  type: 'isometric',
  viewAngle: 45  // 标准等距
}
```

**二测投影 Dimetric:**
```typescript
{
  type: 'dimetric',
  viewAngle: 45,  // 水平旋转
  tiltAngle: 30   // 俯仰角
}
```

### 图层配置 Layer Options

```typescript
{
  // 视差范围：控制深度感强度
  // 0.0 = 所有图层同步移动（无深度感）
  // 0.7 = 中等深度感（默认）
  // 1.0 = 最大深度感
  parallaxRange: 0.7,
  
  // Z 轴间距：每层之间的垂直偏移（像素）
  // 0 = 所有图层重叠
  // 30 = 每层相差 30px
  zIndexStep: 30,
  
  // 前景透明度（Layer 4）
  foregroundAlpha: 0.6,
  
  // 背景透明度（Layer 0）
  backgroundAlpha: 1.0
}
```

## 🛠️ 开发命令 Development Commands

```bash
# 编译框架
npm run build

# 开发模式（自动打开框架示例）
npm run dev

# 监视模式（自动重新编译）
npm run dev:watch

# 运行测试
npm run test

# 启动演示服务器
npm run server

# 运行 CLI 演示
npm run demo

# 清理编译输出
npm run clean
```

## 🧪 测试 Testing

```bash
# 运行单元测试
npm test

# 输出示例：
# Tests: 29
# Passed: 29
# Failed: 0
```

## 📊 核心特性 Features

- 📐 **等距/二测投影** - 支持多种视角配置
- 🎨 **深度排序** - 自动处理遮挡关系
- 🗺️ **网格系统** - 完整的地图数据管理
- 🎭 **实体系统** - 角色、建筑等游戏对象
- 🖱️ **输入处理** - 鼠标/键盘/触摸支持
- 🎨 **UI 系统** - 对话框、按钮等 UI 组件
- 🔍 **调试工具** - FPS、网格、坐标显示
- 📦 **资源管理** - 图片、音频、图集加载
- 🎬 **场景管理** - 多场景切换支持
- ✏️ **寻路系统** - A*算法支持
- 🗂️ **图层系统** - 多图层视差滚动
- 🎨 **Z 轴偏移** - 图层垂直分层
- 🎯 **可调视差** - 动态调整深度感

## 🤝 贡献 Contributing

欢迎提交 Issue 和 Pull Request！

## 📄 许可证 License

MIT License

## 🙏 致谢 Acknowledgments

- 投影算法参考 [as3isolib](https://code.google.com/p/as3isolib/)
- 感谢 J.W.Opitz 的开源贡献

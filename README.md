# Axial2.5D

基于 Canvas 2D API 的 2.5D 等距游戏框架，参考 as3isolib 实现。

A Canvas 2D API isometric game framework inspired by as3isolib.

## 🎮 特性 Features

- 📐 **等距投影** - 使用 30° tilt 角，匹配 as3isolib 标准
- 🎨 **深度排序** - 自动处理遮挡关系
- 🗺️ **网格系统** - 统一的 cellSize，正方形网格
- 🎭 **实体系统** - 支持 IsoBox 3D 建筑、IsoSprite 精灵
- 🖱️ **输入处理** - 鼠标/键盘支持，平滑相机跟随
- 🔍 **调试工具** - FPS、坐标显示、鼠标位置追踪
- 📦 **资源管理** - 图片、音频加载
- 🎬 **场景管理** - 多场景切换
- ✏️ **寻路系统** - A*算法

## 📦 安装 Installation

```bash
cd Axial2.5D
npm install
```

### 可选：Canvas 支持

Node.js 环境完整渲染需要 canvas 包：

```bash
npm install canvas  # 可选，需要原生依赖
```

## 🚀 快速开始 Quick Start

### 方式 1：Web 演示（推荐新手）

```bash
# 启动 Web 服务器
npm run server

# 浏览器访问
http://localhost:3000
```

**特点：**
- 独立 HTML 文件，无需编译
- 包含所有功能的交互式演示
- 适合快速体验和测试

### 方式 2：使用框架开发

```bash
# 1. 编译框架
npm run build

# 2. 在项目中导入
import { Game, LayerManager, Projection } from 'axial-2-5d';

# 3. 创建游戏实例
const game = new Game({
  width: 800,
  height: 600,
  projection: { type: 'isometric', viewAngle: 45 }
});

# 4. 创建图层系统
const layers = layerManager.createStandardLayers(0, 2000, 5, {
  zIndexStep: 30,
  parallaxRange: 0.7
});

# 5. 启动游戏
game.start();
```

### 方式 3：查看框架示例

```bash
# 编译框架
npm run build

# 打开正式示例（使用框架 API）
# 浏览器打开：examples/web-example.html
```

**特点：**
- 展示如何正确使用框架 API
- 包含完整的功能实现
- 作为开发参考模板

## 🎯 Web 演示控制

### 键盘控制

| 按键 | 功能 |
|------|------|
| **W / ↑** | 向上移动 |
| **A / ←** | 向左移动 |
| **S / ↓** | 向下移动 |
| **D / →** | 向右移动 |
| **G** | 切换网格显示 |
| **B** | 切换建筑线框模式 |
| **空格** | 切换调试信息 |

### 鼠标控制

| 操作 | 功能 |
|------|------|
| **点击地面** | 移动到目标位置 |
| **拖动** | 平移相机 |
| **滚轮** | 缩放视图 |

### 界面按钮

- **📐 Grid** - 切换网格线
- **🔲 Wireframe** - 切换建筑线框
- **🐛 Debug** - 显示调试信息
- **📷 Reset Camera** - 重置相机
- **🚀 Teleport** - 随机传送玩家

### 调试信息显示

开启 Debug 后显示：
- FPS 帧率
- 实体数量
- 玩家位置
- 相机偏移和缩放
- **鼠标坐标**（屏幕/世界/网格）
- 鼠标悬停 tile 信息

## 📁 项目结构

```
Axial2.5D/
├── src/                          # TypeScript 源代码
│   ├── core/                     # 核心模块
│   │   ├── Projection.ts         # 投影变换 (30° tilt)
│   │   ├── IsoCamera.ts          # 相机系统
│   │   ├── CanvasRenderer.ts     # 渲染器
│   │   ├── Game.ts               # 游戏主类
│   │   └── types.ts              # 类型定义
│   ├── world/                    # 世界管理
│   │   ├── GridSystem.ts         # 网格系统
│   │   ├── GridLines.ts          # 网格线可视化
│   │   ├── EntityManager.ts      # 实体管理
│   │   ├── PathFinder.ts         # A*寻路
│   │   ├── IsoPrimitive.ts       # 3D 几何体基类
│   │   ├── IsoBox.ts             # 3D 盒子/建筑
│   │   └── IsoSprite.ts          # 精灵/角色
│   ├── input/                    # 输入处理
│   │   └── InputManager.ts       # 输入管理器
│   ├── ui/                       # UI 系统
│   │   └── UIManager.ts          # UI 管理器
│   ├── debug/                    # 调试工具
│   │   └── DebugSystem.ts        # 调试系统
│   ├── scene/                    # 场景管理
│   │   └── SceneManager.ts       # 场景管理器
│   ├── resource/                 # 资源管理
│   │   └── ResourceManager.ts
│   ├── utils/                    # 工具类
│   │   └── EventBus.ts           # 事件总线
│   └── index.ts                  # 主入口
├── public/                       # Web 演示文件
│   ├── demo.html                 # 交互式演示
│   ├── index.html                # 旧版演示
│   └── web-demo.js               # Web 演示逻辑
├── server/                       # 服务器
│   └── demo-server.js            # HTTP 服务器
├── tests/                        # 测试
│   └── index.ts
├── examples/                     # 示例
│   ├── demo.ts                   # 基础演示
│   ├── game-demo.ts              # 完整游戏演示
│   └── advanced-demo.ts          # 高级功能演示
├── package.json
└── tsconfig.json
```

## 📖 核心 API

### 投影系统

```typescript
import { Projection } from './src/index';

// 创建投影（30° tilt 角，匹配 as3isolib）
const projection = new Projection({
  type: 'isometric',
  viewAngle: 45,
  tileScale: 1
});

// 坐标转换
const screen = projection.worldToScreen(x, z, y);
const world = projection.screenToWorld(sx, sy, y);
```

### 网格系统

```typescript
import { GridSystem } from './src/index';

const gridSystem = new GridSystem({
  width: 12,
  height: 12,
  tileW: 50,  // 统一 cellSize
  tileH: 50
}, projection);

// 坐标转换
const world = gridSystem.gridToWorld(col, row);
const grid = gridSystem.worldToGrid(x, z);
```

### 3D 建筑

```typescript
import { IsoBox } from './src/index';

const building = new IsoBox('house', 5, 5, 100, 100, 80);
building.setFaceColors([
  '#f5deb3', // top
  '#deb887', // front-right
  '#cd853f', // front-left
  '#b8860b', // back-right
  '#daa520', // back-left
  '#8b4513'  // bottom
]);
building.setWireframe(false);
entityManager.addEntity(building);
```

### 相机控制

```typescript
// 平滑跟随玩家
game.centerCameraOnEntity('player');

// 手动控制
game.renderer.camera.zoom(1.1);    // 放大
game.renderer.camera.zoom(0.9);    // 缩小
game.renderer.camera.pan(dx, dy);  // 平移
```

### 寻路系统

```typescript
import { PathFinder } from './src/index';

const pathFinder = new PathFinder();
const path = pathFinder.findPath(
  { col: startCol, row: startRow },
  { col: endCol, row: endRow },
  gridSystem,
  { allowDiagonal: false }
);
```

## 🧪 测试

```bash
# 运行单元测试（29 项测试）
npm test

# 输出示例：
# Tests: 29
# Passed: 29
# Failed: 0
```

## 🛠️ 开发

```bash
# 编译 TypeScript
npm run build

# 监视模式
npm run dev

# 启动 Web 服务器
npm run server
```

## 📊 技术细节

### 投影公式

匹配 as3isolib 的 `IsoMath.isoToScreen`：

```
screenX = (worldX - worldY) * cos(30°)
screenY = (worldX + worldY) * sin(30°) - worldZ
```

### 深度排序

```
depth = screenY + entityHeight
```

按深度值升序绘制（远→近），实现正确遮挡。

### 相机平滑

```javascript
// 每帧插值 10%
offset += (targetOffset - offset) * 0.1;
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- 投影算法参考 [as3isolib](https://code.google.com/p/as3isolib/)
- 感谢 J.W.Opitz 的开源贡献

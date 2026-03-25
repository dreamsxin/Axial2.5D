# Phase 5 Roadmap - 框架内化与自动化

## ✅ 状态：已完成 (2026-03-25)

**应用代码行数**: ~150 行（从 ~350 行减少 57%）

详见：[PHASE5_COMPLETE.md](./PHASE5_COMPLETE.md)

---

## 目标
将应用层通用功能进一步内化到框架中，精简应用代码至 **200 行以内**，实现配置化开发。

---

## 一、组件自动挂载与生命周期管理

### 当前问题
应用层手动创建并初始化多个子系统：
- `LayerManager`、`EffectSystem`、`CameraController`、`OcclusionSystem`、`UIDataBinder`、`DebugRenderer`
- 手动设置依赖关系
- 手动注册 `renderHooks`

### 解决方案：插件系统

```typescript
// 应用层代码（简化后）
const game = new Game({
  width: 800,
  height: 600,
  canvas: canvas,
  modules: {
    cameraController: { enabled: true, followEntity: 'player', smoothness: 0.1 },
    occlusionSystem: { enabled: true },
    effectSystem: { enabled: true },
    uiBinder: { enabled: true, autoUpdate: true },
    debugRenderer: { enabled: false }
  }
});
```

### 框架实现
```typescript
// Game.ts 内部
export interface ModuleConfig {
  cameraController?: { enabled: boolean; followEntity?: string; smoothness?: number };
  occlusionSystem?: { enabled: boolean };
  effectSystem?: { enabled: boolean };
  uiBinder?: { enabled: boolean; autoUpdate?: boolean };
  debugRenderer?: { enabled: boolean };
}

export class Game {
  public modules: {
    cameraController?: CameraController;
    occlusionSystem?: OcclusionSystem;
    effectSystem?: EffectSystem;
    uiBinder?: UIDataBinder;
    debugRenderer?: DebugRenderer;
  } = {};

  private initModules(config: ModuleConfig): void {
    if (config.cameraController?.enabled) {
      this.modules.cameraController = new CameraController({
        camera: this.renderer.camera,
        projection: this.projection,
        gridSystem: this.gridSystem,
        entityManager: this.entityManager,
        // ...自动注入依赖
        ...config.cameraController
      });
    }
    // 其他模块同理...
  }
}
```

---

## 二、渲染管线集成

### 当前问题
应用层手动在 `renderHooks` 中调用各系统更新/渲染。

### 解决方案：标准钩子 + 自动注册

```typescript
// 框架内部 - Game.ts
public render(): void {
  const ctx = this.renderer.ctx as CanvasRenderingContext2D;
  
  // 1. Before Clear
  this.emit('beforeClear', ctx);
  
  // 2. Clear
  this.renderer.clear('#1a1a2e');
  
  // 3. After Clear / Before Update
  this.emit('beforeUpdate');
  this.modules.cameraController?.update();
  this.modules.occlusionSystem?.update();
  this.modules.effectSystem?.update(16);
  
  // 4. Render Layers
  this.renderDefault();
  
  // 5. After Layers / Render Effects
  this.emit('afterLayers');
  this.modules.effectSystem?.renderAll(ctx); // 自动循环所有层
  
  // 6. After Render / Debug
  this.emit('afterRender');
  this.modules.debugRenderer?.render(ctx, this.gridSystem, this.renderer.camera, this.projection);
  
  // 7. Before Present
  this.emit('beforePresent');
  this.modules.uiBinder?.updateAll(); // 自动更新
  
  // 8. Present
  this.renderer.present();
}
```

---

## 三、UI 数据绑定与自动刷新

### 当前问题
- 手动调用 `uiBinder.updateAll()`
- 图层列表手动遍历更新 DOM

### 解决方案：响应式绑定 + 内置组件

```typescript
// 框架提供
export class UIManager {
  private bindings: Map<string, DataBinding> = new Map();
  
  // 声明式绑定
  bind(elementId: string, getValue: () => any, formatter?: (v: any) => string): void;
  
  // 内置图层列表组件
  renderLayerList(containerId: string, layerManager: LayerManager, effectSystem?: EffectSystem): void;
}

// 应用层使用
game.ui.bind('fps', () => game.stats.fps);
game.ui.bind('playerPos', () => {
  const p = game.entityManager.getEntity('player');
  return p ? `${p.col},${p.row}` : '0,0';
});
game.ui.renderLayerList('layerList', game.modules.layerManager, game.modules.effectSystem);
```

---

## 四、调试系统增强

### 当前问题
- 手动添加调试项
- 手动管理启用/禁用状态

### 解决方案：内置调试面板

```typescript
// 框架提供
export class DebugPanel {
  // 自动收集的性能数据
  get stats(): { fps: number; frameTime: number; drawCalls: number; entityCount: number };
  
  // 内置调试项
  showFPS(enabled: boolean): void;
  showEntityInfo(enabled: boolean): void;
  showCameraInfo(enabled: boolean): void;
  showMouseInfo(enabled: boolean): void;
  
  // 自定义调试项
  addText(id: string, getText: () => string, options?: DebugTextOptions): void;
  addTileHighlight(id: string, getTile: () => GridCoord, options?: HighlightOptions): void;
}

// 应用层使用
game.debug.showFPS(true);
game.debug.showMouseInfo(true);
game.debug.addText('custom', () => `Custom: ${value}`);
```

---

## 五、输入与移动控制

### 当前问题
- 应用层监听事件、手动移动
- 移动逻辑重复

### 解决方案：PlayerController 组件

```typescript
// 框架提供
export class PlayerController {
  constructor(
    entityId: string,
    inputManager: InputManager,
    gridSystem: GridSystem,
    entityManager: EntityManager,
    options?: {
      moveSpeed?: number;
      allowClickToMove?: boolean;
      allowKeyboardMove?: boolean;
      boundary?: { minCol: number; maxCol: number; minRow: number; maxRow: number }
    }
  );
  
  enable(): void;
  disable(): void;
  moveTo(col: number, row: number): Promise<boolean>;
  onMove(callback: (col: number, row: number) => void): void;
}

// 应用层使用
const playerController = new PlayerController('player', game.inputManager, game.gridSystem, game.entityManager, {
  allowClickToMove: true,
  allowKeyboardMove: true
});
playerController.enable();
```

---

## 六、日志系统与性能监控

### 当前问题
- 自定义 `log` 函数
- 手动计算 FPS

### 解决方案：内置 Logger + Stats

```typescript
// 框架提供
export class Logger {
  info(msg: string, ...args: any[]): void;
  success(msg: string, ...args: any[]): void;
  warn(msg: string, ...args: any[]): void;
  error(msg: string, ...args: any[]): void;
  
  // 输出到 DOM 元素
  attachToElement(elementId: string, maxLines?: number): void;
}

export class StatsMonitor {
  readonly fps: number;
  readonly frameTime: number;
  readonly drawCalls: number;
  readonly entityCount: number;
  
  onFpsChange(callback: (fps: number) => void): void;
}

// 应用层使用
game.log.info('Game started');
game.log.success('Player moved to (%d, %d)', col, row);
console.log(`FPS: ${game.stats.fps}`);
```

---

## 七、地图初始化与数据驱动

### 当前问题
- 双重循环手动设置瓦片
- 硬编码建筑数据

### 解决方案：数据驱动加载

```typescript
// 框架提供
export class GridSystem {
  // 从二维数组加载
  loadFromArray(tileMap: string[][], tileTypeMap: Record<string, TileType>): void;
  
  // 从 JSON 加载
  loadFromJSON(jsonUrl: string): Promise<void>;
  
  // 批量添加实体
  addEntities(entities: EntityConfig[]): void;
}

// 应用层使用
const tileMap = [
  ['water', 'water', 'water', 'water'],
  ['water', 'grass', 'grass', 'water'],
  ['water', 'grass', 'road', 'water'],
  ['water', 'water', 'water', 'water']
];
game.gridSystem.loadFromArray(tileMap, {
  water: { walkable: false, color: '#4a90a4' },
  grass: { walkable: true, color: '#4a7c4e' },
  road: { walkable: true, color: '#666666' }
});

game.entityManager.addEntities([
  { id: 'house1', col: 1, row: 1, width: 100, length: 100, height: 70 },
  { id: 'player', col: 2, row: 2, width: 40, length: 40, height: 40 }
]);
```

---

## 八、效果系统高级 API

### 当前问题
- 手动创建效果对象
- 属性设置繁琐

### 解决方案：效果构建器

```typescript
// 框架提供
export class EffectSystem {
  // 云效果构建器
  addCloud(options: {
    col: number;
    row: number;
    layer?: number;
    size?: number;
    color?: string;
    alpha?: number;
    offsetY?: number;
  }): string; // 返回效果 ID
  
  // 粒子效果构建器
  addParticleEmitter(options: ParticleEmitterConfig): string;
  
  // 批量添加
  addClouds(count: number, options: Partial<CloudConfig>): string[];
}

// 应用层使用
// 单个云
effectSystem.addCloud({ col: 5, row: 5, size: 60 });

// 批量云
effectSystem.addClouds(8, {
  layer: 4,
  sizeRange: [40, 80],
  color: '#ffffff'
});
```

---

## 九、全局函数与事件绑定

### 当前问题
- `window.toggleGrid` 全局污染
- `onclick` 绑定耦合

### 解决方案：UI 绑定 API

```typescript
// 框架提供
export class UIManager {
  // 按钮绑定
  bindButton(buttonId: string, handler: () => void, options?: {
    activeClass?: string;
    toggle?: boolean;
    label?: { on: string; off: string }
  }): void;
  
  // 滑块绑定
  bindSlider(sliderId: string, onChange: (value: number) => void, displayId?: string): void;
}

// 应用层使用
game.ui.bindButton('btnGrid', () => game.setGridVisible(!game.isGridVisible()), {
  toggle: true,
  label: { on: '📐 Grid ON', off: '📐 Grid OFF' }
});

game.ui.bindSlider('fgAlphaSlider', (v) => game.setLayerAlpha(v), 'fgAlphaVal');
```

---

## 十、实现优先级

| 优先级 | 模块 | 复杂度 | 收益 | 状态 |
|--------|------|--------|------|------|
| P0 | 组件自动挂载 | 中 | 高 | ✅ 完成 |
| P0 | 渲染管线集成 | 中 | 高 | ✅ 完成 |
| P1 | PlayerController | 低 | 高 | ✅ 完成 |
| P1 | Logger + Stats | 低 | 中 | ✅ 完成 |
| P2 | UI 绑定 API | 中 | 中 | ✅ 完成 |
| P2 | 地图数据驱动 | 低 | 中 | ✅ 完成 |
| P3 | 效果构建器 | 中 | 低 | ✅ 完成 |
| P3 | 响应式 UI | 高 | 中 | ✅ 完成 |

---

## 十一、Phase 5 目标代码对比

### 当前（Phase 4）应用层代码
```typescript
// ~500 行：手动创建组件、注册钩子、处理输入、更新 UI
```

### 目标（Phase 5）应用层代码
```typescript
// ~150 行：仅配置和业务逻辑
const game = new Game({
  width: 800,
  height: 600,
  canvas: canvas,
  modules: {
    cameraController: { followEntity: 'player', smoothness: 0.1 },
    occlusionSystem: {},
    effectSystem: {},
    uiBinder: { autoUpdate: true },
    debugRenderer: {}
  }
});

// 加载地图
game.gridSystem.loadFromArray(tileMap, tileTypeMap);
game.entityManager.addEntities(buildings);

// 启用玩家控制
const playerController = new PlayerController('player', game.input, game.grid);
playerController.enable();

// UI 绑定
game.ui.bind('fps', () => game.stats.fps);
game.ui.bindButton('btnGrid', () => game.setGridVisible(!game.isGridVisible()), { toggle: true });
game.ui.renderLayerList('layerList');

// 效果系统
game.modules.effectSystem.addClouds(8, { layer: 4 });

// 启动
game.start();
```

---

## 十二、下一步行动

✅ **Phase 5 已完成！**

所有目标已实现：
1. ✅ `ModuleManager` - 组件生命周期管理
2. ✅ `Game.render()` - 标准渲染钩子
3. ✅ `PlayerController` - 输入与移动封装
4. ✅ `Logger` - 多级别日志 + DOM 输出
5. ✅ `UIManager.bindButton/Slider` - UI 绑定 API
6. ✅ `EffectSystem.addCloud/addClouds` - 效果构建器

### Phase 6 建议（可选）
- 响应式数据绑定（自动检测依赖）
- 地图数据驱动加载（JSON/数组）
- 更多效果类型（雨、雪、雾）
- 性能分析工具集成

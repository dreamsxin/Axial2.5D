# Phase 6 Roadmap - 深度优化与业务解耦

## 🎯 目标

将应用层代码进一步精简至 **100 行以内**，实现 **声明式配置** 和 **零样板代码**。应用层只关注业务逻辑（地图布局、实体定义、效果生成）。

---

## 一、UI 组件化

### 当前问题
- `updateLayerList()` 手动遍历所有瓦片、实体、云来统计各层数据
- O(n²) 遍历整个地图，性能较差
- 与框架核心逻辑耦合

### 优化方案

**框架提供内置的 `LayerList` 组件**

```typescript
// 应用层代码
game.ui.addLayerList('layerList', {
  layerColors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'],
  showStats: ['tiles', 'entities', 'clouds']
});
```

**框架内部实现**:
```typescript
class UIManager {
  addLayerList(containerId: string, options: LayerListConfig): void {
    const layerList = new LayerList(containerId, this.game.layerManager, options);
    // 自动监听 layerManager 变化
    this.game.layerManager.on('statsChanged', () => layerList.update());
  }
}

class LayerManager {
  private tileCounts: number[] = [];
  private entityCounts: number[] = [];
  private effectCounts: number[] = [];

  // 自动维护统计
  onTileAdded(col: number, row: number): void {
    this.tileCounts[this.getLayerForDepth(col + row)]++;
  }

  onEntityAdded(entity: Entity): void {
    this.entityCounts[this.getLayerForDepth(entity.col + entity.row)]++;
  }

  onEffectAdded(effect: Effect): void {
    this.effectCounts[effect.layer]++;
  }

  getLayerStats(layer: number): LayerStats {
    return {
      ...this.layerProps[layer],
      tileCount: this.tileCounts[layer],
      entityCount: this.entityCounts[layer],
      effectCount: this.effectCounts[layer]
    };
  }
}
```

**应用层移除**:
- ❌ `updateLayerList()` 函数
- ❌ `onBeforePresent` 中的层列表更新调用
- ❌ 手动遍历统计的代码

---

## 二、鼠标坐标自动注入

### 当前问题
- 应用层通过 `canvas.addEventListener('mousemove')` 手动记录鼠标坐标
- 调试渲染器需要从 `state.mouse` 读取坐标

### 优化方案

**`InputManager` 直接提供 `mouseScreenX`、`mouseScreenY` 属性**

```typescript
// InputManager 内部
export class InputManager {
  private _mouseScreenX = 0;
  private _mouseScreenY = 0;

  constructor(config: InputManagerConfig) {
    config.canvas.addEventListener('mousemove', (e) => {
      const rect = config.canvas.getBoundingClientRect();
      this._mouseScreenX = e.clientX - rect.left;
      this._mouseScreenY = e.clientY - rect.top;
    });
  }

  get mouseScreenX(): number { return this._mouseScreenX; }
  get mouseScreenY(): number { return this._mouseScreenY; }
}

// 调试渲染器内部直接使用
const mx = game.inputManager.mouseScreenX;
const my = game.inputManager.mouseScreenY;
```

**应用层移除**:
- ❌ `canvas.addEventListener('mousemove')` 相关代码
- ❌ `state.mouse` 变量

---

## 三、UI 按钮状态自动管理

### 当前问题
- 应用层仍需手动维护 `showGrid`、`showDebug` 变量
- 按钮的激活状态（active 类）需要手动切换

### 优化方案

**增强 `uiManager.bindButton` 支持自动维护状态**

```typescript
// 方案 A：增强 bindButton
uiManager.bindButton('btnGrid', () => {
  game.setRenderOptions({ showGrid: game.renderOptions.showGrid });
}, {
  toggle: true,
  getToggleState: () => game.renderOptions.showGrid,
  onStateChange: (state) => {
    // 自动更新文本和样式
  }
});

// 方案 B：提供 toggleButton 方法（更简洁）
uiManager.toggleButton('btnGrid', {
  getState: () => game.renderOptions.showGrid,
  onToggle: (state) => game.setRenderOptions({ showGrid: state }),
  getText: (state) => `📐 Grid: ${state ? 'ON' : 'OFF'}`,
  activeClass: 'active'
});
```

**应用层移除**:
- ❌ `showGrid`、`showDebug` 变量
- ❌ 按钮回调中手动更新文本和类的代码

---

## 四、层统计自动维护

### 当前问题
- 瓦片、实体、云的数量变化时，应用层需要重新遍历计算
- `LayerManager` 仅提供层属性，不包含动态统计

### 优化方案

**`LayerManager` 内部维护各层统计计数器**

```typescript
class LayerManager {
  private tileCounts: number[] = [];
  private entityCounts: number[] = [];
  private effectCounts: number[] = [];

  // 监听事件自动更新统计
  init(gridSystem: GridSystem, entityManager: EntityManager, effectSystem: EffectSystem): void {
    gridSystem.on('tileSet', (col, row) => {
      this.tileCounts[this.getLayerForDepth(col + row)]++;
    });

    entityManager.on('entityAdded', (entity) => {
      this.entityCounts[this.getLayerForDepth(entity.col + entity.row)]++;
    });

    effectSystem.on('effectAdded', (effect) => {
      this.effectCounts[effect.layer]++;
    });
  }

  getLayerStats(layer: number): LayerStats {
    return {
      parallax: this.layers[layer].parallax,
      alpha: this.layers[layer].alpha,
      zIndexOffset: this.layers[layer].zIndexOffset,
      tileCount: this.tileCounts[layer],
      entityCount: this.entityCounts[layer],
      effectCount: this.effectCounts[layer]
    };
  }
}
```

**应用层移除**:
- ❌ `updateLayerList` 中遍历统计的代码
- ✅ 改为直接读取 `layerManager.getLayerStats(i)` 的统计字段

---

## 五、移动控制器集成

### 当前问题
- 应用层手动监听 `click` 和 `keyDown` 事件
- 调用 `movePlayer` 直接操作实体管理器

### 优化方案

**框架提供 `PlayerController` 模块，配置化启用**

```typescript
// 应用层代码
const game = new Game({
  modules: {
    playerController: {
      enabled: true,
      entityId: 'player',
      moveSpeed: 1,      // 每按键移动的格子数
      clickToMove: true, // 点击移动
      wasdKeys: true     // WASD/方向键移动
    }
  }
});
```

**框架内部实现**:
```typescript
class PlayerController {
  constructor(config: PlayerControllerConfig, game: Game) {
    this.entityId = config.entityId;
    this.game = game;

    if (config.wasdKeys) {
      game.inputManager.on('keyDown', (e) => this.handleKey(e));
    }

    if (config.clickToMove) {
      game.eventBus.on('click', (data) => this.handleClick(data));
    }
  }

  private handleKey(e: KeyboardEvent): void {
    const { dCol, dRow } = this.game.inputManager.getMovementDirection();
    if (dCol !== 0 || dRow !== 0) {
      this.moveTo(this.entity.col + dCol, this.entity.row + dRow);
    }
  }

  private handleClick(data: ClickData): void {
    const tile = this.game.gridSystem.getTile(data.gridCol, data.gridRow);
    if (tile?.walkable) {
      this.moveTo(data.gridCol, data.gridRow);
    }
  }

  private moveTo(col: number, row: number): void {
    const entity = this.game.entityManager.getEntity(this.entityId);
    if (entity) {
      this.game.entityManager.moveEntity(entity, col, row);
      this.game.eventBus.emit('playerMoved', { col, row });
    }
  }
}
```

**应用层移除**:
- ❌ `setupEventHandlers` 中的点击和键盘监听
- ❌ `movePlayer` 函数

---

## 六、配置与状态统一管理

### 当前问题
- `showGrid`、`showDebug` 等 UI 状态由应用层维护
- 与框架的渲染选项（`game.renderOptions`）分离
- 层设置同时存储在 `layerManager` 和 `game.setRenderOptions`，存在冗余

### 优化方案

**框架提供统一的配置系统 `game.config`**

```typescript
// 配置系统
class ConfigManager {
  private config: Record<string, any> = {};
  private listeners: Map<string, Set<(value: any) => void>> = new Map();

  set<T>(key: string, value: T): void {
    const oldValue = this.get(key);
    this.config[key] = value;
    this.notify(key, value, oldValue);
  }

  get<T>(key: string): T {
    return this.config[key];
  }

  toggle(key: string): boolean {
    const value = !this.get(key);
    this.set(key, value);
    return value;
  }

  on(key: string, callback: (value: any) => void): void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);
  }

  private notify(key: string, newValue: any, oldValue: any): void {
    this.listeners.get(key)?.forEach(cb => cb(newValue, oldValue));
  }
}

// 应用层使用
game.config.set('render.showGrid', true);
game.config.set('debug.enabled', true);
game.config.set('layer.foregroundAlpha', 0.6);

// UI 绑定直接关联配置项
game.ui.bindText('fps', () => game.stats.fps);
game.ui.bindSlider('fgAlphaSlider', (v) => game.config.set('layer.foregroundAlpha', v));
```

**应用层移除**:
- ❌ 独立的 `state` 对象
- ✅ 改为直接读写 `game.config`

---

## 七、调试渲染器集成

### 当前问题
- 调试渲染器需要应用层在渲染钩子中手动调用 `debugRenderer.render`

### 优化方案

**调试系统自动注册到渲染管线**

```typescript
// Game.ts 内部
export class Game {
  constructor(config: GameConfig) {
    // ...
    this.debugRenderer = new DebugRenderer();

    // 自动注册到渲染管线
    this.renderHooks = this.renderHooks || {};
    const originalAfterLayers = this.renderHooks.onAfterLayers;
    this.renderHooks.onAfterLayers = (ctx) => {
      originalAfterLayers?.(ctx);
      if (this.config.get('debug.enabled')) {
        this.debugRenderer.render(ctx, this.gridSystem, this.renderer.camera, this.projection);
      }
    };
  }

  // 应用层只需添加调试项
  debug = {
    addText: (id: string, config: DebugTextConfig) => this.debugRenderer.addText(id, config),
    addTileHighlight: (id: string, config: DebugTileHighlightConfig) =>
      this.debugRenderer.addTileHighlight(id, config)
  };
}

// 应用层使用
game.debug.addText('fps', {
  getText: () => `FPS: ${game.stats.fps}`,
  x: 10, y: 20, color: '#0f0'
});
```

**应用层移除**:
- ❌ `renderHooks.onAfterLayers` 中调用 `debugRenderer.render` 的代码

---

## 八、效果系统自动注册

### 当前问题
- 效果系统通过 `modules` 启用，但更新和渲染需要框架自动集成

### 优化方案

**框架在初始化模块时自动注册**

```typescript
// ModuleManager.ts 内部
private initEffectSystem(): void {
  const cfg = this.config.effectSystem;
  if (!cfg?.enabled) return;

  this.modules.effectSystem = new EffectSystem(
    this.game.renderer.camera,
    this.game.projection,
    this.modules.layerManager?.getLayerCount() ?? 5
  );

  // 自动注册到渲染管线
  const originalBeforeUpdate = this.game.renderHooks?.onAfterClear;
  this.game.renderHooks = this.game.renderHooks || {};
  this.game.renderHooks.onAfterClear = (ctx) => {
    originalBeforeUpdate?.(ctx);
    this.modules.effectSystem?.update(16);
  };

  const originalAfterLayers = this.game.renderHooks?.onAfterLayers;
  this.game.renderHooks.onAfterLayers = (ctx) => {
    originalAfterLayers?.(ctx);
    // 自动渲染所有层的效果
    const layerCount = this.modules.layerManager?.getLayerCount() ?? 5;
    for (let i = 0; i < layerCount; i++) {
      const layerInfo = this.modules.layerManager?.getLayerStats(i) ?? { parallax: 1, alpha: 1 };
      this.modules.effectSystem?.render(ctx, i, {
        parallaxFactor: layerInfo.parallax,
        alpha: layerInfo.alpha
      });
    }
  };
}
```

**应用层**:
- ✅ 无需任何改动（已经是自动的）

---

## 九、最终应用层代码示例（理想状态）

经过上述优化后，应用层代码可缩减至 **~100 行**：

```typescript
import { Game } from 'axial-2-5d';

const game = new Game({
  canvas: '#gameCanvas',
  width: 800, height: 600,
  projection: { type: 'isometric', viewAngle: 30 },
  modules: {
    layerManager: { layerCount: 5, foregroundAlpha: 0.6, zIndexStep: 30, parallaxRange: 0.7 },
    cameraController: { followEntity: 'player', smoothness: 0.1 },
    occlusionSystem: true,
    effectSystem: true,
    uiManager: { autoUpdate: true, logElementId: 'log' },
    playerController: { entityId: 'player', clickToMove: true, wasdKeys: true },
    debugPanel: { enabled: false }
  }
});

// ==================== 地图（业务）====================
game.grid.setMap((c, r) => {
  if (c === 0 || c === 11 || r === 0 || r === 11)
    return { type: 'water', walkable: false };
  if (c === 6 || r === 6) return { type: 'road' };
  if ((c + r) % 4 === 0 && c > 1 && c < 10 && r > 1 && r < 10)
    return { type: 'stone' };
  return { type: 'grass' };
});

// ==================== 实体（业务）====================
game.entities.add({
  id: 'player', col: 6, row: 6, width: 40, height: 40,
  colors: ['#ff6b6b']
});

const buildings = [
  { id: 'tower1', col: 5, row: 5, width: 80, height: 120 },
  { id: 'townhall', col: 3, row: 3, width: 120, height: 80 },
  // ...
];
buildings.forEach(b => game.entities.add(b));

// ==================== 效果（业务）====================
game.effects.addClouds(6, { layer: 4, sizeRange: [40, 80], color: '#fff' });
game.effects.addClouds(2, { layer: 2, sizeRange: [35, 60], color: '#4ecdc4' });

// ==================== UI 绑定（业务）====================
game.ui.bindText('fps', () => game.stats.fps);
game.ui.bindText('playerPos', () => {
  const p = game.entities.get('player');
  return `${p.col},${p.row}`;
});

game.ui.bind('occlusion', (el) => {
  const occluded = game.occlusion.isOccluded('player');
  el.textContent = occluded ? 'OCCLUDED' : 'VISIBLE';
  el.style.color = occluded ? '#f00' : '#0f0';
});

// ==================== UI 组件（框架自动）====================
game.ui.addLayerList('layerList', {
  layerColors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7']
});

game.ui.toggleButton('btnGrid', {
  getState: () => game.config.get('render.showGrid'),
  onToggle: (state) => game.config.set('render.showGrid', state),
  getText: (state) => `📐 Grid: ${state ? 'ON' : 'OFF'}`
});

game.ui.toggleButton('btnDebug', {
  getState: () => game.config.get('debug.enabled'),
  onToggle: (state) => game.config.set('debug.enabled', state),
  getText: (state) => `🐛 Debug: ${state ? 'ON' : 'OFF'}`
});

game.ui.bindSlider('fgAlphaSlider', (v) =>
  game.config.set('layer.foregroundAlpha', v)
);

// ==================== 调试（框架自动）====================
game.debug.addText('fps', {
  getText: () => `FPS: ${game.stats.fps}`,
  x: 10, y: 20, color: '#0f0'
});

// ==================== 启动 ====================
game.start();
```

---

## 十、实施优先级

| 优先级 | 功能 | 复杂度 | 收益 | 预计行数减少 |
|--------|------|--------|------|-------------|
| **P0** | 移动控制器集成 | 低 | 高 | -20 行 |
| **P0** | 鼠标坐标自动注入 | 低 | 中 | -5 行 |
| **P1** | 层统计自动维护 | 中 | 高 | -30 行 |
| **P1** | UI 组件化（LayerList） | 中 | 高 | -25 行 |
| **P2** | 配置系统统一管理 | 中 | 中 | -15 行 |
| **P2** | UI 按钮状态自动管理 | 低 | 中 | -10 行 |
| **P3** | 调试渲染器集成 | 低 | 低 | -5 行 |
| **P3** | 效果系统自动注册 | 低 | 低 | 0 行（已自动） |

---

## 十一、Phase 6 目标

| 指标 | Phase 5 | Phase 6 目标 |
|------|---------|-------------|
| **应用代码行数** | ~150 行 | **~100 行** |
| **手动状态管理** | 需要 | **无需** |
| **手动事件监听** | 需要 | **无需** |
| **手动统计遍历** | 需要 | **无需** |
| **配置集中度** | 分散 | **统一** |
| **UI 组件化** | 部分 | **完全** |

---

## 十二、下一步行动

1. **实现 `PlayerController` 模块** - 自动处理移动
2. **增强 `InputManager`** - 提供 `mouseScreenX/Y` 属性
3. **实现 `LayerManager` 统计自动维护** - O(1) 查询
4. **创建 `LayerList` UI 组件** - 自动更新
5. **实现 `ConfigManager`** - 统一配置管理
6. **增强 `UIManager`** - `toggleButton` 方法

---

**Phase 6 愿景**: 应用层只关注业务逻辑，框架处理所有基础设施！🚀

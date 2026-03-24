# Framework Usage Guide

## 🎯 Overview

This guide demonstrates how to use the new Axial2.5D framework components to build isometric games with minimal boilerplate code.

---

## 📦 Core Components

### 1. Game - Main Entry Point

```typescript
import { Game } from 'axial-2-5d';

const game = new Game({
  width: 800,
  height: 600,
  canvas: document.getElementById('gameCanvas'),
  projection: { type: 'isometric', viewAngle: 30 },
  onBeforeRender: (ctx) => {
    // Update game logic
  },
  onAfterRender: (ctx) => {
    // Render effects, debug, UI
  }
});

game.init(mapData);
game.start();
```

---

### 2. PlayerController - Input + Camera

```typescript
import { PlayerController } from 'axial-2-5d';

const playerController = new PlayerController({
  playerId: 'player',
  camera: game.renderer.camera,
  projection: game.projection,
  gridSystem: game.gridSystem,
  entityManager: game.entityManager,
  eventBus: game.eventBus,
  layerManager: layerManager,
  smoothCamera: true,
  cameraSmoothness: 0.1
});

// In game loop (onBeforeRender)
playerController.update(16);

// Get position
const pos = playerController.getPosition();
console.log(`Player at (${pos.col}, ${pos.row})`);
```

**Benefits**:
- ✅ Automatic WASD/arrow key handling
- ✅ Automatic click-to-move
- ✅ Automatic camera follow with parallax
- ✅ **50+ lines of code eliminated**

---

### 3. OcclusionSystem - Automatic Transparency

```typescript
import { OcclusionSystem } from 'axial-2-5d';

const occlusion = new OcclusionSystem(
  game.gridSystem,
  game.entityManager,
  {
    enabled: true,
    occludedAlpha: 0.5,    // 50% transparent when occluded
    minHeight: 60          // Objects taller than 60px occlude
  }
);

// In game loop (onBeforeRender)
occlusion.update();  // Mark dirty when entities move

// In rendering (onAfterRender)
for (const entity of game.entityManager.getAllEntities()) {
  const alpha = occlusion.getEntityAlpha(entity);
  ctx.globalAlpha = alpha;
  entity.draw(ctx);
}
ctx.globalAlpha = 1.0;
```

**Benefits**:
- ✅ Players visible behind buildings
- ✅ Automatic transparency calculation
- ✅ Performance optimized (O(1) lookup)

---

### 4. DebugRenderer - Debug Drawing

```typescript
import { DebugRenderer } from 'axial-2-5d';

const debugRenderer = new DebugRenderer();
debugRenderer.setContext(game.renderer.ctx);

// Setup (once)
debugRenderer.addText({
  getText: () => `FPS: ${fps}`,
  x: 10, y: 20, color: '#0f0'
});

debugRenderer.addTileHighlight({
  getTile: () => game.inputManager.mouseGridPosition,
  color: '#ffff00',
  lineWidth: 2
});

// In rendering (onAfterRender)
debugRenderer.setEnabled(showDebug);
debugRenderer.render(ctx, gridSystem, camera, projection);
```

**Benefits**:
- ✅ Declarative debug drawing
- ✅ Automatic tile highlighting
- ✅ Toggle on/off easily

---

### 5. Logger - Unified Logging

```typescript
import { Logger } from 'axial-2-5d';

// Setup (once)
Logger.getInstance({
  level: 'info',
  outputToElement: 'log',
  showTimestamp: true
});

// Use anywhere
Logger.debug('Debug message');
Logger.info('Info message');
Logger.warn('Warning message');
Logger.error('Error message');

// Convenience functions
logger.info('Player moved');
logger.success('Level loaded');
```

---

### 6. EffectSystem - Visual Effects

```typescript
import { EffectSystem } from 'axial-2-5d';

const effectSystem = new EffectSystem(
  game.renderer.camera,
  game.projection,
  layerCount
);

// Add effects
effectSystem.addEffect({
  id: 'cloud1',
  type: 'cloud',
  col: 5, row: 5,
  layer: 4,
  size: 60,
  offsetY: -50,
  color: '#ffffff',
  alpha: 0.9
});

// In game loop (onBeforeRender)
effectSystem.update(16);

// In rendering (onAfterRender)
for (let i = 0; i < layerCount; i++) {
  const layerInfo = layerManager.getLayerStats(i);
  effectSystem.render(ctx, i, {
    parallaxFactor: layerInfo.parallax,
    alpha: layerInfo.alpha
  });
}
```

---

## 🏗️ Complete Example

```typescript
import { 
  Game, LayerManager, EffectSystem, PlayerController,
  OcclusionSystem, DebugRenderer, Logger,
  gridToWorld, worldToGrid 
} from 'axial-2-5d';

class MyGame {
  constructor() {
    this.init();
  }
  
  init() {
    // Logger
    Logger.getInstance({
      level: 'info',
      outputToElement: 'log'
    });
    
    // Game
    this.game = new Game({
      width: 800,
      height: 600,
      canvas: document.getElementById('gameCanvas'),
      projection: { type: 'isometric', viewAngle: 30 },
      onBeforeRender: (ctx) => this.onBeforeRender(ctx),
      onAfterRender: (ctx) => this.onAfterRender(ctx)
    });
    
    // Managers
    this.layerManager = new LayerManager({ layerCount: 5 });
    this.effectSystem = new EffectSystem(
      this.game.renderer.camera,
      this.game.projection,
      5
    );
    this.occlusion = new OcclusionSystem(
      this.game.gridSystem,
      this.game.entityManager,
      { occludedAlpha: 0.5 }
    );
    this.debugRenderer = new DebugRenderer();
    this.debugRenderer.setContext(this.game.renderer.ctx);
    
    // Initialize world
    this.game.init(mapData);
    this.setupWorld();
    
    // Player controller (handles input + camera)
    this.playerController = new PlayerController({
      playerId: 'player',
      camera: this.game.renderer.camera,
      projection: this.game.projection,
      gridSystem: this.game.gridSystem,
      entityManager: this.game.entityManager,
      eventBus: this.game.eventBus,
      layerManager: this.layerManager,
      smoothCamera: true
    });
    
    // Start
    this.game.start();
    Logger.info('Game started!');
  }
  
  setupWorld() {
    // Add buildings
    this.game.entityManager.addEntity({
      id: 'building1',
      col: 5, row: 5,
      width: 100, length: 100, height: 80,
      depth: 0, visible: true
    });
    
    // Add player
    this.game.entityManager.addEntity({
      id: 'player',
      col: 6, row: 6,
      width: 50, length: 50, height: 70,
      depth: 0, visible: true
    });
    
    // Setup debug
    this.debugRenderer.addText({
      getText: () => `FPS: ${this.game.debugSystem.stats.fps.toFixed(0)}`,
      x: 10, y: 20
    });
  }
  
  onBeforeRender(ctx) {
    // Update systems
    this.playerController.update(16);
    this.effectSystem.update(16);
    this.occlusion.update();
  }
  
  onAfterRender(ctx) {
    // Render effects
    for (let i = 0; i < 5; i++) {
      const stats = this.layerManager.getLayerStats(i);
      this.effectSystem.render(ctx, i, {
        parallaxFactor: stats.parallax,
        alpha: stats.alpha
      });
    }
    
    // Render debug
    this.debugRenderer.setEnabled(true);
    this.debugRenderer.render(
      ctx, 
      this.game.gridSystem, 
      this.game.renderer.camera, 
      this.game.projection
    );
  }
}

// Start game
new MyGame();
```

---

## 📊 Code Comparison

### Before (Manual Implementation)

```typescript
// Manual state tracking
const state = {
  mouse: { x: 0, y: 0 },
  player: { col: 6, row: 6 },
  showDebug: false
};

// Manual input handling
canvas.addEventListener('mousemove', e => {
  state.mouse.x = e.clientX - rect.left;
  state.mouse.y = e.clientY - rect.top;
});

game.eventBus.on('click', data => {
  // Manual coordinate conversion
  const world = screenToWorld(data.screenX, data.screenY);
  const grid = worldToGrid(world.x, world.y);
  // Manual movement logic
  if (isWalkable(grid.col, grid.row)) {
    movePlayer(grid.col, grid.row);
  }
});

// Manual camera follow
function updateCamera() {
  const playerDepth = state.player.col + state.player.row;
  const playerLayer = layerManager.getLayerForDepth(playerDepth);
  const playerParallax = layerManager.calculateParallaxFactor(playerLayer);
  const worldPos = gridToWorld(state.player.col, state.player.row);
  camera.follow(worldPos.x, worldPos.z, 0, projection, {
    smoothness: 0.1,
    parallaxFactor: playerParallax
  });
}

// Manual occlusion check
function getEntityAlpha(entity) {
  const isOccluded = checkOcclusion(entity.col, entity.row);
  return isOccluded ? 0.5 : 1.0;
}

// Manual debug drawing
function drawDebug() {
  ctx.fillStyle = '#0f0';
  ctx.fillText(`FPS: ${fps}`, 10, 20);
  // ... 50 more lines
}

// Override entire render
game.render = function() {
  updateCamera();
  game.renderer.clear('#1a1a2e');
  game.renderDefault();
  // ... manual effect rendering
  drawDebug();
};
```

**Total**: ~150 lines

---

### After (Framework Components)

```typescript
// PlayerController handles input + camera
const playerController = new PlayerController({...});

// OcclusionSystem handles transparency
const occlusion = new OcclusionSystem(grid, entities, {
  occludedAlpha: 0.5
});

// DebugRenderer handles debug drawing
debugRenderer.addText({ getText: () => `FPS: ${fps}`, x: 10, y: 20 });

// Render hooks for clean separation
new Game({
  onBeforeRender: (ctx) => {
    playerController.update(16);
    occlusion.update();
  },
  onAfterRender: (ctx) => {
    debugRenderer.render(ctx, grid, camera, projection);
  }
});
```

**Total**: ~30 lines

**Code Reduction**: **80%** 🎉

---

## 🎯 Best Practices

### 1. Use Render Hooks

```typescript
// ✅ Good: Clean separation
new Game({
  onBeforeRender: (ctx) => updateLogic(),
  onAfterRender: (ctx) => renderEffects()
});

// ❌ Bad: Override entire render
game.render = function() { ... };
```

### 2. Use PlayerController

```typescript
// ✅ Good: One line
playerController.update(16);

// ❌ Bad: Manual input handling
canvas.addEventListener('mousemove', ...);
game.eventBus.on('click', ...);
game.eventBus.on('keyDown', ...);
```

### 3. Use OcclusionSystem

```typescript
// ✅ Good: Automatic
const alpha = occlusion.getEntityAlpha(entity);

// ❌ Bad: Manual check
const isOccluded = checkOcclusion(entity.col, entity.row);
```

### 4. Use Logger

```typescript
// ✅ Good: Unified logging
Logger.info('Game started');

// ❌ Bad: Custom log function
function log(msg) { ... }
```

### 5. Update Only When Needed

```typescript
// ✅ Good: Update on entity movement
game.eventBus.on('entityMoved', () => {
  occlusion.update();
});

// ❌ Bad: Update every frame
onBeforeRender() {
  occlusion.update();  // Called 60 times per second!
}
```

---

## 🔧 Configuration Examples

### Camera Follow

```typescript
// Smooth follow (cinematic)
new PlayerController({
  smoothCamera: true,
  cameraSmoothness: 0.05  // Very smooth
});

// Tight follow (action game)
new PlayerController({
  smoothCamera: true,
  cameraSmoothness: 0.2  // More responsive
});

// Instant follow (strategy game)
new PlayerController({
  smoothCamera: false
});
```

### Occlusion

```typescript
// High transparency (ghostly)
new OcclusionSystem(grid, entities, {
  occludedAlpha: 0.3
});

// Low transparency (subtle)
new OcclusionSystem(grid, entities, {
  occludedAlpha: 0.7
});

// Only very tall objects occlude
new OcclusionSystem(grid, entities, {
  minHeight: 100
});
```

### Debug

```typescript
// Enable debug
debugRenderer.setEnabled(true);

// Disable debug
debugRenderer.setEnabled(false);

// Toggle debug
debugRenderer.toggle();
```

---

## 📚 API Reference

### PlayerController

| Method | Description |
|--------|-------------|
| `update(delta)` | Update controller (call every frame) |
| `getPosition()` | Get player position `{col, row}` |
| `moveTo(col, row)` | Move player to position |
| `moveBy(dCol, dRow)` | Move player by delta |
| `updateCamera()` | Update camera follow |
| `setCameraSmoothness(val)` | Set smoothness (0-1) |
| `setSmoothCamera(enabled)` | Enable/disable smooth follow |

### OcclusionSystem

| Method | Description |
|--------|-------------|
| `setEnabled(enabled)` | Enable/disable system |
| `isEnabled()` | Check if enabled |
| `update()` | Mark as dirty (call when entities move) |
| `getOcclusion(col, row)` | Get occlusion data |
| `isTileOccluded(col, row)` | Check if tile occluded |
| `getEntityAlpha(entity)` | Get alpha for entity |
| `getOccludedTiles()` | Get all occluded tiles |
| `getStats()` | Get statistics |

### DebugRenderer

| Method | Description |
|--------|-------------|
| `setContext(ctx)` | Set canvas context |
| `setEnabled(enabled)` | Enable/disable rendering |
| `isEnabled()` | Check if enabled |
| `toggle()` | Toggle enabled state |
| `addText(config)` | Add debug text |
| `addShape(config)` | Add debug shape |
| `addTileHighlight(config)` | Add tile highlight |
| `render(ctx, grid, camera, proj)` | Render all debug elements |
| `clear()` | Clear all debug elements |

---

## 🎮 Complete Working Example

See `examples/html/framework.html` for a complete, working example that demonstrates all framework components working together.

---

## ✅ Summary

The new Axial2.5D framework provides:

- ✅ **PlayerController** - Automatic input + camera follow
- ✅ **OcclusionSystem** - Automatic entity transparency
- ✅ **DebugRenderer** - Declarative debug drawing
- ✅ **Logger** - Unified logging
- ✅ **Render Hooks** - Clean separation of concerns
- ✅ **80% code reduction** in common patterns

Build isometric games faster with less boilerplate! 🚀

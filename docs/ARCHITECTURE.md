# Axial2.5D Framework Architecture

## 🎯 Core Design Philosophy

**Separation of Concerns**: Each component has a single, well-defined responsibility. Application code should focus on **game logic**, not infrastructure.

---

## 📦 Core Components

### 1. **Game** - Orchestrator
- Manages overall lifecycle (init, start, stop)
- Integrates all subsystems
- Provides built-in game loop (`game.start()` auto-runs)
- **No manual `requestAnimationFrame` needed**

```typescript
const game = new Game({
  width: 800,
  height: 600,
  projection: { type: 'isometric', viewAngle: 30 }
});

game.init(mapData);
game.start();  // Automatically runs game loop
```

---

### 2. **GridSystem** - Map Data
- Manages tile data (type, walkability, height)
- Coordinate conversion: `gridToWorld()`, `worldToGrid()`
- Tile queries: `getTile()`, `setTileType()`

```typescript
gridSystem.setTileType(5, 5, 'grass', true);
const tile = gridSystem.getTile(5, 5);
const worldPos = gridSystem.gridToWorld(5, 5);
```

---

### 3. **EntityManager** - Game Objects
- Manages entities (players, NPCs, buildings)
- Entity lifecycle: `addEntity()`, `removeEntity()`, `moveEntity()`
- Depth sorting for rendering

```typescript
entityManager.addEntity({
  id: 'player',
  col: 5, row: 5,
  width: 50, length: 50, height: 70
});

entityManager.moveEntity('player', 6, 5);
```

---

### 4. **Renderer + Camera** - Visual Output
- **Renderer**: Projection, layer sorting, canvas management
- **Camera**: Position, zoom, pan, **follow logic**
- Built-in support for parallax scrolling

```typescript
// Camera follows entity automatically
renderer.camera.follow(entity, {
  smooth: true,
  parallaxAware: true
});

// Manual control
renderer.camera.pan(10, 20);
renderer.camera.zoom(1.2);
```

---

### 5. **LayerManager** - Layer Configuration ⭐ NEW
- Manages layer properties (parallax, alpha, Z-offset)
- Automatic calculation based on configuration
- Per-layer statistics

```typescript
const layerManager = new LayerManager({
  layerCount: 5,
  baseParallax: 0.3,
  parallaxRange: 0.7,
  foregroundAlpha: 0.6,
  zIndexStep: 30
});

const layerInfo = layerManager.getLayerStats(3);
// { parallax: 0.72, alpha: 0.7, zIndexOffset: 90 }
```

---

### 6. **InputManager** - Unified Input ⭐ NEW
- Mouse/keyboard/touch handling
- **Automatic coordinate conversion** (screen → world → grid)
- Event emission via EventBus
- Movement direction helper

```typescript
inputManager.init();

// Listen for events
eventBus.on('click', (data) => {
  console.log(`Clicked at grid (${data.gridCol}, ${data.gridRow})`);
});

// Get movement from WASD
const { dCol, dRow } = inputManager.getMovementDirection();
```

---

### 7. **EffectSystem** - Visual Effects ⭐ NEW
- Manages clouds, particles, sparkles
- Automatic layer-aware rendering
- Lifetime management (auto-cleanup)

```typescript
effectSystem.addEffect({
  id: 'cloud1',
  type: 'cloud',
  col: 5, row: 5,
  layer: 4,
  size: 60,
  offsetY: -50,
  color: '#ffffff'
});

// Automatically rendered in renderDefault()
```

---

### 8. **UIManager** - User Interface
- Dialog system, HUD components
- Modal stack management
- Input blocking for modals

```typescript
const dialog = uiManager.createDialog('info', 'Title', 'Content');
dialog.show();
```

---

### 9. **DebugSystem** - Development Tools
- FPS counter, grid overlay, mouse info
- Entity statistics
- Custom debug drawing hooks

```typescript
debugSystem.setConfig({
  showFPS: true,
  showGrid: true,
  showMouseInfo: true
});
```

---

### 10. **EventBus** - Communication Hub
- Decoupled event system
- All components communicate through events
- Application can listen and react

```typescript
eventBus.on('entityMoved', (data) => {
  updateUI(data.entityId, data.newCol, data.newRow);
});

eventBus.emit('entityMoved', { entityId: 'player', newCol: 5, newRow: 5 });
```

---

## 🔄 Data Flow

```
┌─────────────┐
│   Input     │ Mouse/Keyboard events
│   Manager   │
└──────┬──────┘
       │ emits events
       ▼
┌─────────────┐     ┌─────────────┐
│   EventBus  │────▶│   Game      │ Update logic
└──────┬──────┘     └──────┬──────┘
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│    UI       │     │  Renderer   │ Draw frame
│   Manager   │     │  + Camera   │
└─────────────┘     └─────────────┘
```

---

## 📝 Application Code Example

### Before (Old Pattern) ❌
```typescript
// Application manages everything
const state = {
  camera: { offsetX: 0, offsetY: 0, zoom: 1 },
  mouse: { x: 0, y: 0 },
  layerSettings: { parallaxRange: 0.7, zIndexStep: 30 }
};

// Manual coordinate conversion
function screenToWorld(sx, sy) {
  const parallax = calculateParallax(playerLayer);
  // ... 20 lines of math
}

// Manual game loop
function gameLoop(timestamp) {
  update();
  render();
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
```

### After (New Pattern) ✅
```typescript
// Framework handles infrastructure
const game = new Game({ width: 800, height: 600 });
game.init(mapData);

// Listen for high-level events
game.eventBus.on('click', (data) => {
  if (isWalkable(data.gridCol, data.gridRow)) {
    game.entityManager.moveEntity('player', data.gridCol, data.gridRow);
  }
});

// Start - no manual loop needed
game.start();
```

---

## 🎯 Benefits of New Architecture

| Aspect | Before | After |
|--------|--------|-------|
| **Game Loop** | Manual `requestAnimationFrame` | `game.start()` |
| **Input** | Custom event listeners | `InputManager` + EventBus |
| **Coordinates** | Manual conversion formulas | `inputManager.screenToWorld()` |
| **Layers** | Manual parallax/alpha calc | `LayerManager` auto-calculates |
| **Effects** | Custom draw functions | `EffectSystem.addEffect()` |
| **Camera Follow** | Manual offset calculation | `camera.follow(entity)` |
| **Code Size** | ~400 lines app code | ~150 lines app code |

---

## 🚀 Migration Guide

### For Existing Projects

1. **Replace manual loop**:
   ```typescript
   // Old
   requestAnimationFrame(gameLoop);
   
   // New
   game.start();
   ```

2. **Use InputManager**:
   ```typescript
   // Old
   canvas.addEventListener('click', handleClick);
   
   // New
   eventBus.on('click', (data) => { ... });
   ```

3. **Use LayerManager**:
   ```typescript
   // Old
   const parallax = 0.3 + (layerIdx / 4) * parallaxRange;
   
   // New
   const layerInfo = layerManager.getLayerStats(layerIdx);
   ```

---

## 📊 Component Responsibility Matrix

| Feature | Game | GridSystem | EntityManager | Renderer | Camera | InputManager | LayerManager | EffectSystem |
|---------|------|------------|---------------|----------|--------|--------------|--------------|--------------|
| Lifecycle | ✅ | | | | | | | |
| Map Data | | ✅ | | | | | | |
| Entities | | | ✅ | | | | | |
| Rendering | | | | ✅ | ✅ | | | ✅ |
| Input | | | | | | ✅ | | |
| Layers | | | | ✅ | | | ✅ | |
| Effects | | | | ✅ | | | | ✅ |
| Events | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 🎓 Design Principles

1. **Framework handles infrastructure, app handles logic**
2. **Components communicate via EventBus** (loose coupling)
3. **Automatic > Manual** (parallax, coordinates, loops)
4. **Configuration over code** (LayerManager settings)
5. **Sensible defaults** (30° projection, 5 layers, etc.)

---

## 🔮 Future Enhancements

- [ ] **AI System** - Pathfinding, behavior trees
- [ ] **Animation System** - Sprite animations, transitions
- [ ] **Audio System** - BGM, SFX, spatial audio
- [ ] **Save/Load** - Game state serialization
- [ ] **Network** - Multiplayer support
- [ ] **Mobile** - Touch gestures, responsive layout

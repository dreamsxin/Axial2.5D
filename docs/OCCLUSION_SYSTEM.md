# Occlusion System - Automatic Entity Transparency

## 🎯 Overview

The Occlusion System automatically handles entity transparency when entities move behind tall objects (buildings, walls, etc.). This creates a more realistic isometric view where players can see their character even when behind obstacles.

---

## 📦 Features

### 1. Pre-calculated Occlusion Map
- Calculates which tiles are occluded by tall objects
- Caches results for O(1) lookup performance
- Only recalculates when entities move

### 2. Automatic Transparency
- Entities in occluded tiles automatically become semi-transparent
- Configurable transparency levels
- No manual checks needed in game logic

### 3. Configurable Parameters
- `occludedAlpha`: Transparency for occluded entities (default 0.5)
- `normalAlpha`: Opacity for visible entities (default 1.0)
- `minHeight`: Minimum height to cause occlusion (default 50)
- `checkHeight`: Enable/disable height checking

---

## 🚀 Usage

### Basic Setup

```typescript
import { OcclusionSystem } from 'axial-2-5d';

// Create occlusion system
const occlusion = new OcclusionSystem(
  gridSystem,
  entityManager,
  {
    occludedAlpha: 0.5,    // 50% transparent when occluded
    normalAlpha: 1.0,      // 100% opaque when visible
    minHeight: 60,         // Objects taller than 60px cause occlusion
    checkHeight: true      // Enable height checking
  }
);
```

### In Game Loop

```typescript
// Mark occlusion as dirty when entities move
occlusion.update();

// Get alpha for rendering
const alpha = occlusion.getEntityAlpha(entity);

// Use alpha in rendering
ctx.globalAlpha = alpha;
entity.draw(ctx);
ctx.globalAlpha = 1.0;
```

### Check Occlusion Status

```typescript
// Check if a specific tile is occluded
if (occlusion.isTileOccluded(player.col, player.row)) {
  console.log('Player is behind a building!');
}

// Get all occluded tiles
const occludedTiles = occlusion.getOccludedTiles();
console.log(`${occludedTiles.length} tiles are occluded`);

// Get occlusion statistics
const stats = occlusion.getStats();
console.log(`Occlusion rate: ${(stats.occlusionRate * 100).toFixed(1)}%`);
```

---

## 🎮 Integration Example

### With PlayerController

```typescript
class GameApp {
  constructor() {
    this.occlusion = new OcclusionSystem(
      this.game.gridSystem,
      this.game.entityManager,
      { occludedAlpha: 0.5 }
    );
  }
  
  onBeforeRender() {
    // Update occlusion when player moves
    this.occlusion.update();
  }
  
  onAfterRender(ctx) {
    // Render with occlusion-aware alpha
    for (const entity of this.game.entityManager.getAllEntities()) {
      const alpha = this.occlusion.getEntityAlpha(entity);
      ctx.globalAlpha = alpha;
      entity.draw(ctx);
    }
    ctx.globalAlpha = 1.0;
  }
}
```

### With EffectSystem

```typescript
// Clouds should also respect occlusion
for (let i = 0; i < layerCount; i++) {
  const effects = effectSystem.getEffectsForLayer(i);
  for (const effect of effects) {
    const alpha = occlusion.getEntityAlpha(effect);
    ctx.globalAlpha = alpha;
    effect.draw(ctx);
  }
}
```

---

## 📊 How It Works

### Occlusion Calculation Algorithm

```
1. Identify all potential occluders (tall entities)
   - Filter by minHeight
   - Store (col, row, height)

2. For each tile in the map:
   - Calculate tile depth (col + row)
   - Check all occluders:
     * If occluder.depth > tile.depth (behind tile)
     * AND occluder.height >= minHeight
     * AND depthDiff <= 3 (within range)
     * THEN tile is occluded

3. Cache results in occlusionMap
   - Key: "col,row"
   - Value: { isOccluded, occluderHeight }
```

### Depth Calculation

In isometric projection:
- **Higher (col + row) = Further from camera**
- **Lower (col + row) = Closer to camera**

```
Camera view (top-left)
    ↓
(0,0) → depth 0
(1,0) → depth 1
(0,1) → depth 1
(1,1) → depth 2
...

Occluder at (5,5) depth=10 occludes:
- Tiles with depth < 10 (in front of occluder)
- Within range of 3 tiles
- So tiles with depth 7, 8, 9 are occluded
```

---

## ⚙️ Configuration Options

### occludedAlpha (default: 0.5)

Alpha value for entities in occluded tiles.

```typescript
// More transparent
new OcclusionSystem(grid, entities, {
  occludedAlpha: 0.3
});

// Less transparent
new OcclusionSystem(grid, entities, {
  occludedAlpha: 0.7
});
```

### normalAlpha (default: 1.0)

Alpha value for entities in visible tiles.

```typescript
// Slightly transparent always
new OcclusionSystem(grid, entities, {
  normalAlpha: 0.9
});
```

### minHeight (default: 50)

Minimum entity height to cause occlusion.

```typescript
// Only very tall objects occlude
new OcclusionSystem(grid, entities, {
  minHeight: 100
});

// Even short objects occlude
new OcclusionSystem(grid, entities, {
  minHeight: 30
});
```

### checkHeight (default: true)

Enable/disable height-based occlusion.

```typescript
// Disable height checking (all entities occlude)
new OcclusionSystem(grid, entities, {
  checkHeight: false
});
```

---

## 📈 Performance

### Time Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| **Pre-calculation** | O(n × m) | n = entities, m = tiles |
| **Lookup** | O(1) | Cached result |
| **Update** | O(1) | Just marks dirty |
| **getStats** | O(m) | Scans all tiles |

### Memory Usage

- **Occlusion Map**: One entry per tile
- **Per Entry**: 2 numbers (isOccluded, occluderHeight)
- **Example**: 12×12 map = 144 entries ≈ 1KB

### Optimization Tips

1. **Update only when needed**
   ```typescript
   // Don't call update() every frame
   // Only when entities move
   game.eventBus.on('entityMoved', () => {
     occlusion.update();
   });
   ```

2. **Disable when not needed**
   ```typescript
   // Disable in cutscenes or menus
   occlusion.setEnabled(false);
   ```

3. **Adjust minHeight**
   ```typescript
   // Higher minHeight = fewer occluders = faster
   occlusion.minHeight = 80;
   ```

---

## 🎨 Visual Examples

### Example 1: Player Behind Building

```
Before (no occlusion):
[Building] ← Completely blocks player
[Player]   ← Can't see player at all

After (with occlusion):
[Building] ← Semi-transparent
[Player]   ← Visible through building
```

### Example 2: Multiple Occluders

```
Scene:
- Building A at (3,3) height=100
- Building B at (5,5) height=80
- Player at (4,4)

Result:
- Player is occluded by Building B (behind)
- Player is NOT occluded by Building A (in front)
- Alpha = 0.5 (50% transparent)
```

---

## 🔧 Troubleshooting

### Issue: Entities always transparent

**Cause**: Occlusion map not being calculated

**Solution**:
```typescript
// Call update() at least once
occlusion.update();

// Or call getOcclusion() which triggers calculation
occlusion.getOcclusion(player.col, player.row);
```

### Issue: Performance problems

**Cause**: Recalculating every frame

**Solution**:
```typescript
// Only update when entities move
game.eventBus.on('entityMoved', () => {
  occlusion.update();
});

// Don't call update() in game loop
```

### Issue: Wrong entities occluding

**Cause**: minHeight too low

**Solution**:
```typescript
// Increase minHeight
occlusion.minHeight = 80;
```

---

## 📚 API Reference

### Constructor

```typescript
new OcclusionSystem(
  gridSystem: GridSystem,
  entityManager: EntityManager,
  config?: OcclusionConfig
)
```

### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `setEnabled(enabled)` | Enable/disable system | void |
| `isEnabled()` | Check if enabled | boolean |
| `update()` | Mark as dirty | void |
| `getOcclusion(col, row)` | Get occlusion data | OcclusionData |
| `isTileOccluded(col, row)` | Check if occluded | boolean |
| `getEntityAlpha(entity)` | Get alpha for entity | number |
| `getOccludedTiles()` | Get all occluded tiles | Array |
| `getStats()` | Get statistics | Stats |
| `clear()` | Clear cache | void |

### Types

```typescript
interface OcclusionConfig {
  enabled?: boolean;
  occludedAlpha?: number;
  normalAlpha?: number;
  checkHeight?: boolean;
  minHeight?: number;
}

interface OcclusionData {
  isOccluded: boolean;
  occluderHeight: number;
}

interface OcclusionStats {
  totalTiles: number;
  occludedTiles: number;
  occlusionRate: number;
}
```

---

## ✅ Best Practices

1. **Initialize early**
   ```typescript
   // Create during game setup
   const occlusion = new OcclusionSystem(...);
   ```

2. **Update on entity movement**
   ```typescript
   // Listen for movement events
   eventBus.on('entityMoved', () => occlusion.update());
   ```

3. **Use in rendering**
   ```typescript
   // Get alpha before rendering each entity
   const alpha = occlusion.getEntityAlpha(entity);
   ctx.globalAlpha = alpha;
   ```

4. **Tune parameters**
   ```typescript
   // Adjust based on your game's scale
   minHeight: averageBuildingHeight
   occludedAlpha: desiredTransparency
   ```

---

## 🎯 Summary

The Occlusion System provides:
- ✅ **Automatic transparency** - No manual checks
- ✅ **Performance optimized** - O(1) lookup after pre-calc
- ✅ **Configurable** - Tune for your game
- ✅ **Easy integration** - Works with existing code

Perfect for isometric games where entities need to be visible behind obstacles!

# Camera Follow System

## 🎯 Overview

The `IsoCamera.follow()` method provides automatic camera following with **parallax-aware smoothing**. This eliminates the need for manual camera offset calculations in application code.

---

## 📖 Basic Usage

### Simple Follow

```typescript
// Make camera follow player instantly
camera.follow(
  playerX,
  playerY,
  0,  // ground level
  projection
);
```

### Smooth Follow with Parallax

```typescript
// Calculate player's layer parallax
const playerDepth = playerCol + playerRow;
const playerLayer = layerManager.getLayerForDepth(playerDepth);
const playerParallax = layerManager.calculateParallaxFactor(playerLayer);

// Smooth follow with parallax awareness
camera.follow(
  worldX,
  worldY,
  0,
  projection,
  {
    smoothness: 0.9,        // 0-1, higher = smoother
    parallaxFactor: playerParallax
  }
);
```

---

## ⚙️ Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `smoothness` | number | 0 | Interpolation factor (0 = instant, 0.9 = very smooth) |
| `parallaxFactor` | number | 1.0 | Parallax factor for target's layer |
| `offsetX` | number | 0 | Additional screen-space X offset |
| `offsetY` | number | 0 | Additional screen-space Y offset |

---

## 🔄 Update Loop

For continuous following, call `updateFollow()` every frame:

```typescript
// In game loop
function update() {
  // Update player position
  updatePlayer();
  
  // Camera automatically follows
  camera.updateFollow(projection, {
    worldX: player.worldX,
    worldY: player.worldY,
    parallaxFactor: playerParallax
  });
}
```

Or manually call `follow()` each frame with new position:

```typescript
function update() {
  const worldPos = gridToWorld(player.col, player.row);
  camera.follow(worldPos.x, worldPos.y, 0, projection, {
    smoothness: 0.9,
    parallaxFactor: playerParallax
  });
}
```

---

## 🎮 Examples

### Example 1: Instant Camera Snap

```typescript
// Camera instantly snaps to player position
camera.follow(playerX, playerY, 0, projection, {
  smoothness: 0  // Instant
});
```

### Example 2: Smooth Cinematic Follow

```typescript
// Very smooth, cinematic camera movement
camera.follow(playerX, playerY, 0, projection, {
  smoothness: 0.95,  // Very smooth
  parallaxFactor: 0.7
});
```

### Example 3: Follow with Offset (Third-Person)

```typescript
// Camera follows but keeps player slightly off-center
camera.follow(playerX, playerY, 0, projection, {
  smoothness: 0.9,
  offsetX: 100,  // Shift camera 100px right
  offsetY: -50   // Shift camera 50px up
});
```

### Example 4: Multi-Layer Parallax Follow

```typescript
// Get player's layer
const playerLayer = layerManager.getLayerForDepth(player.col + player.row);
const playerParallax = layerManager.calculateParallaxFactor(playerLayer);

// Follow with correct parallax for player's layer
camera.follow(
  playerWorldX,
  playerWorldY,
  playerHeight,
  projection,
  {
    smoothness: 0.9,
    parallaxFactor: playerParallax
  }
);
```

### Example 5: Stop Following

```typescript
// Stop automatic following
camera.stopFollowing();

// Check if following
if (camera.isFollowing()) {
  console.log('Camera is following a target');
}
```

---

## 🎯 Complete Example

```typescript
import { Game, LayerManager } from 'axial-2-5d';

// Setup
const game = new Game({ width: 800, height: 600 });
const layerManager = new LayerManager({ layerCount: 5 });

game.init(mapData);

// Game loop
let lastTime = 0;
function gameLoop(timestamp) {
  const delta = timestamp - lastTime;
  lastTime = timestamp;
  
  // Update player
  const { dCol, dRow } = game.inputManager.getMovementDirection();
  if (dCol !== 0 || dRow !== 0) {
    const player = game.entityManager.getEntity('player');
    if (player) {
      game.entityManager.moveEntity(player, player.col + dCol, player.row + dRow);
    }
  }
  
  // Update camera follow
  const player = game.entityManager.getEntity('player');
  if (player) {
    const playerDepth = player.col + player.row;
    const playerLayer = layerManager.getLayerForDepth(playerDepth);
    const playerParallax = layerManager.calculateParallaxFactor(playerLayer);
    
    const worldPos = game.gridSystem.gridToWorld(player.col, player.row);
    
    game.renderer.camera.follow(
      worldPos.x,
      worldPos.y,
      0,
      game.projection,
      {
        smoothness: 0.9,
        parallaxFactor: playerParallax
      }
    );
  }
  
  // Render
  game.render();
  requestAnimationFrame(gameLoop);
}

game.start();
requestAnimationFrame(gameLoop);
```

---

## 📊 Comparison

### Before (Manual) ❌

```typescript
// Manual camera follow calculation
function updateCamera() {
  const playerDepth = player.col + player.row;
  const playerLayer = Math.floor((playerDepth / 2000) * 5);
  const playerParallax = 0.3 + (playerLayer / 4) * 0.7;
  
  const worldPos = gridToWorld(player.col, player.row, 50);
  const scale = camera.scale;
  const COS_THETA = Math.cos(30 * Math.PI / 180);
  const SIN_THETA = Math.sin(30 * Math.PI / 180);
  
  const rawScreenX = (worldPos.x - worldPos.y) * COS_THETA * scale;
  const rawScreenY = (worldPos.x + worldPos.y) * SIN_THETA * scale;
  
  camera.offsetX += (-rawScreenX / playerParallax - camera.offsetX) * 0.1;
  camera.offsetY += (-rawScreenY / playerParallax - camera.offsetY) * 0.1;
}
```

### After (Automatic) ✅

```typescript
// Framework handles everything
function updateCamera() {
  const playerLayer = layerManager.getLayerForDepth(player.col + player.row);
  const playerParallax = layerManager.calculateParallaxFactor(playerLayer);
  const worldPos = gridToWorld(player.col, player.row, 50);
  
  camera.follow(worldPos.x, worldPos.y, 0, projection, {
    smoothness: 0.9,
    parallaxFactor: playerParallax
  });
}
```

**Code reduction**: ~15 lines → ~5 lines (-67%)

---

## 🔧 How It Works

1. **Calculate target screen position** using projection
2. **Apply camera zoom** to screen coordinates
3. **Calculate target offset** to center the target
4. **Adjust for parallax** (divide by parallax factor)
5. **Interpolate** current offset toward target (smoothness)

```
┌─────────────────┐
│ World Position  │ (playerX, playerY, playerZ)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Projection    │ worldToScreen()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Apply Zoom      │ scale * screenPos
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Calculate Target│ -scaledX + canvasWidth/2
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Parallax Adjust │ targetOffset / parallaxFactor
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Interpolate    │ current + (target - current) * (1 - smoothness)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Camera Offset  │ this.offsetX, this.offsetY
└─────────────────┘
```

---

## 🎓 Best Practices

1. **Call `follow()` or `updateFollow()` every frame** for smooth movement
2. **Use layer-aware parallax** for correct depth perception
3. **Adjust smoothness** based on game style:
   - Action games: 0.7-0.8 (responsive)
   - RPG/Adventure: 0.9-0.95 (cinematic)
   - Strategy: 0.5-0.7 (quick repositioning)
4. **Use `stopFollowing()`** when switching to manual camera control
5. **Combine with camera.pan()** for fine-tuning

---

## 🔮 Future Enhancements

- [ ] **Dead zone** - Don't follow until player nears screen edge
- [ ] **Look ahead** - Anticipate movement direction
- [ ] **Multiple targets** - Frame multiple entities
- [ ] **Boundary constraints** - Keep camera within map bounds
- [ ] **Zoom on follow** - Auto-zoom based on target speed

---

## 📝 API Reference

### `follow(worldX, worldY, worldZ, projection, options?)`

Make camera follow a world position.

**Parameters:**
- `worldX` (number): World X coordinate
- `worldY` (number): World Y coordinate (depth)
- `worldZ` (number): World Z coordinate (height)
- `projection` (Projection): Projection instance
- `options` (object, optional):
  - `smoothness` (number): 0-1, default 0
  - `parallaxFactor` (number): 0-1, default 1.0
  - `offsetX` (number): Screen-space X offset
  - `offsetY` (number): Screen-space Y offset

### `updateFollow(projection, options?)`

Update follow target position (call every frame).

**Parameters:**
- `projection` (Projection): Projection instance
- `options` (object, optional):
  - `worldX` (number): New X position
  - `worldY` (number): New Y position
  - `worldZ` (number): New Z position
  - `parallaxFactor` (number): New parallax factor

### `stopFollowing()`

Stop automatic following.

### `isFollowing()`

Check if camera is currently following a target.

**Returns:** `boolean`

### `followTarget`

Current follow target configuration (public property).

**Type:**
```typescript
{
  worldX: number;
  worldY: number;
  worldZ: number;
  parallaxFactor: number;
  smoothness: number;
  enabled: boolean;
} | null
```

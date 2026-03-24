# Standalone vs Framework 实现对比

## 核心差异分析

### 1. 坐标系统

#### Standalone.html
```javascript
// 常量定义
const CELL_SIZE = 50;
const COS_THETA = Math.cos(30 * Math.PI / 180);  // ≈ 0.866
const SIN_THETA = Math.sin(30 * Math.PI / 180);  // 0.5

// gridToWorld: 简单乘法
function gridToWorld(col, row) {
  return { x: col * CELL_SIZE, y: row * CELL_SIZE };
}

// worldToScreen: 等距投影
function worldToScreen(worldX, worldY, worldZ, parallaxFactor = 1.0) {
  const scale = state.camera.zoom;
  const offsetX = state.camera.offsetX * parallaxFactor;
  const offsetY = state.camera.offsetY * parallaxFactor;
  
  const screenX = (worldX - worldY) * COS_THETA * scale;
  const screenY = (worldX + worldY) * SIN_THETA * scale - worldZ * scale;
  
  return {
    sx: screenX + offsetX + canvas.width / 2,
    sy: screenY + offsetY + canvas.height / 2
  };
}
```

#### Framework (GridSystem.ts)
```typescript
// 常量
this.tileW = 50;
this.tileH = 50;

// gridToWorld: 简单乘法 ✓
public gridToWorld(col: number, row: number): WorldCoord {
  const x = col * this.tileW;
  const z = row * this.tileH;  // 注意：这里用 z 表示 ground Y
  return { x, z };
}

// Projection.worldToScreen: 等距投影 ✓
public worldToScreen(worldX: number, worldY: number, worldZ: number = 0): ScreenCoord {
  sx = (worldX - worldY) * this.cosView * this.tileScale;
  sy = (worldX + worldY) * this.sinView * this.tileScale - worldZ;
}
```

**状态**: ✅ 已匹配

---

### 2. Tile 渲染

#### Standalone.html
```javascript
function drawTile(col, row, type, layerIndex) {
  const worldPos = gridToWorld(col, row);
  const parallax = getParallaxFactor(layerIndex);
  
  // 计算 4 个角点的世界坐标
  const corners = [
    { x: worldPos.x, y: worldPos.y },
    { x: worldPos.x + CELL_SIZE, y: worldPos.y },
    { x: worldPos.x + CELL_SIZE, y: worldPos.y + CELL_SIZE },
    { x: worldPos.x, y: worldPos.y + CELL_SIZE }
  ].map(c => worldToScreen(c.x, c.y, 0, parallax));
  
  // 连接投影后的角点
  ctx.beginPath();
  ctx.moveTo(corners[0].sx, corners[0].sy);
  for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].sx, corners[i].sy);
  ctx.closePath();
  
  ctx.fillStyle = colors[type];
  ctx.fill();
}
```

#### Framework (GridSystem.renderGround)
```typescript
// 计算 4 个角点的世界坐标 ✓
const corners = [
  { x: worldPos.x, y: worldPos.z },
  { x: worldPos.x + this.tileW, y: worldPos.z },
  { x: worldPos.x + this.tileW, y: worldPos.z + this.tileH },
  { x: worldPos.x, y: worldPos.z + this.tileH }
].map(c => camera.worldToScreen(c.x, c.y, tile.height, projection, parallaxFactor));

// 连接投影后的角点 ✓
ctx.beginPath();
ctx.moveTo(corners[0].sx, corners[0].sy);
for (let i = 1; i < 4; i++) {
  ctx.lineTo(corners[i].sx, corners[i].sy);
}
ctx.closePath();
```

**状态**: ✅ 已匹配

---

### 3. 相机跟随

#### Standalone.html
```javascript
function updateCamera() {
  const worldPos = gridToWorld(state.player.col, state.player.row);
  const playerLayer = getPlayerLayer();
  const playerParallax = getParallaxFactor(playerLayer);
  
  // 计算原始屏幕位置（不考虑 canvas 中心和相机偏移）
  const scale = state.camera.zoom;
  const rawScreenX = (worldPos.x - worldPos.y) * COS_THETA * scale;
  const rawScreenY = (worldPos.x + worldPos.y) * SIN_THETA * scale;
  
  // 相机偏移除以玩家图层视差，使玩家在其图层上居中
  state.camera.targetOffsetX = -rawScreenX / playerParallax;
  state.camera.targetOffsetY = -rawScreenY / playerParallax;
  
  // 平滑跟随
  if (!state.isDragging) {
    state.camera.offsetX += (state.camera.targetOffsetX - state.camera.offsetX) * 0.1;
    state.camera.offsetY += (state.camera.targetOffsetY - state.camera.offsetY) * 0.1;
  }
}
```

#### Framework (framework.html)
```javascript
function updateCamera() {
  const playerDepth = state.player.col + state.player.row;
  const playerLayer = Math.floor((playerDepth / 2000) * CONFIG.layerCount);
  const playerParallax = 0.3 + (playerLayer / (CONFIG.layerCount - 1)) * state.layerSettings.parallaxRange;
  
  const worldPos = gridToWorld(state.player.col, state.player.row, CONFIG.cellSize);
  
  const scale = state.camera.zoom;
  const COS_THETA = Math.cos(30 * Math.PI / 180);
  const SIN_THETA = Math.sin(30 * Math.PI / 180);
  const rawScreenX = (worldPos.x - worldPos.y) * COS_THETA * scale;
  const rawScreenY = (worldPos.x + worldPos.y) * SIN_THETA * scale;
  
  const camera = game.renderer.camera;
  camera.offsetX += (-rawScreenX / playerParallax - camera.offsetX) * 0.1;
  camera.offsetY += (-rawScreenY / playerParallax - camera.offsetY) * 0.1;
  camera.setZoom(state.camera.zoom);
}
```

**状态**: ✅ 已匹配

---

### 4. 分层渲染循环

#### Standalone.html
```javascript
function render() {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  updateCamera();
  
  // 按图层渲染（从后到前）：Layer 0 → Layer 4
  for (let layerIdx = 0; layerIdx < LAYER_COUNT; layerIdx++) {
    const parallax = getParallaxFactor(layerIdx);
    const zOffset = getZIndexOffset(layerIdx);
    
    ctx.save();
    
    // 应用 Z 轴偏移
    if (zOffset !== 0) {
      ctx.translate(0, -zOffset);  // 负值 = 向上（前景）
    }
    
    // 绘制该图层的地块
    for (let c = 0; c < mapSize; c++) {
      for (let r = 0; r < mapSize; r++) {
        if (getLayerForDepth(c + r) === layerIdx) {
          drawTile(c, r, tiles[c][r].type, layerIdx);
        }
      }
    }
    
    // 绘制网格
    drawGrid(parallax);
    
    // 绘制该图层的实体
    for (const entity of state.entities) {
      const entityLayer = getLayerForDepth(entity.col + entity.row);
      if (entityLayer === layerIdx) {
        drawBox(entity, layerIdx);
      }
    }
    
    // 绘制云朵
    if (layerIdx === LAYER_COUNT - 1) {
      for (const cloud of cloudTiles) {
        drawCloud(cloud, layerIdx);
      }
    }
    
    ctx.restore();
  }
}
```

#### Framework (Game.renderDefault)
```typescript
public renderDefault(options) {
  for (let layerIdx = 0; layerIdx < layerCount; layerIdx++) {
    const parallaxFactor = 0.3 + (layerIdx / (layerCount - 1)) * parallaxRange;
    const alpha = 1.0 - (1.0 - foregroundAlpha) * (layerIdx / (layerCount - 1));
    const zIndexOffset = layerIdx * zIndexStep;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (zIndexOffset !== 0) {
      ctx.translate(0, -zIndexOffset);
    }

    // 渲染地块（GridSystem 内部已按图层过滤）
    this.gridSystem.renderGround(ctx, camera, {
      layerIndex: layerIdx,
      layerCount,
      showGrid: showGrid && layerIdx === 0,
      parallaxFactor,
      zIndexOffset: 0,
      maxDepth
    });

    // 只在最后一层渲染实体
    if (layerIdx === layerCount - 1) {
      this.entityManager.render(ctx, {
        parallaxFactor,
        zIndexOffset: 0
      });
    }

    ctx.restore();
  }
}
```

**状态**: ⚠️ 部分匹配 - 差异点：
1. ❌ 框架在循环内设置 `ctx.globalAlpha`，standalone 没有
2. ⚠️ 实体只在最后一层渲染，应该按深度分层
3. ❌ 网格线只在 layer 0 渲染，standalone 每层都渲染

---

### 5. 地块分层逻辑

#### Standalone.html
```javascript
function getLayerForDepth(depth) {
  const maxDepth = 2000;
  const layerIndex = Math.floor((depth / maxDepth) * LAYER_COUNT);
  return Math.max(0, Math.min(LAYER_COUNT - 1, layerIndex));
}

// 在渲染循环中
for (let c = 0; c < mapSize; c++) {
  for (let r = 0; r < mapSize; r++) {
    if (getLayerForDepth(c + r) === layerIdx) {
      drawTile(c, r, tiles[c][r].type, layerIdx);
    }
  }
}
```

#### Framework (GridSystem.renderGround)
```typescript
// Calculate depth (col + row for isometric)
const depth = col + row;
const tileLayer = Math.floor((depth / maxDepth) * layerCount);

// Only render tiles for this layer
if (tileLayer !== layerIndex) continue;
```

**状态**: ✅ 已匹配

---

### 6. 图层属性计算

#### Standalone.html
```javascript
// Layer 4 (foreground) = 100%, Layer 0 (background) = 30%
function getParallaxFactor(layerIndex) {
  const parallaxRange = state.layerSettings.parallaxRange;
  return 0.3 + (layerIndex / (LAYER_COUNT - 1)) * parallaxRange;
}

// Layer 4 (foreground) = low alpha, Layer 0 (background) = 100% alpha
function getLayerAlpha(layerIndex) {
  const t = layerIndex / (LAYER_COUNT - 1);
  return 1.0 - (1.0 - state.layerSettings.foregroundAlpha) * t;
}

// Layer 0 = base, higher layers offset
function getZIndexOffset(layerIndex) {
  return layerIndex * state.layerSettings.zIndexStep;
}
```

#### Framework (LayerManager)
```typescript
public getParallaxFactor(layerIndex, layerCount, parallaxRange) {
  return 0.3 + (layerIndex / (layerCount - 1)) * parallaxRange;
}

public getLayerAlpha(layerIndex, layerCount, foregroundAlpha) {
  const t = layerIndex / (layerCount - 1);
  return 1.0 - (1.0 - foregroundAlpha) * t;
}

public getZIndexOffset(layerIndex, zIndexStep) {
  return layerIndex * zIndexStep;
}
```

**状态**: ✅ 已匹配

---

## 待修复问题

### 1. 网格线渲染
**问题**: 框架只在 layer 0 渲染网格线，standalone 每层都渲染

**修复**:
```typescript
// GridSystem.renderGround
if (showGrid) {
  this.renderGrid(ctx, camera, parallaxFactor, gridColor);
}
```

### 2. 实体分层
**问题**: 框架只在最后一层渲染所有实体，应该按深度分层

**修复**:
```typescript
// EntityManager.render
// 添加 layerIndex, layerCount, maxDepth 参数
// 过滤实体只渲染当前层的
```

### 3. Alpha 混合
**问题**: 框架在每层设置 `ctx.globalAlpha`，但 standalone 没有

**分析**: standalone 的 alpha 是通过云朵等特定对象的透明度实现的，不是全局图层 alpha

**决策**: 保留框架的 alpha 实现，这是更好的视觉效果

---

## 总结

| 组件 | 状态 | 备注 |
|------|------|------|
| 坐标系统 | ✅ | 已完全匹配 |
| Tile 投影 | ✅ | 4 角点投影已实现 |
| 相机跟随 | ✅ | 视差感知跟随 |
| 分层逻辑 | ✅ | col+row 深度计算 |
| 图层属性 | ✅ | parallax/alpha/zOffset |
| 网格线 | ⚠️ | 只在 layer 0 渲染 |
| 实体分层 | ❌ | 未按深度分层 |
| Alpha 混合 | ⚠️ | 实现不同但效果更好 |

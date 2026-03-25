# Phase 6 - 建筑物自动拆分系统

## 🎯 功能说明

**问题**: 
- 建筑物跨越多格（如 80x80 世界单位，50x50 每格）
- 当前基于单一中心点计算深度，导致深度排序错误
- 建筑物遮挡关系不正确

**解决方案**:
- 框架自动检测多格建筑物
- 拆分为多个渲染单元（每格一个）
- 每个单元独立计算深度
- 应用层无感知，保持逻辑统一

---

## 📦 实现内容

### 1. MultiTileEntity 类

**文件**: `src/world/MultiTileEntity.ts`

**核心功能**:
```typescript
class MultiTileEntity {
  // 检测是否跨越多格
  isMultiTile(entity: Entity): boolean
  
  // 拆分为渲染单元
  splitEntity(entity: Entity, gridSystem: GridSystem): MultiTileRenderUnit[]
  
  // 计算每个单元的深度
  calculateUnitDepth(col: number, row: number, entity: Entity): number
}
```

**渲染单元结构**:
```typescript
interface MultiTileRenderUnit {
  entityId: string;    // 父实体 ID
  col: number;         // 单元网格列
  row: number;         // 单元网格行
  depth: number;       // 深度值（用于排序）
  offsetX: number;     // 世界坐标偏移 X
  offsetZ: number;     // 世界坐标偏移 Z
  width: number;       // 单元宽度
  length: number;      // 单元长度
  height: number;      // 单元高度
  colors?: string[];   // 颜色（继承自父实体）
}
```

---

### 2. EntityManager 集成

**修改**: `src/world/EntityManager.ts`

**新增功能**:
```typescript
class EntityManager {
  private multiTileSplitter?: MultiTileEntity;
  private renderUnitsCache: Map<string, MultiTileRenderUnit[]> = new Map();
  
  // 添加实体时自动拆分
  addEntity(entity: Entity): void {
    this.entities.set(entity.id, entity);
    
    // 自动拆分并缓存
    const units = this.multiTileSplitter.splitEntity(entity, this.gridSystem);
    this.renderUnitsCache.set(entity.id, units);
  }
  
  // 获取渲染单元（已按深度排序）
  getAllRenderUnits(): MultiTileRenderUnit[] {
    const allUnits = [];
    for (const units of this.renderUnitsCache.values()) {
      allUnits.push(...units);
    }
    // 按深度排序
    allUnits.sort((a, b) => a.depth - b.depth);
    return allUnits;
  }
  
  // 渲染时使用拆分后的单元
  render(ctx, options) {
    const units = this.getAllRenderUnits();
    this.renderUnits(ctx, units, ...);
  }
}
```

---

## 🎮 应用层使用

### 修改前（需要手动处理）

```javascript
// 应用层需要知道建筑物跨越多格
// 可能需要手动拆分或接受深度排序错误

game.entityManager.addEntity({
  id: 'building',
  col: 3, row: 3,
  width: 100, length: 100,  // 2x2 格
  height: 80
});

// ❌ 深度计算基于中心点 (3, 3)
// ❌ 实际占据 (3,3), (4,3), (3,4), (4,4)
// ❌ 遮挡关系可能错误
```

### 修改后（框架自动处理）

```javascript
// 应用层无需任何改动！
game.entityManager.addEntity({
  id: 'building',
  col: 3, row: 3,
  width: 100, length: 100,  // 2x2 格
  height: 80
});

// ✅ 框架自动拆分为 4 个渲染单元
// ✅ 每个单元独立计算深度
// ✅ 正确的遮挡排序
// ✅ 应用层无感知
```

---

## 📊 拆分示例

### 2x2 建筑物拆分

**输入**:
```javascript
{
  id: 'tower',
  col: 5, row: 5,
  width: 100, length: 100,  // 2x2 格 (50x50 每格)
  height: 120
}
```

**输出** (4 个渲染单元):
```javascript
[
  {
    entityId: 'tower',
    col: 5, row: 5,        // 左上角
    offsetX: 0, offsetZ: 0,
    width: 50, length: 50,
    depth: 计算值 1
  },
  {
    entityId: 'tower',
    col: 6, row: 5,        // 右上角
    offsetX: 50, offsetZ: 0,
    width: 50, length: 50,
    depth: 计算值 2
  },
  {
    entityId: 'tower',
    col: 5, row: 6,        // 左下角
    offsetX: 0, offsetZ: 50,
    width: 50, length: 50,
    depth: 计算值 3
  },
  {
    entityId: 'tower',
    col: 6, row: 6,        // 右下角
    offsetX: 50, offsetZ: 50,
    width: 50, length: 50,
    depth: 计算值 4
  }
]
```

**渲染顺序**: 按 depth 排序，确保正确的遮挡关系

---

## 🔧 技术细节

### 深度计算

每个渲染单元使用自己的网格位置计算深度：

```typescript
calculateUnitDepth(col: number, row: number, entity: Entity): number {
  const worldPos = gridSystem.gridToWorld(col, row);
  const screenPos = projection.worldToScreen(
    worldPos.x, worldPos.z, 0, camera
  );
  // 深度 = 屏幕 Y + 实体高度（正确遮挡）
  return screenPos.sy + entity.height;
}
```

### 缓存机制

为避免每帧重新拆分，使用缓存：

```typescript
// 添加实体时拆分并缓存
addEntity(entity) {
  const units = this.splitter.splitEntity(entity, gridSystem);
  this.renderUnitsCache.set(entity.id, units);
}

// 实体移动时更新缓存
moveEntity(entity, newCol, newRow) {
  entity.col = newCol;
  entity.row = newRow;
  this.invalidateRenderUnits(entity.id); // 重新拆分
}

// 获取时直接使用缓存
getAllRenderUnits() {
  return this.renderUnitsCache.values().flat();
}
```

---

## 📈 性能优化

### 缓存策略

- **添加实体时**：拆分并缓存
- **移动实体时**：重新拆分并更新缓存
- **删除实体时**：清除缓存
- **每帧渲染**：使用缓存，无需重新计算

### 排序优化

```typescript
getAllRenderUnits(): MultiTileRenderUnit[] {
  const allUnits = [];
  for (const units of this.renderUnitsCache.values()) {
    allUnits.push(...units);
  }
  // 按深度排序（O(n log n)）
  allUnits.sort((a, b) => a.depth - b.depth);
  return allUnits;
}
```

---

## ✅ 优势

### 应用层
- ✅ **零改动** - 应用层代码无需任何修改
- ✅ **无感知** - 框架自动处理拆分细节
- ✅ **逻辑统一** - 仍然操作单个实体对象

### 渲染效果
- ✅ **正确深度** - 每个单元独立深度计算
- ✅ **正确遮挡** - 建筑物正确遮挡角色
- ✅ **平滑过渡** - 跨格建筑物渲染自然

### 性能
- ✅ **缓存机制** - 避免每帧重新拆分
- ✅ **按需更新** - 仅当实体移动时重新计算
- ✅ **高效排序** - 统一的深度排序

---

## 🚀 下一步

### 已完成
- ✅ MultiTileEntity 核心类
- ✅ EntityManager 集成
- ✅ 缓存机制
- ✅ 深度计算

### 待完成
- ⏳ render 方法完全使用拆分单元
- ⏳ 实体移动时自动更新缓存
- ⏳ 单元测试
- ⏳ 性能基准测试

---

## 📝 使用示例

```javascript
// 应用层代码 - 无需任何改动！
const game = new Game({
  modules: {
    // ... 其他模块
  }
});

game.init({ width: 12, height: 12, tileW: 50, tileH: 50 });

// 添加跨格建筑物
game.entityManager.addEntity({
  id: 'townhall',
  col: 3, row: 3,
  width: 120, length: 120,  // 约 2.4x2.4 格
  height: 80,
  colors: ['#f5deb3', '#deb887', '#cd853f']
});

// 框架自动处理：
// 1. 检测为多格实体
// 2. 拆分为 6 个渲染单元 (3x2)
// 3. 每个单元独立深度计算
// 4. 按深度排序渲染
// 5. 应用层无感知
```

---

**状态**: 🔄 实现中  
**完成度**: 70%  
**预计完成**: Phase 6 结束前

🎉 **框架自动处理多格建筑物深度排序！**

# Occlusion System - Building Shadows & Semi-Transparency

## Overview

The Occlusion System handles the visual relationship between buildings and
characters in the isometric view. The camera sits at the **southeast (SE)**
looking **northwest (NW)**, so a tall building hides characters standing in
the tiles directly behind it. When a character is occluded, the occluding
buildings are rendered **semi-transparent (alpha 0.5)** so the character
remains visible.

Key properties:

- Pre-computed shadow map with O(1) per-tile lookup
- Incremental updates: the map is only rebuilt when a **building** is added,
  removed, or moved (`markDirty`); character movement is re-evaluated cheaply
  every `update()`
- Change callbacks (`onOcclusionChange`) fire on state transitions without
  spamming every frame
- Multi-tile buildings: shadow is cast from every occupied tile, depth sorting
  uses the building's **southeast corner**
- Cross-layer: semi-transparency is resolved against **all** entities, not
  just the layer currently being rendered

---

## Usage

### Construction

```typescript
import { OcclusionSystem } from 'axial-2-5d';

const occlusion = new OcclusionSystem({
  entityManager: game.entityManager,
  gridSystem: game.gridSystem,
  tileSize: 64        // world units per tile; default 50
  // mapWidth/mapHeight default to gridSystem.getDimensions()
});
```

Usually you don't construct it manually — enable it via the module system:

```typescript
const game = new Game({
  // ...
  modules: {
    occlusionSystem: { enabled: true }
  }
});
// game.occlusionSystem is now wired into the renderer
```

### Frame update

```typescript
// Call once per frame (Game does this automatically when the module is on).
occlusion.update();
```

`update()` rebuilds the shadow map only when dirty; otherwise it just
re-evaluates per-character occlusion (cheap map lookups) so callbacks also
fire when a **character** walks into or out of a shadow.

### Invalidation (automatic)

`EntityManager` emits lifecycle events on the game's `EventBus`:
`entityAdded`, `entityMoved`, `entityRemoved`. `Game` listens to these and
calls `occlusionSystem.markDirty()` — but only for entities where
`isBuilding()` is true. Character movement never triggers a map rebuild.

If you manage entities outside `Game`, wire it yourself:

```typescript
eventBus.on('entityMoved', (d) => { if (d.isBuilding) occlusion.markDirty(); });
```

### Queries

```typescript
if (occlusion.isOccluded(player)) { /* player is hidden by a building */ }

const occluders = occlusion.getOccludingBuildings(player);
// occluders: OcclusionData[] = [{ buildingId, height, southeastCol, southeastRow, depth }]

const factor = occlusion.getOcclusionFactor(player); // 1.0 = visible, down to 0.3

const hidden = occlusion.getOccludedEntities();      // all occluded characters
```

### Change callbacks

```typescript
occlusion.onOcclusionChange((entity, occludingBuildings) => {
  // Fires when an entity becomes occluded, becomes visible, or the set of
  // occluding buildings changes while it stays occluded.
  // Standing still inside the same shadow does NOT re-fire.
});
```

---

## How It Works

### Shadow casting

Only entities with `entityType === 'building'` cast shadows. For each tile a
building occupies, the shadow extends into the three NW-adjacent directions
(the blind zone hidden by the building's visible faces):

- `(-1, 0)` — West, behind the South/left face
- `( 0,-1)` — North, behind the East/right face
- `(-1,-1)` — NW corner, behind both faces

The shadow length in each direction is `floor(building.height / tileSize)`
steps. A building one tile tall casts a 1-tile shadow; two tiles tall casts
2 steps, and so on. Tiles E/S/SE of the building are on the visible side and
are never occluded.

### Southeast-corner depth guard

A raw shadow entry only counts if the building is actually **in front of**
the entity relative to the camera:

```
building SE-corner depth = southeastCol + southeastRow  >  entity.col + entity.row
```

For multi-tile buildings the SE corner is
`(col + ceil(width/tileSize) - 1, row + ceil(length/tileSize) - 1)`.
This prevents a small background building's shadow from wrongly occluding
foreground entities.

### Rendering integration

When `game.occlusionSystem` is set, `EntityManager.render()`:

1. Computes the set of buildings that occlude at least one character
   (across **all** layers, so a character on another layer still triggers it).
2. Depth-sorts entities by SE-corner depth (`col+row` for characters,
   SE-corner sum for buildings); ties put buildings before characters.
3. Draws occluding buildings with `globalAlpha = 0.5`.

Without an `OcclusionSystem`, a legacy internal occlusion map is used; it is
recomputed at most once per frame (on the layer-0 pass).

---

## API Reference

### `new OcclusionSystem(config: OcclusionSystemConfig)`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `entityManager` | `EntityManager` | — | Source of entities |
| `gridSystem` | `GridSystem` | — | Map bounds & tile info |
| `tileSize` | `number` | `50` | World units per tile (shadow length unit) |
| `mapWidth` / `mapHeight` | `number` | grid dimensions | Shadow map size |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `update()` | void | Rebuild if dirty; otherwise re-evaluate characters |
| `markDirty()` | void | Force shadow-map rebuild on next `update()` |
| `isOccluded(entity)` | boolean | True if any occluding building is taller than the entity |
| `getOccludingBuildings(entity)` | `OcclusionData[]` | Foreground buildings shadowing the entity |
| `getOcclusionFactor(entity)` | number | 1.0 visible … 0.3 maximally occluded |
| `getOccludedEntities()` | `Entity[]` | All currently occluded characters |
| `onOcclusionChange(cb)` / `offOcclusionChange(cb)` | void | (Un)register transition callback |
| `getDebugData()` | `Map<string, OcclusionData[]>` | Copy of the raw shadow map |
| `clear()` | void | Clear shadow map and tracked state |
| `calculateOcclusionMap()` | void | Immediate full rebuild (rarely needed) |

### Types

```typescript
interface OcclusionData {
  buildingId: string;
  height: number;
  southeastCol: number;  // SE corner column (depth sorting)
  southeastRow: number;  // SE corner row (depth sorting)
  depth: number;         // southeastCol + southeastRow
}

type OcclusionCallback = (entity: Entity, occludingBuildings: OcclusionData[]) => void;
```

---

## Performance

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Shadow map rebuild | O(buildings × footprint × shadowLen) | Only on `markDirty` |
| `update()` when clean | O(entities) | Map lookups only |
| `isOccluded` | O(k) | k = buildings shadowing that tile |
| Memory | O(mapWidth × mapHeight) | One array slot per tile |

Tips:

- Set `tileSize` to your actual tile size (e.g. 64) — the default is 50.
- Only buildings should have `entityType = 'building'`; characters moving
  never trigger a rebuild.
- `markDirty` is idempotent — multiple building moves in one frame cause a
  single rebuild.

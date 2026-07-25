/**
 * Axial2.5D Test Suite
 */

import {
  Projection,
  IsoCamera,
  CanvasRenderer,
  GridSystem,
  EntityManager,
  BasicEntity,
  PathFinder,
  EventBus,
  MapData,
  TileData,
  IsoBox,
  OcclusionSystem,
  LayerManager,
  InputManager,
  worldToGrid as isoWorldToGrid
} from '../src/index';

// Canvas will be created by CanvasRenderer in mock mode if needed

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${e}`);
    failed++;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual: any, expected: any, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

console.log('Axial2.5D Test Suite\n');
console.log('====================\n');

// ============================================================================
// Projection Tests
// ============================================================================
console.log('Projection Tests:');
console.log('-----------------');

test('Isometric projection creates correct instance', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  assert(proj.type === 'isometric', 'Type should be isometric');
  assertEqual(proj.tileScale, 1, 'Default scale should be 1');
});

test('Isometric worldToScreen conversion', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const result = proj.worldToScreen(64, 0, 0);
  
  // For 45° isometric: screenX = (x - z) * cos(45) = 64 * 0.707... ≈ 45.25
  const expected = 64 * Math.cos(Math.PI / 4);
  assert(Math.abs(result.sx - expected) < 0.1, `screenX should be ~${expected}`);
});

test('Isometric screenToWorld roundtrip', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const original = { worldX: 100, worldY: 50 };
  
  const screen = proj.worldToScreen(original.worldX, original.worldY, 0);
  const world = proj.screenToWorld(screen.sx, screen.sy, 0);
  
  assert(Math.abs(world.worldX - original.worldX) < 0.1, 'worldX should match after roundtrip');
  assert(Math.abs(world.worldY - original.worldY) < 0.1, 'worldY should match after roundtrip');
});

test('Dimetric projection with custom tilt', () => {
  const proj = new Projection({ type: 'dimetric', viewAngle: 45, tiltAngle: 30 });
  const result = proj.worldToScreen(64, 0, 0);
  
  assert(proj.type === 'dimetric', 'Type should be dimetric');
  assertEqual(proj.tiltAngleRad, (30 * Math.PI) / 180, 'Tilt angle should be 30°');
});

test('Projection scale update', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45, tileScale: 1 });
  proj.setScale(2);
  assertEqual(proj.tileScale, 2, 'Scale should be updated to 2');
});

console.log('');

// ============================================================================
// Camera Tests
// ============================================================================
console.log('Camera Tests:');
console.log('-------------');

test('Camera initializes with correct defaults', () => {
  const camera = new IsoCamera(800, 600);
  assertEqual(camera.offsetX, 0, 'Default offsetX should be 0');
  assertEqual(camera.offsetY, 0, 'Default offsetY should be 0');
  assertEqual(camera.scale, 1, 'Default scale should be 1');
});

test('Camera pan', () => {
  const camera = new IsoCamera(800, 600);
  camera.pan(100, 50);
  assertEqual(camera.offsetX, 100, 'offsetX should be 100');
  assertEqual(camera.offsetY, 50, 'offsetY should be 50');
});

test('Camera zoom', () => {
  const camera = new IsoCamera(800, 600);
  camera.zoom(1.5);
  assertEqual(camera.scale, 1.5, 'Scale should be 1.5');
});

test('Camera zoom limits', () => {
  const camera = new IsoCamera(800, 600);
  camera.zoom(0.05); // Should clamp to 0.1
  assert(camera.scale >= 0.1, 'Scale should not go below 0.1');
  
  camera.zoom(100); // Should clamp to 5
  assert(camera.scale <= 5, 'Scale should not go above 5');
});

test('Camera setPosition with projection', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const camera = new IsoCamera(800, 600);
  camera.setPosition(100, 100, proj);
  
  // Regression (BUG-1): target must project exactly onto the canvas center,
  // i.e. offset = -proj * scale (previously a half-canvas term was missing).
  const sp = proj.worldToScreen(100, 100, 0);
  const screen = camera.cameraToScreen(sp.sx, sp.sy);
  assert(Math.abs(screen.sx - 400) < 0.001, `Target screenX should be canvas center 400, got ${screen.sx}`);
  assert(Math.abs(screen.sy - 300) < 0.001, `Target screenY should be canvas center 300, got ${screen.sy}`);
});

test('Camera setPosition centers target at any zoom level', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const camera = new IsoCamera(800, 600);
  camera.zoom(2);
  camera.setPosition(100, 100, proj);
  
  const sp = proj.worldToScreen(100, 100, 0);
  const screen = camera.cameraToScreen(sp.sx, sp.sy);
  assert(Math.abs(screen.sx - 400) < 0.001, 'Target should stay centered at scale 2');
  assert(Math.abs(screen.sy - 300) < 0.001, 'Target should stay centered at scale 2');
});

test('Camera pipeline roundtrip (cameraToScreen <-> screenToCameraSpace)', () => {
  const camera = new IsoCamera(800, 600);
  camera.pan(37, -22);
  camera.zoom(1.8);
  
  // Regression (BUG-2): both transform paths must share the same convention
  // screen = proj * scale + offset + center.
  const pt = { sx: 123, sy: -45 };
  const screen = camera.cameraToScreen(pt.sx, pt.sy);
  const back = camera.screenToCameraSpace(screen.sx, screen.sy);
  assert(Math.abs(back.sx - pt.sx) < 0.001, `Roundtrip sx mismatch: ${back.sx} != ${pt.sx}`);
  assert(Math.abs(back.sy - pt.sy) < 0.001, `Roundtrip sy mismatch: ${back.sy} != ${pt.sy}`);
});

console.log('');

// ============================================================================
// GridSystem Tests
// ============================================================================
console.log('GridSystem Tests:');
console.log('-----------------');

test('GridSystem creates default tiles', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const grid = new GridSystem({ width: 5, height: 5, tileW: 64, tileH: 32 }, proj);
  
  const tile = grid.getTile(2, 2);
  assert(tile !== null, 'Tile should exist');
  assertEqual(tile!.type, 'grass', 'Default tile type should be grass');
  assertEqual(tile!.walkable, true, 'Default tile should be walkable');
});

test('GridSystem gridToWorld conversion', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const grid = new GridSystem({ width: 10, height: 10, tileW: 64, tileH: 32 }, proj);
  
  // gridToWorld returns the tile's world-space corner: (col * tileW, row * tileH)
  const world = grid.gridToWorld(5, 5);
  assertEqual(world.x, 320, 'Grid (5,5) should map to x=320 (5 * 64)');
  assertEqual(world.z, 160, 'Grid (5,5) should map to z=160 (5 * 32)');
});

test('GridSystem worldToGrid roundtrip', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const grid = new GridSystem({ width: 10, height: 10, tileW: 64, tileH: 32 }, proj);
  
  const original = { col: 3, row: 7 };
  const world = grid.gridToWorld(original.col, original.row);
  const gridPos = grid.worldToGrid(world.x, world.z);
  
  assertEqual(gridPos.col, original.col, 'Column should match after roundtrip');
  assertEqual(gridPos.row, original.row, 'Row should match after roundtrip');
});

test('GridSystem isWalkable with entity', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const grid = new GridSystem({ width: 5, height: 5, tileW: 64, tileH: 32 }, proj);
  const camera = new IsoCamera(800, 600);
  const entityManager = new EntityManager(grid, proj, camera);
  
  const entity = new BasicEntity('test', 2, 2);
  entityManager.addEntity(entity);
  
  assert(grid.isWalkable(2, 2) === false, 'Tile with entity should not be walkable');
  assert(grid.isWalkable(2, 2, entity) === true, 'Tile should be walkable when ignoring own entity');
});

test('GridSystem getNeighbors', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const grid = new GridSystem({ width: 5, height: 5, tileW: 64, tileH: 32 }, proj);
  
  const neighbors = grid.getNeighbors(2, 2);
  assertEqual(neighbors.length, 4, 'Should have 4 neighbors');
});

test('GridSystem boundary checks', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const grid = new GridSystem({ width: 5, height: 5, tileW: 64, tileH: 32 }, proj);
  
  assertEqual(grid.getTile(-1, 0), null, 'Negative column should return null');
  assertEqual(grid.getTile(0, -1), null, 'Negative row should return null');
  assertEqual(grid.getTile(5, 0), null, 'Out of bounds column should return null');
  assertEqual(grid.getTile(0, 5), null, 'Out of bounds row should return null');
});

console.log('');

// ============================================================================
// PathFinder Tests
// ============================================================================
console.log('PathFinder Tests:');
console.log('-----------------');

test('PathFinder finds direct path', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const grid = new GridSystem({ width: 10, height: 10, tileW: 64, tileH: 32 }, proj);
  const pathFinder = new PathFinder();
  
  const path = pathFinder.findPath({ col: 0, row: 0 }, { col: 3, row: 0 }, grid);
  
  assert(path.length > 0, 'Path should be found');
  assertEqual(path.length, 3, 'Path should have 3 steps');
});

test('PathFinder handles obstacles', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const grid = new GridSystem({ width: 5, height: 5, tileW: 64, tileH: 32 }, proj);
  
  // Create obstacle
  grid.setTileType(1, 0, 'wall', false);
  grid.setTileType(1, 1, 'wall', false);
  
  const pathFinder = new PathFinder();
  const path = pathFinder.findPath({ col: 0, row: 0 }, { col: 2, row: 0 }, grid);
  
  // Path should go around obstacle
  assert(path.length > 0, 'Path should be found around obstacle');
});

test('PathFinder returns empty for unreachable', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const grid = new GridSystem({ width: 5, height: 5, tileW: 64, tileH: 32 }, proj);
  
  // Block all paths
  for (let col = 0; col < 5; col++) {
    grid.setTileType(col, 1, 'wall', false);
  }
  
  const pathFinder = new PathFinder();
  const path = pathFinder.findPath({ col: 2, row: 0 }, { col: 2, row: 2 }, grid);
  
  assertEqual(path.length, 0, 'Path should be empty for unreachable target');
});

console.log('');

// ============================================================================
// EntityManager Tests
// ============================================================================
console.log('EntityManager Tests:');
console.log('--------------------');

test('EntityManager adds entity', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const grid = new GridSystem({ width: 10, height: 10, tileW: 64, tileH: 32 }, proj);
  const camera = new IsoCamera(800, 600);
  const entityManager = new EntityManager(grid, proj, camera);
  
  const entity = new BasicEntity('test1', 5, 5);
  entityManager.addEntity(entity);
  
  assertEqual(entityManager.getCount(), 1, 'Should have 1 entity');
  assert(entityManager.getEntity('test1') === entity, 'Should retrieve added entity');
});

test('EntityManager removes entity', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const grid = new GridSystem({ width: 10, height: 10, tileW: 64, tileH: 32 }, proj);
  const camera = new IsoCamera(800, 600);
  const entityManager = new EntityManager(grid, proj, camera);
  
  const entity = new BasicEntity('test2', 5, 5);
  entityManager.addEntity(entity);
  entityManager.removeEntity('test2');
  
  assertEqual(entityManager.getCount(), 0, 'Should have 0 entities after removal');
  assert(entityManager.getEntity('test2') === undefined, 'Removed entity should be undefined');
});

test('EntityManager moveEntity', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const grid = new GridSystem({ width: 10, height: 10, tileW: 64, tileH: 32 }, proj);
  const camera = new IsoCamera(800, 600);
  const entityManager = new EntityManager(grid, proj, camera);
  
  const entity = new BasicEntity('test3', 5, 5);
  entityManager.addEntity(entity);
  
  const success = entityManager.moveEntity(entity, 6, 5);
  assert(success === true, 'Move should succeed');
  assertEqual(entity.col, 6, 'Entity column should be updated');
  
  const fail = entityManager.moveEntity(entity, 6, 5); // Move to same spot
  assert(fail === true, 'Move to same spot should succeed');
});

test('EntityManager updateAll recalculates depths', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const grid = new GridSystem({ width: 10, height: 10, tileW: 64, tileH: 32 }, proj);
  const camera = new IsoCamera(800, 600);
  const entityManager = new EntityManager(grid, proj, camera);
  
  const entity1 = new BasicEntity('e1', 0, 0);
  const entity2 = new BasicEntity('e2', 5, 5);
  entityManager.addEntity(entity1);
  entityManager.addEntity(entity2);
  
  entityManager.updateAll();
  
  assert(entity1.depth !== 0 || entity2.depth !== 0, 'Depths should be calculated');
  assert(entity2.depth > entity1.depth, 'Entity at (5,5) should have greater depth than (0,0)');
});

console.log('');

// ============================================================================
// EventBus Tests
// ============================================================================
console.log('EventBus Tests:');
console.log('---------------');

test('EventBus on/emit', () => {
  const eventBus = new EventBus();
  let called = false;
  let data: any = null;
  
  eventBus.on('test', (d) => {
    called = true;
    data = d;
  });
  
  eventBus.emit('test', { value: 42 });
  
  assert(called, 'Callback should be called');
  assertEqual(data!.value, 42, 'Data should be passed');
});

test('EventBus once', () => {
  const eventBus = new EventBus();
  let count = 0;
  
  eventBus.once('once_test', () => {
    count++;
  });
  
  eventBus.emit('once_test');
  eventBus.emit('once_test');
  
  assertEqual(count, 1, 'Once listener should only be called once');
});

test('EventBus off', () => {
  const eventBus = new EventBus();
  let called = false;
  
  const callback = () => { called = true; };
  eventBus.on('remove_test', callback);
  eventBus.off('remove_test', callback);
  eventBus.emit('remove_test');
  
  assert(called === false, 'Removed listener should not be called');
});

console.log('');

// ============================================================================
// CanvasRenderer Tests
// ============================================================================
console.log('CanvasRenderer Tests:');
console.log('---------------------');

test('CanvasRenderer initializes', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const renderer = new CanvasRenderer(800, 600, proj);
  
  assert(renderer.canvas !== null, 'Canvas should exist');
  assert(renderer.ctx !== null, 'Context should exist');
  assertEqual(renderer.getRenderItemCount(), 0, 'Initial render count should be 0');
});

test('CanvasRenderer addRenderItem', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const renderer = new CanvasRenderer(800, 600, proj);
  
  const mockItem = {
    depth: 100,
    draw: () => {}
  };
  
  renderer.addRenderItem(mockItem);
  assertEqual(renderer.getRenderItemCount(), 1, 'Should have 1 render item');
});

test('CanvasRenderer worldToScreen', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const renderer = new CanvasRenderer(800, 600, proj);
  
  const screen = renderer.worldToScreen(0, 0, 0);
  
  // With camera at origin, (0,0) should be near center
  assert(Math.abs(screen.sx - 400) < 10, 'X should be near canvas center');
  assert(Math.abs(screen.sy - 300) < 10, 'Y should be near canvas center');
});

console.log('');

// ============================================================================
// Regression Tests (coordinate system / occlusion / layering fixes)
// ============================================================================
console.log('Regression Tests:');
console.log('-----------------');

test('IsoUtils.worldToGrid uses floor (tile-corner convention)', () => {
  // Regression (BUG-3): gridToWorld returns the tile corner, so the inverse
  // must floor – Math.round would jump to the next tile halfway through it.
  const inside = isoWorldToGrid(63.9, 63.9, 64);
  assertEqual(inside.col, 0, 'Point inside tile 0 should map to col 0');
  assertEqual(inside.row, 0, 'Point inside tile 0 should map to row 0');
  
  const boundary = isoWorldToGrid(64, 0, 64);
  assertEqual(boundary.col, 1, 'Point on boundary should map to col 1');
  
  const negative = isoWorldToGrid(-1, 0, 64);
  assertEqual(negative.col, -1, 'Negative world coord should floor to col -1');
});

test('InputManager worldToGrid respects rectangular tiles (tileW != tileH)', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const renderer = new CanvasRenderer(800, 600, proj);
  const eventBus = new EventBus();
  const input = new InputManager({
    canvas: renderer.canvas as HTMLCanvasElement,
    camera: renderer.camera,
    projection: proj,
    eventBus,
    cellSize: 64,
    tileH: 32
  });
  
  // Regression (BUG-4): rows must advance every tileH (32) world units,
  // not every cellSize (64). Old code mapped y=33 to row 0.
  const grid = input.worldToGrid(70, 33);
  assertEqual(grid.col, 1, 'col = floor(70 / 64) = 1');
  assertEqual(grid.row, 1, 'row = floor(33 / 32) = 1');
  
  const row0 = input.worldToGrid(10, 31);
  assertEqual(row0.row, 0, 'y=31 is still inside row 0');
});

test('LayerManager assigns layers using configured maxDepth', () => {
  // Regression (RISK-5): with a map-sized maxDepth, entities spread across
  // layers instead of all collapsing into layer 0 (old hardcoded 2000).
  const lm = new LayerManager({ layerCount: 5, maxDepth: 20 });
  assertEqual(lm.getLayerForDepth(0), 0, 'Depth 0 -> layer 0');
  assertEqual(lm.getLayerForDepth(8), 2, 'Depth 8 -> layer 2');
  assertEqual(lm.getLayerForDepth(16), 4, 'Depth 16 -> layer 4');
  assertEqual(lm.getLayerForDepth(100), 4, 'Depth beyond maxDepth clamps to last layer');
  
  const legacy = new LayerManager({ layerCount: 5 }); // default maxDepth 2000
  assertEqual(legacy.getLayerForDepth(8), 0, 'Default maxDepth keeps small depths in layer 0');
});

test('EntityManager emits lifecycle events (entityAdded/Moved/Removed)', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const grid = new GridSystem({ width: 10, height: 10, tileW: 64, tileH: 32 }, proj);
  const camera = new IsoCamera(800, 600);
  const eventBus = new EventBus();
  const entityManager = new EntityManager(grid, proj, camera, undefined, 64, eventBus);
  
  // Regression (BUG-8): occlusion invalidation relies on these events.
  const events: string[] = [];
  eventBus.on('entityAdded', (d: any) => events.push(`added:${d.id}:${d.isBuilding}`));
  eventBus.on('entityMoved', (d: any) => events.push(`moved:${d.id}:${d.oldCol},${d.oldRow}->${d.col},${d.row}`));
  eventBus.on('entityRemoved', (d: any) => events.push(`removed:${d.id}`));
  
  const building = new BasicEntity('b1', 2, 2);
  building.entityType = 'building';
  entityManager.addEntity(building);
  entityManager.moveEntity(building, 3, 2);
  entityManager.removeEntity('b1');
  
  assertEqual(events.length, 3, `Expected 3 lifecycle events, got ${events.length}`);
  assertEqual(events[0], 'added:b1:true', 'entityAdded payload should include isBuilding');
  assertEqual(events[1], 'moved:b1:2,2->3,2', 'entityMoved payload should include old and new position');
  assertEqual(events[2], 'removed:b1', 'entityRemoved payload should include id');
});

test('Multi-tile building occupies its full footprint on the grid', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const grid = new GridSystem({ width: 10, height: 10, tileW: 64, tileH: 32 }, proj);
  const camera = new IsoCamera(800, 600);
  const entityManager = new EntityManager(grid, proj, camera);
  
  // Regression (BUG-10): a 128x64 building on 64x32 tiles covers 2x2 tiles.
  const building = new IsoBox('big', 3, 3, 128, 64, 64);
  building.entityType = 'building';
  entityManager.addEntity(building);
  
  assertEqual(entityManager.getFootprintTiles(building).length, 4, 'Footprint should cover 4 tiles');
  assert(grid.isWalkable(3, 3) === false, 'Anchor tile should be occupied');
  assert(grid.isWalkable(4, 4) === false, 'Far footprint tile (4,4) should be occupied');
  assert(grid.isWalkable(5, 4) === true, 'Tile outside footprint should stay walkable');
  
  // Footprint must move with the entity and release old tiles
  const moved = entityManager.moveEntity(building, 6, 6);
  assert(moved === true, 'Move should succeed');
  assert(grid.isWalkable(3, 3) === true, 'Old anchor tile should be released');
  assert(grid.isWalkable(7, 7) === false, 'New footprint tile (7,7) should be occupied');
  
  // Another entity cannot move into the occupied footprint
  const char = new BasicEntity('c0', 0, 0);
  entityManager.addEntity(char);
  const blocked = entityManager.moveEntity(char, 7, 7);
  assert(blocked === false, 'Move into occupied footprint tile should fail');
  assert(char.col === 0 && char.row === 0, 'Blocked entity should stay in place');
});

test('OcclusionSystem: building shadow occludes characters NW of it', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const grid = new GridSystem({ width: 10, height: 10, tileW: 64, tileH: 32 }, proj);
  const camera = new IsoCamera(800, 600);
  const entityManager = new EntityManager(grid, proj, camera);
  
  const building = new IsoBox('tower', 5, 5, 64, 64, 128);
  building.entityType = 'building';
  entityManager.addEntity(building);
  
  const behind = new BasicEntity('behind', 4, 5, '#fff', 20, 30);  // West tile: in shadow
  const inFront = new BasicEntity('front', 6, 6, '#fff', 20, 30);  // SE tile: visible side
  entityManager.addEntity(behind);
  entityManager.addEntity(inFront);
  
  const occlusion = new OcclusionSystem({ entityManager, gridSystem: grid, tileSize: 64 });
  
  assert(occlusion.isOccluded(behind) === true, 'Character NW of tall building should be occluded');
  assert(occlusion.isOccluded(inFront) === false, 'Character SE of building should NOT be occluded');
  
  const occluders = occlusion.getOccludingBuildings(behind);
  assertEqual(occluders.length, 1, 'Exactly one building should occlude');
  assertEqual(occluders[0].buildingId, 'tower', 'Occluder should be the tower');
});

test('OcclusionSystem: character move triggers callback without markDirty', () => {
  const proj = new Projection({ type: 'isometric', viewAngle: 45 });
  const grid = new GridSystem({ width: 10, height: 10, tileW: 64, tileH: 32 }, proj);
  const camera = new IsoCamera(800, 600);
  const eventBus = new EventBus();
  const entityManager = new EntityManager(grid, proj, camera, undefined, 64, eventBus);
  
  const building = new IsoBox('hall', 5, 5, 64, 64, 128);
  building.entityType = 'building';
  entityManager.addEntity(building);
  const walker = new BasicEntity('walker', 8, 8, '#fff', 20, 30);
  entityManager.addEntity(walker);
  
  const occlusion = new OcclusionSystem({ entityManager, gridSystem: grid, tileSize: 64 });
  occlusion.update(); // settle initial state (no events expected for walker)
  
  // Regression (BUG-9): callbacks used to fire only when the shadow map was
  // recalculated, so a character walking into a shadow was never reported.
  const calls: { occluded: boolean; count: number }[] = [];
  occlusion.onOcclusionChange((entity, occlusions) => {
    if (entity.id === 'walker') calls.push({ occluded: occlusions.length > 0, count: occlusions.length });
  });
  
  entityManager.moveEntity(walker, 4, 5); // into the shadow (character move: no markDirty)
  occlusion.update();
  assertEqual(calls.length, 1, 'Walking into shadow should fire exactly one callback');
  assert(calls[0].occluded, 'Callback should report the walker as occluded');
  
  occlusion.update(); // anti-spam: standing still must not re-fire
  assertEqual(calls.length, 1, 'Standing still in shadow should not re-fire');
  
  entityManager.moveEntity(walker, 8, 8); // back out of the shadow
  occlusion.update();
  assertEqual(calls.length, 2, 'Walking out of shadow should fire a second callback');
  assert(calls[1].occluded === false, 'Callback should report the walker as visible');
});

console.log('');

// ============================================================================
// Summary
// ============================================================================
console.log('====================');
console.log(`Tests: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('');

if (failed > 0) {
  process.exit(1);
}

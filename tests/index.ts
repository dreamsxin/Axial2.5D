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
  TileData
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
  const original = { x: 100, z: 50 };
  
  const screen = proj.worldToScreen(original.x, original.z, 0);
  const world = proj.screenToWorld(screen.sx, screen.sy, 0);
  
  assert(Math.abs(world.x - original.x) < 0.1, 'X should match after roundtrip');
  assert(Math.abs(world.z - original.z) < 0.1, 'Z should match after roundtrip');
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
  
  // Camera should be positioned so (100, 100) is at center
  assert(camera.offsetX !== 0 || camera.offsetY !== 0, 'Camera should have non-zero offset');
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
  
  const world = grid.gridToWorld(5, 5);
  assertEqual(world.x, 0, 'Center grid (5,5) should map to x=0');
  assertEqual(world.z, 160, 'Center grid (5,5) should map to z=160');
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

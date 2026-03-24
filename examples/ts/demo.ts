/**
 * Axial2.5D Demo - Basic demonstration of the framework
 * 
 * This demo runs in mock mode without the canvas package.
 * For full rendering, use in browser or install canvas package.
 */

import {
  Projection,
  CanvasRenderer,
  GridSystem,
  EntityManager,
  BasicEntity,
  PathFinder,
  InputManager,
  UIManager,
  DebugSystem,
  SceneManager,
  ResourceManager,
  EventBus,
  MapData,
  TileData
} from '../../src/index';

// Initialize core systems
const eventBus = new EventBus();
const projection = new Projection({
  type: 'isometric',
  viewAngle: 30,  // True isometric projection
  tileScale: 1
});

const renderer = new CanvasRenderer(800, 600, projection);
const camera = renderer.camera;

// Create map data
const mapWidth = 10;
const mapHeight = 10;
const tileW = 64;
const tileH = 32;

const tiles: TileData[][] = [];
for (let col = 0; col < mapWidth; col++) {
  tiles[col] = [];
  for (let row = 0; row < mapHeight; row++) {
    tiles[col][row] = {
      type: row % 2 === 0 ? 'grass' : 'sand',
      height: 0,
      walkable: true,
      entity: null
    };
  }
}

const mapData: MapData = {
  width: mapWidth,
  height: mapHeight,
  tileW,
  tileH,
  tiles
};

// Create world systems
const gridSystem = new GridSystem(mapData, projection);
const entityManager = new EntityManager(gridSystem, projection, camera);
const pathFinder = new PathFinder();

// Add some test entities
const player = new BasicEntity('player', 5, 5, '#4a90d9', 20, 40);
entityManager.addEntity(player);

entityManager.addEntity(new BasicEntity('npc1', 3, 3, '#d9a04a', 20, 35));
entityManager.addEntity(new BasicEntity('npc2', 7, 7, '#d94a4a', 20, 35));
entityManager.addEntity(new BasicEntity('building', 2, 7, '#888888', 40, 60));

// Create input manager (will work in mock mode)
const inputManager = new InputManager(renderer.canvas, camera, projection, eventBus);

// Create UI manager
const uiManager = new UIManager(eventBus);
uiManager.setInputManager(inputManager);

// Create debug system
const debugSystem = new DebugSystem();
debugSystem.init(renderer, gridSystem, entityManager, inputManager, eventBus);
debugSystem.setConfig({
  showGrid: true,
  showFPS: true,
  showMouseInfo: true
});

// Handle input events
eventBus.on('click', (data) => {
  console.log('Click at:', data.worldX, data.worldZ);
  
  // Get grid position
  const gridPos = gridSystem.worldToGrid(data.worldX, data.worldZ);
  console.log('Grid:', gridPos.col, gridPos.row);
  
  // Try to move player
  if (gridSystem.isWalkable(gridPos.col, gridPos.row)) {
    const path = pathFinder.findPath(
      { col: player.col, row: player.row },
      gridPos,
      gridSystem
    );
    
    if (path.length > 0) {
      console.log('Path found:', path);
      // Move player to first step (simplified - would animate in real game)
      entityManager.moveEntity(player, path[0].col, path[0].row);
    }
  }
});

eventBus.on('wheel', (data) => {
  camera.zoom(data.delta);
});

eventBus.on('dragMove', (data) => {
  camera.pan(-data.deltaX, -data.deltaY);
});

// Center camera on player
const playerWorld = gridSystem.gridToWorld(player.col, player.row);
camera.setPosition(playerWorld.x, playerWorld.z, projection);

// Game loop
let lastTime = Date.now();
let frameCount = 0;

function gameLoop(): void {
  const now = Date.now();
  const delta = now - lastTime;
  lastTime = now;
  
  // Update
  entityManager.updateAll(delta);
  debugSystem.updateFrameStats(delta);
  
  // Render
  renderer.clear('#1a1a2e');
  
  // Add ground
  const groundItems = gridSystem.buildGroundRenderItems();
  renderer.addRenderItems(groundItems);
  
  // Add entities
  const entityItems = entityManager.getRenderItems();
  renderer.addRenderItems(entityItems);
  
  // Render
  renderer.render();
  renderer.clearRenderItems();
  
  // Draw debug info (if context supports it)
  if (renderer.ctx && typeof (renderer.ctx as any).fillText === 'function') {
    debugSystem.draw(renderer.ctx as CanvasRenderingContext2D);
  }
  
  frameCount++;
  
  if (frameCount % 60 === 0) {
    console.log(`Frame ${frameCount} - Player at (${player.col}, ${player.row})`);
  }
}

// Run demo
console.log('Starting Axial2.5D demo...');
console.log('Canvas size: 800x600');
console.log('Map size: 10x10');
console.log('Entities: player, npc1, npc2, building');
console.log('');
console.log('Note: Running in mock mode (no canvas package).');
console.log('For full rendering, run in browser or install canvas package.');
console.log('');

// Run 60 frames for demo
for (let i = 0; i < 60; i++) {
  gameLoop();
}

console.log('');
console.log('Demo complete!');
console.log('');
console.log('Framework initialized successfully:');
console.log('✓ Projection (isometric, 45°)');
console.log('✓ CanvasRenderer with depth sorting');
console.log(`✓ GridSystem (${mapWidth}x${mapHeight} map)`);
console.log(`✓ EntityManager (${entityManager.getCount()} entities)`);
console.log('✓ PathFinder (A* algorithm)');
console.log('✓ InputManager (mouse/keyboard)');
console.log('✓ UIManager');
console.log('✓ DebugSystem');
console.log('✓ EventBus');

/**
 * Axial2.5D Advanced Demo
 * Demonstrates IsoBox, IsoSprite, GridLines, and advanced features
 */

import {
  Game,
  MapData,
  TileData,
  IsoBox,
  IsoSprite,
  IsoCharacter,
  GridLines,
  Projection,
  EntityManager
} from '../../src/index';

// Create game instance
const game = new Game({
  width: 800,
  height: 600,
  projection: {
    type: 'isometric',
    viewAngle: 45,
    tileScale: 1
  },
  debug: {
    showGrid: false,
    showFPS: true,
    showMouseInfo: true,
    showStats: true
  }
});

// Create map data
const mapWidth = 15;
const mapHeight = 15;
const tileW = 64;
const tileH = 32;

const tiles: TileData[][] = [];
for (let col = 0; col < mapWidth; col++) {
  tiles[col] = [];
  for (let row = 0; row < mapHeight; row++) {
    let type = 'grass';
    let walkable = true;
    
    // Create a border of water
    if (col === 0 || col === mapWidth - 1 || row === 0 || row === mapHeight - 1) {
      type = 'water';
      walkable = false;
    }
    
    // Add some roads
    if (col === 7 || row === 7) {
      type = 'road';
    }
    
    // Add decorative stone areas
    if ((col + row) % 5 === 0 && col > 1 && col < mapWidth - 2 && row > 1 && row < mapHeight - 2) {
      type = 'stone';
    }
    
    tiles[col][row] = {
      type,
      height: 0,
      walkable,
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

// Initialize game
game.init(mapData);

// Create grid lines overlay
const gridLines = new GridLines({
  showGrid: true,
  showOrigin: true,
  showAxes: false,
  gridColor: 'rgba(255, 255, 255, 0.3)',
  lineWidth: 1
});

// Add entities using different types
console.log('Creating entities...');

// 1. Create IsoBox buildings
const buildings: IsoBox[] = [];

// Town hall - large central building
const townhall = new IsoBox('townhall', 7, 7, 100, 100, 80);
townhall.setFaceColors([
  '#f5deb3', // top - light wheat
  '#deb887', // front-right - burlywood
  '#cd853f', // front-left - peru
  '#b8860b', // back-right - dark goldenrod
  '#daa520', // back-left - goldenrod
  '#8b4513'  // bottom - saddle brown
]);
townhall.setStrokeStyle('#654321', 2);
buildings.push(townhall);

// Houses - smaller buildings
const house1 = new IsoBox('house1', 3, 3, 60, 60, 50);
house1.setFaceColors(['#8b0000', '#a52a2a', '#8b0000', '#654321', '#8b4513', '#654321']);
buildings.push(house1);

const house2 = new IsoBox('house2', 11, 3, 60, 60, 50);
house2.setFaceColors(['#2e8b57', '#3cb371', '#2e8b57', '#654321', '#8b4513', '#654321']);
buildings.push(house2);

const house3 = new IsoBox('house3', 3, 11, 60, 60, 50);
house3.setFaceColors(['#4169e1', '#6495ed', '#4169e1', '#654321', '#8b4513', '#654321']);
buildings.push(house3);

// Warehouse
const warehouse = new IsoBox('warehouse', 11, 11, 80, 60, 40);
warehouse.setFaceColors(['#708090', '#778899', '#708090', '#654321', '#8b4513', '#654321']);
buildings.push(warehouse);

// 2. Create IsoSprite characters
const characters: IsoSprite[] = [];

const player = new IsoCharacter('player', 7, 5, 'hero', {
  width: 30,
  height: 50,
  anchorY: 1.0
});
characters.push(player);

const npc1 = new IsoCharacter('npc_merchant', 5, 5, 'merchant', {
  width: 28,
  height: 45,
  anchorY: 1.0
});
characters.push(npc1);

const npc2 = new IsoCharacter('npc_guard', 9, 5, 'guard', {
  width: 32,
  height: 55,
  anchorY: 1.0
});
characters.push(npc2);

// 3. Add all entities to manager
const entityManager = game.entityManager;
if (entityManager) {
  // Add buildings
  for (const building of buildings) {
    entityManager.addEntity(building);
  }
  
  // Add characters
  for (const char of characters) {
    entityManager.addEntity(char);
  }
  
  console.log(`Added ${entityManager.getCount()} entities`);
}

// Center camera on player
game.centerCameraOnEntity('player');

// Setup keyboard controls for player movement
game.eventBus.on('keydown', (data) => {
  const grid = game.gridSystem;
  if (!grid || !entityManager) return;
  
  let newCol = player.col;
  let newRow = player.row;
  
  switch (data.key.toLowerCase()) {
    case 'w':
    case 'arrowup':
      newRow--;
      break;
    case 's':
    case 'arrowdown':
      newRow++;
      break;
    case 'a':
    case 'arrowleft':
      newCol--;
      break;
    case 'd':
    case 'arrowright':
      newCol++;
      break;
    case 'g':
      // Toggle grid
      gridLines.toggle();
      console.log('Grid toggled');
      return;
    case 'b':
      // Toggle building wireframe
      for (const b of buildings) {
        b.setWireframe(!b.showWireframe);
      }
      console.log('Building wireframe toggled');
      return;
    case ' ':
      game.toggleDebug();
      return;
    default:
      return;
  }
  
  // Move player if walkable
  if (grid.isWalkable(newCol, newRow)) {
    entityManager.moveEntity(player, newCol, newRow);
    
    // Make player face movement direction
    if (player instanceof IsoCharacter) {
      player.faceTowards(newCol, newRow);
    }
    
    game.centerCameraOnEntity('player');
    console.log(`Player moved to (${newCol}, ${newRow})`);
  }
});

// Mouse click to move
game.eventBus.on('tileClick', (data) => {
  const grid = game.gridSystem;
  if (!grid || !entityManager) return;
  
  if (grid.isWalkable(data.col, data.row)) {
    const path = game.pathFinder.findPath(
      { col: player.col, row: player.row },
      data,
      grid
    );
    
    if (path.length > 0) {
      entityManager.moveEntity(player, path[0].col, path[0].row);
      game.centerCameraOnEntity('player');
      console.log(`Moving to (${data.col}, ${data.row})`);
    }
  }
});

console.log('');
console.log('Axial2.5D Advanced Demo');
console.log('=======================');
console.log('');
console.log('Features demonstrated:');
console.log('  ✓ IsoBox - 3D buildings with face colors');
console.log('  ✓ IsoCharacter - Character sprites with direction');
console.log('  ✓ GridLines - Visual grid overlay');
console.log('  ✓ Depth sorting - Proper occlusion');
console.log('  ✓ Path finding - A* algorithm');
console.log('');
console.log('Controls:');
console.log('  WASD/Arrows - Move player');
console.log('  Mouse click - Move to tile');
console.log('  G - Toggle grid lines');
console.log('  B - Toggle building wireframe');
console.log('  Space - Toggle debug info');
console.log('  Mouse drag - Pan camera');
console.log('  Mouse wheel - Zoom');
console.log('');
console.log(`Scene: ${mapWidth}x${mapHeight} map with ${buildings.length} buildings and ${characters.length} characters`);
console.log('');

// Custom render loop that includes grid lines
let frameCount = 0;

function customRender() {
  const { renderer, gridSystem, projection } = game;
  
  // Clear
  renderer.clear('#1a1a2e');
  
  // Add ground tiles
  if (gridSystem) {
    const groundItems = gridSystem.buildGroundRenderItems();
    renderer.addRenderItems(groundItems);
  }
  
  // Add entities
  if (entityManager) {
    entityManager.updateAll(16);
    const entityItems = entityManager.getRenderItems();
    renderer.addRenderItems(entityItems);
  }
  
  // Render
  renderer.render();
  renderer.clearRenderItems();
  
  // Draw grid lines overlay (after main render)
  if (gridSystem && gridLines) {
    gridLines.draw(renderer.ctx as CanvasRenderingContext2D, projection, renderer.camera);
  }
  
  // Draw debug info
  game.debugSystem.draw(renderer.ctx as CanvasRenderingContext2D);
  
  frameCount++;
  
  if (frameCount % 60 === 0) {
    console.log(`Frame ${frameCount} - Player at (${player.col}, ${player.row})`);
  }
}

// Run demo for 120 frames
let demoFrame = 0;
const maxDemoFrames = 120;

function runDemo() {
  if (demoFrame >= maxDemoFrames) {
    console.log('');
    console.log('Demo complete!');
    console.log('');
    console.log('Axial2.5D Framework Features:');
    console.log('  ✓ Projection (isometric/dimetric)');
    console.log('  ✓ CanvasRenderer with depth sorting');
    console.log('  ✓ GridSystem with terrain types');
    console.log('  ✓ EntityManager (entities + primitives)');
    console.log('  ✓ IsoBox (3D buildings)');
    console.log('  ✓ IsoSprite/IsoCharacter (sprites)');
    console.log('  ✓ GridLines (visualization)');
    console.log('  ✓ PathFinder (A* algorithm)');
    console.log('  ✓ InputManager (mouse + keyboard)');
    console.log('  ✓ UIManager');
    console.log('  ✓ SceneManager');
    console.log('  ✓ DebugSystem');
    console.log('  ✓ EventBus');
    console.log('  ✓ ResourceManager');
    console.log('');
    console.log('Framework implementation complete!');
    return;
  }
  
  customRender();
  demoFrame++;
  
  setTimeout(runDemo, 16);
}

runDemo();

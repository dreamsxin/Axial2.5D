/**
 * Axial2.5D Web Demo
 * Browser-based interactive demo
 */

// Import the framework (will be bundled or loaded via script tags)
import {
  Game,
  Projection,
  IsoBox,
  IsoCharacter,
  GridLines,
  MapData,
  TileData
} from '../src/index.js';

// Global variables
let game = null;
let gridLines = null;
let player = null;
let buildings = [];
let isGridVisible = true;
let isWireframeVisible = false;

// Initialize the game
function init() {
  const canvas = document.getElementById('gameCanvas');
  
  // Create game instance
  game = new Game({
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
    },
    canvas: canvas
  });

  // Create map data
  const mapWidth = 15;
  const mapHeight = 15;
  const tileW = 64;
  const tileH = 32;

  const tiles = [];
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

  const mapData = {
    width: mapWidth,
    height: mapHeight,
    tileW,
    tileH,
    tiles
  };

  // Initialize game
  game.init(mapData);

  // Create grid lines overlay
  gridLines = new GridLines({
    showGrid: true,
    showOrigin: true,
    showAxes: false,
    gridColor: 'rgba(255, 255, 255, 0.3)',
    lineWidth: 1
  });

  // Create buildings
  createBuildings();

  // Create player
  player = new IsoCharacter('player', 7, 5, 'hero', {
    width: 30,
    height: 50,
    anchorY: 1.0
  });

  // Add all entities
  const entityManager = game.entityManager;
  if (entityManager) {
    for (const building of buildings) {
      entityManager.addEntity(building);
    }
    entityManager.addEntity(player);
  }

  // Center camera on player
  game.centerCameraOnEntity('player');

  // Setup event handlers
  setupEventHandlers();

  // Start game loop
  game.start();

  // Start UI update loop
  updateUI();

  log('Game initialized!', 'success');
  log(`Created ${buildings.length + 1} entities`, 'info');
}

function createBuildings() {
  // Town hall
  const townhall = new IsoBox('townhall', 7, 7, 100, 100, 80);
  townhall.setFaceColors([
    '#f5deb3', '#deb887', '#cd853f',
    '#b8860b', '#daa520', '#8b4513'
  ]);
  townhall.setStrokeStyle('#654321', 2);
  buildings.push(townhall);

  // Houses
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
}

function setupEventHandlers() {
  const canvas = document.getElementById('gameCanvas');

  // Keyboard controls
  document.addEventListener('keydown', (e) => {
    const grid = game.gridSystem;
    const entityManager = game.entityManager;
    if (!grid || !entityManager || !player) return;

    let newCol = player.col;
    let newRow = player.row;

    switch (e.key.toLowerCase()) {
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
        toggleGrid();
        return;
      case 'b':
        toggleWireframe();
        return;
      case ' ':
        toggleDebug();
        e.preventDefault();
        return;
      default:
        return;
    }

    // Move player
    if (grid.isWalkable(newCol, newRow)) {
      entityManager.moveEntity(player, newCol, newRow);
      if (player instanceof IsoCharacter) {
        player.faceTowards(newCol, newRow);
      }
      game.centerCameraOnEntity('player');
      log(`Player moved to (${newCol}, ${newRow})`, 'info');
    }
  });

  // Mouse click to move
  game.eventBus.on('tileClick', (data) => {
    const grid = game.gridSystem;
    const entityManager = game.entityManager;
    if (!grid || !entityManager || !player) return;

    if (grid.isWalkable(data.col, data.row)) {
      const path = game.pathFinder.findPath(
        { col: player.col, row: player.row },
        data,
        grid
      );

      if (path.length > 0) {
        entityManager.moveEntity(player, path[0].col, path[0].row);
        game.centerCameraOnEntity('player');
        log(`Moving to (${data.col}, ${data.row})`, 'info');
      }
    }
  });
}

function updateUI() {
  setInterval(() => {
    // Update FPS
    const fpsEl = document.getElementById('fps-display');
    if (fpsEl && game.debugSystem) {
      fpsEl.textContent = game.debugSystem.isEnabled() ? game.debugSystem.stats.fps : '--';
    }

    // Update entity count
    const entityEl = document.getElementById('entity-count');
    if (entityEl && game.entityManager) {
      entityEl.textContent = game.entityManager.getCount();
    }

    // Update player position
    const posEl = document.getElementById('player-pos');
    if (posEl && player) {
      posEl.textContent = `${player.col}, ${player.row}`;
    }
  }, 100);
}

function log(message, type = '') {
  const logEl = document.getElementById('log');
  if (!logEl) return;

  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;

  // Keep only last 50 entries
  while (logEl.children.length > 50) {
    logEl.removeChild(logEl.firstChild);
  }
}

// Control functions
window.toggleGrid = function() {
  isGridVisible = !isGridVisible;
  if (gridLines) {
    gridLines.setConfig({ showGrid: isGridVisible });
  }
  document.getElementById('btn-grid').classList.toggle('active', isGridVisible);
  log(`Grid ${isGridVisible ? 'enabled' : 'disabled'}`, 'info');
};

window.toggleWireframe = function() {
  isWireframeVisible = !isWireframeVisible;
  for (const b of buildings) {
    b.setWireframe(isWireframeVisible);
  }
  document.getElementById('btn-wireframe').classList.toggle('active', isWireframeVisible);
  log(`Wireframe ${isWireframeVisible ? 'enabled' : 'disabled'}`, 'info');
};

window.toggleDebug = function() {
  if (game) {
    game.toggleDebug();
    document.getElementById('btn-debug').classList.toggle('active', game.debugSystem.isEnabled());
    log(`Debug ${game.debugSystem.isEnabled() ? 'enabled' : 'disabled'}`, 'info');
  }
};

window.resetCamera = function() {
  if (game && player) {
    game.centerCameraOnEntity('player');
    game.renderer.camera.setZoom(1);
    log('Camera reset', 'info');
  }
};

window.teleportPlayer = function() {
  const grid = game.gridSystem;
  const entityManager = game.entityManager;
  if (!grid || !entityManager || !player) return;

  // Find random walkable tile
  let attempts = 0;
  while (attempts < 100) {
    const col = Math.floor(Math.random() * (grid.getDimensions().width - 2)) + 1;
    const row = Math.floor(Math.random() * (grid.getDimensions().height - 2)) + 1;
    
    if (grid.isWalkable(col, row)) {
      entityManager.moveEntity(player, col, row);
      game.centerCameraOnEntity('player');
      log(`Teleported to (${col}, ${row})`, 'success');
      return;
    }
    attempts++;
  }
  log('Could not find valid teleport location', 'error');
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/**
 * Framework Demo - manual integration without the module system.
 *
 * Shows how to wire the framework pieces together by hand:
 * Game + LayerManager + EffectSystem + CameraController + OcclusionSystem
 * + EffectSystemWrapper + UIDataBinder + DebugRenderer + render hooks.
 *
 * (Ported from the former examples/html/framework.html)
 */

import {
  Game,
  LayerManager,
  EffectSystem,
  CameraController,
  OcclusionSystem,
  EffectSystemWrapper,
  UIDataBinder,
  DebugRenderer
} from '../../src/index';
import type { Demo } from './types';

const CONFIG = {
  width: 800,
  height: 600,
  mapSize: 12,
  cellSize: 50,
  layerCount: 5
};

const LAYER_COLORS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'];
const layerCloudColors: Record<number, string> = { 1: '#ff6b6b', 2: '#4ecdc4', 3: '#ffeaa7' };

export const frameworkDemo: Demo = {
  id: 'framework',
  title: 'Framework',
  description: 'Manual integration: Game + controllers + render hooks (no module system)',

  mount(container: HTMLElement): () => void {
    container.innerHTML = `
      <div class="demo">
        <div class="demo-canvas-container"><canvas id="gameCanvas" width="800" height="600"></canvas></div>
        <div class="demo-sidebar">
          <h1>🎮 Axial2.5D Framework</h1>
          <h2>📊 Status</h2>
          <div class="stat">FPS: <span id="fps">0</span></div>
          <div class="stat">Layers: <span id="layerCount">0</span></div>
          <div class="stat">Player: <span id="playerPos">0, 0</span></div>
          <div class="stat">Occlusion: <span id="occlusionAlpha">100%</span></div>
          <div class="stat" id="mouseDebug" style="color:#ff0;display:none;">Mouse: --</div>
          <h2>🎯 Controls</h2>
          <div class="stat"><span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span> Move</div>
          <div class="stat"><span class="key">Click</span> Move to tile</div>
          <div class="stat"><span class="key">Drag</span> Pan camera</div>
          <div class="stat"><span class="key">Wheel</span> Zoom</div>
          <h2>⚙️ Settings</h2>
          <button id="btnGrid">📐 Grid</button>
          <button id="btnDebug">🐛 Debug</button>
          <button id="btnResetCam">📷 Reset Camera</button>
          <button id="btnClouds">☁️ Regenerate Clouds</button>
          <label>前景透明度：<span id="fgAlphaVal">0.6</span></label>
          <input type="range" min="0.2" max="1.0" step="0.1" value="0.6" aria-label="foreground-alpha">
          <label>Z 轴间距：<span id="zStepVal">30</span></label>
          <input type="range" min="0" max="100" step="10" value="30" aria-label="z-index-step">
          <label>视差范围：<span id="parallaxRangeVal">0.7</span></label>
          <input type="range" min="0" max="1.0" step="0.1" value="0.7" aria-label="parallax-range">
          <h2>📊 Layers</h2>
          <div id="layerList"></div>
          <h2>📜 Log</h2>
          <div id="log" class="log"></div>
        </div>
      </div>
    `;

    const abort = new AbortController();
    const { signal } = abort;

    // ==================== Game State ====================
    const state = {
      showGrid: true,
      showDebug: false,
      player: { col: 6, row: 6 },
      mouse: { x: 0, y: 0 },
      layerSettings: {
        foregroundAlpha: 0.6,
        zIndexStep: 30,
        parallaxRange: 0.7
      }
    };

    // ==================== Initialize Game ====================
    const canvas = container.querySelector<HTMLCanvasElement>('#gameCanvas')!;
    const logEl = container.querySelector<HTMLElement>('#log')!;

    function log(msg: string, type: string = ''): void {
      const entry = document.createElement('div');
      entry.className = `log-msg log-${type}`;
      entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
      logEl.appendChild(entry);
      logEl.scrollTop = logEl.scrollHeight;
      while (logEl.children.length > 20) logEl.removeChild(logEl.children[0]);
    }

    const game = new Game({
      width: CONFIG.width,
      height: CONFIG.height,
      canvas,
      projection: { type: 'isometric', viewAngle: 30 }
    });

    // Initialize layer manager
    const layerManager = new LayerManager({
      layerCount: CONFIG.layerCount,
      baseParallax: 0.3,
      parallaxRange: 0.7,
      foregroundAlpha: 0.6,
      backgroundAlpha: 1.0,
      zIndexStep: 30
    });

    // Initialize effect system (for clouds)
    const effectSystem = new EffectSystem(game.renderer.camera, game.projection, CONFIG.layerCount);

    // Initialize game with map
    game.init({
      width: CONFIG.mapSize,
      height: CONFIG.mapSize,
      tileW: CONFIG.cellSize,
      tileH: CONFIG.cellSize,
      tiles: []
    });

    // Core systems are guaranteed to exist after init()
    const gridSystem = game.gridSystem!;
    const entityManager = game.entityManager!;
    const inputManager = game.inputManager!;

    // Setup map, entities, and effects
    setupMapTiles();
    setupEntities();
    setupEffects();

    // Configure input manager layer settings (game.init() already calls inputManager.init() internally)
    inputManager.setLayerConfig({
      layerCount: CONFIG.layerCount,
      maxDepth: 2000,
      parallaxRange: 0.7
    });

    // Initialize camera controller (Phase 1)
    const cameraController = new CameraController({
      camera: game.renderer.camera,
      projection: game.projection,
      gridSystem: gridSystem,
      entityManager: entityManager,
      layerCount: CONFIG.layerCount,
      maxDepth: 2000,
      parallaxRange: 0.7,
      baseParallax: 0.3
    });

    cameraController.follow({
      entityId: 'player',
      smoothness: 0.1,
      autoParallax: true
    });
    cameraController.centerOnEntity('player');

    // Initialize occlusion system (Phase 2)
    const occlusionSystem = new OcclusionSystem({
      entityManager: entityManager,
      gridSystem: gridSystem,
      tileSize: CONFIG.cellSize
    });
    game.occlusionSystem = occlusionSystem;

    occlusionSystem.onOcclusionChange((entity, occlusions) => {
      if (entity.id === 'player') {
        const isOccluded = occlusions.some(o => o.height > entity.height);
        log(`Player occlusion: ${isOccluded ? 'OCCLUDED by ' + occlusions.map(o => o.buildingId).join(', ') : 'VISIBLE'}`, 'info');
      }
    });

    // Track mouse position for debug display
    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      state.mouse.x = e.clientX - rect.left;
      state.mouse.y = e.clientY - rect.top;
    }, { signal });

    setupEventHandlers();

    // Layer list DOM cache - declared BEFORE renderHooks (onBeforePresent calls updateLayerList)
    const layerDomCache: Record<string, HTMLElement> = {};
    let layerDomBuilt = false;

    // Setup render hooks (Phase 1, 2 & 3)
    game.renderHooks = {
      onBeforeClear: () => {
        cameraController.update();
        occlusionSystem.update();
        effectSystem.update(game.stats.frameTime || 16);
      },
      onAfterClear: () => {
        uiBinder.updateAll();
      },
      onAfterLayers: (ctx) => {
        for (let i = 0; i < CONFIG.layerCount; i++) {
          const layerInfo = layerManager.getLayerStats(i);
          effectSystem.render(ctx, i, {
            parallaxFactor: layerInfo.parallaxFactor,
            alpha: layerInfo.alpha
          });
        }

        if (state.showDebug) {
          const player = entityManager.getEntity('player');
          debugRenderer.render(ctx, gridSystem, game.renderer.camera, game.projection, {
            playerCol: player?.col ?? state.player.col,
            playerRow: player?.row ?? state.player.row,
            layerCount: CONFIG.layerCount,
            maxDepth: 2000,
            parallaxRange: state.layerSettings.parallaxRange,
            baseParallax: 0.3
          });
        }
      },
      onBeforePresent: () => {
        updateLayerList();

        const mouseDebugEl = container.querySelector<HTMLElement>('#mouseDebug');
        if (mouseDebugEl && state.showDebug) {
          const mouseInfo = inputManager.getMouseGridPosition(state.player.col, state.player.row);
          mouseDebugEl.style.display = 'block';
          mouseDebugEl.textContent = `Mouse: Screen(${state.mouse.x.toFixed(0)}, ${state.mouse.y.toFixed(0)}) Grid(${mouseInfo.col}, ${mouseInfo.row}) L${mouseInfo.layer}`;
        } else if (mouseDebugEl) {
          mouseDebugEl.style.display = 'none';
        }
      }
    };

    // Effect system wrapper (Phase 2) - convenience methods
    const effectWrapper = new EffectSystemWrapper(effectSystem, layerManager, {
      layerCount: CONFIG.layerCount,
      autoUpdate: false,
      autoRender: false
    });
    void effectWrapper; // constructed for parity with the original demo

    // UI data binder (Phase 3)
    const uiBinder = new UIDataBinder();

    // Debug renderer (Phase 3)
    const debugRenderer = new DebugRenderer();

    // Setup UI bindings - use game.stats.fps (updated by the engine)
    uiBinder.bindText('fps', () => game.stats.fps);
    uiBinder.bindText('layerCount', () => CONFIG.layerCount);
    uiBinder.bindText('playerPos', () => {
      const player = entityManager.getEntity('player');
      return player ? `${player.col}, ${player.row}` : '0, 0';
    });
    uiBinder.bind('occlusionAlpha', (el) => {
      const player = entityManager.getEntity('player');
      if (!player) return;

      const occlusions = occlusionSystem.getOccludingBuildings(player);
      const isOccluded = occlusions.some(o => o.height > player.height);

      if (isOccluded) {
        el.textContent = `OCCLUDED by ${occlusions.map(o => o.buildingId).join(', ')}`;
        el.style.color = '#4ecdc4';
      } else {
        el.textContent = 'VISIBLE (normal)';
        el.style.color = '#4ad97a';
      }
    });

    // Setup debug renderer items
    debugRenderer.addText('fps', {
      getText: () => `FPS: ${game.stats.fps}`,
      x: 10, y: 20, color: '#0f0',
      enabled: () => state.showDebug
    });
    debugRenderer.addText('stats', {
      getText: () => `Entities: ${entityManager.getCount()} | Draw calls: ${game.renderer.getRenderItemCount()}`,
      x: 10, y: 36, color: '#fff',
      enabled: () => state.showDebug
    });
    debugRenderer.addText('player', {
      getText: () => {
        const player = entityManager.getEntity('player');
        return player ? `Player: (${player.col}, ${player.row})` : 'Player: (0, 0)';
      },
      x: 10, y: 52, color: '#4a90d9',
      enabled: () => state.showDebug
    });
    debugRenderer.addText('camera', {
      getText: () => `Camera: (${game.renderer.camera.offsetX.toFixed(0)}, ${game.renderer.camera.offsetY.toFixed(0)}) zoom:${game.renderer.camera.scale.toFixed(2)}`,
      x: 10, y: 68, color: '#aaa',
      enabled: () => state.showDebug
    });
    debugRenderer.addText('mouse', {
      getText: () => {
        const mouseInfo = inputManager.getMouseGridPosition(state.player.col, state.player.row);
        return `Mouse: Screen(${state.mouse.x.toFixed(0)}, ${state.mouse.y.toFixed(0)}) Grid(${mouseInfo.col}, ${mouseInfo.row}) L${mouseInfo.layer}`;
      },
      x: 10, y: 84, color: '#ff0',
      enabled: () => state.showDebug
    });
    debugRenderer.addTileHighlight('mouse', {
      getTile: () => {
        const mouseInfo = inputManager.getMouseGridPosition(state.player.col, state.player.row);
        return { col: mouseInfo.col, row: mouseInfo.row };
      },
      color: '#ff0',
      lineWidth: 2,
      alpha: 0.4,
      enabled: () => state.showDebug
    });
    debugRenderer.addText('layers', {
      getText: () => `Layers: ${CONFIG.layerCount} | Parallax: ${state.layerSettings.parallaxRange} | Z-Step: ${state.layerSettings.zIndexStep}`,
      x: 10, y: 100, color: '#96ceb4',
      enabled: () => state.showDebug
    });

    // Start game loop
    game.start();
    log('🎮 Axial2.5D Framework started!', 'success');
    log(`Map: ${CONFIG.mapSize}x${CONFIG.mapSize}, ${CONFIG.layerCount} layers`, 'info');

    // ==================== Setup Functions ====================
    function setupMapTiles(): void {
      const { mapSize } = CONFIG;

      for (let c = 0; c < mapSize; c++) {
        for (let r = 0; r < mapSize; r++) {
          let type = 'grass';
          let walkable = true;

          if (c === 0 || c === mapSize - 1 || r === 0 || r === mapSize - 1) {
            type = 'water';
            walkable = false;
          }
          if (c === 6 || r === 6) type = 'road';
          if ((c + r) % 4 === 0 && c > 1 && c < mapSize - 2 && r > 1 && r < mapSize - 2) {
            type = 'stone';
          }

          gridSystem.setTileType(c, r, type, walkable);
        }
      }
    }

    function setupEntities(): void {
      // Player (height 40, shorter than buildings for the occlusion demo)
      entityManager.addEntity({
        id: 'player',
        col: state.player.col,
        row: state.player.row,
        width: 40,
        length: 40,
        height: 40,
        depth: 0,
        visible: true,
        colors: ['#ff6b6b', '#ff5252', '#ff3838', '#e03030', '#ff6b6b', '#c02020']
      } as any);
      log(`Added player at (${state.player.col}, ${state.player.row})`, 'success');

      const buildingColors = [
        ['#f5deb3', '#deb887', '#cd853f', '#b8860b', '#daa520', '#8b4513'],
        ['#8b0000', '#a52a2a', '#8b0000', '#654321', '#8b4513', '#654321'],
        ['#2e8b57', '#3cb371', '#2e8b57', '#654321', '#8b4513', '#654321'],
        ['#4169e1', '#6495ed', '#4169e1', '#654321', '#8b4513', '#654321'],
        ['#708090', '#778899', '#708090', '#654321', '#8b4513', '#654321'],
        ['#9370db', '#8b7ab8', '#9370db', '#654321', '#8b4513', '#654321'],
        ['#ff8c00', '#ffa500', '#ff8c00', '#654321', '#8b4513', '#654321']
      ];

      const buildings = [
        { id: 'tower1', col: 5, row: 5, width: 80, length: 80, height: 120, colorIndex: 5 },
        { id: 'tower2', col: 7, row: 7, width: 80, length: 80, height: 100, colorIndex: 6 },
        { id: 'tower3', col: 8, row: 5, width: 70, length: 70, height: 90, colorIndex: 3 },
        { id: 'townhall', col: 3, row: 3, width: 120, length: 120, height: 80, colorIndex: 0 },
        { id: 'house1', col: 9, row: 3, width: 90, length: 90, height: 65, colorIndex: 1 },
        { id: 'house2', col: 3, row: 9, width: 90, length: 90, height: 65, colorIndex: 2 },
        { id: 'warehouse', col: 9, row: 9, width: 100, length: 80, height: 50, colorIndex: 4 }
      ];

      for (const b of buildings) {
        entityManager.addEntity({
          ...b,
          depth: 0,
          visible: true,
          colors: buildingColors[b.colorIndex]
        } as any);
      }
      log(`Added ${buildings.length} buildings (3 tall towers for occlusion demo)`, 'success');
      log(`Total entities: ${entityManager.getCount()}`, 'info');
    }

    // ==================== Cloud System ====================
    function regenerateClouds(): void {
      effectSystem.clear();

      // Layer 4: white clouds
      const cloudCount = 6 + Math.floor(Math.random() * 5);
      for (let i = 0; i < cloudCount; i++) {
        effectSystem.addEffect({
          id: `cloud_white_${i}`,
          type: 'cloud',
          col: Math.floor(Math.random() * (CONFIG.mapSize - 2)) + 1,
          row: Math.floor(Math.random() * (CONFIG.mapSize - 2)) + 1,
          layer: 4,
          size: 40 + Math.random() * 40,
          offsetY: -50 - Math.random() * 100,
          color: '#ffffff',
          alpha: 0.9
        });
      }

      // Layer 1-3: colored clouds
      for (let layerIdx = 1; layerIdx <= 3; layerIdx++) {
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          effectSystem.addEffect({
            id: `cloud_${layerIdx}_${i}`,
            type: 'cloud',
            col: Math.floor(Math.random() * (CONFIG.mapSize - 2)) + 1,
            row: Math.floor(Math.random() * (CONFIG.mapSize - 2)) + 1,
            layer: layerIdx,
            size: 35 + Math.random() * 35,
            offsetY: -40 - Math.random() * 80,
            color: layerCloudColors[layerIdx],
            alpha: 0.9
          });
        }
      }

      log(`☁️ Regenerated ${effectSystem.getCount()} clouds`, 'success');
    }

    function setupEffects(): void {
      regenerateClouds();
    }

    // ==================== Event Handlers ====================
    function setupEventHandlers(): void {
      // Click to move - 'tileClick' provides ready-made grid coordinates {col, row}
      game.eventBus.on('tileClick', (data: any) => {
        const tile = gridSystem.getTile(data.col, data.row);
        if (tile && tile.walkable) {
          movePlayer(data.col, data.row);
        }
      });

      // Keyboard movement
      game.eventBus.on('keyDown', () => {
        const { dCol, dRow } = inputManager.getMovementDirection();
        if (dCol !== 0 || dRow !== 0) {
          const newCol = state.player.col + dCol;
          const newRow = state.player.row + dRow;
          const tile = gridSystem.getTile(newCol, newRow);
          if (tile && tile.walkable) {
            movePlayer(newCol, newRow);
          }
        }
      });
    }

    function movePlayer(col: number, row: number): void {
      state.player.col = col;
      state.player.row = row;

      const player = entityManager.getEntity('player');
      if (player) {
        entityManager.moveEntity(player, col, row);
      }

      // Keep InputManager in sync for parallax-accurate click conversion
      inputManager.setPlayerPosition(col, row);

      log(`Moved to (${col}, ${row})`, 'info');
    }

    // ==================== UI Functions ====================
    const btnGrid = container.querySelector<HTMLButtonElement>('#btnGrid')!;
    const btnDebug = container.querySelector<HTMLButtonElement>('#btnDebug')!;

    btnGrid.addEventListener('click', () => {
      state.showGrid = !state.showGrid;
      btnGrid.classList.toggle('active', state.showGrid);
      game.setRenderOptions({ showGrid: state.showGrid });
      log(`Grid ${state.showGrid ? 'enabled' : 'disabled'}`, 'info');
    }, { signal });

    btnDebug.addEventListener('click', () => {
      state.showDebug = !state.showDebug;
      btnDebug.classList.toggle('active', state.showDebug);
    }, { signal });

    container.querySelector<HTMLButtonElement>('#btnResetCam')!.addEventListener('click', () => {
      game.renderer.camera.reset();
      cameraController.update(); // Re-apply follow
      log('Camera reset', 'info');
    }, { signal });

    container.querySelector<HTMLButtonElement>('#btnClouds')!.addEventListener('click', () => {
      regenerateClouds();
    }, { signal });

    // Sliders
    function bindSlider(ariaLabel: string, onChange: (value: number) => void): void {
      const input = container.querySelector<HTMLInputElement>(`input[aria-label="${ariaLabel}"]`)!;
      input.addEventListener('input', () => {
        onChange(parseFloat(input.value));
        updateLayerSettings();
      }, { signal });
    }

    bindSlider('foreground-alpha', (v) => { state.layerSettings.foregroundAlpha = v; });
    bindSlider('z-index-step', (v) => { state.layerSettings.zIndexStep = v; });
    bindSlider('parallax-range', (v) => { state.layerSettings.parallaxRange = v; });

    function updateLayerSettings(): void {
      const { foregroundAlpha, zIndexStep, parallaxRange } = state.layerSettings;

      container.querySelector<HTMLElement>('#fgAlphaVal')!.textContent = String(foregroundAlpha);
      container.querySelector<HTMLElement>('#zStepVal')!.textContent = String(zIndexStep);
      container.querySelector<HTMLElement>('#parallaxRangeVal')!.textContent = String(parallaxRange);

      layerManager.updateLayerProperties({ foregroundAlpha, zIndexStep, parallaxRange });
      game.setRenderOptions({ foregroundAlpha, zIndexStep, parallaxRange });

      log(`Layer settings updated: α=${foregroundAlpha}, Z=${zIndexStep}px, parallax=${parallaxRange}`, 'info');
    }

    // ==================== Layer List ====================
    function updateLayerList(): void {
      const layerList = container.querySelector<HTMLElement>('#layerList');
      if (!layerList) return;

      const layerStats: Record<number, { tiles: number; entities: number; clouds: number }> = {};
      for (let i = 0; i < CONFIG.layerCount; i++) {
        layerStats[i] = { tiles: 0, entities: 0, clouds: 0 };
      }

      for (let c = 0; c < CONFIG.mapSize; c++) {
        for (let r = 0; r < CONFIG.mapSize; r++) {
          layerStats[layerManager.getLayerForDepth(c + r)].tiles++;
        }
      }

      for (const entity of entityManager.getAllEntities()) {
        layerStats[layerManager.getLayerForDepth(entity.col + entity.row)].entities++;
      }

      for (const cloud of effectSystem.getAllEffects()) {
        layerStats[cloud.layer].clouds++;
      }

      // Build DOM once, then update text in-place
      if (!layerDomBuilt) {
        layerList.innerHTML = '';
        for (let i = CONFIG.layerCount - 1; i >= 0; i--) {
          const div = document.createElement('div');
          div.className = 'layer-item';
          div.style.borderLeft = i === CONFIG.layerCount - 1 ? '3px solid #4a90d9' : '3px solid transparent';

          const left = document.createElement('div');
          left.style.cssText = 'display:flex;align-items:center;';
          const swatch = document.createElement('div');
          swatch.className = 'layer-color';
          swatch.style.background = LAYER_COLORS[i];
          const nameSpan = document.createElement('span');
          nameSpan.textContent = `Layer ${i}${i === CONFIG.layerCount - 1 ? ' (前景)' : i === 0 ? ' (背景)' : ''}`;
          left.appendChild(swatch);
          left.appendChild(nameSpan);

          const right = document.createElement('div');
          right.style.textAlign = 'right';
          const statsLine = document.createElement('div');
          const settingsLine = document.createElement('div');
          settingsLine.style.cssText = 'font-size:0.75em;color:#888;';
          right.appendChild(statsLine);
          right.appendChild(settingsLine);

          div.appendChild(left);
          div.appendChild(right);
          layerList.appendChild(div);
          layerDomCache[`stats-${i}`] = statsLine;
          layerDomCache[`settings-${i}`] = settingsLine;
          layerDomCache[`swatch-${i}`] = swatch;
        }
        layerDomBuilt = true;
      }

      for (let i = CONFIG.layerCount - 1; i >= 0; i--) {
        const stats = layerManager.getLayerStats(i);
        const ls = layerStats[i];
        layerDomCache[`swatch-${i}`].style.opacity = String(stats.alpha);
        layerDomCache[`stats-${i}`].textContent =
          `${ls.tiles} tiles | ${ls.entities} entities${ls.clouds ? ` | ☁️ ${ls.clouds} clouds` : ''}`;
        layerDomCache[`settings-${i}`].textContent =
          `${(stats.parallaxFactor * 100).toFixed(0)}% parallax | ${(stats.alpha * 100).toFixed(0)}% alpha | Z+${stats.zIndexOffset}`;
      }
    }

    // ==================== Cleanup ====================
    return () => {
      abort.abort();                 // remove all DOM listeners
      game.stop();                   // stop the RAF loop
      inputManager.destroy();   // remove engine listeners
    };
  }
};

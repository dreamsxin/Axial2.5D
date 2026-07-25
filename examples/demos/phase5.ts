/**
 * Phase 5 Demo - module system with automatic wiring.
 *
 * Same scene as the Framework demo, but everything is created by the
 * ModuleManager: LayerManager, CameraController, OcclusionSystem,
 * EffectSystem, UIManager and PlayerController. No manual event handling.
 *
 * (Ported from the former examples/html/phase5-demo.html)
 */

import { Game, DebugRenderer } from '../../src/index';
import type { OcclusionData } from '../../src/index';
import type { Demo } from './types';

const CONFIG = { width: 800, height: 600, mapSize: 12, cellSize: 50, layerCount: 5 };
const LAYER_COLORS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'];

export const phase5Demo: Demo = {
  id: 'phase5',
  title: 'Phase 5 · Modules',
  description: 'Module system: auto-wired controllers, UI bindings and config sliders',

  mount(container: HTMLElement): () => void {
    container.innerHTML = `
      <div class="demo">
        <div class="demo-canvas-container"><canvas id="gameCanvas" width="800" height="600"></canvas></div>
        <div class="demo-sidebar">
          <h1>🎮 Axial2.5D Phase 5</h1>
          <h2>📊 Status</h2>
          <div class="stat">FPS: <span id="fps">0</span></div>
          <div class="stat">Player: <span id="playerPos">0, 0</span></div>
          <div class="stat">Occlusion: <span id="occlusion">VISIBLE</span></div>
          <h2>🎯 Controls</h2>
          <div class="stat"><span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span> Move</div>
          <div class="stat"><span class="key">Click</span> Move to tile</div>
          <div class="stat"><span class="key">Drag</span> Pan camera</div>
          <div class="stat"><span class="key">Wheel</span> Zoom</div>
          <h2>⚙️ Settings</h2>
          <button id="btnGrid">📐 Grid: ON</button>
          <button id="btnDebug">🐛 Debug: OFF</button>
          <button id="btnClouds">☁️ Regenerate Clouds</button>
          <label>前景透明度：<span id="fgAlphaVal">0.6</span></label>
          <input type="range" id="fgAlphaSlider" min="0.2" max="1.0" step="0.1" value="0.6">
          <label>Z 轴间距：<span id="zStepVal">30</span></label>
          <input type="range" id="zStepSlider" min="0" max="100" step="10" value="30">
          <label>视差范围：<span id="parallaxRangeVal">0.7</span></label>
          <input type="range" id="parallaxRangeSlider" min="0" max="1.0" step="0.1" value="0.7">
          <h2>📊 Layers</h2>
          <div id="layerList"></div>
          <h2>📜 Log</h2>
          <div id="log" class="log"></div>
        </div>
      </div>
    `;

    // ==================== Game Setup (module system) ====================
    const game = new Game({
      width: CONFIG.width,
      height: CONFIG.height,
      canvas: container.querySelector<HTMLCanvasElement>('#gameCanvas')!,
      projection: { type: 'isometric', viewAngle: 30 },
      config: {
        'render.showGrid': true,
        'render.foregroundAlpha': 0.6,
        'render.zIndexStep': 30,
        'render.parallaxRange': 0.7,
        'debug.enabled': false
      },
      modules: {
        layerManager: { enabled: true, layerCount: 5, foregroundAlpha: 0.6, zIndexStep: 30, parallaxRange: 0.7 },
        cameraController: { enabled: true, followEntity: 'player', smoothness: 0.1, autoParallax: true },
        occlusionSystem: { enabled: true },
        effectSystem: { enabled: true },
        uiManager: { enabled: true, autoUpdate: true, logElementId: 'log' },
        playerController: { enabled: true, entityId: 'player', clickToMove: true, wasdKeys: true },
        debugPanel: { enabled: false }
      }
    });

    game.init({ width: CONFIG.mapSize, height: CONFIG.mapSize, tileW: CONFIG.cellSize, tileH: CONFIG.cellSize, tiles: [] });

    const gridSystem = game.gridSystem!;
    const entityManager = game.entityManager!;
    const inputManager = game.inputManager!;

    // Modules are guaranteed by the config above
    const layerManager = game.modules.layerManager!;
    const effectSystem = game.modules.effectSystem!;
    const occlusionSystem = game.modules.occlusionSystem!;
    const uiManager = game.modules.uiManager!;

    // ==================== Debug Renderer ====================
    const debugEnabled = () => game.config.get<boolean>('debug.enabled') ?? false;

    const debugRenderer = new DebugRenderer();
    debugRenderer.addText('fps', {
      getText: () => `FPS: ${game.stats.fps}`,
      x: 10, y: 20, color: '#0f0',
      enabled: debugEnabled
    });
    debugRenderer.addText('stats', {
      getText: () => `Entities: ${entityManager.getCount()} | Draw calls: ${game.renderer.getRenderItemCount()}`,
      x: 10, y: 36, color: '#fff',
      enabled: debugEnabled
    });
    debugRenderer.addText('player', {
      getText: () => {
        const player = entityManager.getEntity('player');
        return player ? `Player: (${player.col}, ${player.row})` : 'Player: (0, 0)';
      },
      x: 10, y: 52, color: '#4a90d9',
      enabled: debugEnabled
    });
    debugRenderer.addText('camera', {
      getText: () => `Camera: (${game.renderer.camera.offsetX.toFixed(0)}, ${game.renderer.camera.offsetY.toFixed(0)}) zoom:${game.renderer.camera.scale.toFixed(2)}`,
      x: 10, y: 68, color: '#aaa',
      enabled: debugEnabled
    });
    debugRenderer.addText('mouse', {
      getText: () => {
        const mx = inputManager.mouseScreenX;
        const my = inputManager.mouseScreenY;
        const player = entityManager.getEntity('player');
        const mouseInfo = inputManager.getMouseGridPosition(player?.col ?? 6, player?.row ?? 6);
        return `Mouse: Screen(${mx.toFixed(0)}, ${my.toFixed(0)}) Grid(${mouseInfo.col}, ${mouseInfo.row}) L${mouseInfo.layer}`;
      },
      x: 10, y: 84, color: '#ff0',
      enabled: debugEnabled
    });
    debugRenderer.addTileHighlight('mouse', {
      getTile: () => {
        const player = entityManager.getEntity('player');
        const mouseInfo = inputManager.getMouseGridPosition(player?.col ?? 6, player?.row ?? 6);
        return { col: mouseInfo.col, row: mouseInfo.row };
      },
      color: '#ff0',
      lineWidth: 2,
      alpha: 0.4,
      enabled: debugEnabled
    });
    debugRenderer.addText('layers', {
      getText: () => {
        const parallaxRange = game.config.get<number>('render.parallaxRange') ?? 0.7;
        const s = layerManager.getLayerStats(0);
        return `Layers: ${CONFIG.layerCount} | Parallax: ${Number(parallaxRange).toFixed(1)} | Z-Step: ${Math.round(s?.zIndexOffset ?? 30)}`;
      },
      x: 10, y: 100, color: '#96ceb4',
      enabled: debugEnabled
    });

    // ==================== Setup Map ====================
    for (let c = 0; c < CONFIG.mapSize; c++) {
      for (let r = 0; r < CONFIG.mapSize; r++) {
        let type = 'grass';
        let walkable = true;
        if (c === 0 || c === CONFIG.mapSize - 1 || r === 0 || r === CONFIG.mapSize - 1) { type = 'water'; walkable = false; }
        if (c === 6 || r === 6) type = 'road';
        if ((c + r) % 4 === 0 && c > 1 && c < CONFIG.mapSize - 2 && r > 1 && r < CONFIG.mapSize - 2) type = 'stone';
        gridSystem.setTileType(c, r, type, walkable);
      }
    }

    // ==================== Setup Entities ====================
    entityManager.addEntity({
      id: 'player', col: 6, row: 6, width: 40, length: 40, height: 40,
      colors: ['#ff6b6b', '#ff5252', '#ff3838', '#e03030', '#ff6b6b', '#c02020']
    } as any);

    const buildings = [
      { id: 'tower1', col: 5, row: 5, width: 80, length: 80, height: 120 },
      { id: 'tower2', col: 7, row: 7, width: 80, length: 80, height: 100 },
      { id: 'townhall', col: 3, row: 3, width: 120, length: 120, height: 80 },
      { id: 'house1', col: 9, row: 3, width: 90, length: 90, height: 65 },
      { id: 'warehouse', col: 9, row: 9, width: 100, length: 80, height: 50 }
    ];

    const buildingColors = [
      ['#f5deb3', '#deb887', '#cd853f', '#b8860b', '#daa520', '#8b4513'],
      ['#8b0000', '#a52a2a', '#8b0000', '#654321', '#8b4513', '#654321'],
      ['#2e8b57', '#3cb371', '#2e8b57', '#654321', '#8b4513', '#654321'],
      ['#4169e1', '#6495ed', '#4169e1', '#654321', '#8b4513', '#654321'],
      ['#708090', '#778899', '#708090', '#654321', '#8b4513', '#654321']
    ];

    buildings.forEach((b, i) => {
      entityManager.addEntity({ ...b, depth: 0, visible: true, colors: buildingColors[i % buildingColors.length] } as any);
    });

    game.log?.success(`Added ${buildings.length + 1} entities`);

    // ==================== Setup Effects (builder API) ====================
    function regenerateClouds(): void {
      effectSystem.clear();
      effectSystem.addClouds(6, { layer: 4, sizeRange: [40, 80], color: '#ffffff', mapSize: CONFIG.mapSize });
      effectSystem.addClouds(2, { layer: 2, sizeRange: [35, 60], color: '#4ecdc4', mapSize: CONFIG.mapSize });
      effectSystem.addClouds(2, { layer: 1, sizeRange: [30, 55], color: '#ff6b6b', mapSize: CONFIG.mapSize });
      effectSystem.addClouds(2, { layer: 3, sizeRange: [35, 60], color: '#45b7d1', mapSize: CONFIG.mapSize });
      game.log?.success(`☁️ Generated ${effectSystem.getCount()} clouds`);
    }

    regenerateClouds();

    // ==================== UI Bindings ====================
    uiManager.bindText('fps', () => game.stats.fps);
    uiManager.bindText('playerPos', () => {
      const p = entityManager.getEntity('player');
      return p ? `${p.col}, ${p.row}` : '0, 0';
    });
    uiManager.bind('occlusion', (el: HTMLElement) => {
      const player = entityManager.getEntity('player');
      if (!player) return;
      const occlusions = occlusionSystem.getOccludingBuildings(player);
      const isOccluded = occlusions.some((o: OcclusionData) => o.height > player.height);
      el.textContent = isOccluded ? `OCCLUDED by ${occlusions.map((o: OcclusionData) => o.buildingId).join(', ')}` : 'VISIBLE (normal)';
      el.style.color = isOccluded ? '#4ecdc4' : '#4ad97a';
    });

    uiManager.addLayerList('layerList', {
      layerColors: LAYER_COLORS,
      showStats: ['tiles', 'entities', 'clouds']
    });

    uiManager.toggleButtonForConfig('btnGrid', 'render.showGrid', {
      getText: (state: boolean) => `📐 Grid: ${state ? 'ON' : 'OFF'}`,
      activeClass: 'active'
    });
    uiManager.toggleButtonForConfig('btnDebug', 'debug.enabled', {
      getText: (state: boolean) => `🐛 Debug: ${state ? 'ON' : 'OFF'}`
    });
    uiManager.bindButton('btnClouds', () => regenerateClouds());

    // ==================== Slider Bindings ====================
    uiManager.bindSliderToConfig('fgAlphaSlider', 'render.foregroundAlpha', 'fgAlphaVal');
    uiManager.bindSliderToConfig('zStepSlider', 'render.zIndexStep', 'zStepVal');
    uiManager.bindSliderToConfig('parallaxRangeSlider', 'render.parallaxRange', 'parallaxRangeVal');

    game.config.on('render.foregroundAlpha', (v) => {
      layerManager.updateLayerProperties({ foregroundAlpha: Number(v) });
    });
    game.config.on('render.zIndexStep', (v) => {
      layerManager.updateLayerProperties({ zIndexStep: Number(v) });
    });
    game.config.on('render.parallaxRange', (v) => {
      layerManager.updateLayerProperties({ parallaxRange: Number(v) });
    });

    // ==================== Render Hook ====================
    // Chain onto existing hooks: the UIManager module already registered
    // onBeforePresent for autoUpdate - do not clobber it.
    const prevHooks = game.renderHooks ?? {};
    game.renderHooks = {
      ...prevHooks,
      onAfterLayers: (ctx) => {
        prevHooks.onAfterLayers?.(ctx);
        if (debugEnabled()) {
          debugRenderer.render(ctx, gridSystem, game.renderer.camera, game.projection);
        }
      }
    };

    // ==================== Start ====================
    game.start();
    game.log?.success('🎮 Axial2.5D Phase 5 started!');
    game.log?.info(`Map: ${CONFIG.mapSize}x${CONFIG.mapSize}, ${CONFIG.layerCount} layers`);

    // ==================== Cleanup ====================
    return () => {
      game.stop();
      inputManager.destroy();
    };
  }
};

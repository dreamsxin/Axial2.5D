/**
 * Standalone Demo - pure Canvas 2D, no framework.
 *
 * The original minimal multi-layer isometric demo: hand-rolled projection,
 * parallax layers, Z-axis offsets, clouds, camera follow and input handling.
 * Useful as a baseline reference for what the framework automates.
 *
 * (Ported from the former examples/html/standalone.html)
 */

import type { Demo } from './types';

const COS_THETA = Math.cos(30 * Math.PI / 180);
const SIN_THETA = Math.sin(30 * Math.PI / 180);
const CELL_SIZE = 50;
const LAYER_COUNT = 5;
const LAYER_COLORS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'];

interface DemoEntity {
  id: string;
  col: number;
  row: number;
  width: number;
  length: number;
  height: number;
}

interface Tile {
  type: string;
  walkable: boolean;
  layer: number;
}

interface Cloud {
  col: number;
  row: number;
  size: number;
  offsetY: number;
  color?: string;
}

interface ScreenPoint {
  sx: number;
  sy: number;
}

export const standaloneDemo: Demo = {
  id: 'standalone',
  title: 'Standalone',
  description: 'Pure Canvas 2D multi-layer demo with zero framework code',

  mount(container: HTMLElement): () => void {
    container.innerHTML = `
      <div class="demo">
        <div class="demo-canvas-container"><canvas id="canvas" width="800" height="600"></canvas></div>
        <div class="demo-sidebar">
          <h1>🎮 Axial2.5D Demo</h1>
          <h2>📊 Status</h2>
          <div class="stat">FPS: <span id="fps">0</span></div>
          <div class="stat">Layers: <span id="layerCount">0</span></div>
          <div class="stat">Player: <span id="playerPos">0, 0</span></div>
          <h2>🎯 Controls</h2>
          <div class="stat"><span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span> Move</div>
          <div class="stat"><span class="key">Click</span> Move to tile</div>
          <div class="stat"><span class="key">Drag</span> Pan camera</div>
          <div class="stat"><span class="key">Wheel</span> Zoom</div>
          <h2>⚙️ Settings</h2>
          <button id="btnGrid">📐 Grid</button>
          <button id="btnWire">🔲 Wireframe</button>
          <button id="btnDebug">🐛 Debug</button>
          <button id="btnLayers">🗂️ Show Layers</button>
          <button id="btnResetCam">📷 Reset Camera</button>
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

    const abort = new AbortController();
    const { signal } = abort;

    const canvas = container.querySelector<HTMLCanvasElement>('#canvas')!;
    const ctx = canvas.getContext('2d')!;
    const logEl = container.querySelector<HTMLElement>('#log')!;
    const fpsEl = container.querySelector<HTMLElement>('#fps')!;
    const layerCountEl = container.querySelector<HTMLElement>('#layerCount')!;
    const playerPosEl = container.querySelector<HTMLElement>('#playerPos')!;
    const layerListEl = container.querySelector<HTMLElement>('#layerList')!;

    // ==================== State ====================
    const state = {
      showGrid: true,
      showWireframe: false,
      showDebug: false,
      showLayerColors: false,
      player: { col: 6, row: 6 },
      camera: { offsetX: 0, offsetY: 0, zoom: 1, targetOffsetX: 0, targetOffsetY: 0 },
      entities: [] as DemoEntity[],
      lastTime: 0,
      frameCount: 0,
      fps: 0,
      isDragging: false,
      mouse: {
        screenX: 0, screenY: 0,
        worldX: 0, worldY: 0,
        gridCol: 0, gridRow: 0,
        overTile: null as Tile | null,
        layer: 0
      },
      layerSettings: {
        foregroundAlpha: 0.6,
        zIndexStep: 30,
        parallaxRange: 0.7  // Parallax range coefficient (0.3 to 1.0)
      }
    };

    // ==================== Projection ====================
    function worldToScreen(worldX: number, worldY: number, worldZ: number, parallaxFactor = 1.0): ScreenPoint {
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

    function screenToWorld(screenX: number, screenY: number, parallaxFactor = 1.0): { x: number; y: number } {
      const scale = state.camera.zoom;
      const adjX = (screenX - canvas.width / 2 - state.camera.offsetX * parallaxFactor) / scale;
      const adjY = (screenY - canvas.height / 2 - state.camera.offsetY * parallaxFactor) / scale;
      const worldX = (adjX / COS_THETA + adjY / SIN_THETA) / 2;
      const worldY = (adjY / SIN_THETA - adjX / COS_THETA) / 2;
      return { x: worldX, y: worldY };
    }

    function gridToWorld(col: number, row: number): { x: number; y: number } {
      return { x: col * CELL_SIZE, y: row * CELL_SIZE };
    }

    function worldToGrid(worldX: number, worldY: number): { col: number; row: number } {
      return { col: Math.round(worldX / CELL_SIZE), row: Math.round(worldY / CELL_SIZE) };
    }

    // ==================== Layers ====================
    function getLayerForDepth(depth: number): number {
      const maxDepth = 2000;
      const layerIndex = Math.floor((depth / maxDepth) * LAYER_COUNT);
      return Math.max(0, Math.min(LAYER_COUNT - 1, layerIndex));
    }

    // Layer 4 = foreground (top), Layer 0 = background (bottom)
    function getParallaxFactor(layerIndex: number): number {
      // Layer 4 (foreground) = 100%, Layer 0 (background) = 30%
      return 0.3 + (layerIndex / (LAYER_COUNT - 1)) * state.layerSettings.parallaxRange;
    }

    function getLayerAlpha(layerIndex: number): number {
      // Layer 4 (foreground) = low alpha, Layer 0 (background) = 100% alpha
      const t = layerIndex / (LAYER_COUNT - 1);
      return 1.0 - (1.0 - state.layerSettings.foregroundAlpha) * t;
    }

    function getZIndexOffset(layerIndex: number): number {
      // Layer 0 = base (Z=0, world reference plane)
      // Positive Z = above Layer 0 (foreground/closer to camera)
      return layerIndex * state.layerSettings.zIndexStep;
    }

    function getPlayerLayer(): number {
      return getLayerForDepth(state.player.col + state.player.row);
    }

    function getPlayerLayerParallax(): number {
      return getParallaxFactor(getPlayerLayer());
    }

    // ==================== Map & Clouds ====================
    const mapSize = 12;
    const tiles: Tile[][] = [];
    const cloudTiles: Cloud[] = [];            // Layer 4 (foreground) clouds
    const layerClouds: Record<number, Cloud[]> = {};  // Layer 1-3 clouds

    const layerCloudColors: Record<number, string> = {
      1: '#ff6b6b',  // Red
      2: '#4ecdc4',  // Teal
      3: '#ffeaa7'   // Yellow
    };

    function regenerateClouds(): void {
      cloudTiles.length = 0;
      const cloudCount = 6 + Math.floor(Math.random() * 5);  // 6-10 clouds
      for (let i = 0; i < cloudCount; i++) {
        cloudTiles.push({
          col: Math.floor(Math.random() * (mapSize - 2)) + 1,
          row: Math.floor(Math.random() * (mapSize - 2)) + 1,
          size: 40 + Math.random() * 40,
          offsetY: -50 - Math.random() * 100
        });
      }

      // Regenerate Layer 1-3 clouds
      for (let layerIdx = 1; layerIdx <= 3; layerIdx++) {
        layerClouds[layerIdx].length = 0;
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          layerClouds[layerIdx].push({
            col: Math.floor(Math.random() * (mapSize - 2)) + 1,
            row: Math.floor(Math.random() * (mapSize - 2)) + 1,
            size: 35 + Math.random() * 35,
            offsetY: -40 - Math.random() * 80,
            color: layerCloudColors[layerIdx]
          });
        }
      }

      const total = cloudTiles.length + Object.keys(layerClouds).reduce((sum, k) => sum + layerClouds[Number(k)].length, 0);
      log(`Regenerated ${total} clouds`, 'success');
    }

    for (let layerIdx = 1; layerIdx <= 3; layerIdx++) layerClouds[layerIdx] = [];
    regenerateClouds();

    for (let c = 0; c < mapSize; c++) {
      tiles[c] = [];
      for (let r = 0; r < mapSize; r++) {
        let type = 'grass';
        let walkable = true;
        if (c === 0 || c === mapSize - 1 || r === 0 || r === mapSize - 1) { type = 'water'; walkable = false; }
        if (c === 6 || r === 6) type = 'road';
        if ((c + r) % 4 === 0 && c > 1 && c < mapSize - 2 && r > 1 && r < mapSize - 2) type = 'stone';
        tiles[c][r] = { type, walkable, layer: getLayerForDepth(c + r) };
      }
    }

    // ==================== Entities ====================
    const buildings: DemoEntity[] = [
      { id: 'townhall', col: 6, row: 6, width: 150, length: 150, height: 100 },
      { id: 'house1', col: 2, row: 2, width: 100, length: 100, height: 70 },
      { id: 'house2', col: 9, row: 2, width: 100, length: 100, height: 70 },
      { id: 'house3', col: 2, row: 9, width: 100, length: 100, height: 70 },
      { id: 'warehouse', col: 9, row: 9, width: 120, length: 100, height: 60 }
    ];

    const buildingColors = [
      ['#f5deb3', '#deb887', '#cd853f', '#b8860b', '#daa520', '#8b4513'],
      ['#8b0000', '#a52a2a', '#8b0000', '#654321', '#8b4513', '#654321'],
      ['#2e8b57', '#3cb371', '#2e8b57', '#654321', '#8b4513', '#654321'],
      ['#4169e1', '#6495ed', '#4169e1', '#654321', '#8b4513', '#654321'],
      ['#708090', '#778899', '#708090', '#654321', '#8b4513', '#654321']
    ];

    const playerEntity: DemoEntity = { id: 'player', col: state.player.col, row: state.player.row, width: 50, length: 50, height: 70 };
    state.entities = [...buildings, playerEntity];

    const colors: Record<string, string> = { grass: '#4a7c4e', water: '#4a90a4', road: '#666666', stone: '#888888', sand: '#c2b280' };

    // ==================== Drawing ====================
    function drawTile(col: number, row: number, type: string, layerIndex: number): void {
      const worldPos = gridToWorld(col, row);
      const parallax = getParallaxFactor(layerIndex);
      const corners = [
        { x: worldPos.x, y: worldPos.y },
        { x: worldPos.x + CELL_SIZE, y: worldPos.y },
        { x: worldPos.x + CELL_SIZE, y: worldPos.y + CELL_SIZE },
        { x: worldPos.x, y: worldPos.y + CELL_SIZE }
      ].map(c => worldToScreen(c.x, c.y, 0, parallax));

      ctx.beginPath();
      ctx.moveTo(corners[0].sx, corners[0].sy);
      for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].sx, corners[i].sy);
      ctx.closePath();

      let fillColor = colors[type] || '#4a4a4a';
      if (state.showLayerColors) {
        fillColor = blendColors(fillColor, LAYER_COLORS[layerIndex], 0.3);
      }

      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    function drawCloud(cloud: Cloud, layerIndex: number): void {
      const worldPos = gridToWorld(cloud.col, cloud.row);
      const parallax = getParallaxFactor(layerIndex);
      const alpha = getLayerAlpha(layerIndex);

      // Cloud center in screen space (floating above ground)
      const center = worldToScreen(worldPos.x, worldPos.y, cloud.offsetY, parallax);
      const size = cloud.size;

      ctx.save();
      ctx.globalAlpha = alpha * 0.9;  // Slightly transparent clouds

      // Draw fluffy cloud (multiple overlapping circles)
      ctx.fillStyle = cloud.color || '#ffffff';
      ctx.beginPath();
      ctx.arc(center.sx, center.sy, size * 0.5, 0, Math.PI * 2);
      ctx.arc(center.sx - size * 0.4, center.sy + size * 0.1, size * 0.4, 0, Math.PI * 2);
      ctx.arc(center.sx + size * 0.4, center.sy + size * 0.1, size * 0.4, 0, Math.PI * 2);
      ctx.arc(center.sx - size * 0.2, center.sy - size * 0.3, size * 0.35, 0, Math.PI * 2);
      ctx.arc(center.sx + size * 0.2, center.sy - size * 0.3, size * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Subtle shadow
      ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
      ctx.beginPath();
      ctx.arc(center.sx, center.sy + size * 0.3, size * 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    function drawBox(entity: DemoEntity, layerIndex: number): void {
      const baseX = entity.col * CELL_SIZE;
      const baseY = entity.row * CELL_SIZE;
      const w = entity.width;
      const l = entity.length;
      const h = entity.height;
      const parallax = getParallaxFactor(layerIndex);
      const alpha = getLayerAlpha(layerIndex);

      const corners = {
        lbb: worldToScreen(baseX, baseY, 0, parallax),
        rbb: worldToScreen(baseX + w, baseY, 0, parallax),
        rfb: worldToScreen(baseX + w, baseY + l, 0, parallax),
        lfb: worldToScreen(baseX, baseY + l, 0, parallax),
        lbt: worldToScreen(baseX, baseY, h, parallax),
        rbt: worldToScreen(baseX + w, baseY, h, parallax),
        rft: worldToScreen(baseX + w, baseY + l, h, parallax),
        lft: worldToScreen(baseX, baseY + l, h, parallax)
      };

      const entityIndex = buildings.indexOf(entity);
      const bcolors = entityIndex >= 0 ? buildingColors[entityIndex] : ['#ccc', '#aaa', '#888', '#666', '#444', '#222'];

      ctx.save();
      ctx.globalAlpha = alpha;

      if (!state.showWireframe) {
        const faces: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint, string][] = [
          [corners.lbb, corners.rbb, corners.rfb, corners.lfb, bcolors[5]],
          [corners.lbb, corners.lfb, corners.lft, corners.lbt, bcolors[4]],
          [corners.lbb, corners.rbb, corners.rbt, corners.lbt, bcolors[3]],
          [corners.lfb, corners.rfb, corners.rft, corners.lft, bcolors[2]],
          [corners.rbb, corners.rfb, corners.rft, corners.rbt, bcolors[1]],
          [corners.lbt, corners.rbt, corners.rft, corners.lft, bcolors[0]]
        ];

        for (const [p1, p2, p3, p4, color] of faces) {
          ctx.beginPath();
          ctx.moveTo(p1.sx, p1.sy);
          ctx.lineTo(p2.sx, p2.sy);
          ctx.lineTo(p3.sx, p3.sy);
          ctx.lineTo(p4.sx, p4.sy);
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
          ctx.stroke();
        }
      }

      ctx.restore();

      ctx.strokeStyle = state.showWireframe ? '#fff' : '#444';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(corners.lbb.sx, corners.lbb.sy);
      ctx.lineTo(corners.rbb.sx, corners.rbb.sy);
      ctx.lineTo(corners.rfb.sx, corners.rfb.sy);
      ctx.lineTo(corners.lfb.sx, corners.lfb.sy);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(corners.lbt.sx, corners.lbt.sy);
      ctx.lineTo(corners.rbt.sx, corners.rbt.sy);
      ctx.lineTo(corners.rft.sx, corners.rft.sy);
      ctx.lineTo(corners.lft.sx, corners.lft.sy);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(corners.lbb.sx, corners.lbb.sy); ctx.lineTo(corners.lbt.sx, corners.lbt.sy);
      ctx.moveTo(corners.rbb.sx, corners.rbb.sy); ctx.lineTo(corners.rbt.sx, corners.rbt.sy);
      ctx.moveTo(corners.rfb.sx, corners.rfb.sy); ctx.lineTo(corners.rft.sx, corners.rft.sy);
      ctx.moveTo(corners.lfb.sx, corners.lfb.sy); ctx.lineTo(corners.lft.sx, corners.lft.sy);
      ctx.stroke();
    }

    function drawGrid(parallaxFactor = 1.0): void {
      if (!state.showGrid) return;
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;

      for (let c = 0; c <= mapSize; c++) {
        const start = gridToWorld(c, 0);
        const end = gridToWorld(c, mapSize);
        const s1 = worldToScreen(start.x, start.y, 0, parallaxFactor);
        const s2 = worldToScreen(end.x, end.y, 0, parallaxFactor);
        ctx.beginPath(); ctx.moveTo(s1.sx, s1.sy); ctx.lineTo(s2.sx, s2.sy); ctx.stroke();
      }
      for (let r = 0; r <= mapSize; r++) {
        const start = gridToWorld(0, r);
        const end = gridToWorld(mapSize, r);
        const s1 = worldToScreen(start.x, start.y, 0, parallaxFactor);
        const s2 = worldToScreen(end.x, end.y, 0, parallaxFactor);
        ctx.beginPath(); ctx.moveTo(s1.sx, s1.sy); ctx.lineTo(s2.sx, s2.sy); ctx.stroke();
      }
    }

    function blendColors(c1: string, c2: string, factor: number): string {
      const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
      const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
      const r = Math.round(r1 + (r2 - r1) * factor);
      const g = Math.round(g1 + (g2 - g1) * factor);
      const b = Math.round(b1 + (b2 - b1) * factor);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    // ==================== Camera ====================
    function updateCamera(): void {
      const worldPos = gridToWorld(state.player.col, state.player.row);
      const playerParallax = getPlayerLayerParallax();

      // Raw screen position WITHOUT camera offset or canvas center
      const scale = state.camera.zoom;
      const rawScreenX = (worldPos.x - worldPos.y) * COS_THETA * scale;
      const rawScreenY = (worldPos.x + worldPos.y) * SIN_THETA * scale;

      // Camera offset is multiplied by parallax during rendering;
      // to center the player on their layer, divide by the player's parallax
      state.camera.targetOffsetX = -rawScreenX / playerParallax;
      state.camera.targetOffsetY = -rawScreenY / playerParallax;

      if (!state.isDragging) {
        state.camera.offsetX += (state.camera.targetOffsetX - state.camera.offsetX) * 0.1;
        state.camera.offsetY += (state.camera.targetOffsetY - state.camera.offsetY) * 0.1;
      }
    }

    function centerCamera(): void {
      const worldPos = gridToWorld(state.player.col, state.player.row);
      const playerParallax = getPlayerLayerParallax();

      const scale = state.camera.zoom;
      const rawScreenX = (worldPos.x - worldPos.y) * COS_THETA * scale;
      const rawScreenY = (worldPos.x + worldPos.y) * SIN_THETA * scale;

      state.camera.offsetX = -rawScreenX / playerParallax;
      state.camera.offsetY = -rawScreenY / playerParallax;
      state.camera.targetOffsetX = state.camera.offsetX;
      state.camera.targetOffsetY = state.camera.offsetY;
    }

    // ==================== Render ====================
    function render(): void {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      updateCamera();

      // Render by layers (back to front): Layer 0 → Layer 4
      for (let layerIdx = 0; layerIdx < LAYER_COUNT; layerIdx++) {
        const parallax = getParallaxFactor(layerIdx);
        const zOffset = getZIndexOffset(layerIdx);

        ctx.save();
        // Apply Z-axis offset as screen-space translation
        if (zOffset !== 0) {
          ctx.translate(0, -zOffset);  // Negative = up (foreground)
        }

        // Draw tiles for this layer
        for (let c = 0; c < mapSize; c++) {
          for (let r = 0; r < mapSize; r++) {
            if (getLayerForDepth(c + r) === layerIdx) {
              drawTile(c, r, tiles[c][r].type, layerIdx);
            }
          }
        }

        // Draw grid for this layer (each layer shows its own grid with correct parallax)
        drawGrid(parallax);

        // Draw entities for this layer
        for (const entity of state.entities) {
          const entityLayer = getLayerForDepth(entity.col + entity.row);
          if (entityLayer === layerIdx) {
            drawBox(entity, layerIdx);
          }
        }

        // Draw clouds for this layer
        if (layerIdx === LAYER_COUNT - 1) {
          for (const cloud of cloudTiles) drawCloud(cloud, layerIdx);
        } else if (layerClouds[layerIdx]) {
          for (const cloud of layerClouds[layerIdx]) drawCloud(cloud, layerIdx);
        }

        ctx.restore();
      }

      if (state.showDebug) {
        ctx.fillStyle = '#0f0';
        ctx.font = '12px monospace';
        let y = 20;
        const lineH = 16;

        ctx.fillText(`FPS: ${state.fps}`, 10, y); y += lineH;
        ctx.fillText(`Layers: ${LAYER_COUNT}`, 10, y); y += lineH;
        ctx.fillText(`Player: (${state.player.col}, ${state.player.row})`, 10, y); y += lineH;
        ctx.fillText(`Camera: (${state.camera.offsetX.toFixed(0)}, ${state.camera.offsetY.toFixed(0)})`, 10, y); y += lineH;
        y += 5;

        ctx.fillStyle = '#ff0';
        ctx.fillText('=== Mouse ===', 10, y); y += lineH;
        ctx.fillStyle = '#0f0';
        ctx.fillText(`Screen: (${state.mouse.screenX.toFixed(0)}, ${state.mouse.screenY.toFixed(0)})`, 10, y); y += lineH;
        ctx.fillText(`World: (${state.mouse.worldX.toFixed(1)}, ${state.mouse.worldY.toFixed(1)})`, 10, y); y += lineH;
        ctx.fillText(`Grid: (${state.mouse.gridCol}, ${state.mouse.gridRow})`, 10, y); y += lineH;
        const mouseLayer = state.mouse.layer || getLayerForDepth(state.mouse.gridCol + state.mouse.gridRow);
        ctx.fillText(`Layer: ${mouseLayer} (α:${(getLayerAlpha(mouseLayer) * 100).toFixed(0)}% Z:${getZIndexOffset(mouseLayer)}px)`, 10, y); y += lineH;
        ctx.fillText(`Player Layer: ${getPlayerLayer()} (parallax: ${(getPlayerLayerParallax() * 100).toFixed(0)}%)`, 10, y); y += lineH;
        ctx.fillText(`Parallax Range: ${state.layerSettings.parallaxRange}`, 10, y); y += lineH;

        // Highlight mouse tile on player's layer (with Z-axis offset)
        const { gridCol, gridRow } = state.mouse;
        if (gridCol >= 0 && gridCol < mapSize && gridRow >= 0 && gridRow < mapSize) {
          const playerLayer = getPlayerLayer();
          const playerParallax = getPlayerLayerParallax();
          const playerZOffset = getZIndexOffset(playerLayer);

          const worldPos = gridToWorld(gridCol, gridRow);
          const corners = [
            worldToScreen(worldPos.x, worldPos.y, 0, playerParallax),
            worldToScreen(worldPos.x + CELL_SIZE, worldPos.y, 0, playerParallax),
            worldToScreen(worldPos.x + CELL_SIZE, worldPos.y + CELL_SIZE, 0, playerParallax),
            worldToScreen(worldPos.x, worldPos.y + CELL_SIZE, 0, playerParallax)
          ];

          ctx.save();
          if (playerZOffset !== 0) {
            ctx.translate(0, playerZOffset);
          }

          ctx.beginPath();
          ctx.moveTo(corners[0].sx, corners[0].sy);
          for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].sx, corners[i].sy);
          ctx.closePath();
          ctx.strokeStyle = '#ffff00';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.restore();
        }
      }

      updateLayerList();
    }

    function updateLayerList(): void {
      const layerStats: Record<number, { tiles: number; entities: number; clouds?: number }> = {};
      for (let i = 0; i < LAYER_COUNT; i++) {
        layerStats[i] = { tiles: 0, entities: 0 };
      }

      for (let c = 0; c < mapSize; c++) {
        for (let r = 0; r < mapSize; r++) {
          layerStats[getLayerForDepth(c + r)].tiles++;
        }
      }

      for (const entity of state.entities) {
        layerStats[getLayerForDepth(entity.col + entity.row)].entities++;
      }

      // Add cloud count to layer stats
      layerStats[LAYER_COUNT - 1].clouds = cloudTiles.length;
      for (let i = 1; i <= 3; i++) {
        layerStats[i].clouds = layerClouds[i] ? layerClouds[i].length : 0;
      }

      layerListEl.innerHTML = '';
      // Display from top (foreground) to bottom (background): Layer 4 → Layer 0
      for (let i = LAYER_COUNT - 1; i >= 0; i--) {
        const parallax = getParallaxFactor(i);
        const alpha = getLayerAlpha(i);
        const zOffset = getZIndexOffset(i);
        const div = document.createElement('div');
        div.className = 'layer-item';
        div.style.borderLeft = i === LAYER_COUNT - 1 ? '3px solid #4a90d9' : '3px solid transparent';
        div.innerHTML = `
          <div style="display:flex;align-items:center;">
            <div class="layer-color" style="background:${LAYER_COLORS[i]};opacity:${alpha}"></div>
            <span>Layer ${i} ${i === LAYER_COUNT - 1 ? '(前景)' : i === 0 ? '(背景)' : ''}</span>
          </div>
          <div style="text-align:right;">
            <div>${layerStats[i].tiles} tiles | ${layerStats[i].entities} entities${layerStats[i].clouds ? ` | ☁️ ${layerStats[i].clouds} clouds` : ''}</div>
            <div style="font-size:0.75em;color:#888;">
              ${(parallax * 100).toFixed(0)}% parallax | ${(alpha * 100).toFixed(0)}% alpha | Z+${zOffset}
            </div>
          </div>
        `;
        layerListEl.appendChild(div);
      }
    }

    // ==================== Logging ====================
    function log(msg: string, type = ''): void {
      const entry = document.createElement('div');
      entry.className = `log-msg log-${type}`;
      entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
      logEl.appendChild(entry);
      logEl.scrollTop = logEl.scrollHeight;
      while (logEl.children.length > 20) logEl.removeChild(logEl.children[0]);
    }

    // ==================== Input ====================
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      state.isDragging = true;
    }, { signal });

    canvas.addEventListener('mouseup', () => {
      isDragging = false;
      state.isDragging = false;
    }, { signal });

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      state.mouse.screenX = e.clientX - rect.left;
      state.mouse.screenY = e.clientY - rect.top;

      // Use player's layer parallax and Z-offset for mouse coordinate calculation
      const playerParallax = getPlayerLayerParallax();
      const playerZOffset = getZIndexOffset(getPlayerLayer());

      const adjScreenX = state.mouse.screenX;
      const adjScreenY = state.mouse.screenY - playerZOffset;

      const world = screenToWorld(adjScreenX, adjScreenY, playerParallax);
      state.mouse.worldX = world.x;
      state.mouse.worldY = world.y;

      const grid = worldToGrid(world.x, world.y);
      state.mouse.gridCol = grid.col;
      state.mouse.gridRow = grid.row;
      state.mouse.overTile = (grid.col >= 0 && grid.col < mapSize && grid.row >= 0 && grid.row < mapSize) ? tiles[grid.col][grid.row] : null;
      state.mouse.layer = getLayerForDepth(grid.col + grid.row);

      if (isDragging) {
        state.camera.offsetX += e.clientX - lastX;
        state.camera.offsetY += e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
      }
    }, { signal });

    canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      state.camera.zoom *= e.deltaY > 0 ? 0.9 : 1.1;
      state.camera.zoom = Math.max(0.5, Math.min(3, state.camera.zoom));
    }, { signal, passive: false });

    canvas.addEventListener('click', (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const playerParallax = getPlayerLayerParallax();
      const playerZOffset = getZIndexOffset(getPlayerLayer());

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top - playerZOffset;

      const world = screenToWorld(screenX, screenY, playerParallax);
      const grid = worldToGrid(world.x, world.y);
      if (grid.col >= 0 && grid.col < mapSize && grid.row >= 0 && grid.row < mapSize && tiles[grid.col][grid.row].walkable) {
        state.player.col = grid.col;
        state.player.row = grid.row;
        playerEntity.col = grid.col;
        playerEntity.row = grid.row;
        log(`Moved to (${grid.col}, ${grid.row})`, 'info');
      }
    }, { signal });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      const { col, row } = state.player;
      let newCol = col;
      let newRow = row;
      if (e.key === 'w' || e.key === 'ArrowUp') newRow--;
      if (e.key === 's' || e.key === 'ArrowDown') newRow++;
      if (e.key === 'a' || e.key === 'ArrowLeft') newCol--;
      if (e.key === 'd' || e.key === 'ArrowRight') newCol++;
      if (newCol >= 0 && newCol < mapSize && newRow >= 0 && newRow < mapSize && tiles[newCol][newRow].walkable) {
        state.player.col = newCol;
        state.player.row = newRow;
        playerEntity.col = newCol;
        playerEntity.row = newRow;
        log(`Moved to (${newCol}, ${newRow})`, 'info');
      }
    }, { signal });

    // ==================== UI Controls ====================
    const bindToggle = (id: string, get: () => boolean, set: (v: boolean) => void): void => {
      const btn = container.querySelector<HTMLButtonElement>(id)!;
      btn.addEventListener('click', () => {
        set(!get());
        btn.classList.toggle('active', get());
      }, { signal });
    };

    bindToggle('#btnGrid', () => state.showGrid, v => { state.showGrid = v; });
    bindToggle('#btnWire', () => state.showWireframe, v => { state.showWireframe = v; });
    bindToggle('#btnDebug', () => state.showDebug, v => { state.showDebug = v; });
    bindToggle('#btnLayers', () => state.showLayerColors, v => { state.showLayerColors = v; });

    container.querySelector<HTMLButtonElement>('#btnResetCam')!
      .addEventListener('click', () => {
        centerCamera();
        state.camera.zoom = 1;
        log('Camera reset', 'info');
      }, { signal });

    container.querySelector<HTMLButtonElement>('#btnClouds')!
      .addEventListener('click', () => regenerateClouds(), { signal });

    const bindSlider = (sliderId: string, displayId: string, onChange: (value: string) => void): void => {
      const slider = container.querySelector<HTMLInputElement>(sliderId)!;
      const display = container.querySelector<HTMLElement>(displayId)!;
      slider.addEventListener('input', () => {
        display.textContent = slider.value;
        onChange(slider.value);
      }, { signal });
    };

    bindSlider('#fgAlphaSlider', '#fgAlphaVal', (value) => {
      state.layerSettings.foregroundAlpha = parseFloat(value);
      log(`Foreground alpha: ${value}`, 'info');
    });
    bindSlider('#zStepSlider', '#zStepVal', (value) => {
      state.layerSettings.zIndexStep = parseInt(value, 10);
      log(`Z-axis step: ${value}`, 'info');
    });
    bindSlider('#parallaxRangeSlider', '#parallaxRangeVal', (value) => {
      state.layerSettings.parallaxRange = parseFloat(value);
      const layer0Parallax = (0.3 * 100).toFixed(0);
      const layer4Parallax = (0.3 + parseFloat(value)) * 100;
      log(`Parallax range: ${value} (Layer 0: ${layer0Parallax}%, Layer 4: ${layer4Parallax.toFixed(0)}%)`, 'info');
    });

    // ==================== Main Loop ====================
    let rafId = 0;
    let fpsElapsed = 0;

    function loop(time: number): void {
      const delta = time - state.lastTime;
      state.lastTime = time;
      state.frameCount++;
      fpsElapsed += delta;
      if (fpsElapsed >= 1000) {
        state.fps = state.frameCount;
        state.frameCount = 0;
        fpsElapsed = 0;
      }
      render();
      fpsEl.textContent = String(state.fps);
      layerCountEl.textContent = String(LAYER_COUNT);
      playerPosEl.textContent = `${state.player.col}, ${state.player.row}`;
      rafId = requestAnimationFrame(loop);
    }

    // ==================== Start ====================
    centerCamera();
    log('Axial2.5D Multi-Layer Demo started!', 'success');
    log(`${LAYER_COUNT} layers with parallax scrolling`, 'info');
    log(`☁️ ${cloudTiles.length} clouds in Layer 4 (foreground sky)`, 'info');
    rafId = requestAnimationFrame(loop);

    // ==================== Cleanup ====================
    return () => {
      cancelAnimationFrame(rafId);
      abort.abort();
    };
  }
};

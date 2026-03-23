/**
 * DebugSystem - Development visualization tools
 */

import { Projection } from '../core/Projection';
import { IsoCamera } from '../core/IsoCamera';
import { CanvasRenderer } from '../core/CanvasRenderer';
import { GridSystem } from '../world/GridSystem';
import { EntityManager } from '../world/EntityManager';
import { InputManager } from '../input/InputManager';
import { EventBus } from '../utils/EventBus';
import { DebugConfig } from '../core/types';

export class DebugSystem {
  private enabled: boolean = false;
  private config: DebugConfig = {
    showGrid: false,
    showCoordinates: false,
    showBoundingBoxes: false,
    showFPS: true,
    showMouseInfo: false,
    showPath: false,
    showStats: false
  };

  private renderer: CanvasRenderer | null = null;
  private gridSystem: GridSystem | null = null;
  private entityManager: EntityManager | null = null;
  private inputManager: InputManager | null = null;
  private eventBus: EventBus | null = null;

  private stats = {
    fps: 0,
    frameTime: 0,
    drawCalls: 0,
    entityCount: 0
  };

  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fpsUpdateTime: number = 0;

  constructor() {}

  /**
   * Initialize debug system with dependencies
   */
  public init(
    renderer: CanvasRenderer,
    gridSystem: GridSystem,
    entityManager: EntityManager,
    inputManager: InputManager,
    eventBus: EventBus
  ): void {
    this.renderer = renderer;
    this.gridSystem = gridSystem;
    this.entityManager = entityManager;
    this.inputManager = inputManager;
    this.eventBus = eventBus;

    // Listen for toggle event
    this.eventBus.on('toggleDebug', () => this.toggle());
  }

  /**
   * Toggle debug mode
   */
  public toggle(): void {
    this.enabled = !this.enabled;
  }

  /**
   * Set debug configuration
   */
  public setConfig(config: Partial<DebugConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Enable/disable debug mode
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if debug is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Update frame timing stats
   */
  public updateFrameStats(deltaTime: number): void {
    const now = performance.now();
    
    this.frameCount++;
    this.stats.frameTime = deltaTime;

    if (now - this.fpsUpdateTime >= 1000) {
      this.stats.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsUpdateTime = now;
    }

    if (this.entityManager) {
      this.stats.entityCount = this.entityManager.getCount();
    }

    if (this.renderer) {
      this.stats.drawCalls = this.renderer.getRenderItemCount();
    }
  }

  /**
   * Draw debug information
   */
  public draw(ctx: CanvasRenderingContext2D): void {
    if (!this.enabled) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform for UI

    if (this.config.showFPS) {
      this.drawFPS(ctx);
    }

    if (this.config.showStats) {
      this.drawStats(ctx);
    }

    if (this.config.showGrid && this.gridSystem) {
      this.drawGrid(ctx);
    }

    if (this.config.showCoordinates && this.gridSystem) {
      this.drawCoordinates(ctx);
    }

    if (this.config.showBoundingBoxes && this.entityManager) {
      this.drawBoundingBoxes(ctx);
    }

    if (this.config.showMouseInfo && this.inputManager) {
      this.drawMouseInfo(ctx);
    }

    ctx.restore();
  }

  private drawFPS(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0f0';
    ctx.font = '14px monospace';
    ctx.fillText(`FPS: ${this.stats.fps}`, 10, 20);
  }

  private drawStats(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    const y = 40;
    const lineHeight = 16;
    
    ctx.fillText(`Frame: ${this.stats.frameTime.toFixed(2)}ms`, 10, y);
    ctx.fillText(`Entities: ${this.stats.entityCount}`, 10, y + lineHeight);
    ctx.fillText(`Draw calls: ${this.stats.drawCalls}`, 10, y + lineHeight * 2);
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    if (!this.gridSystem || !this.renderer) return;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;

    const { width, height } = this.gridSystem.getDimensions();
    
    for (let col = 0; col <= width; col++) {
      for (let row = 0; row <= height; row++) {
        const worldPos = this.gridSystem.gridToWorld(col, row);
        const screenPos = this.renderer.worldToScreen(worldPos.x, worldPos.z, 0);
        
        ctx.beginPath();
        ctx.arc(screenPos.sx, screenPos.sy, 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private drawCoordinates(ctx: CanvasRenderingContext2D): void {
    if (!this.gridSystem || !this.renderer) return;

    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    const { width, height } = this.gridSystem.getDimensions();
    
    for (let col = 0; col < width; col++) {
      for (let row = 0; row < height; row++) {
        const worldPos = this.gridSystem.gridToWorld(col, row);
        const screenPos = this.renderer.worldToScreen(worldPos.x, worldPos.z, 0);
        
        ctx.fillText(`(${col},${row})`, screenPos.sx, screenPos.sy - 5);
      }
    }
  }

  private drawBoundingBoxes(ctx: CanvasRenderingContext2D): void {
    if (!this.entityManager) return;

    ctx.strokeStyle = '#f00';
    ctx.lineWidth = 2;

    for (const entity of this.entityManager.getAllEntities()) {
      if (!this.renderer || !this.gridSystem) continue;

      const worldPos = this.gridSystem.gridToWorld(entity.col, entity.row);
      const screenPos = this.renderer.worldToScreen(worldPos.x, worldPos.z, 0);
      
      const size = 20;
      ctx.strokeRect(
        screenPos.sx - size / 2,
        screenPos.sy - entity.height - size,
        size,
        size
      );
    }
  }

  private drawMouseInfo(ctx: CanvasRenderingContext2D): void {
    if (!this.inputManager || !this.gridSystem) return;

    const mouseState = this.inputManager.getMouseState();
    const worldPos = this.inputManager.getWorldPositionFromScreen(mouseState.x, mouseState.y);
    const gridPos = this.gridSystem.worldToGrid(worldPos.x, worldPos.z);
    
    const tile = this.gridSystem.getTile(gridPos.col, gridPos.row);

    ctx.fillStyle = '#ff0';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    
    const info = [
      `Mouse: (${mouseState.x}, ${mouseState.y})`,
      `World: (${worldPos.x.toFixed(1)}, ${worldPos.z.toFixed(1)})`,
      `Grid: (${gridPos.col}, ${gridPos.row})`,
      `Tile: ${tile?.type || 'none'} (${tile?.walkable ? 'walkable' : 'blocked'})`
    ];

    const x = 10;
    let y = this.config.showStats ? 80 : 60;
    
    for (const line of info) {
      ctx.fillText(line, x, y);
      y += 16;
    }
  }
}

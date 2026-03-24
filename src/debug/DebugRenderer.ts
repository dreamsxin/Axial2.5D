/**
 * DebugRenderer - Declarative debug drawing for game development
 * 
 * Provides easy-to-use debug visualization:
 * - Text overlays with auto-positioning
 * - Tile highlights
 * - Line drawings
 * - Shape drawings (rectangles, circles)
 * - Entity bounding boxes
 * 
 * Usage:
 * ```typescript
 * const debugRenderer = new DebugRenderer();
 * 
 * // Add debug text
 * debugRenderer.addText('fps', {
 *   getText: () => `FPS: ${game.stats.fps}`,
 *   x: 10, y: 20, color: '#0f0'
 * });
 * 
 * // Add tile highlight
 * debugRenderer.addTileHighlight('mouseTile', {
 *   getTile: () => mouseGridPosition,
 *   color: '#ff0',
 *   lineWidth: 2
 * });
 * 
 * // Add line
 * debugRenderer.addLine('path', {
 *   getStart: () => playerPos,
 *   getEnd: () => targetPos,
 *   color: '#f0f',
 *   lineWidth: 2,
 *   dashed: true
 * });
 * 
 * // Render (call in render loop)
 * debugRenderer.render(ctx, gridSystem, camera, projection);
 * 
 * // Toggle visibility
 * debugRenderer.setEnabled('fps', false);
 * debugRenderer.toggle(); // Toggle all
 * ```
 */

import { GridSystem } from '../world/GridSystem';
import { Projection } from '../core/Projection';
import { IsoCamera } from '../core/IsoCamera';
import { Entity } from '../core/types';

export interface DebugTextConfig {
  getText: () => string;
  x: number;
  y: number;
  color?: string;
  font?: string;
  enabled?: boolean;
}

export interface DebugTileHighlightConfig {
  getTile: () => { col: number; row: number } | null;
  color?: string;
  lineWidth?: number;
  alpha?: number;
  enabled?: boolean;
}

export interface DebugLineConfig {
  getStart: () => { x: number; y: number };
  getEnd: () => { x: number; y: number };
  color?: string;
  lineWidth?: number;
  dashed?: boolean;
  enabled?: boolean;
}

export interface DebugShapeConfig {
  getBounds: () => { x: number; y: number; width: number; height: number };
  color?: string;
  lineWidth?: number;
  fill?: boolean;
  alpha?: number;
  enabled?: boolean;
}

export interface DebugEntityBoundsConfig {
  getEntity: () => Entity | null;
  color?: string;
  lineWidth?: number;
  showHeight?: boolean;
  enabled?: boolean;
}

type DebugItem = 
  | { type: 'text'; config: DebugTextConfig }
  | { type: 'tile'; config: DebugTileHighlightConfig }
  | { type: 'line'; config: DebugLineConfig }
  | { type: 'shape'; config: DebugShapeConfig }
  | { type: 'entity'; config: DebugEntityBoundsConfig };

export class DebugRenderer {
  private items: Map<string, DebugItem> = new Map();
  private enabled: boolean = true;

  /**
   * Add debug text overlay
   */
  addText(id: string, config: DebugTextConfig): void {
    this.items.set(id, { type: 'text', config });
  }

  /**
   * Add tile highlight
   */
  addTileHighlight(id: string, config: DebugTileHighlightConfig): void {
    this.items.set(id, { type: 'tile', config });
  }

  /**
   * Add debug line
   */
  addLine(id: string, config: DebugLineConfig): void {
    this.items.set(id, { type: 'line', config });
  }

  /**
   * Add debug shape (rectangle)
   */
  addShape(id: string, config: DebugShapeConfig): void {
    this.items.set(id, { type: 'shape', config });
  }

  /**
   * Add entity bounding box
   */
  addEntityBounds(id: string, config: DebugEntityBoundsConfig): void {
    this.items.set(id, { type: 'entity', config });
  }

  /**
   * Remove a debug item
   */
  remove(id: string): void {
    this.items.delete(id);
  }

  /**
   * Clear all debug items
   */
  clear(): void {
    this.items.clear();
  }

  /**
   * Enable/disable a debug item
   */
  setEnabled(id: string, enabled: boolean): void {
    const item = this.items.get(id);
    if (item) {
      (item.config as any).enabled = enabled;
    }
  }

  /**
   * Toggle all debug rendering
   */
  toggle(): void {
    this.enabled = !this.enabled;
  }

  /**
   * Set enabled state
   */
  setEnabledGlobal(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Render all debug items
   */
  render(
    ctx: CanvasRenderingContext2D,
    gridSystem: GridSystem,
    camera: IsoCamera,
    projection: Projection
  ): void {
    if (!this.enabled) return;

    for (const [id, item] of this.items) {
      const config = item.config as any;
      
      // Check if item is enabled
      if (config.enabled === false) continue;

      try {
        switch (item.type) {
          case 'text':
            this.renderText(ctx, config as DebugTextConfig);
            break;
          case 'tile':
            this.renderTileHighlight(ctx, config as DebugTileHighlightConfig, gridSystem, camera, projection);
            break;
          case 'line':
            this.renderLine(ctx, config as DebugLineConfig, camera, projection);
            break;
          case 'shape':
            this.renderShape(ctx, config as DebugShapeConfig, camera, projection);
            break;
          case 'entity':
            this.renderEntityBounds(ctx, config as DebugEntityBoundsConfig, gridSystem, camera, projection);
            break;
        }
      } catch (error) {
        console.error(`DebugRenderer: Error rendering "${id}":`, error);
      }
    }
  }

  private renderText(ctx: CanvasRenderingContext2D, config: DebugTextConfig): void {
    const text = config.getText();
    
    ctx.save();
    ctx.fillStyle = config.color || '#0f0';
    ctx.font = config.font || '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(text, config.x, config.y);
    ctx.restore();
  }

  private renderTileHighlight(
    ctx: CanvasRenderingContext2D,
    config: DebugTileHighlightConfig,
    gridSystem: GridSystem,
    camera: IsoCamera,
    projection: Projection
  ): void {
    const tile = config.getTile();
    if (!tile) return;

    const worldPos = gridSystem.gridToWorld(tile.col, tile.row);
    const tileSize = gridSystem.getTileSize();

    const corners = [
      camera.worldToScreen(worldPos.x, worldPos.z, 0, projection, 1.0),
      camera.worldToScreen(worldPos.x + tileSize.width, worldPos.z, 0, projection, 1.0),
      camera.worldToScreen(worldPos.x + tileSize.width, worldPos.z + tileSize.height, 0, projection, 1.0),
      camera.worldToScreen(worldPos.x, worldPos.z + tileSize.height, 0, projection, 1.0)
    ];

    ctx.save();
    ctx.globalAlpha = config.alpha ?? 0.3;
    ctx.beginPath();
    ctx.moveTo(corners[0].sx, corners[0].sy);
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(corners[i].sx, corners[i].sy);
    }
    ctx.closePath();
    ctx.fillStyle = config.color || '#ff0';
    ctx.fill();
    
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = config.color || '#ff0';
    ctx.lineWidth = config.lineWidth ?? 2;
    ctx.stroke();
    ctx.restore();
  }

  private renderLine(
    ctx: CanvasRenderingContext2D,
    config: DebugLineConfig,
    camera: IsoCamera,
    projection: Projection
  ): void {
    const start = config.getStart();
    const end = config.getEnd();

    const startScreen = camera.worldToScreen(start.x, start.y, 0, projection, 1.0);
    const endScreen = camera.worldToScreen(end.x, end.y, 0, projection, 1.0);

    ctx.save();
    ctx.strokeStyle = config.color || '#f0f';
    ctx.lineWidth = config.lineWidth ?? 2;
    
    if (config.dashed) {
      ctx.setLineDash([5, 5]);
    }
    
    ctx.beginPath();
    ctx.moveTo(startScreen.sx, startScreen.sy);
    ctx.lineTo(endScreen.sx, endScreen.sy);
    ctx.stroke();
    ctx.restore();
  }

  private renderShape(
    ctx: CanvasRenderingContext2D,
    config: DebugShapeConfig,
    camera: IsoCamera,
    projection: Projection
  ): void {
    const bounds = config.getBounds();
    const centerScreen = camera.worldToScreen(bounds.x, bounds.y, 0, projection, 1.0);

    ctx.save();
    ctx.globalAlpha = config.alpha ?? 0.3;
    
    if (config.fill) {
      ctx.fillStyle = config.color || '#0ff';
      ctx.fillRect(
        centerScreen.sx - bounds.width / 2,
        centerScreen.sy - bounds.height / 2,
        bounds.width,
        bounds.height
      );
    }
    
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = config.color || '#0ff';
    ctx.lineWidth = config.lineWidth ?? 2;
    ctx.strokeRect(
      centerScreen.sx - bounds.width / 2,
      centerScreen.sy - bounds.height / 2,
      bounds.width,
      bounds.height
    );
    ctx.restore();
  }

  private renderEntityBounds(
    ctx: CanvasRenderingContext2D,
    config: DebugEntityBoundsConfig,
    gridSystem: GridSystem,
    camera: IsoCamera,
    projection: Projection
  ): void {
    const entity = config.getEntity();
    if (!entity) return;

    const worldPos = gridSystem.gridToWorld(entity.col, entity.row);
    const width = (entity as any).width || 50;
    const length = (entity as any).length || 50;
    const height = entity.height || 0;

    // Draw base rectangle
    const corners = [
      camera.worldToScreen(worldPos.x, worldPos.z, 0, projection, 1.0),
      camera.worldToScreen(worldPos.x + width, worldPos.z, 0, projection, 1.0),
      camera.worldToScreen(worldPos.x + width, worldPos.z + length, 0, projection, 1.0),
      camera.worldToScreen(worldPos.x, worldPos.z + length, 0, projection, 1.0)
    ];

    ctx.save();
    ctx.strokeStyle = config.color || '#f00';
    ctx.lineWidth = config.lineWidth ?? 2;
    
    ctx.beginPath();
    ctx.moveTo(corners[0].sx, corners[0].sy);
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(corners[i].sx, corners[i].sy);
    }
    ctx.closePath();
    ctx.stroke();

    // Draw height indicator if requested
    if (config.showHeight && height > 0) {
      const topCorners = [
        camera.worldToScreen(worldPos.x, worldPos.z, height, projection, 1.0),
        camera.worldToScreen(worldPos.x + width, worldPos.z, height, projection, 1.0),
        camera.worldToScreen(worldPos.x + width, worldPos.z + length, height, projection, 1.0),
        camera.worldToScreen(worldPos.x, worldPos.z + length, height, projection, 1.0)
      ];

      // Draw vertical lines
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(corners[i].sx, corners[i].sy);
        ctx.lineTo(topCorners[i].sx, topCorners[i].sy);
        ctx.stroke();
      }

      // Draw top rectangle
      ctx.beginPath();
      ctx.moveTo(topCorners[0].sx, topCorners[0].sy);
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(topCorners[i].sx, topCorners[i].sy);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Get all debug items
   */
  getItems(): Map<string, DebugItem> {
    return new Map(this.items);
  }

  /**
   * Check if debug rendering is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

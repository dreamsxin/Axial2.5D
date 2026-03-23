/**
 * GridLines - Visual grid line overlay for debugging and visualization
 * Inspired by as3isolib.display.scene.IsoGrid
 */

import { Projection } from '../core/Projection';
import { IsoCamera } from '../core/IsoCamera';
import { GridSystem } from './GridSystem';

export interface GridLinesConfig {
  showGrid: boolean;
  showOrigin: boolean;
  showAxes: boolean;
  gridColor: string;
  axisColor: string;
  lineWidth: number;
  cellSize: number;
}

export class GridLines {
  private config: GridLinesConfig;
  private gridSystem: GridSystem | null = null;

  constructor(config?: Partial<GridLinesConfig>) {
    this.config = {
      showGrid: true,
      showOrigin: true,
      showAxes: true,
      gridColor: 'rgba(200, 200, 200, 0.5)',
      axisColor: 'rgba(255, 100, 100, 0.8)',
      lineWidth: 1,
      cellSize: 32,
      ...config
    };
  }

  /**
   * Set grid system reference
   */
  public setGridSystem(gridSystem: GridSystem): void {
    this.gridSystem = gridSystem;
  }

  /**
   * Update configuration
   */
  public setConfig(config: Partial<GridLinesConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Toggle grid visibility
   */
  public toggle(): void {
    this.config.showGrid = !this.config.showGrid;
  }

  /**
   * Draw grid lines
   */
  public draw(ctx: CanvasRenderingContext2D, projection: Projection, camera: IsoCamera): void {
    if (!this.config.showGrid) return;

    ctx.save();
    ctx.lineWidth = this.config.lineWidth;

    // Draw grid lines
    if (this.gridSystem) {
      this.drawGridFromSystem(ctx, projection);
    } else {
      this.drawSimpleGrid(ctx, projection);
    }

    // Draw origin marker
    if (this.config.showOrigin) {
      this.drawOrigin(ctx, projection);
    }

    // Draw axes
    if (this.config.showAxes) {
      this.drawAxes(ctx, projection);
    }

    ctx.restore();
  }

  /**
   * Draw grid based on GridSystem
   */
  private drawGridFromSystem(ctx: CanvasRenderingContext2D, projection: Projection): void {
    if (!this.gridSystem) return;

    const { width, height } = this.gridSystem.getDimensions();

    ctx.strokeStyle = this.config.gridColor;

    // Draw grid lines along both axes
    for (let col = 0; col <= width; col++) {
      const start = this.gridSystem.gridToWorld(col, 0);
      const end = this.gridSystem.gridToWorld(col, height);
      
      const startScreen = projection.worldToScreen(start.x, start.z, 0);
      const endScreen = projection.worldToScreen(end.x, end.z, 0);
      
      ctx.beginPath();
      ctx.moveTo(startScreen.sx, startScreen.sy);
      ctx.lineTo(endScreen.sx, endScreen.sy);
      ctx.stroke();
    }

    for (let row = 0; row <= height; row++) {
      const start = this.gridSystem.gridToWorld(0, row);
      const end = this.gridSystem.gridToWorld(width, row);
      
      const startScreen = projection.worldToScreen(start.x, start.z, 0);
      const endScreen = projection.worldToScreen(end.x, end.z, 0);
      
      ctx.beginPath();
      ctx.moveTo(startScreen.sx, startScreen.sy);
      ctx.lineTo(endScreen.sx, endScreen.sy);
      ctx.stroke();
    }
  }

  /**
   * Draw simple grid without GridSystem
   */
  private drawSimpleGrid(ctx: CanvasRenderingContext2D, projection: Projection): void {
    const size = this.config.cellSize;
    const range = 20; // Draw 20x20 grid

    ctx.strokeStyle = this.config.gridColor;

    // Lines along X axis
    for (let i = -range; i <= range; i++) {
      const start = projection.worldToScreen(i * size, -range * size, 0);
      const end = projection.worldToScreen(i * size, range * size, 0);
      
      ctx.beginPath();
      ctx.moveTo(start.sx, start.sy);
      ctx.lineTo(end.sx, end.sy);
      ctx.stroke();
    }

    // Lines along Z axis
    for (let i = -range; i <= range; i++) {
      const start = projection.worldToScreen(-range * size, i * size, 0);
      const end = projection.worldToScreen(range * size, i * size, 0);
      
      ctx.beginPath();
      ctx.moveTo(start.sx, start.sy);
      ctx.lineTo(end.sx, end.sy);
      ctx.stroke();
    }
  }

  /**
   * Draw origin marker at (0, 0, 0)
   */
  private drawOrigin(ctx: CanvasRenderingContext2D, projection: Projection): void {
    const origin = projection.worldToScreen(0, 0, 0);
    
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(origin.sx, origin.sy, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('0,0', origin.sx + 8, origin.sy - 8);
  }

  /**
   * Draw X and Z axis lines
   */
  private drawAxes(ctx: CanvasRenderingContext2D, projection: Projection): void {
    const length = 200;
    
    // X axis (red)
    const xStart = projection.worldToScreen(0, 0, 0);
    const xEnd = projection.worldToScreen(length, 0, 0);
    
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xStart.sx, xStart.sy);
    ctx.lineTo(xEnd.sx, xEnd.sy);
    ctx.stroke();
    
    // Label X axis
    ctx.fillStyle = '#ff4444';
    ctx.font = '12px monospace';
    ctx.fillText('X', xEnd.sx + 5, xEnd.sy);

    // Z axis (blue)
    const zStart = projection.worldToScreen(0, 0, 0);
    const zEnd = projection.worldToScreen(0, length, 0);
    
    ctx.strokeStyle = '#4444ff';
    ctx.beginPath();
    ctx.moveTo(zStart.sx, zStart.sy);
    ctx.lineTo(zEnd.sx, zEnd.sy);
    ctx.stroke();
    
    // Label Z axis
    ctx.fillStyle = '#4444ff';
    ctx.fillText('Z', zEnd.sx + 5, zEnd.sy);

    // Y axis (green) - vertical
    const yStart = projection.worldToScreen(0, 0, 0);
    const yEnd = projection.worldToScreen(0, 0, -length);
    
    ctx.strokeStyle = '#44ff44';
    ctx.beginPath();
    ctx.moveTo(yStart.sx, yStart.sy);
    ctx.lineTo(yEnd.sx, yEnd.sy);
    ctx.stroke();
    
    // Label Y axis
    ctx.fillStyle = '#44ff44';
    ctx.fillText('Y', yEnd.sx + 5, yEnd.sy);
  }
}

/**
 * IsoPrimitive - Base class for isometric 3D primitives
 * Inspired by as3isolib.display.primitive.IsoPrimitive
 */

import { Projection } from '../core/Projection';
import { Entity } from '../core/types';

export interface FillStyle {
  color: string;
  alpha?: number;
}

export interface StrokeStyle {
  color: string;
  width: number;
  alpha?: number;
}

export abstract class IsoPrimitive extends Entity {
  protected boxWidth: number;
  protected boxLength: number;
  
  constructor(
    id: string,
    col: number,
    row: number,
    width: number,
    length: number,
    height: number
  ) {
    super(id, col, row, height);
    this.boxWidth = width;
    this.boxLength = length;
  }
  
  public get width(): number { return this.boxWidth; }
  public get length(): number { return this.boxLength; }
  
  protected fillColor: string = '#cccccc';
  protected strokeColor: string = '#666666';
  protected strokeWidth: number = 1;
  
  public showWireframe: boolean = false;



  /**
   * Set dimensions
   */
  public setDimensions(width: number, length: number, height: number): void {
    this.boxWidth = width;
    this.boxLength = length;
    this.height = height;
  }

  /**
   * Set fill color
   */
  public setFillColor(color: string): void {
    this.fillColor = color;
  }

  /**
   * Set stroke style
   */
  public setStrokeStyle(color: string, width: number): void {
    this.strokeColor = color;
    this.strokeWidth = width;
  }

  /**
   * Set wireframe mode
   */
  public setWireframe(show: boolean): void {
    this.showWireframe = show;
  }

  /**
   * Calculate the 8 corners of a box in screen space
   */
  protected calculateCorners(projection: Projection, offsetX: number = 0, offsetZ: number = 0): { [key: string]: { sx: number; sy: number } } {
    // Convert grid position to world coordinates using grid system if available
    const worldX = offsetX;
    const worldZ = offsetZ;
    const baseY = 0;

    // All 8 corners of the box (bottom and top faces)
    const corners: { [key: string]: { sx: number; sy: number } } = {};
    
    // Bottom face corners
    corners.lbb = projection.worldToScreen(worldX, worldZ, baseY);
    corners.rbb = projection.worldToScreen(worldX + this.boxWidth, worldZ, baseY);
    corners.rfb = projection.worldToScreen(worldX + this.boxWidth, worldZ + this.boxLength, baseY);
    corners.lfb = projection.worldToScreen(worldX, worldZ + this.boxLength, baseY);
    
    // Top face corners
    corners.lbt = projection.worldToScreen(worldX, worldZ, baseY + this.height);
    corners.rbt = projection.worldToScreen(worldX + this.boxWidth, worldZ, baseY + this.height);
    corners.rft = projection.worldToScreen(worldX + this.boxWidth, worldZ + this.boxLength, baseY + this.height);
    corners.lft = projection.worldToScreen(worldX, worldZ + this.boxLength, baseY + this.height);

    return corners;
  }

  /**
   * Draw a filled polygon
   */
  protected drawPolygon(
    ctx: CanvasRenderingContext2D,
    points: { sx: number; sy: number }[],
    fill: string,
    stroke?: string,
    strokeWidth?: number
  ): void {
    if (points.length < 3) return;

    ctx.beginPath();
    ctx.moveTo(points[0].sx, points[0].sy);
    
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].sx, points[i].sy);
    }
    
    ctx.closePath();

    // Fill
    if (fill && !this.showWireframe) {
      ctx.fillStyle = fill;
      ctx.fill();
    }

    // Stroke
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth || 1;
      ctx.stroke();
    }
  }

  /**
   * Draw a line between two points
   */
  protected drawLine(
    ctx: CanvasRenderingContext2D,
    from: { sx: number; sy: number },
    to: { sx: number; sy: number },
    color: string,
    width: number = 1
  ): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(from.sx, from.sy);
    ctx.lineTo(to.sx, to.sy);
    ctx.stroke();
  }

  /**
   * Get the screen Y position for depth sorting
   */
  public getDepth(projection: Projection): number {
    const worldX = this.col * 32 - this.row * 32;
    const worldZ = this.col * 16 + this.row * 16;
    const screenPos = projection.worldToScreen(worldX + this.width / 2, worldZ + this.length / 2, 0);
    return screenPos.sy + this.height;
  }
}

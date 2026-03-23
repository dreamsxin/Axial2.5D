/**
 * IsoBox - 3D box primitive in isometric space
 * Inspired by as3isolib.display.primitive.IsoBox
 * 
 * Draws a 6-faced 3D box with proper depth sorting
 */

import { Projection } from '../core/Projection';
import { IsoPrimitive } from './IsoPrimitive';

export class IsoBox extends IsoPrimitive {
  private faceColors: string[] = [];

  constructor(
    id: string,
    col: number,
    row: number,
    width: number = 64,
    length: number = 64,
    height: number = 64
  ) {
    super(id, col, row, width, length, height);
    
    // Default face colors (top, front-right, front-left, back-right, back-left, bottom)
    this.faceColors = [
      '#dddddd', // top
      '#cccccc', // front-right
      '#bbbbbb', // front-left
      '#aaaaaa', // back-right
      '#999999', // back-left
      '#888888'  // bottom
    ];
  }

  /**
   * Set individual face colors
   * Order: top, front-right, front-left, back-right, back-left, bottom
   */
  public setFaceColors(colors: string[]): void {
    this.faceColors = colors;
  }

  /**
   * Set face color by index
   */
  public setFaceColor(index: number, color: string): void {
    if (index >= 0 && index < 6) {
      this.faceColors[index] = color;
    }
  }

  /**
   * Draw the box with explicit projection
   */
  public drawWithProjection(ctx: CanvasRenderingContext2D, projection: Projection): void {
    const corners = this.calculateCorners(projection);

    // Apply lighting effect - darker faces for depth
    const colors = this.showWireframe ? [] : this.faceColors;

    // Draw faces in back-to-front order for proper occlusion
    // Bottom face (drawn first, usually not visible)
    if (!this.showWireframe) {
      this.drawPolygon(
        ctx,
        [corners.lbb, corners.rbb, corners.rfb, corners.lfb],
        colors[5] || this.fillColor,
        this.strokeColor,
        this.strokeWidth
      );
    }

    // Back-left face
    if (!this.showWireframe) {
      this.drawPolygon(
        ctx,
        [corners.lbb, corners.lfb, corners.lft, corners.lbt],
        colors[4] || this.fillColor,
        this.strokeColor,
        this.strokeWidth
      );
    }

    // Back-right face
    if (!this.showWireframe) {
      this.drawPolygon(
        ctx,
        [corners.lbb, corners.rbb, corners.rbt, corners.lbt],
        colors[3] || this.fillColor,
        this.strokeColor,
        this.strokeWidth
      );
    }

    // Front-left face
    if (!this.showWireframe) {
      this.drawPolygon(
        ctx,
        [corners.lfb, corners.rfb, corners.rft, corners.lft],
        colors[2] || this.fillColor,
        this.strokeColor,
        this.strokeWidth
      );
    }

    // Front-right face
    if (!this.showWireframe) {
      this.drawPolygon(
        ctx,
        [corners.rbb, corners.rfb, corners.rft, corners.rbt],
        colors[1] || this.fillColor,
        this.strokeColor,
        this.strokeWidth
      );
    }

    // Top face (drawn last)
    if (!this.showWireframe) {
      this.drawPolygon(
        ctx,
        [corners.lbt, corners.rbt, corners.rft, corners.lft],
        colors[0] || this.fillColor,
        this.strokeColor,
        this.strokeWidth
      );
    }

    // Draw wireframe edges if in wireframe mode or as outline
    if (this.showWireframe || this.strokeWidth > 0) {
      // Bottom edges
      this.drawLine(ctx, corners.lbb, corners.rbb, this.strokeColor, this.strokeWidth);
      this.drawLine(ctx, corners.rbb, corners.rfb, this.strokeColor, this.strokeWidth);
      this.drawLine(ctx, corners.rfb, corners.lfb, this.strokeColor, this.strokeWidth);
      this.drawLine(ctx, corners.lfb, corners.lbb, this.strokeColor, this.strokeWidth);

      // Top edges
      this.drawLine(ctx, corners.lbt, corners.rbt, this.strokeColor, this.strokeWidth);
      this.drawLine(ctx, corners.rbt, corners.rft, this.strokeColor, this.strokeWidth);
      this.drawLine(ctx, corners.rft, corners.lft, this.strokeColor, this.strokeWidth);
      this.drawLine(ctx, corners.lft, corners.lbt, this.strokeColor, this.strokeWidth);

      // Vertical edges
      this.drawLine(ctx, corners.lbb, corners.lbt, this.strokeColor, this.strokeWidth);
      this.drawLine(ctx, corners.rbb, corners.rbt, this.strokeColor, this.strokeWidth);
      this.drawLine(ctx, corners.rfb, corners.rft, this.strokeColor, this.strokeWidth);
      this.drawLine(ctx, corners.lfb, corners.lft, this.strokeColor, this.strokeWidth);
    }
  }

  override draw(ctx: CanvasRenderingContext2D): void {
    // Use the simplified draw method
    const w = this.boxWidth;
    const l = this.boxLength;
    const h = this.height;
    
    const halfW = w / 2;
    const halfL = l / 2;
    
    // Draw top face (diamond shape)
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(halfW, -h + halfL);
    ctx.lineTo(0, -h + l);
    ctx.lineTo(-halfW, -h + halfL);
    ctx.closePath();
    
    if (!this.showWireframe) {
      ctx.fillStyle = this.faceColors[0] || this.fillColor;
      ctx.fill();
    }
    ctx.strokeStyle = this.strokeColor;
    ctx.lineWidth = this.strokeWidth;
    ctx.stroke();

    // Draw side faces
    if (!this.showWireframe) {
      // Right face
      ctx.beginPath();
      ctx.moveTo(halfW, -h + halfL);
      ctx.lineTo(halfW, halfL);
      ctx.lineTo(0, l);
      ctx.lineTo(0, -h + l);
      ctx.closePath();
      ctx.fillStyle = this.faceColors[1] || this.fillColor;
      ctx.fill();
      ctx.stroke();

      // Left face
      ctx.beginPath();
      ctx.moveTo(-halfW, -h + halfL);
      ctx.lineTo(-halfW, halfL);
      ctx.lineTo(0, l);
      ctx.lineTo(0, -h + l);
      ctx.closePath();
      ctx.fillStyle = this.faceColors[2] || this.fillColor;
      ctx.fill();
      ctx.stroke();
    }

    // Draw wireframe edges
    ctx.strokeStyle = this.strokeColor;
    ctx.lineWidth = this.strokeWidth;
    
    // Vertical edges
    this.drawLine(ctx, { sx: -halfW, sy: -h + halfL }, { sx: -halfW, sy: halfL }, this.strokeColor, this.strokeWidth);
    this.drawLine(ctx, { sx: halfW, sy: -h + halfL }, { sx: halfW, sy: halfL }, this.strokeColor, this.strokeWidth);
    this.drawLine(ctx, { sx: 0, sy: -h + l }, { sx: 0, sy: l }, this.strokeColor, this.strokeWidth);
  }
}

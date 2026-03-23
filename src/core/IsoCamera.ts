/**
 * IsoCamera - Handles camera position, zoom, and screen-space transformations
 */

import { Projection } from './Projection';
import { WorldCoord, ScreenCoord } from './types';

export class IsoCamera {
  public offsetX: number = 0;
  public offsetY: number = 0;
  public scale: number = 1;
  
  private canvasWidth: number = 800;
  private canvasHeight: number = 600;

  constructor(canvasWidth: number = 800, canvasHeight: number = 600) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  /**
   * Set canvas dimensions
   */
  public setCanvasSize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  /**
   * Center the camera on a world position
   * @param worldX - World X coordinate to center on
   * @param worldZ - World Z coordinate to center on
   * @param projection - Projection instance for coordinate conversion
   * @param worldY - Optional world Y (height) to center on
   */
  public setPosition(worldX: number, worldZ: number, projection: Projection, worldY: number = 0): void {
    // Convert world position to screen space
    const screenPos = projection.worldToScreen(worldX, worldZ, worldY);
    
    // Center the camera so this point is in the middle of the canvas
    this.offsetX = -screenPos.sx + this.canvasWidth / 2;
    this.offsetY = -screenPos.sy + this.canvasHeight / 2;
  }

  /**
   * Set camera offset directly in screen space
   */
  public setOffset(offsetX: number, offsetY: number): void {
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }

  /**
   * Pan the camera by a delta amount
   */
  public pan(deltaX: number, deltaY: number): void {
    this.offsetX += deltaX;
    this.offsetY += deltaY;
  }

  /**
   * Zoom the camera
   * @param factor - Zoom factor (e.g., 1.1 to zoom in, 0.9 to zoom out)
   */
  public zoom(factor: number): void {
    this.scale = Math.max(0.1, Math.min(5, this.scale * factor));
  }

  /**
   * Set absolute zoom level
   */
  public setZoom(level: number): void {
    this.scale = Math.max(0.1, Math.min(5, level));
  }

  /**
   * Convert a screen position to camera-adjusted coordinates
   * (applies camera offset and scale)
   */
  public screenToCameraSpace(sx: number, sy: number): ScreenCoord {
    return {
      sx: (sx - this.canvasWidth / 2) / this.scale - this.offsetX,
      sy: (sy - this.canvasHeight / 2) / this.scale - this.offsetY
    };
  }

  /**
   * Convert camera-space coordinates to screen coordinates
   */
  public cameraToScreen(sx: number, sy: number): ScreenCoord {
    return {
      sx: (sx + this.offsetX) * this.scale + this.canvasWidth / 2,
      sy: (sy + this.offsetY) * this.scale + this.canvasHeight / 2
    };
  }

  /**
   * Apply camera transform to a canvas context
   * Call this before rendering world content
   */
  public applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.canvasWidth / 2, this.canvasHeight / 2);
    ctx.scale(this.scale, this.scale);
    ctx.translate(this.offsetX, this.offsetY);
  }

  /**
   * Reset canvas context after camera transform
   */
  public resetTransform(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }

  /**
   * Get the visible world bounds given a projection
   */
  public getVisibleBounds(projection: Projection): { minX: number; maxX: number; minZ: number; maxZ: number } {
    const halfW = (this.canvasWidth / 2) / this.scale;
    const halfH = (this.canvasHeight / 2) / this.scale;
    
    // Convert screen corners to world coordinates
    const topLeft = projection.screenToWorld(
      -halfW - this.offsetX,
      -halfH - this.offsetY
    );
    const bottomRight = projection.screenToWorld(
      halfW - this.offsetX,
      halfH - this.offsetY
    );
    
    return {
      minX: Math.min(topLeft.x, bottomRight.x),
      maxX: Math.max(topLeft.x, bottomRight.x),
      minZ: Math.min(topLeft.z, bottomRight.z),
      maxZ: Math.max(topLeft.z, bottomRight.z)
    };
  }

  /**
   * Reset camera to default position and zoom
   */
  public reset(): void {
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;
  }
}

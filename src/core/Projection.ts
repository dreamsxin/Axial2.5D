/**
 * Projection - Handles world-to-screen and screen-to-world coordinate transformations
 * Supports both isometric and dimetric projections with configurable angles
 */

import { ProjectionType, ScreenCoord, WorldCoord, ProjectionConfig } from './types';

export class Projection {
  public type: ProjectionType;
  public viewAngleRad: number;
  public tiltAngleRad: number;
  public tileScale: number;
  
  // Pre-calculated trig values for performance
  public cosView: number;
  public sinView: number;
  public cosTilt: number;
  public sinTilt: number;

  constructor(config: ProjectionConfig) {
    this.type = config.type;
    this.viewAngleRad = (config.viewAngle * Math.PI) / 180;
    this.tileScale = config.tileScale ?? 1;
    
    // Calculate trig values
    this.cosView = Math.cos(this.viewAngleRad);
    this.sinView = Math.sin(this.viewAngleRad);
    
    if (this.type === 'dimetric') {
      this.tiltAngleRad = ((config.tiltAngle ?? 30) * Math.PI) / 180;
      this.cosTilt = Math.cos(this.tiltAngleRad);
      this.sinTilt = Math.sin(this.tiltAngleRad);
    } else {
      // For isometric, use standard 30 degree tilt
      this.tiltAngleRad = (30 * Math.PI) / 180;
      this.cosTilt = Math.cos(this.tiltAngleRad);
      this.sinTilt = Math.sin(this.tiltAngleRad);
    }
  }

  /**
   * Convert world coordinates to screen coordinates
   * @param worldX - World X coordinate (ground plane, corresponds to grid col)
   * @param worldY - World Y coordinate (ground plane, corresponds to grid row)
   * @param worldZ - World Z coordinate (height)
   * @returns Screen coordinates {sx, sy}
   */
  public worldToScreen(worldX: number, worldY: number, worldZ: number = 0): ScreenCoord {
    let sx: number, sy: number;

    if (this.type === 'isometric') {
      // Standard isometric projection (matches standalone.html)
      // screenX = (worldX - worldY) * cos(viewAngle) * scale
      // screenY = (worldX + worldY) * sin(viewAngle) * scale - worldZ
      sx = (worldX - worldY) * this.cosView * this.tileScale;
      sy = (worldX + worldY) * this.sinView * this.tileScale - worldZ;
    } else {
      // Dimetric projection with independent tilt
      sx = (worldX * this.cosView - worldY * this.sinView) * this.tileScale;
      sy = (worldX * this.sinView + worldY * this.cosView) * this.sinTilt - worldZ * this.cosTilt;
    }

    return { sx, sy };
  }

  /**
   * Convert screen coordinates to world coordinates (assumes worldZ=0 for ground plane)
   * @param sx - Screen X coordinate
   * @param sy - Screen Y coordinate
   * @param worldZ - World Z coordinate (height, default 0 for ground)
   * @returns World coordinates {worldX, worldY}
   */
  public screenToWorld(sx: number, sy: number, worldZ: number = 0): { worldX: number; worldY: number } {
    let worldX: number, worldY: number;

    if (this.type === 'isometric') {
      // Inverse isometric projection (matches standalone.html)
      // From: sx = (worldX - worldY) * cos * scale
      //       sy = (worldX + worldY) * sin * scale - worldZ
      // Solve for worldX and worldY:
      const scaledSx = sx / (this.cosView * this.tileScale);
      const scaledSy = (sy + worldZ) / (this.sinView * this.tileScale);
      
      worldX = (scaledSx + scaledSy) / 2;
      worldY = (scaledSy - scaledSx) / 2;
    } else {
      // Inverse dimetric projection - solve linear system
      const a = this.cosView;
      const b = -this.sinView;
      const c = this.sinView;
      const d = this.cosView;
      
      const det = a * d - b * c;
      
      const tx = sx / this.tileScale;
      const ty = (sy + worldZ * this.cosTilt) / this.sinTilt;
      
      worldX = (d * tx - b * ty) / det;
      worldY = (-c * tx + a * ty) / det;
    }

    return { worldX, worldY };
  }

  /**
   * Get the projection matrix parameters for external use
   */
  public getMatrix(): { cosView: number; sinView: number; cosTilt: number; sinTilt: number; scale: number } {
    return {
      cosView: this.cosView,
      sinView: this.sinView,
      cosTilt: this.cosTilt,
      sinTilt: this.sinTilt,
      scale: this.tileScale
    };
  }

  /**
   * Update projection scale (for zoom effects)
   */
  public setScale(scale: number): void {
    this.tileScale = scale;
  }

  /**
   * Clone this projection with optional overrides
   */
  public clone(overrides?: Partial<ProjectionConfig>): Projection {
    const config: ProjectionConfig = {
      type: this.type,
      viewAngle: (this.viewAngleRad * 180) / Math.PI,
      tiltAngle: (this.tiltAngleRad * 180) / Math.PI,
      tileScale: this.tileScale,
      ...overrides
    };
    return new Projection(config);
  }
}

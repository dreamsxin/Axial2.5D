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
   * @param x - World X coordinate
   * @param z - World Z coordinate (depth)
   * @param y - World Y coordinate (height)
   * @returns Screen coordinates {sx, sy}
   */
  public worldToScreen(x: number, z: number, y: number = 0): ScreenCoord {
    let sx: number, sy: number;

    if (this.type === 'isometric') {
      // Standard isometric projection
      // screenX = (x - z) * cos(viewAngle) * scale
      // screenY = (x + z) * sin(viewAngle) * scale - y
      sx = (x - z) * this.cosView * this.tileScale;
      sy = (x + z) * this.sinView * this.tileScale - y;
    } else {
      // Dimetric projection with independent tilt
      // screenX = (x * cos(view) - z * sin(view)) * scale
      // screenY = (x * sin(view) + z * cos(view)) * sin(tilt) - y * cos(tilt)
      sx = (x * this.cosView - z * this.sinView) * this.tileScale;
      sy = (x * this.sinView + z * this.cosView) * this.sinTilt - y * this.cosTilt;
    }

    return { sx, sy };
  }

  /**
   * Convert screen coordinates to world coordinates (assumes y=0 for ground plane)
   * @param sx - Screen X coordinate
   * @param sy - Screen Y coordinate
   * @param y - World Y coordinate (height, default 0 for ground)
   * @returns World coordinates {x, z}
   */
  public screenToWorld(sx: number, sy: number, y: number = 0): WorldCoord {
    let x: number, z: number;

    if (this.type === 'isometric') {
      // Inverse isometric projection
      // From: sx = (x - z) * cos * scale
      //       sy = (x + z) * sin * scale - y
      // Solve for x and z:
      const scaledSx = sx / (this.cosView * this.tileScale);
      const scaledSy = (sy + y) / (this.sinView * this.tileScale);
      
      x = (scaledSx + scaledSy) / 2;
      z = (scaledSy - scaledSx) / 2;
    } else {
      // Inverse dimetric projection - solve linear system
      // [ cos  -sin ] [x] = [ sx / scale ]
      // [ sin   cos ] [z]   [ (sy + y*cosTilt) / sinTilt ]
      const a = this.cosView;
      const b = -this.sinView;
      const c = this.sinView;
      const d = this.cosView;
      
      const det = a * d - b * c; // Should be 1 for rotation matrix
      
      const tx = sx / this.tileScale;
      const ty = (sy + y * this.cosTilt) / this.sinTilt;
      
      x = (d * tx - b * ty) / det;
      z = (-c * tx + a * ty) / det;
    }

    return { x, z };
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

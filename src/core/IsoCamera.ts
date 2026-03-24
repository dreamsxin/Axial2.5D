/**
 * IsoCamera - Handles camera position, zoom, and screen-space transformations
 */

import { Projection } from './Projection';
import { WorldCoord, ScreenCoord } from './types';
import { Entity } from './types';
import { GridSystem } from '../world/GridSystem';

/**
 * Screen point with depth and parallax
 */
export interface ScreenPoint3D {
  sx: number;
  sy: number;
}

/**
 * World point in 3D space
 */
export interface WorldPoint3D {
  x: number;
  y: number;
  z: number;
}

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
  public getVisibleBounds(projection: Projection): { minX: number; maxX: number; minY: number; maxY: number } {
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
      minX: Math.min(topLeft.worldX, bottomRight.worldX),
      maxX: Math.max(topLeft.worldX, bottomRight.worldX),
      minY: Math.min(topLeft.worldY, bottomRight.worldY),
      maxY: Math.max(topLeft.worldY, bottomRight.worldY)
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

  /**
   * Follow configuration options
   */
  public followTarget: {
    worldX: number;
    worldY: number;
    worldZ: number;
    parallaxFactor: number;
    smoothness: number;  // 0-1, higher = smoother/slower
    enabled: boolean;
  } | null = null;

  /**
   * Make camera follow a world position with parallax awareness
   * @param worldX - World X coordinate to follow
   * @param worldY - World Y coordinate to follow (depth in isometric space)
   * @param worldZ - World Z coordinate to follow (height)
   * @param projection - Projection for coordinate conversion
   * @param options - Follow options
   * @param options.smoothness - Smoothing factor (0-1, default 0.9 = smooth, 0 = instant)
   * @param options.parallaxFactor - Parallax factor for target layer (default 1.0)
   * @param options.offsetX - Additional X offset in screen space
   * @param options.offsetY - Additional Y offset in screen space
   */
  public follow(
    worldX: number,
    worldY: number,
    worldZ: number,
    projection: Projection,
    options?: {
      smoothness?: number;
      parallaxFactor?: number;
      offsetX?: number;
      offsetY?: number;
    }
  ): void {
    const smoothness = options?.smoothness ?? 0;
    const parallaxFactor = options?.parallaxFactor ?? 1.0;
    const offsetX = options?.offsetX ?? 0;
    const offsetY = options?.offsetY ?? 0;

    // Calculate raw screen position WITHOUT canvas center (like standalone.html)
    // projection.worldToScreen returns position relative to canvas center
    const screenPos = projection.worldToScreen(worldX, worldY, worldZ);
    const rawScreenX = screenPos.sx * this.scale;
    const rawScreenY = screenPos.sy * this.scale;

    // Calculate target camera offset to center the target
    // Match standalone.html: targetOffset = -rawScreen / parallax
    const targetOffsetX = -rawScreenX / parallaxFactor + offsetX;
    const targetOffsetY = -rawScreenY / parallaxFactor + offsetY;

    // Store follow target
    this.followTarget = {
      worldX,
      worldY,
      worldZ,
      parallaxFactor,
      smoothness,
      enabled: true
    };

    // Apply smooth or instant movement (match standalone.html: 0.1 = 10% interpolation)
    if (smoothness > 0) {
      // Smooth interpolation: move 'smoothness' percent toward target
      this.offsetX = this.offsetX + (targetOffsetX - this.offsetX) * smoothness;
      this.offsetY = this.offsetY + (targetOffsetY - this.offsetY) * smoothness;
    } else {
      // Instant snap
      this.offsetX = targetOffsetX;
      this.offsetY = targetOffsetY;
    }
  }

  /**
   * Update camera follow (call every frame)
   * @param projection - Projection for coordinate conversion
   * @param options - Optional override for follow parameters
   */
  public updateFollow(projection: Projection, options?: {
    worldX?: number;
    worldY?: number;
    worldZ?: number;
    parallaxFactor?: number;
  }): void {
    if (!this.followTarget || !this.followTarget.enabled) return;

    // Use override values or stored values
    const worldX = options?.worldX ?? this.followTarget.worldX;
    const worldY = options?.worldY ?? this.followTarget.worldY;
    const worldZ = options?.worldZ ?? this.followTarget.worldZ;
    const parallaxFactor = options?.parallaxFactor ?? this.followTarget.parallaxFactor;

    // Update stored position
    this.followTarget.worldX = worldX;
    this.followTarget.worldY = worldY;
    this.followTarget.worldZ = worldZ;
    this.followTarget.parallaxFactor = parallaxFactor;

    // Apply follow
    this.follow(worldX, worldY, worldZ, projection, {
      smoothness: this.followTarget.smoothness,
      parallaxFactor,
      offsetX: 0,
      offsetY: 0
    });
  }

  /**
   * Stop following
   */
  public stopFollowing(): void {
    this.followTarget = null;
  }

  /**
   * Check if camera is currently following a target
   */
  public isFollowing(): boolean {
    return this.followTarget !== null && this.followTarget.enabled;
  }

  /**
   * Convert world coordinates to screen coordinates with camera transform and parallax
   * @param worldX - World X coordinate
   * @param worldY - World Y coordinate (depth in isometric space)
   * @param worldZ - World Z coordinate (height)
   * @param projection - Projection instance for coordinate conversion
   * @param parallaxFactor - Parallax factor (0-1), 1 = full parallax, 0 = no parallax
   * @returns Screen coordinates {sx, sy}
   */
  public worldToScreen(
    worldX: number, 
    worldY: number, 
    worldZ: number, 
    projection: Projection,
    parallaxFactor: number = 1.0
  ): ScreenPoint3D {
    // Apply projection to get base screen position
    const baseScreen = projection.worldToScreen(worldX, worldY, worldZ);
    
    // Apply camera zoom
    const scaledX = baseScreen.sx * this.scale;
    const scaledY = baseScreen.sy * this.scale;
    
    // Apply camera offset with parallax
    const offsetX = this.offsetX * parallaxFactor;
    const offsetY = this.offsetY * parallaxFactor;
    
    // Add canvas center
    return {
      sx: scaledX + offsetX + this.canvasWidth / 2,
      sy: scaledY + offsetY + this.canvasHeight / 2
    };
  }

  /**
   * Convert screen coordinates to world coordinates with camera transform and parallax
   * @param screenX - Screen X coordinate
   * @param screenY - Screen Y coordinate
   * @param projection - Projection instance for coordinate conversion
   * @param parallaxFactor - Parallax factor (0-1), 1 = full parallax, 0 = no parallax
   * @param worldZ - World Z coordinate (height, default 0 for ground)
   * @returns World coordinates {x, y}
   */
  public screenToWorld(
    screenX: number, 
    screenY: number, 
    projection: Projection,
    parallaxFactor: number = 1.0,
    worldZ: number = 0
  ): WorldPoint3D {
    // Remove canvas center
    const centeredX = screenX - this.canvasWidth / 2;
    const centeredY = screenY - this.canvasHeight / 2;
    
    // Remove camera offset with parallax
    const offsetX = this.offsetX * parallaxFactor;
    const offsetY = this.offsetY * parallaxFactor;
    
    const adjustedX = centeredX - offsetX;
    const adjustedY = centeredY - offsetY;
    
    // Remove camera zoom
    const scaledX = adjustedX / this.scale;
    const scaledY = adjustedY / this.scale;
    
    // Apply inverse projection
    const world = projection.screenToWorld(scaledX, scaledY, worldZ);
    
    return {
      x: world.worldX,
      y: world.worldY,
      z: worldZ
    };
  }

  /**
   * Follow an entity automatically (call every frame)
   * @param entity - Entity to follow
   * @param gridSystem - Grid system for coordinate conversion
   * @param projection - Projection for coordinate conversion
   * @param options - Follow options
   */
  public followEntity(
    entity: Entity,
    gridSystem: GridSystem,
    projection: Projection,
    options?: {
      smoothness?: number;
      parallaxFactor?: number;
      offsetX?: number;
      offsetY?: number;
    }
  ): void {
    const worldPos = gridSystem.gridToWorld(entity.col, entity.row);
    
    // Auto-calculate parallax from entity depth if not provided
    const parallaxFactor = options?.parallaxFactor ?? (() => {
      const depth = entity.col + entity.row;
      const layer = Math.floor((depth / 2000) * 5);
      return 0.3 + (layer / 4) * 0.7;
    })();

    this.follow(
      worldPos.x,
      worldPos.z,
      entity.height,
      projection,
      {
        smoothness: options?.smoothness ?? 0.1,
        parallaxFactor,
        offsetX: options?.offsetX ?? 0,
        offsetY: options?.offsetY ?? 0
      }
    );
  }

  /**
   * Center camera on an entity instantly (no smoothing)
   */
  public centerOnEntity(
    entity: Entity,
    gridSystem: GridSystem,
    projection: Projection,
    options?: {
      offsetX?: number;
      offsetY?: number;
    }
  ): void {
    const worldPos = gridSystem.gridToWorld(entity.col, entity.row);
    
    this.follow(
      worldPos.x,
      worldPos.z,
      entity.height,
      projection,
      {
        smoothness: 0,
        parallaxFactor: 1.0,
        offsetX: options?.offsetX ?? 0,
        offsetY: options?.offsetY ?? 0
      }
    );
  }
}

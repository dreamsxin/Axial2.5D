/**
 * IsoSprite - Sprite-based entity for isometric rendering
 * Supports image-based sprites with proper depth sorting
 */

import { Projection } from '../core/Projection';
import { Entity } from '../core/types';
import { ResourceManager } from '../resource/ResourceManager';

export interface SpriteConfig {
  width: number;
  height: number;
  anchorX?: number;  // 0-1, horizontal anchor point (default 0.5)
  anchorY?: number;  // 0-1, vertical anchor point (default 1.0 - bottom)
  offset?: { x: number; y: number };
}

export class IsoSprite extends Entity {
  public spriteKey: string;
  public config: SpriteConfig;
  
  private resourceManager: ResourceManager | null = null;
  private frameIndex: number = 0;
  private animationFrames: string[] = [];
  private animationSpeed: number = 0; // ms per frame, 0 = no animation
  private lastFrameTime: number = 0;

  constructor(
    id: string,
    col: number,
    row: number,
    spriteKey: string,
    config?: Partial<SpriteConfig>
  ) {
    super(id, col, row, config?.height || 0, spriteKey);
    this.spriteKey = spriteKey;
    this.config = {
      width: config?.width || 32,
      height: config?.height || 32,
      anchorX: config?.anchorX ?? 0.5,
      anchorY: config?.anchorY ?? 1.0,
      offset: config?.offset || { x: 0, y: 0 }
    };
  }

  /**
   * Set resource manager for sprite loading
   */
  public setResourceManager(rm: ResourceManager): void {
    this.resourceManager = rm;
  }

  /**
   * Set animation frames
   */
  public setAnimation(frames: string[], speed: number = 100): void {
    this.animationFrames = frames;
    this.animationSpeed = speed;
    this.frameIndex = 0;
  }

  /**
   * Update animation frame
   */
  override update(delta: number): void {
    if (this.animationSpeed > 0 && this.animationFrames.length > 1) {
      this.lastFrameTime += delta;
      
      if (this.lastFrameTime >= this.animationSpeed) {
        this.frameIndex = (this.frameIndex + 1) % this.animationFrames.length;
        this.lastFrameTime = 0;
      }
    }
  }

  /**
   * Get current sprite key (for animated sprites)
   */
  public getCurrentSpriteKey(): string {
    if (this.animationFrames.length > 0) {
      return this.animationFrames[this.frameIndex];
    }
    return this.spriteKey;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { width, height, anchorX, anchorY, offset } = this.config;
    
    // Handle possibly undefined values
    const ax = anchorX ?? 0.5;
    const ay = anchorY ?? 1.0;
    const offX = offset?.x || 0;
    const offY = offset?.y || 0;
    
    // Calculate draw position based on anchor
    const drawX = -width * ax + offX;
    const drawY = -height * ay + offY;

    // Try to get image from resource manager
    if (this.resourceManager) {
      const image = this.resourceManager.getImage(this.getCurrentSpriteKey());
      if (image) {
        ctx.drawImage(image, drawX, drawY, width, height);
        return;
      }
    }

    // Fallback: draw placeholder
    this.drawPlaceholder(ctx, drawX, drawY, width, height);
  }

  /**
   * Draw placeholder when sprite image is not available
   */
  private drawPlaceholder(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    // Draw sprite body
    ctx.fillStyle = '#6a8caf';
    ctx.fillRect(x, y - height, width, height);
    
    // Draw outline
    ctx.strokeStyle = '#3a5a7f';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y - height, width, height);
    
    // Draw ID label
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.id, x + width / 2, y - height / 2);
  }

  /**
   * Get screen bounds for collision/hit testing
   */
  public getScreenBounds(projection: Projection): { x: number; y: number; width: number; height: number } {
    const { width, height, offset } = this.config;
    const offX = offset?.x || 0;
    const offY = offset?.y || 0;
    
    const screenPos = projection.worldToScreen(
      this.col * 32 - this.row * 32,
      this.col * 16 + this.row * 16,
      0
    );
    
    return {
      x: screenPos.sx - width / 2 + offX,
      y: screenPos.sy - height + offY,
      width,
      height
    };
  }
}

/**
 * IsoCharacter - Character sprite with direction support
 */
export class IsoCharacter extends IsoSprite {
  private direction: number = 0; // 0-7, 8 directions
  private directionPrefix: string = 'char_';

  constructor(
    id: string,
    col: number,
    row: number,
    baseSpriteKey: string,
    config?: Partial<SpriteConfig>
  ) {
    super(id, col, row, baseSpriteKey, config);
    this.directionPrefix = baseSpriteKey;
  }

  /**
   * Set direction (0-7 for 8-directional sprites)
   */
  public setDirection(dir: number): void {
    this.direction = dir % 8;
    this.spriteKey = `${this.directionPrefix}_dir${this.direction}`;
  }

  /**
   * Face towards a target grid position
   */
  public faceTowards(targetCol: number, targetRow: number): void {
    const dc = targetCol - this.col;
    const dr = targetRow - this.row;
    
    // Calculate direction index (0-7)
    const angle = Math.atan2(dr, dc);
    const dirIndex = Math.round(((angle * 180 / Math.PI) + 180) / 45) % 8;
    this.setDirection(dirIndex);
  }
}

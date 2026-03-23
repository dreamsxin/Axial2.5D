/**
 * Layer - Represents a render layer with parallax scrolling
 * Layers are sorted by depth range, with smaller depth (foreground) having more parallax
 */

import { Projection } from './Projection';
import { IsoCamera } from './IsoCamera';
import { RenderItem } from './types';

export interface LayerConfig {
  id: string;
  depthMin: number;      // Minimum depth for this layer
  depthMax: number;      // Maximum depth for this layer
  parallaxFactor?: number; // 0-1, 1 = full parallax (foreground), 0 = no parallax (background)
  visible?: boolean;
  zIndex?: number;       // Render order within layer
}

export class Layer implements RenderItem {
  public id: string;
  public depthMin: number;
  public depthMax: number;
  public parallaxFactor: number;
  public visible: boolean;
  public zIndex: number;
  public depth: number = 0;
  
  private items: RenderItem[] = [];
  private camera: IsoCamera;
  private projection: Projection;

  constructor(config: LayerConfig, camera: IsoCamera, projection: Projection) {
    this.id = config.id;
    this.depthMin = config.depthMin;
    this.depthMax = config.depthMax;
    this.parallaxFactor = config.parallaxFactor ?? 1.0;
    this.visible = config.visible ?? true;
    this.zIndex = config.zIndex ?? 0;
    this.camera = camera;
    this.projection = projection;
  }

  /**
   * Add a render item to this layer
   */
  public addItem(item: RenderItem): void {
    this.items.push(item);
  }

  /**
   * Add multiple render items
   */
  public addItems(items: RenderItem[]): void {
    this.items.push(...items);
  }

  /**
   * Clear all items from this layer
   */
  public clear(): void {
    this.items = [];
  }

  /**
   * Get all items in this layer
   */
  public getItems(): RenderItem[] {
    return this.items;
  }

  /**
   * Get item count
   */
  public getCount(): number {
    return this.items.length;
  }

  /**
   * Check if a depth value falls within this layer's range
   */
  public containsDepth(depth: number): boolean {
    return depth >= this.depthMin && depth <= this.depthMax;
  }

  /**
   * Get parallax offset for this layer
   * Foreground layers (smaller depth) have larger offset
   * Background layers (larger depth) have smaller offset
   */
  public getParallaxOffset(): { x: number; y: number } {
    const baseOffsetX = this.camera.offsetX;
    const baseOffsetY = this.camera.offsetY;
    
    // Apply parallax factor
    // Lower factor = less movement = appears further away
    return {
      x: baseOffsetX * this.parallaxFactor,
      y: baseOffsetY * this.parallaxFactor
    };
  }

  /**
   * Update all items in this layer
   */
  public update(delta: number): void {
    for (const item of this.items) {
      if (item.update) {
        item.update(delta);
      }
    }
  }

  /**
   * Draw all items in this layer
   * Note: Camera transform should be applied externally with parallax offset
   */
  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) return;
    
    for (const item of this.items) {
      item.draw(ctx);
    }
  }

  /**
   * Sort items by depth
   */
  public sortItems(): void {
    this.items.sort((a, b) => a.depth - b.depth);
  }
}

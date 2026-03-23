/**
 * LayerManager - Manages multiple render layers with parallax scrolling
 * Automatically assigns items to layers based on depth
 */

import { Layer, LayerConfig } from './Layer';
import { Projection } from './Projection';
import { IsoCamera } from './IsoCamera';
import { RenderItem } from './types';

export interface LayerManagerConfig {
  autoSort?: boolean;
  defaultParallaxSteps?: number;
}

export class LayerManager {
  private layers: Layer[] = [];
  private layerMap: Map<string, Layer> = new Map();
  private camera: IsoCamera;
  private projection: Projection;
  private autoSort: boolean;
  private defaultParallaxSteps: number;

  constructor(
    camera: IsoCamera,
    projection: Projection,
    config?: LayerManagerConfig
  ) {
    this.camera = camera;
    this.projection = projection;
    this.autoSort = config?.autoSort ?? true;
    this.defaultParallaxSteps = config?.defaultParallaxSteps ?? 5;
  }

  /**
   * Create standard layers based on depth ranges
   * Automatically calculates parallax factors
   */
  public createStandardLayers(
    depthMin: number,
    depthMax: number,
    layerCount: number = 5
  ): Layer[] {
    this.clear();
    
    const range = depthMax - depthMin;
    const step = range / layerCount;
    const layers: Layer[] = [];

    for (let i = 0; i < layerCount; i++) {
      const layerMin = depthMin + i * step;
      const layerMax = depthMin + (i + 1) * step;
      
      // Parallax factor: foreground (i=0) = 1.0, background (i=layerCount-1) = 0.0
      // Using smooth interpolation
      const t = i / (layerCount - 1);
      const parallaxFactor = 1.0 - t * 0.8; // Background still moves 20%
      
      const layer = this.createLayer({
        id: `layer_${i}`,
        depthMin: layerMin,
        depthMax: layerMax,
        parallaxFactor,
        zIndex: i
      });
      
      layers.push(layer);
    }

    return layers;
  }

  /**
   * Create a custom layer
   */
  public createLayer(config: LayerConfig): Layer {
    const layer = new Layer(config, this.camera, this.projection);
    this.layers.push(layer);
    this.layerMap.set(config.id, layer);
    
    // Sort layers by depthMin (background first)
    this.layers.sort((a, b) => a.depthMin - b.depthMin);
    
    return layer;
  }

  /**
   * Get a layer by ID
   */
  public getLayer(id: string): Layer | undefined {
    return this.layerMap.get(id);
  }

  /**
   * Get all layers
   */
  public getLayers(): Layer[] {
    return this.layers;
  }

  /**
   * Remove a layer
   */
  public removeLayer(id: string): void {
    const layer = this.layerMap.get(id);
    if (layer) {
      const index = this.layers.indexOf(layer);
      if (index > -1) {
        this.layers.splice(index, 1);
      }
      this.layerMap.delete(id);
    }
  }

  /**
   * Clear all layers
   */
  public clear(): void {
    this.layers = [];
    this.layerMap.clear();
  }

  /**
   * Add a render item to the appropriate layer based on its depth
   */
  public addItem(item: RenderItem): Layer | null {
    const layer = this.getLayerForDepth(item.depth);
    if (layer) {
      layer.addItem(item);
      return layer;
    }
    return null;
  }

  /**
   * Add items to appropriate layers
   */
  public addItems(items: RenderItem[]): void {
    for (const item of items) {
      this.addItem(item);
    }
  }

  /**
   * Get the appropriate layer for a depth value
   */
  public getLayerForDepth(depth: number): Layer | null {
    for (const layer of this.layers) {
      if (layer.containsDepth(depth)) {
        return layer;
      }
    }
    
    // If no layer matches, return the closest one
    if (this.layers.length > 0) {
      if (depth < this.layers[0].depthMin) {
        return this.layers[0]; // Foreground
      }
      return this.layers[this.layers.length - 1]; // Background
    }
    
    return null;
  }

  /**
   * Update all layers
   */
  public update(delta: number): void {
    for (const layer of this.layers) {
      layer.update(delta);
    }
  }

  /**
   * Render all layers with parallax scrolling
   * Each layer is rendered with its own parallax offset
   */
  public render(ctx: CanvasRenderingContext2D): void {
    // Sort layers by depth (background first, then foreground)
    const sortedLayers = [...this.layers].sort((a, b) => a.depthMin - b.depthMin);
    
    for (const layer of sortedLayers) {
      if (!layer.visible) continue;
      
      // Save context state
      ctx.save();
      
      // Apply parallax offset for this layer
      const parallax = layer.getParallaxOffset();
      ctx.translate(parallax.x - this.camera.offsetX, parallax.y - this.camera.offsetY);
      
      // Draw layer contents
      layer.draw(ctx);
      
      // Restore context state
      ctx.restore();
    }
  }

  /**
   * Get layer statistics
   */
  public getStats(): { layerCount: number; totalItems: number; layers: Array<{ id: string; items: number }> } {
    return {
      layerCount: this.layers.length,
      totalItems: this.layers.reduce((sum, l) => sum + l.getCount(), 0),
      layers: this.layers.map(l => ({
        id: l.id,
        items: l.getCount()
      }))
    };
  }

  /**
   * Set layer visibility
   */
  public setLayerVisible(id: string, visible: boolean): void {
    const layer = this.layerMap.get(id);
    if (layer) {
      layer.visible = visible;
    }
  }

  /**
   * Toggle layer visibility
   */
  public toggleLayerVisible(id: string): boolean {
    const layer = this.layerMap.get(id);
    if (layer) {
      layer.visible = !layer.visible;
      return layer.visible;
    }
    return false;
  }

  /**
   * Recalculate layer assignments for all items
   * Useful when items have moved
   */
  public reassignItems(): void {
    if (!this.autoSort) return;
    
    // Collect all items
    const allItems: RenderItem[] = [];
    for (const layer of this.layers) {
      allItems.push(...layer.getItems());
    }
    
    // Clear all layers
    for (const layer of this.layers) {
      layer.clear();
    }
    
    // Reassign items
    for (const item of allItems) {
      this.addItem(item);
    }
  }
}

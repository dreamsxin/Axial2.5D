/**
 * LayerManager - Manages layer configurations with parallax, alpha, and Z-offset
 * Each layer represents a visual depth plane with its own properties
 */

export interface LayerConfig {
  index: number;
  parallaxFactor?: number;    // 0-1, parallax scrolling intensity
  alpha?: number;             // 0-1, layer transparency
  zIndexOffset?: number;      // Screen-space Z offset in pixels
  visible?: boolean;
}

export interface LayerManagerConfig {
  layerCount?: number;
  maxDepth?: number;
  baseParallax?: number;      // Background layer parallax (default 0.3)
  parallaxRange?: number;     // Parallax range coefficient (default 0.7)
  foregroundAlpha?: number;   // Foreground layer alpha (default 0.6)
  backgroundAlpha?: number;   // Background layer alpha (default 1.0)
  zIndexStep?: number;        // Z offset step between layers (default 30)
}

export interface LayerInfo {
  index: number;
  parallaxFactor: number;
  alpha: number;
  zIndexOffset: number;
}

export class LayerManager {
  private layerCount: number;
  private maxDepth: number;
  private baseParallax: number;
  private parallaxRange: number;
  private foregroundAlpha: number;
  private backgroundAlpha: number;
  private zIndexStep: number;
  
  private layers: Map<number, LayerConfig> = new Map();

  constructor(config?: LayerManagerConfig) {
    this.layerCount = config?.layerCount ?? 5;
    this.maxDepth = config?.maxDepth ?? 2000;
    this.baseParallax = config?.baseParallax ?? 0.3;
    this.parallaxRange = config?.parallaxRange ?? 0.7;
    this.foregroundAlpha = config?.foregroundAlpha ?? 0.6;
    this.backgroundAlpha = config?.backgroundAlpha ?? 1.0;
    this.zIndexStep = config?.zIndexStep ?? 30;
    
    // Initialize default layers
    this.initializeLayers();
  }

  /**
   * Initialize default layers with calculated properties
   */
  private initializeLayers(): void {
    for (let i = 0; i < this.layerCount; i++) {
      this.setLayer(i, {
        index: i,
        parallaxFactor: this.calculateParallaxFactor(i),
        alpha: this.calculateLayerAlpha(i),
        zIndexOffset: this.calculateZIndexOffset(i),
        visible: true
      });
    }
  }

  /**
   * Calculate parallax factor for a layer index
   * Layer 0 (background) = baseParallax, Layer N-1 (foreground) = baseParallax + range
   */
  public calculateParallaxFactor(layerIndex: number): number {
    if (this.layerCount <= 1) return 1.0;
    return this.baseParallax + (layerIndex / (this.layerCount - 1)) * this.parallaxRange;
  }

  /**
   * Calculate alpha for a layer index
   * Layer 0 (background) = backgroundAlpha, Layer N-1 (foreground) = foregroundAlpha
   */
  public calculateLayerAlpha(layerIndex: number): number {
    if (this.layerCount <= 1) return 1.0;
    const t = layerIndex / (this.layerCount - 1);
    return this.backgroundAlpha - (this.backgroundAlpha - this.foregroundAlpha) * t;
  }

  /**
   * Calculate Z-axis offset for a layer index
   */
  public calculateZIndexOffset(layerIndex: number): number {
    return layerIndex * this.zIndexStep;
  }

  /**
   * Get layer configuration
   */
  public getLayer(index: number): LayerConfig | undefined {
    return this.layers.get(index);
  }

  /**
   * Set or update layer configuration
   */
  public setLayer(index: number, config: Partial<LayerConfig>): void {
    const existing = this.layers.get(index) || { index };
    this.layers.set(index, { ...existing, ...config, index });
  }

  /**
   * Get layer for a given depth value
   */
  public getLayerForDepth(depth: number): number {
    const layerIndex = Math.floor((depth / this.maxDepth) * this.layerCount);
    return Math.max(0, Math.min(this.layerCount - 1, layerIndex));
  }

  /**
   * Get all layers
   */
  public getAllLayers(): LayerConfig[] {
    return Array.from(this.layers.values()).sort((a, b) => a.index - b.index);
  }

  /**
   * Get layer count
   */
  public getLayerCount(): number {
    return this.layerCount;
  }

  /**
   * Update layer properties dynamically
   */
  public updateLayerProperties(options: {
    parallaxRange?: number;
    foregroundAlpha?: number;
    zIndexStep?: number;
  }): void {
    if (options.parallaxRange !== undefined) {
      this.parallaxRange = options.parallaxRange;
    }
    if (options.foregroundAlpha !== undefined) {
      this.foregroundAlpha = options.foregroundAlpha;
    }
    if (options.zIndexStep !== undefined) {
      this.zIndexStep = options.zIndexStep;
    }
    
    // Recalculate all layer properties
    this.initializeLayers();
  }

  /**
   * Get statistics for a layer
   */
  public getLayerStats(layerIndex: number): {
    parallax: number;
    alpha: number;
    zIndexOffset: number;
  } {
    return {
      parallax: this.calculateParallaxFactor(layerIndex),
      alpha: this.calculateLayerAlpha(layerIndex),
      zIndexOffset: this.calculateZIndexOffset(layerIndex)
    };
  }

  /**
   * Get statistics for all layers
   */
  public getAllStats(): Array<{
    index: number;
    parallax: number;
    alpha: number;
    zIndexOffset: number;
  }> {
    const stats: Array<{index: number; parallax: number; alpha: number; zIndexOffset: number}> = [];
    for (let i = 0; i < this.layerCount; i++) {
      stats.push({
        index: i,
        parallax: this.calculateParallaxFactor(i),
        alpha: this.calculateLayerAlpha(i),
        zIndexOffset: this.calculateZIndexOffset(i)
      });
    }
    return stats;
  }
}

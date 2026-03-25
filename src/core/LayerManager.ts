/**
 * LayerManager - Manages layer configurations with parallax, alpha, and Z-offset
 * Each layer represents a visual depth plane with its own properties
 * 
 * Features (Phase 6):
 * - Automatic statistics tracking (tiles, entities, effects per layer)
 * - Event emission for statistics changes
 */

import { EventBus } from '../utils/EventBus';

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
  eventBus?: EventBus;        // For emitting statistics events
}

export interface LayerInfo {
  index: number;
  parallaxFactor: number;
  alpha: number;
  zIndexOffset: number;
}

export interface LayerStats extends LayerInfo {
  tileCount: number;
  entityCount: number;
  effectCount: number;
}

export class LayerManager {
  private layerCount: number;
  private maxDepth: number;
  private baseParallax: number;
  private parallaxRange: number;
  private foregroundAlpha: number;
  private backgroundAlpha: number;
  private zIndexStep: number;
  private eventBus?: EventBus;
  
  private layers: Map<number, LayerConfig> = new Map();
  
  // Statistics tracking (Phase 6)
  private tileCounts: number[] = [];
  private entityCounts: number[] = [];
  private effectCounts: number[] = [];

  constructor(config?: LayerManagerConfig) {
    this.layerCount = config?.layerCount ?? 5;
    this.maxDepth = config?.maxDepth ?? 2000;
    this.baseParallax = config?.baseParallax ?? 0.3;
    this.parallaxRange = config?.parallaxRange ?? 0.7;
    this.foregroundAlpha = config?.foregroundAlpha ?? 0.6;
    this.backgroundAlpha = config?.backgroundAlpha ?? 1.0;
    this.zIndexStep = config?.zIndexStep ?? 30;
    this.eventBus = config?.eventBus;
    
    // Initialize statistics arrays
    this.tileCounts = new Array(this.layerCount).fill(0);
    this.entityCounts = new Array(this.layerCount).fill(0);
    this.effectCounts = new Array(this.layerCount).fill(0);
    
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
   * Get statistics for a layer (Phase 6 - includes tile/entity/effect counts)
   */
  public getLayerStats(layerIndex: number): LayerStats {
    return {
      index: layerIndex,
      parallaxFactor: this.calculateParallaxFactor(layerIndex),
      alpha: this.calculateLayerAlpha(layerIndex),
      zIndexOffset: this.calculateZIndexOffset(layerIndex),
      tileCount: this.tileCounts[layerIndex] ?? 0,
      entityCount: this.entityCounts[layerIndex] ?? 0,
      effectCount: this.effectCounts[layerIndex] ?? 0
    };
  }

  /**
   * Get statistics for all layers (Phase 6 - includes counts)
   */
  public getAllStats(): LayerStats[] {
    const stats: LayerStats[] = [];
    for (let i = 0; i < this.layerCount; i++) {
      stats.push(this.getLayerStats(i));
    }
    return stats;
  }

  // ==================== Statistics Tracking (Phase 6) ====================

  /**
   * Update tile count for a layer
   */
  public updateTileCount(col: number, row: number, delta: number): void {
    const layer = this.getLayerForDepth(col + row);
    const oldCount = this.tileCounts[layer];
    this.tileCounts[layer] = Math.max(0, (this.tileCounts[layer] ?? 0) + delta);
    
    if (oldCount !== this.tileCounts[layer]) {
      this.emitStatsChange();
    }
  }

  /**
   * Update entity count for a layer
   */
  public updateEntityCount(col: number, row: number, delta: number): void {
    const layer = this.getLayerForDepth(col + row);
    const oldCount = this.entityCounts[layer];
    this.entityCounts[layer] = Math.max(0, (this.entityCounts[layer] ?? 0) + delta);
    
    if (oldCount !== this.entityCounts[layer]) {
      this.emitStatsChange();
    }
  }

  /**
   * Update effect count for a layer
   */
  public updateEffectCount(layer: number, delta: number): void {
    const oldCount = this.effectCounts[layer];
    this.effectCounts[layer] = Math.max(0, (this.effectCounts[layer] ?? 0) + delta);
    
    if (oldCount !== this.effectCounts[layer]) {
      this.emitStatsChange();
    }
  }

  /**
   * Reset all statistics
   */
  public resetStats(): void {
    this.tileCounts.fill(0);
    this.entityCounts.fill(0);
    this.effectCounts.fill(0);
    this.emitStatsChange();
  }

  /**
   * Emit statistics change event
   */
  private emitStatsChange(): void {
    if (this.eventBus) {
      this.eventBus.emit('layerStatsChanged');
    }
  }
}

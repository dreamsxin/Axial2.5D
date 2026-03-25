/**
 * LayerList - Auto-updating layer statistics UI component
 * 
 * Displays a list of layers with their properties and statistics:
 * - Layer index and name (background/foreground)
 * - Parallax factor
 * - Alpha (transparency)
 * - Z-axis offset
 * - Tile count
 * - Entity count
 * - Effect count
 * 
 * Automatically updates when layer statistics change.
 * 
 * Usage:
 * ```typescript
 * // Via UIManager
 * game.ui.addLayerList('layerList', {
 *   layerColors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'],
 *   showStats: ['tiles', 'entities', 'clouds']
 * });
 * 
 * // Or directly
 * const layerList = new LayerList('layerList', game.layerManager, {
 *   layerColors: [...],
 *   showStats: ['tiles', 'entities', 'clouds']
 * });
 * layerList.start(); // Start auto-updating
 * ```
 */

import { LayerManager } from '../core/LayerManager';
import { EventBus } from '../utils/EventBus';

export interface LayerListConfig {
  /** Colors for each layer (cycled if fewer layers than colors) */
  layerColors?: string[];
  /** Which statistics to show: 'tiles', 'entities', 'clouds'/'effects' */
  showStats?: Array<'tiles' | 'entities' | 'clouds' | 'effects'>;
  /** Custom labels for statistics */
  labels?: {
    tiles?: string;
    entities?: string;
    clouds?: string;
    effects?: string;
  };
  /** Custom labels for specific layers (overrides auto-detection) */
  layerLabels?: Record<number, string>;
  /** CSS class for layer items */
  itemClass?: string;
  /** CSS class for layer color indicator */
  colorClass?: string;
}

export class LayerList {
  private container: HTMLElement | null = null;
  private layerManager: LayerManager;
  private eventBus?: EventBus;
  private config: LayerListConfig;
  private unsubscribe?: () => void;

  constructor(
    containerId: string,
    layerManager: LayerManager,
    config?: LayerListConfig
  ) {
    this.layerManager = layerManager;
    this.config = {
      layerColors: config?.layerColors ?? ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'],
      showStats: config?.showStats ?? ['tiles', 'entities', 'clouds'],
      labels: config?.labels,
      itemClass: config?.itemClass,
      colorClass: config?.colorClass
    };

    // Get container element
    if (typeof document !== 'undefined') {
      this.container = document.getElementById(containerId);
      if (!this.container) {
        console.warn(`LayerList: Container "${containerId}" not found`);
      }
    }
  }

  /**
   * Start auto-updating the layer list
   * Call this after creating the component
   */
  public start(): void {
    if (!this.container) return;

    // Initial render
    this.update();

    // Subscribe to layer statistics changes
    if (this.layerManager instanceof LayerManager) {
      // Access eventBus through layerManager if available
      // For now, we'll update on every frame via UIManager
    }
  }

  /**
   * Stop auto-updating
   */
  public stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  /**
   * Update the layer list display
   * Call this every frame or when statistics change
   */
  public update(): void {
    if (!this.container) return;

    const layerCount = this.layerManager.getLayerCount?.() ?? 5;
    const items: string[] = [];

    // Render layers from front to back (highest index first)
    for (let i = layerCount - 1; i >= 0; i--) {
      const stats = this.layerManager.getLayerStats(i);
      const color = this.config.layerColors![i % this.config.layerColors!.length];
      
      items.push(this.renderLayerItem(i, stats, color));
    }

    this.container.innerHTML = items.join('');
  }

  /**
   * Render a single layer item
   */
  private renderLayerItem(index: number, stats: any, color: string): string {
    // Get layer label from config or auto-detect based on parallax
    let label = '';
    
    if (this.config.layerLabels?.[index]) {
      // Custom label from config
      label = this.config.layerLabels![index];
    } else {
      // Auto-detect based on parallax factor
      const layerCount = this.layerManager.getLayerCount?.() ?? 5;
      
      // Find layers with min/max parallax
      let minParallaxLayer = 0;
      let maxParallaxLayer = layerCount - 1;
      let minParallax = Infinity;
      let maxParallax = -Infinity;
      
      for (let i = 0; i < layerCount; i++) {
        const layerStats = this.layerManager.getLayerStats(i);
        if (layerStats.parallaxFactor < minParallax) {
          minParallax = layerStats.parallaxFactor;
          minParallaxLayer = i;
        }
        if (layerStats.parallaxFactor > maxParallax) {
          maxParallax = layerStats.parallaxFactor;
          maxParallaxLayer = i;
        }
      }
      
      // Label based on parallax relationship
      if (index === maxParallaxLayer && layerCount > 1) {
        label = '(前景)';  // Highest parallax = closest = foreground
      } else if (index === minParallaxLayer && layerCount > 1) {
        label = '(背景)';  // Lowest parallax = farthest = background
      }
    }

    // Build statistics display
    const statsHtml = this.buildStatsHtml(stats);

    return `
      <div class="layer-item" style="display:flex;justify-content:space-between;padding:3px;margin:2px 0;background:rgba(255,255,255,0.05);border-radius:3px;font-size:0.75em;">
        <div style="display:flex;align-items:center;">
          <div class="layer-color" style="width:10px;height:10px;border-radius:2px;margin-right:6px;background:${color};opacity:${stats.alpha}"></div>
          <span>L${index} ${label}</span>
        </div>
        <div style="text-align:right;font-size:0.7em;color:#888;">
          ${statsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Build statistics HTML for a layer
   */
  private buildStatsHtml(stats: any): string {
    const parts: string[] = [];
    const showStats = this.config.showStats ?? ['tiles', 'entities', 'clouds'];
    const labels = this.config.labels ?? {};

    if (showStats.includes('tiles')) {
      parts.push(`${stats.tileCount ?? 0} ${labels.tiles ?? 'tiles'}`);
    }
    if (showStats.includes('entities')) {
      parts.push(`${stats.entityCount ?? 0} ${labels.entities ?? 'ent'}`);
    }
    if (showStats.includes('clouds') || showStats.includes('effects')) {
      const count = stats.effectCount ?? 0;
      const label = labels.clouds ?? '☁️';
      if (count > 0) {
        parts.push(`${label} ${count}`);
      }
    }

    return parts.join(' | ');
  }

  /**
   * Destroy the component and clean up
   */
  public destroy(): void {
    this.stop();
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
  }
}

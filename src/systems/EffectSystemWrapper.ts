/**
 * EffectSystemWrapper - Auto-integrates EffectSystem with game loop and render pipeline
 * 
 * Wraps EffectSystem to provide automatic:
 * - Update on every frame (via Game.update)
 * - Render integration (via render hooks)
 * - Layer-aware rendering
 * 
 * Usage:
 * ```typescript
 * const effectWrapper = new EffectSystemWrapper(effectSystem, layerManager, {
 *   layerCount: 5
 * });
 * 
 * effectWrapper.enable(game); // Auto-registers with game
 * 
 * // Add effects normally
 * effectSystem.addEffect({ ... });
 * ```
 */

import { EffectSystem } from '../effects/EffectSystem';
import { LayerManager } from '../core/LayerManager';
import { Game } from '../core/Game';

export interface EffectSystemWrapperConfig {
  layerCount?: number;
  autoUpdate?: boolean;
  autoRender?: boolean;
}

export class EffectSystemWrapper {
  private effectSystem: EffectSystem;
  private layerManager: LayerManager;
  private layerCount: number;
  private autoUpdate: boolean;
  private autoRender: boolean;
  private game: Game | null = null;
  private enabled: boolean = false;

  constructor(
    effectSystem: EffectSystem,
    layerManager: LayerManager,
    config: EffectSystemWrapperConfig = {}
  ) {
    this.effectSystem = effectSystem;
    this.layerManager = layerManager;
    this.layerCount = config.layerCount ?? 5;
    this.autoUpdate = config.autoUpdate ?? true;
    this.autoRender = config.autoRender ?? true;
  }

  /**
   * Enable automatic integration with game
   * Registers update and render hooks
   */
  public enable(game: Game): void {
    if (this.enabled) return;
    
    this.game = game;
    this.enabled = true;

    // Register render hook for effects
    if (this.autoRender && game.renderHooks) {
      const originalAfterLayers = game.renderHooks.onAfterLayers;
      
      game.renderHooks.onAfterLayers = (ctx) => {
        // Call original hook if exists
        if (originalAfterLayers) {
          originalAfterLayers(ctx);
        }
        
        // Render effects
        this.render();
      };
    }

    // Effects are automatically updated in Game.update via effectSystem.update
    // No additional hook needed if autoUpdate is true
  }

  /**
   * Disable automatic integration
   */
  public disable(): void {
    if (!this.enabled || !this.game) return;

    // Remove render hook
    if (this.game.renderHooks) {
      // Reset to default (no-op)
      this.game.renderHooks.onAfterLayers = undefined;
    }

    this.enabled = false;
  }

  /**
   * Update effects (called automatically if autoUpdate is true)
   */
  public update(delta: number = 16): void {
    if (this.autoUpdate) {
      this.effectSystem.update(delta);
    }
  }

  /**
   * Render effects for all layers
   */
  public render(): void {
    if (!this.autoRender || !this.game) return;

    const ctx = this.game.renderer.ctx as CanvasRenderingContext2D;
    
    for (let i = 0; i < this.layerCount; i++) {
      const layerInfo = this.layerManager.getLayerStats(i);
      this.effectSystem.render(ctx, i, {
        parallaxFactor: layerInfo.parallax,
        alpha: layerInfo.alpha
      });
    }
  }

  /**
   * Check if wrapper is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get underlying EffectSystem
   */
  public getEffectSystem(): EffectSystem {
    return this.effectSystem;
  }

  /**
   * Add an effect (convenience method)
   */
  public addEffect(config: any): void {
    this.effectSystem.addEffect(config);
  }

  /**
   * Remove an effect (convenience method)
   */
  public removeEffect(effectId: string): void {
    this.effectSystem.removeEffect(effectId);
  }

  /**
   * Clear all effects (convenience method)
   */
  public clear(): void {
    this.effectSystem.clear();
  }
}

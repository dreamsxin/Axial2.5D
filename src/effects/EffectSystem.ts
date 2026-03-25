/**
 * EffectSystem - Manages visual effects (clouds, particles, etc.)
 * Effects are entities with special rendering properties (parallax, transparency)
 * 
 * Phase 6: Integrated with LayerManager for automatic statistics tracking
 */

import { IsoCamera } from '../core/IsoCamera';
import { Projection } from '../core/Projection';
import { LayerManager } from '../core/LayerManager';
import { EventBus } from '../utils/EventBus';

export interface EffectConfig {
  id: string;
  type: 'cloud' | 'particle' | 'sparkle' | string;
  col: number;
  row: number;
  layer: number;
  size: number;
  offsetY: number;  // Height offset (negative = above ground)
  color?: string;
  alpha?: number;
  lifetime?: number;  // -1 = infinite
}

export interface Effect extends EffectConfig {
  age: number;
  visible: boolean;
}

export class EffectSystem {
  private effects: Map<string, Effect> = new Map();
  private camera: IsoCamera;
  private projection: Projection;
  private layerCount: number = 5;
  private layerManager?: LayerManager;  // For statistics tracking (Phase 6)

  constructor(camera: IsoCamera, projection: Projection, layerCount?: number, layerManager?: LayerManager) {
    this.camera = camera;
    this.projection = projection;
    this.layerCount = layerCount ?? 5;
    this.layerManager = layerManager;
  }

  /**
   * Set layer manager for statistics tracking (Phase 6)
   */
  public setLayerManager(layerManager: LayerManager): void {
    this.layerManager = layerManager;
  }

  /**
   * Add an effect
   */
  public addEffect(config: EffectConfig): void {
    const effect: Effect = {
      ...config,
      age: 0,
      visible: true
    };
    this.effects.set(config.id, effect);
    
    // Update statistics (Phase 6)
    if (this.layerManager) {
      this.layerManager.updateEffectCount(config.layer, 1);
    }
  }

  /**
   * Remove an effect
   */
  public removeEffect(id: string): void {
    const effect = this.effects.get(id);
    if (effect && this.layerManager) {
      this.layerManager.updateEffectCount(effect.layer, -1);
    }
    this.effects.delete(id);
  }

  /**
   * Get an effect by ID
   */
  public getEffect(id: string): Effect | undefined {
    return this.effects.get(id);
  }

  /**
   * Get all effects for a specific layer
   */
  public getEffectsForLayer(layerIndex: number): Effect[] {
    return Array.from(this.effects.values())
      .filter(e => e.visible && e.layer === layerIndex);
  }

  /**
   * Get all effects
   */
  public getAllEffects(): Effect[] {
    return Array.from(this.effects.values()).filter(e => e.visible);
  }

  /**
   * Update all effects (age, lifetime)
   */
  public update(delta: number): void {
    for (const effect of this.effects.values()) {
      effect.age += delta;
      
      // Remove expired effects
      if (effect.lifetime !== undefined && effect.lifetime >= 0 && effect.age > effect.lifetime) {
        effect.visible = false;
      }
    }
    
    // Clean up invisible effects
    for (const [id, effect] of this.effects.entries()) {
      if (!effect.visible) {
        this.effects.delete(id);
      }
    }
  }

  /**
   * Render effects for a specific layer
   * Note: Caller should apply Z-axis offset before calling this
   */
  public render(
    ctx: CanvasRenderingContext2D,
    layerIndex: number,
    options?: {
      parallaxFactor?: number;
      alpha?: number;
    }
  ): void {
    const effects = this.getEffectsForLayer(layerIndex);
    if (effects.length === 0) return;

    const parallaxFactor = options?.parallaxFactor ?? 1.0;
    const layerAlpha = options?.alpha ?? 1.0;

    ctx.save();

    for (const effect of effects) {
      this.renderEffect(ctx, effect, parallaxFactor, layerAlpha);
    }

    ctx.restore();
  }

  /**
   * Render a single effect
   */
  private renderEffect(
    ctx: CanvasRenderingContext2D,
    effect: Effect,
    parallaxFactor: number,
    layerAlpha: number
  ): void {
    const worldX = effect.col * 50;  // Assuming cellSize = 50
    const worldY = effect.row * 50;
    
    const screen = this.camera.worldToScreen(
      worldX,
      worldY,
      effect.offsetY,
      this.projection,
      parallaxFactor
    );

    const alpha = (effect.alpha ?? 1.0) * layerAlpha;
    ctx.globalAlpha = alpha;

    switch (effect.type) {
      case 'cloud':
        this.drawCloud(ctx, screen.sx, screen.sy, effect.size, effect.color);
        break;
      case 'particle':
        this.drawParticle(ctx, screen.sx, screen.sy, effect.size, effect.color);
        break;
      default:
        this.drawDefault(ctx, screen.sx, screen.sy, effect.size, effect.color);
    }

    ctx.globalAlpha = 1.0;
  }

  /**
   * Draw cloud effect (5 overlapping circles like standalone.html)
   */
  private drawCloud(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color?: string
  ): void {
    ctx.fillStyle = color || '#ffffff';
    ctx.beginPath();
    
    // Main cloud body
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.arc(x - size * 0.4, y + size * 0.1, size * 0.4, 0, Math.PI * 2);
    ctx.arc(x + size * 0.4, y + size * 0.1, size * 0.4, 0, Math.PI * 2);
    ctx.arc(x - size * 0.2, y - size * 0.3, size * 0.35, 0, Math.PI * 2);
    ctx.arc(x + size * 0.2, y - size * 0.3, size * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Subtle shadow
    ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
    ctx.beginPath();
    ctx.arc(x, y + size * 0.3, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw particle effect
   */
  private drawParticle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color?: string
  ): void {
    ctx.fillStyle = color || '#ffff00';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw default effect representation
   */
  private drawDefault(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color?: string
  ): void {
    ctx.fillStyle = color || '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Clear all effects
   */
  public clear(): void {
    // Reset statistics (Phase 6)
    if (this.layerManager) {
      this.layerManager.updateEffectCount(0, -this.getCount());
    }
    this.effects.clear();
  }

  /**
   * Get effect count
   */
  public getCount(): number {
    return this.effects.size;
  }

  /**
   * Get effects count by layer
   */
  public getCountByLayer(): Map<number, number> {
    const counts = new Map<number, number>();
    for (const effect of this.effects.values()) {
      if (effect.visible) {
        counts.set(effect.layer, (counts.get(effect.layer) || 0) + 1);
      }
    }
    return counts;
  }

  // ==================== Effect Builder API (Phase 5) ====================

  /**
   * Add a cloud effect with simplified API
   */
  public addCloud(options: {
    col: number;
    row: number;
    layer?: number;
    size?: number;
    color?: string;
    alpha?: number;
    offsetY?: number;
    id?: string;
  }): string {
    const id = options.id || `cloud_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.addEffect({
      id,
      type: 'cloud',
      col: options.col,
      row: options.row,
      layer: options.layer ?? 4,
      size: options.size ?? 50,
      color: options.color ?? '#ffffff',
      alpha: options.alpha ?? 0.9,
      offsetY: options.offsetY ?? -50
    });
    return id;
  }

  /**
   * Add multiple cloud effects at once
   */
  public addClouds(count: number, options: {
    layer?: number;
    sizeRange?: [number, number];
    color?: string;
    alpha?: number;
    offsetY?: number;
    mapSize?: number;
  }): string[] {
    const ids: string[] = [];
    const mapSize = options.mapSize ?? 12;
    const sizeRange = options.sizeRange ?? [40, 80];

    for (let i = 0; i < count; i++) {
      const id = this.addCloud({
        col: Math.floor(Math.random() * (mapSize - 2)) + 1,
        row: Math.floor(Math.random() * (mapSize - 2)) + 1,
        layer: options.layer ?? 4,
        size: sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]),
        color: options.color,
        alpha: options.alpha,
        offsetY: options.offsetY
      });
      ids.push(id);
    }

    return ids;
  }

  /**
   * Add a particle emitter effect
   */
  public addParticleEmitter(options: {
    col: number;
    row: number;
    layer?: number;
    count?: number;
    size?: number;
    color?: string;
    spread?: number;
    lifetime?: number;
    offsetY?: number;
  }): string {
    const id = `particle_emitter_${Date.now()}`;
    const count = options.count ?? 10;
    const spread = options.spread ?? 1;

    for (let i = 0; i < count; i++) {
      const particleId = `${id}_particle_${i}`;
      this.addEffect({
        id: particleId,
        type: 'particle',
        col: options.col + (Math.random() - 0.5) * spread,
        row: options.row + (Math.random() - 0.5) * spread,
        layer: options.layer ?? 4,
        size: options.size ?? 10,
        color: options.color ?? '#ffff00',
        alpha: 0.8,
        offsetY: options.offsetY ?? -20,
        lifetime: options.lifetime ?? 2000
      });
    }

    return id;
  }

  /**
   * Remove all effects of a specific type
   */
  public removeByType(type: string): void {
    for (const [id, effect] of this.effects.entries()) {
      if (effect.type === type) {
        this.effects.delete(id);
      }
    }
  }

  /**
   * Remove all effects in a specific layer
   */
  public removeByLayer(layer: number): void {
    for (const [id, effect] of this.effects.entries()) {
      if (effect.layer === layer) {
        this.effects.delete(id);
      }
    }
  }
}

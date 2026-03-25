/**
 * CameraController - High-level camera control with auto-follow and parallax support
 * 
 * Simplifies camera follow logic by automatically calculating parallax factors
 * from entity depth and LayerManager configuration.
 */

import { IsoCamera } from '../core/IsoCamera';
import { Projection } from '../core/Projection';
import { GridSystem } from '../world/GridSystem';
import { EntityManager } from '../world/EntityManager';
import { Entity } from '../core/types';

export interface CameraFollowConfig {
  /** Entity ID to follow */
  entityId: string;
  /** Smoothness factor (0 = instant, 0.1 = 10% interpolation per frame) */
  smoothness?: number;
  /** Enable automatic parallax calculation based on entity depth */
  autoParallax?: boolean;
  /** Manual parallax factor (overrides autoParallax) */
  parallaxFactor?: number;
  /** Vertical offset in pixels */
  offsetY?: number;
  /** Horizontal offset in pixels */
  offsetX?: number;
}

export interface CameraControllerConfig {
  camera: IsoCamera;
  projection: Projection;
  gridSystem: GridSystem;
  entityManager: EntityManager;
  layerCount?: number;
  maxDepth?: number;
  parallaxRange?: number;
  baseParallax?: number;
}

export class CameraController {
  private camera: IsoCamera;
  private projection: Projection;
  private gridSystem: GridSystem;
  private entityManager: EntityManager;
  
  // Configuration
  private layerCount: number;
  private maxDepth: number;
  private parallaxRange: number;
  private baseParallax: number;
  
  // Follow state
  private followConfig: CameraFollowConfig | null = null;
  private isFollowing: boolean = false;

  constructor(config: CameraControllerConfig) {
    this.camera = config.camera;
    this.projection = config.projection;
    this.gridSystem = config.gridSystem;
    this.entityManager = config.entityManager;
    
    // Layer configuration with defaults
    this.layerCount = config.layerCount ?? 5;
    this.maxDepth = config.maxDepth ?? 2000;
    this.parallaxRange = config.parallaxRange ?? 0.7;
    this.baseParallax = config.baseParallax ?? 0.3;
  }

  /**
   * Start following an entity with automatic parallax calculation
   * 
   * @param config - Follow configuration
   * 
   * @example
   * cameraController.follow({
   *   entityId: 'player',
   *   smoothness: 0.1,
   *   autoParallax: true
   * });
   */
  public follow(config: CameraFollowConfig): void {
    this.followConfig = config;
    this.isFollowing = true;
  }

  /**
   * Stop following the current entity
   */
  public stopFollowing(): void {
    this.isFollowing = false;
    this.followConfig = null;
    this.camera.stopFollowing();
  }

  /**
   * Update camera follow (call every frame)
   * Automatically calculates parallax factor if autoParallax is enabled
   */
  public update(): void {
    if (!this.isFollowing || !this.followConfig) return;

    const entity = this.entityManager.getEntity(this.followConfig.entityId);
    if (!entity) return;

    // Calculate parallax factor
    let parallaxFactor = this.followConfig.parallaxFactor;
    
    if (this.followConfig.autoParallax !== false) {
      // Auto-calculate parallax based on entity depth
      parallaxFactor = this.calculateParallaxForEntity(entity);
    }

    // Get world position
    const worldPos = this.gridSystem.gridToWorld(entity.col, entity.row);
    
    // Update camera follow - use smoothness 0 for first frame to snap to position
    const smoothness = this.camera.isFollowing() ? (this.followConfig.smoothness ?? 0) : 0;
    
    this.camera.follow(
      worldPos.x,
      worldPos.z, // worldY (depth in isometric - corresponds to row)
      0, // worldZ (ground level height)
      this.projection,
      {
        smoothness,
        parallaxFactor,
        offsetX: this.followConfig.offsetX ?? 0,
        offsetY: this.followConfig.offsetY ?? 0
      }
    );
  }

  /**
   * Calculate parallax factor for an entity based on its depth
   * 
   * @param entity - Entity to calculate parallax for
   * @returns Parallax factor (0.3 to 1.0 by default)
   */
  public calculateParallaxForEntity(entity: Entity): number {
    // Calculate entity depth (col + row for isometric)
    const depth = entity.col + entity.row;
    
    // Calculate which layer this entity belongs to
    const layerIndex = Math.floor((depth / this.maxDepth) * this.layerCount);
    const clampedLayer = Math.max(0, Math.min(this.layerCount - 1, layerIndex));
    
    // Calculate parallax factor for this layer
    // Layer 0 (background) = baseParallax, Layer N-1 (foreground) = baseParallax + parallaxRange
    return this.baseParallax + (clampedLayer / (this.layerCount - 1)) * this.parallaxRange;
  }

  /**
   * Instant center on an entity (no smoothing)
   */
  public centerOnEntity(entityId: string): void {
    const entity = this.entityManager.getEntity(entityId);
    if (!entity) return;

    const worldPos = this.gridSystem.gridToWorld(entity.col, entity.row);
    const parallaxFactor = this.calculateParallaxForEntity(entity);
    
    this.camera.setPosition(worldPos.x, 0, this.projection);
  }

  /**
   * Get current follow target entity ID
   */
  public getFollowTarget(): string | null {
    return this.followConfig?.entityId ?? null;
  }

  /**
   * Check if camera is currently following an entity
   */
  public isFollowingEntity(): boolean {
    return this.isFollowing && this.followConfig !== null;
  }

  /**
   * Update layer configuration (call when layer settings change)
   */
  public updateLayerConfig(config: {
    layerCount?: number;
    maxDepth?: number;
    parallaxRange?: number;
    baseParallax?: number;
  }): void {
    if (config.layerCount !== undefined) this.layerCount = config.layerCount;
    if (config.maxDepth !== undefined) this.maxDepth = config.maxDepth;
    if (config.parallaxRange !== undefined) this.parallaxRange = config.parallaxRange;
    if (config.baseParallax !== undefined) this.baseParallax = config.baseParallax;
  }
}

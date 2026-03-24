/**
 * OcclusionSystem - Pre-calculates and manages tile occlusion
 * Automatically handles transparency for entities in occluded tiles
 */

import { GridSystem } from './GridSystem';
import { EntityManager } from './EntityManager';

export interface OcclusionConfig {
  enabled?: boolean;
  occludedAlpha?: number;      // Alpha for occluded entities (default 0.5)
  normalAlpha?: number;        // Alpha for visible entities (default 1.0)
  checkHeight?: boolean;       // Check if entity is tall enough to occlude (default true)
  minHeight?: number;          // Minimum height to cause occlusion (default 50)
}

export interface OcclusionData {
  isOccluded: boolean;         // Is this tile occluded by a tall object?
  occluderHeight: number;      // Height of the occluding object
}

export class OcclusionSystem {
  private gridSystem: GridSystem;
  private entityManager: EntityManager;
  private enabled: boolean;
  private occludedAlpha: number;
  private normalAlpha: number;
  private checkHeight: boolean;
  private minHeight: number;
  
  // Occlusion cache: key = "col,row", value = OcclusionData
  private occlusionMap: Map<string, OcclusionData> = new Map();
  private dirty: boolean = true;

  constructor(
    gridSystem: GridSystem,
    entityManager: EntityManager,
    config?: OcclusionConfig
  ) {
    this.gridSystem = gridSystem;
    this.entityManager = entityManager;
    this.enabled = config?.enabled ?? true;
    this.occludedAlpha = config?.occludedAlpha ?? 0.5;
    this.normalAlpha = config?.normalAlpha ?? 1.0;
    this.checkHeight = config?.checkHeight ?? true;
    this.minHeight = config?.minHeight ?? 50;
  }

  /**
   * Enable/disable occlusion system
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.markDirty();
    }
  }

  /**
   * Check if occlusion system is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Mark occlusion cache as dirty (needs recalculation)
   */
  public markDirty(): void {
    this.dirty = true;
  }

  /**
   * Get occlusion data for a tile
   */
  public getOcclusion(col: number, row: number): OcclusionData {
    // Recalculate if dirty
    if (this.dirty) {
      this.calculateOcclusion();
    }
    
    const key = `${col},${row}`;
    return this.occlusionMap.get(key) || { isOccluded: false, occluderHeight: 0 };
  }

  /**
   * Check if a tile is occluded
   */
  public isTileOccluded(col: number, row: number): boolean {
    return this.getOcclusion(col, row).isOccluded;
  }

  /**
   * Get alpha for an entity based on occlusion
   */
  public getEntityAlpha(entity: any, baseAlpha: number = 1.0): number {
    if (!this.enabled) {
      return baseAlpha;
    }
    
    const occlusion = this.getOcclusion(entity.col, entity.row);
    
    if (occlusion.isOccluded) {
      return this.occludedAlpha * baseAlpha;
    }
    
    return this.normalAlpha * baseAlpha;
  }

  /**
   * Calculate occlusion for all tiles
   * This is called when the occlusion cache is dirty
   */
  public calculateOcclusion(): void {
    this.occlusionMap.clear();
    
    const { width, height } = this.gridSystem.getDimensions();
    
    // Step 1: Identify all occluding entities (tall static objects)
    const occluders: Array<{col: number; row: number; height: number}> = [];
    
    for (const entity of this.entityManager.getAllEntities()) {
      // Check if this entity is tall enough to occlude
      if (this.checkHeight && entity.height < this.minHeight) {
        continue;
      }
      
      // For now, treat all entities as potential occluders
      // In a real game, you might want to mark buildings as "static"
      occluders.push({
        col: entity.col,
        row: entity.row,
        height: entity.height
      });
    }
    
    // Step 2: For each tile, check if it's occluded by any tall object
    // A tile is occluded if there's a tall object "in front" of it (higher depth)
    for (let col = 0; col < width; col++) {
      for (let row = 0; row < height; row++) {
        const tileDepth = col + row;
        let isOccluded = false;
        let occluderHeight = 0;
        
        // Check all potential occluders
        for (const occluder of occluders) {
          const occluderDepth = occluder.col + occluder.row;
          
          // An occluder blocks tiles that are "behind" it (higher depth value)
          // In isometric view, higher (col+row) = further from camera
          if (occluderDepth > tileDepth && occluder.height >= this.minHeight) {
            // Check if occluder is close enough to block this tile
            const depthDiff = occluderDepth - tileDepth;
            
            // Simple heuristic: occluders within 3 tiles can occlude
            if (depthDiff <= 3) {
              isOccluded = true;
              occluderHeight = Math.max(occluderHeight, occluder.height);
            }
          }
        }
        
        const key = `${col},${row}`;
        this.occlusionMap.set(key, {
          isOccluded,
          occluderHeight
        });
      }
    }
    
    this.dirty = false;
  }

  /**
   * Get all occluded tiles
   */
  public getOccludedTiles(): Array<{col: number; row: number; data: OcclusionData}> {
    if (this.dirty) {
      this.calculateOcclusion();
    }
    
    const occluded: Array<{col: number; row: number; data: OcclusionData}> = [];
    
    for (const [key, data] of this.occlusionMap.entries()) {
      if (data.isOccluded) {
        const [col, row] = key.split(',').map(Number);
        occluded.push({ col, row, data });
      }
    }
    
    return occluded;
  }

  /**
   * Get statistics about occlusion
   */
  public getStats(): {
    totalTiles: number;
    occludedTiles: number;
    occlusionRate: number;
  } {
    if (this.dirty) {
      this.calculateOcclusion();
    }
    
    const totalTiles = this.occlusionMap.size;
    const occludedTiles = Array.from(this.occlusionMap.values())
      .filter(d => d.isOccluded).length;
    
    return {
      totalTiles,
      occludedTiles,
      occlusionRate: totalTiles > 0 ? occludedTiles / totalTiles : 0
    };
  }

  /**
   * Clear occlusion cache
   */
  public clear(): void {
    this.occlusionMap.clear();
    this.dirty = true;
  }

  /**
   * Update occlusion system (call when entities move)
   */
  public update(): void {
    // Mark as dirty when called
    // Actual calculation happens on-demand
    this.markDirty();
  }
}

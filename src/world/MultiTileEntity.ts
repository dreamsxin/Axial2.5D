/**
 * MultiTileEntity - Automatic splitting of multi-tile entities for correct depth sorting
 * 
 * Problem:
 * - Buildings can span multiple tiles (e.g., 80x80 world units on 50x50 grid)
 * - Single depth value causes incorrect occlusion sorting
 * - Different parts of the building should have different depths
 * 
 * Solution:
 * - Automatically split multi-tile entities into render units
 * - Each tile gets its own depth calculation
 * - Logical entity remains unified (application layer unaware)
 * 
 * Usage:
 * ```typescript
 * // Application layer - no changes needed!
 * game.entityManager.addEntity({
 *   id: 'building',
 *   col: 3, row: 3,
 *   width: 100, length: 100,  // Spans multiple tiles
 *   height: 80
 * });
 * 
 * // Framework automatically splits into render units
 * // Each unit has correct depth for its position
 * ```
 */

import { Entity } from '../core/types';
import { GridSystem } from './GridSystem';

export interface MultiTileRenderUnit {
  /** Parent entity ID */
  entityId: string;
  /** Grid position of this unit */
  col: number;
  row: number;
  /** Depth for sorting */
  depth: number;
  /** World position offset within entity */
  offsetX: number;
  offsetZ: number;
  /** Unit dimensions */
  width: number;
  length: number;
  height: number;
  /** Entity colors (same for all units) */
  colors?: string[];
}

export interface MultiTileEntityConfig {
  /** Enable auto-splitting (default: true) */
  enabled?: boolean;
  /** Tile size for splitting calculation */
  tileSize?: number;
}

export class MultiTileEntity {
  private tileSize: number;
  private enabled: boolean;

  constructor(config?: MultiTileEntityConfig) {
    this.tileSize = config?.tileSize ?? 50;
    this.enabled = config?.enabled ?? true;
  }

  /**
   * Check if an entity spans multiple tiles
   */
  public isMultiTile(entity: Entity): boolean {
    if (!this.enabled) return false;
    
    const tilesWide = Math.ceil(entity.width / this.tileSize);
    const tilesLong = Math.ceil(entity.length / this.tileSize);
    
    return tilesWide > 1 || tilesLong > 1;
  }

  /**
   * Split a multi-tile entity into render units
   * Each unit represents one tile of the building
   */
  public splitEntity(entity: Entity, gridSystem: GridSystem): MultiTileRenderUnit[] {
    if (!this.isMultiTile(entity)) {
      // Single tile entity - return as-is
      const depth = this.calculateUnitDepth(entity.col, entity.row, entity, gridSystem);
      return [{
        entityId: entity.id,
        col: entity.col,
        row: entity.row,
        depth,
        offsetX: 0,
        offsetZ: 0,
        width: entity.width,
        length: entity.length,
        height: entity.height,
        colors: entity.colors
      }];
    }

    // Multi-tile entity - split into units
    const units: MultiTileRenderUnit[] = [];
    const tilesWide = Math.ceil(entity.width / this.tileSize);
    const tilesLong = Math.ceil(entity.length / this.tileSize);

    for (let tCol = 0; tCol < tilesWide; tCol++) {
      for (let tRow = 0; tRow < tilesLong; tRow++) {
        // Calculate grid position for this unit
        const unitCol = entity.col + tCol;
        const unitRow = entity.row + tRow;

        // Calculate world offset for this unit
        const offsetX = tCol * this.tileSize;
        const offsetZ = tRow * this.tileSize;

        // Calculate depth for this specific unit
        const depth = this.calculateUnitDepth(unitCol, unitRow, entity, gridSystem);

        units.push({
          entityId: entity.id,
          col: unitCol,
          row: unitRow,
          depth,
          offsetX,
          offsetZ,
          width: Math.min(this.tileSize, entity.width - offsetX),
          length: Math.min(this.tileSize, entity.length - offsetZ),
          height: entity.height,
          colors: entity.colors
        });
      }
    }

    return units;
  }

  /**
   * Calculate depth for a specific unit
   * Uses the unit's grid position for accurate depth sorting
   */
  private calculateUnitDepth(
    col: number,
    row: number,
    entity: Entity,
    gridSystem: GridSystem
  ): number {
    // Convert grid position to world position
    const worldPos = gridSystem.gridToWorld(col, row);
    
    // Calculate screen Y position (depth)
    // Use entity height for correct occlusion (matches standalone.html)
    const projection = gridSystem.getProjection();
    const camera = gridSystem.getCamera();
    
    if (!projection || !camera) {
      // Fallback to simple depth calculation
      return col + row;
    }

    const screenPos = projection.worldToScreen(
      worldPos.x,
      worldPos.z,
      0, // Base at ground level
      camera
    );

    // Depth = screen Y + entity height (for correct occlusion)
    return screenPos.sy + entity.height;
  }

  /**
   * Get all render units for an entity from cache
   * (To be used with EntityManager caching)
   */
  public getCachedUnits(entityId: string): MultiTileRenderUnit[] | null {
    // Cache will be managed by EntityManager
    return null;
  }

  /**
   * Clear cached units for an entity
   */
  public invalidateCache(entityId: string): void {
    // Cache will be managed by EntityManager
  }

  /**
   * Clear all cached units
   */
  public invalidateAllCache(): void {
    // Cache will be managed by EntityManager
  }
}

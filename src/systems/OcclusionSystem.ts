/**
 * OcclusionSystem - Manages occlusion relationships between buildings and characters
 * 
 * Automatically calculates which tiles are occluded by buildings based on:
 * - Building height and footprint
 * - View direction (isometric: camera at southeast, looking northwest)
 * - Occlusion shadow casting
 * - Southeast corner position for fine-grained depth sorting
 * 
 * Features:
 * - Pre-computed occlusion map (efficient runtime queries)
 * - Multi-building occlusion support (multiple buildings can occlude same tile)
 * - Automatic updates when entities move
 * - Integration with rendering for semi-transparent occluding buildings
 * - Southeast corner depth sorting for correct partial occlusion
 */

import { Entity } from '../core/types';
import { GridSystem } from '../world/GridSystem';
import { EntityManager } from '../world/EntityManager';

export interface OcclusionData {
  buildingId: string;
  height: number;
  southeastCol: number;  // Southeast corner column for depth sorting
  southeastRow: number;  // Southeast corner row for depth sorting
  depth: number;         // Combined depth value (southeastCol + southeastRow)
}

export interface OcclusionSystemConfig {
  entityManager: EntityManager;
  gridSystem: GridSystem;
  tileSize?: number;
  mapWidth?: number;
  mapHeight?: number;
}

export interface OcclusionCallback {
  (entity: Entity, occludingBuildings: OcclusionData[]): void;
}

export class OcclusionSystem {
  private entityManager: EntityManager;
  private gridSystem: GridSystem;
  private tileSize: number;
  private mapWidth: number;
  private mapHeight: number;
  
  // Occlusion map: tile key -> array of occluding buildings
  private occlusionMap: Map<string, OcclusionData[]> = new Map();
  
  // Callbacks for occlusion changes
  private onChangeCallbacks: OcclusionCallback[] = [];
  
  // Track which entities are currently occluded
  private occludedEntities: Map<string, OcclusionData[]> = new Map();

  constructor(config: OcclusionSystemConfig) {
    this.entityManager = config.entityManager;
    this.gridSystem = config.gridSystem;
    this.tileSize = config.tileSize ?? 50;
    
    const mapSize = this.gridSystem.getDimensions();
    this.mapWidth = config.mapWidth ?? mapSize.width;
    this.mapHeight = config.mapHeight ?? mapSize.height;
    
    // Initial calculation
    this.calculateOcclusionMap();
  }

  /**
   * Calculate occlusion map for all tiles
   * Called when entities change or on initialization
   */
  public calculateOcclusionMap(): void {
    this.occlusionMap.clear();

    // Initialize all tiles with empty occlusion array
    for (let c = 0; c < this.mapWidth; c++) {
      for (let r = 0; r < this.mapHeight; r++) {
        this.occlusionMap.set(`${c},${r}`, []);
      }
    }

    // Get all entities
    const allEntities = this.entityManager.getAllEntities();

    // For each building, calculate occlusion
    for (const entity of allEntities) {
      if (entity.height >= 50) { // Only buildings cast shadows
        const width = (entity as any).width || this.tileSize;
        const length = (entity as any).length || this.tileSize;
        this.calculateBuildingOcclusion(
          entity.id,
          entity.col,
          entity.row,
          entity.height,
          width,
          length
        );
      }
    }

    // Notify callbacks about occlusion changes
    this.notifyOcclusionChanges();
  }

  /**
   * Calculate occlusion for a single building
   * Uses southeast corner position for depth sorting
   */
  private calculateBuildingOcclusion(
    buildingId: string,
    buildingCol: number,
    buildingRow: number,
    buildingHeight: number,
    buildingWidth: number,
    buildingLength: number
  ): void {
    const colsOccupied = Math.ceil(buildingWidth / this.tileSize);
    const rowsOccupied = Math.ceil(buildingLength / this.tileSize);
    const occlusionSteps = Math.floor(buildingHeight / this.tileSize);
    
    // Calculate southeast corner position (for depth sorting)
    const southeastCol = buildingCol + colsOccupied - 1;
    const southeastRow = buildingRow + rowsOccupied - 1;
    const depth = southeastCol + southeastRow;

    // For each tile occupied by the building, cast occlusion shadow
    for (let dc = 0; dc < colsOccupied; dc++) {
      for (let dr = 0; dr < rowsOccupied; dr++) {
        const col = buildingCol + dc;
        const row = buildingRow + dr;
        
        if (col >= 0 && col < this.mapWidth && row >= 0 && row < this.mapHeight) {
          const directions = [
            { dc: -1, dr: -1 },  // Northwest
            { dc: -1, dr: 0 },   // West
            { dc: 0, dr: -1 },   // North
          ];

          for (let step = 1; step <= occlusionSteps; step++) {
            for (const dir of directions) {
              const shadowCol = col + dir.dc * step;
              const shadowRow = row + dir.dr * step;

              if (shadowCol >= 0 && shadowCol < this.mapWidth && shadowRow >= 0 && shadowRow < this.mapHeight) {
                const shadowKey = `${shadowCol},${shadowRow}`;
                const occlusions = this.occlusionMap.get(shadowKey) || [];

                // Check if this building already occludes this tile
                const existing = occlusions.find(o => o.buildingId === buildingId);
                if (!existing) {
                  occlusions.push({ 
                    buildingId, 
                    height: buildingHeight,
                    southeastCol,
                    southeastRow,
                    depth
                  });
                  this.occlusionMap.set(shadowKey, occlusions);
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Check if an entity is occluded by any building
   */
  public isOccluded(entity: Entity): boolean {
    const occlusions = this.getOccludingBuildings(entity);
    return occlusions.some(occ => occ.height > entity.height);
  }

  /**
   * Get all buildings that occlude an entity
   */
  public getOccludingBuildings(entity: Entity): OcclusionData[] {
    const key = `${entity.col},${entity.row}`;
    return this.occlusionMap.get(key) || [];
  }

  /**
   * Get occlusion factor for an entity (0 = fully occluded, 1 = not occluded)
   */
  public getOcclusionFactor(entity: Entity): number {
    const occlusions = this.getOccludingBuildings(entity);
    
    if (occlusions.length === 0) return 1.0;
    
    // Find the tallest occluding building
    const maxOcclusionHeight = Math.max(...occlusions.map(o => o.height));
    
    if (maxOcclusionHeight <= entity.height) return 1.0;
    
    // Calculate factor based on height difference
    const heightDiff = maxOcclusionHeight - entity.height;
    const maxDiff = 100; // Max height difference for full occlusion
    
    const occlusionFactor = Math.min(1.0, heightDiff / maxDiff);
    return 1.0 - (occlusionFactor * 0.7); // Range: 0.3 to 1.0
  }

  /**
   * Get all entities that are currently occluded
   */
  public getOccludedEntities(): Entity[] {
    const allEntities = this.entityManager.getAllEntities();
    return allEntities.filter(e => e.height < 50 && this.isOccluded(e));
  }

  /**
   * Register callback for occlusion changes
   */
  public onOcclusionChange(callback: OcclusionCallback): void {
    this.onChangeCallbacks.push(callback);
  }

  /**
   * Unregister callback for occlusion changes
   */
  public offOcclusionChange(callback: OcclusionCallback): void {
    const index = this.onChangeCallbacks.indexOf(callback);
    if (index > -1) {
      this.onChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify callbacks about occlusion changes
   */
  private notifyOcclusionChanges(): void {
    const allEntities = this.entityManager.getAllEntities();
    
    for (const entity of allEntities) {
      if (entity.height >= 50) continue; // Only characters
      
      const occlusions = this.getOccludingBuildings(entity);
      const wasOccluded = this.occludedEntities.has(entity.id);
      const isOccluded = occlusions.some(occ => occ.height > entity.height);
      
      // Notify if occlusion state changed
      if (wasOccluded !== isOccluded || occlusions.length > 0) {
        if (isOccluded) {
          this.occludedEntities.set(entity.id, occlusions);
        } else {
          this.occludedEntities.delete(entity.id);
        }
        
        for (const callback of this.onChangeCallbacks) {
          callback(entity, occlusions);
        }
      }
    }
  }

  /**
   * Update occlusion system (call when entities move)
   */
  public update(): void {
    this.calculateOcclusionMap();
  }

  /**
   * Get occlusion map data (for debugging)
   */
  public getDebugData(): Map<string, OcclusionData[]> {
    return new Map(this.occlusionMap);
  }

  /**
   * Clear occlusion map
   */
  public clear(): void {
    this.occlusionMap.clear();
    this.occludedEntities.clear();
  }
}

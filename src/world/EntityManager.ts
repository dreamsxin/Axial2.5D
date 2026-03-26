/**
 * EntityManager - Manages all game entities (characters, buildings, items)
 * 
 * Phase 6: 
 * - Integrated with LayerManager for automatic statistics tracking
 * - Auto-splitting multi-tile entities for correct depth sorting
 */

import { Projection } from '../core/Projection';
import { IsoCamera } from '../core/IsoCamera';
import { GridSystem } from './GridSystem';
import { Entity, RenderItem, GridCoord } from '../core/types';
import { LayerManager } from '../core/LayerManager';
import { MultiTileEntity, MultiTileRenderUnit } from './MultiTileEntity';

export class EntityManager {
  private entities: Map<string, Entity> = new Map();
  private gridSystem: GridSystem;
  private projection: Projection;
  private camera: IsoCamera;
  private layerManager?: LayerManager;  // For statistics tracking (Phase 6)
  private multiTileSplitter?: MultiTileEntity;  // For auto-splitting (Phase 6)
  
  // Cache for split render units
  private renderUnitsCache: Map<string, MultiTileRenderUnit[]> = new Map();

  constructor(
    gridSystem: GridSystem,
    projection: Projection,
    camera: IsoCamera,
    layerManager?: LayerManager,
    tileSize?: number
  ) {
    this.gridSystem = gridSystem;
    this.projection = projection;
    this.camera = camera;
    this.layerManager = layerManager;
    
    // Initialize multi-tile entity splitter (Phase 6)
    this.multiTileSplitter = new MultiTileEntity({
      enabled: true,
      tileSize: tileSize ?? 50
    });
  }

  /**
   * Set layer manager for statistics tracking (Phase 6)
   */
  public setLayerManager(layerManager: LayerManager): void {
    this.layerManager = layerManager;
  }

  /**
   * Normalise a plain-object entity so it always has the Entity helper methods
   * (isBuilding, isCharacter).  Plain JS objects are structurally compatible with
   * the Entity interface but lack its prototype methods.  When entityType is not
   * set we fall back to the legacy height>=50 heuristic so existing demo code
   * continues to work without change.
   */
  private normaliseEntity(entity: Entity): Entity {
    if (typeof (entity as any).isBuilding !== 'function') {
      const e = entity as any;
      // Auto-detect entityType from height when not explicitly set
      if (!e.entityType) {
        e.entityType = e.height >= 50 ? 'building' : 'character';
      }
      e.isBuilding  = function() { return this.entityType === 'building'; };
      e.isCharacter = function() { return this.entityType === 'character'; };
    }
    return entity;
  }

  /**
   * Add an entity to the manager
   */
  public addEntity(entity: Entity): void {
    if (this.entities.has(entity.id)) {
      console.warn(`Entity with id "${entity.id}" already exists`);
      return;
    }

    // Ensure plain-object entities have the required helper methods
    entity = this.normaliseEntity(entity);
    
    this.entities.set(entity.id, entity);
    this.syncEntityPosition(entity);
    
    // Auto-split multi-tile entity and cache render units (Phase 6)
    if (this.multiTileSplitter) {
      const units = this.multiTileSplitter.splitEntity(entity, this.gridSystem, this.projection);
      this.renderUnitsCache.set(entity.id, units);
      
      // Update statistics for each unit (Phase 6)
      if (this.layerManager) {
        for (const unit of units) {
          this.layerManager.updateEntityCount(unit.col, unit.row, 1);
        }
      }
    } else {
      // Fallback for single-tile entities
      if (this.layerManager) {
        this.layerManager.updateEntityCount(entity.col, entity.row, 1);
      }
    }
  }

  /**
   * Remove an entity from the manager
   */
  public removeEntity(id: string): void {
    const entity = this.entities.get(id);
    if (entity) {
      const cachedUnits = this.renderUnitsCache.get(id);

      if (cachedUnits) {
        // Multi-tile entity: clear grid occupancy for EVERY occupied tile, not just the anchor
        const clearedKeys = new Set<string>();
        for (const unit of cachedUnits) {
          const key = `${unit.col},${unit.row}`;
          if (!clearedKeys.has(key)) {
            this.gridSystem.setEntity(unit.col, unit.row, null);
            clearedKeys.add(key);
          }
        }

        // Update statistics (Phase 6)
        if (this.layerManager) {
          for (const unit of cachedUnits) {
            this.layerManager.updateEntityCount(unit.col, unit.row, -1);
          }
        }
      } else {
        // Single-tile entity (no cached units)
        this.gridSystem.setEntity(entity.col, entity.row, null);
        if (this.layerManager) {
          this.layerManager.updateEntityCount(entity.col, entity.row, -1);
        }
      }

      // Clear cache and remove entity
      this.renderUnitsCache.delete(id);
      this.entities.delete(id);
    }
  }

  /**
   * Get render units for an entity (auto-split if multi-tile)
   */
  public getRenderUnits(entityId: string): MultiTileRenderUnit[] | null {
    return this.renderUnitsCache.get(entityId) || null;
  }

  /**
   * Get all render units for all entities (for rendering)
   */
  public getAllRenderUnits(): MultiTileRenderUnit[] {
    const allUnits: MultiTileRenderUnit[] = [];
    
    for (const [entityId, units] of this.renderUnitsCache.entries()) {
      // Check if parent entity is visible
      const entity = this.entities.get(entityId);
      if (entity?.visible !== false) {
        allUnits.push(...units);
      }
    }
    
    // Sort by depth for correct rendering order
    allUnits.sort((a, b) => a.depth - b.depth);
    
    return allUnits;
  }

  /**
   * Invalidate render units cache for an entity
   * Call this when entity moves or changes
   */
  public invalidateRenderUnits(entityId: string): void {
    const entity = this.entities.get(entityId);
    if (entity && this.multiTileSplitter) {
      const units = this.multiTileSplitter.splitEntity(entity, this.gridSystem, this.projection);
      this.renderUnitsCache.set(entityId, units);
    }
  }

  /**
   * Invalidate all render units cache
   */
  public invalidateAllRenderUnits(): void {
    this.renderUnitsCache.clear();
    
    for (const entity of this.entities.values()) {
      if (this.multiTileSplitter) {
        const units = this.multiTileSplitter.splitEntity(entity, this.gridSystem, this.projection);
        this.renderUnitsCache.set(entity.id, units);
      }
    }
  }

  /**
   * Get an entity by ID
   */
  public getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  /**
   * Get all entities at a grid position.
   *
   * For single-tile entities this is a simple anchor-point comparison.
   * For multi-tile entities (buildings that span several tiles) we also
   * check every render unit in the cache so that clicking on any part of
   * a large building correctly returns its parent entity.
   */
  public getEntitiesAt(col: number, row: number): Entity[] {
    const result: Entity[] = [];
    const seen = new Set<string>();

    for (const entity of this.entities.values()) {
      if (seen.has(entity.id)) continue;

      // Fast path: anchor tile matches
      if (entity.col === col && entity.row === row) {
        result.push(entity);
        seen.add(entity.id);
        continue;
      }

      // Slow path: check all render units (handles multi-tile buildings)
      const units = this.renderUnitsCache.get(entity.id);
      if (units) {
        for (const unit of units) {
          if (unit.col === col && unit.row === row) {
            result.push(entity);
            seen.add(entity.id);
            break;
          }
        }
      }
    }

    return result;
  }

  /**
   * Get all entities
   */
  public getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Get player entity (by convention, id = 'player')
   */
  public getPlayer(): Entity | undefined {
    return this.entities.get('player');
  }

  /**
   * Sync entity position with grid system
   */
  public syncEntityPosition(entity: Entity): void {
    // Update grid occupancy
    this.gridSystem.setEntity(entity.col, entity.row, entity);
  }

  /**
   * Move an entity to a new position
   */
  public moveEntity(entity: Entity, newCol: number, newRow: number): boolean {
    const oldCol = entity.col;
    const oldRow = entity.row;

    // Check if target is walkable
    if (!this.gridSystem.isWalkable(newCol, newRow, entity)) {
      return false;
    }

    // Clear old position
    this.gridSystem.setEntity(oldCol, oldRow, null);
    
    // Update entity position
    entity.col = newCol;
    entity.row = newRow;
    
    // Set new occupancy
    this.gridSystem.setEntity(newCol, newRow, entity);
    
    return true;
  }

  /**
   * Update all entities and recalculate depths
   * Depth is calculated as: screen Y of entity's base (feet) + entity height
   * This ensures correct sorting for isometric rendering
   */
  public updateAll(delta: number = 16): void {
    for (const entity of this.entities.values()) {
      const isDynamic = typeof (entity as any).isCharacter === 'function'
        ? (entity as any).isCharacter()
        : (entity as any).entityType === 'character';

      if (entity.update) {
        entity.update(delta);
      }

      // Static buildings never move – their depth and renderUnits are set once at addEntity time.
      // Only recalculate for dynamic entities (characters) that may have moved this frame.
      if (!isDynamic && !entity.update) continue;
      
      // Recalculate depth based on projection
      // Match standalone.html: depth = screenY(base) + height
      const worldPos = this.gridSystem.gridToWorld(entity.col, entity.row);
      const baseScreenPos = this.projection.worldToScreen(worldPos.x, worldPos.z, 0);
      entity.depth = baseScreenPos.sy + entity.height;

      // Sync renderUnitsCache depths to match the updated entity position.
      // Without this, cached units keep stale depths when an entity moves.
      const cachedUnits = this.renderUnitsCache.get(entity.id);
      if (cachedUnits && this.multiTileSplitter) {
        const freshUnits = this.multiTileSplitter.splitEntity(entity, this.gridSystem, this.projection);
        // Update depth on each cached unit in-place (avoids full cache replacement when not needed)
        for (let i = 0; i < cachedUnits.length && i < freshUnits.length; i++) {
          cachedUnits[i].depth = freshUnits[i].depth;
          cachedUnits[i].col   = freshUnits[i].col;
          cachedUnits[i].row   = freshUnits[i].row;
        }
        // If unit count changed (shouldn't happen during normal movement), replace entirely
        if (freshUnits.length !== cachedUnits.length) {
          this.renderUnitsCache.set(entity.id, freshUnits);
        }
      }
    }
  }

  /**
   * Get all entities as render items
   */
  public getRenderItems(): RenderItem[] {
    const items: RenderItem[] = [];
    for (const entity of this.entities.values()) {
      if (entity.visible) {
        items.push(entity);
      }
    }
    return items;
  }

  /**
   * Find entity at screen position (returns topmost entity)
   */
  public getEntityAtScreenPosition(
    screenX: number,
    screenY: number,
    tolerance: number = 10
  ): Entity | undefined {
    const hits: Entity[] = [];

    for (const entity of this.entities.values()) {
      const worldPos = this.gridSystem.gridToWorld(entity.col, entity.row);
      const screenPos = this.projection.worldToScreen(worldPos.x, worldPos.z, 0);
      
      // Simple distance check
      const dx = screenX - screenPos.sx;
      const dy = screenY - screenPos.sy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < tolerance) {
        hits.push(entity);
      }
    }

    // Return topmost (highest depth)
    if (hits.length > 0) {
      hits.sort((a, b) => b.depth - a.depth);
      return hits[0];
    }

    return undefined;
  }

  /**
   * Get entity count
   */
  public getCount(): number {
    return this.entities.size;
  }

  /**
   * Clear all entities
   */
  public clear(): void {
    for (const entity of this.entities.values()) {
      this.gridSystem.setEntity(entity.col, entity.row, null);
    }
    this.entities.clear();
    // Also clear the render-unit cache so no stale references to removed entities remain
    this.renderUnitsCache.clear();
  }

  /**
   * Render entities with optional occlusion handling
   * 
   * Occlusion logic (when occlusionSystem is provided):
   * - Characters in occluded tiles are drawn FIRST (opaque)
   * - Buildings that occlude characters are drawn SEMI-TRANSPARENT on top
   * - This ensures characters are visible through buildings
   * 
   * If occlusionSystem is NOT provided, uses legacy internal occlusion map
   */
  public render(
    ctx: CanvasRenderingContext2D,
    options?: {
      layerIndex?: number;
      layerCount?: number;
      maxDepth?: number;
      parallaxFactor?: number;
      wireframe?: boolean;
      occlusionSystem?: any; // OcclusionSystem from systems/OcclusionSystem
    }
  ): void {
    const layerIndex = options?.layerIndex;
    const layerCount = options?.layerCount ?? 5;
    const maxDepth = options?.maxDepth ?? 2000;
    const parallaxFactor = options?.parallaxFactor ?? 1.0;
    const wireframe = options?.wireframe ?? false;
    const occlusionSystem = options?.occlusionSystem;

    ctx.save();

    // Get all entities
    const allEntities = this.getAllEntities().filter(e => e.visible !== false);
    
    // Filter by layer if specified
    const layerEntities = allEntities.filter(e => {
      if (layerIndex !== undefined) {
        const depth = e.col + e.row;
        const entityLayer = Math.floor((depth / maxDepth) * layerCount);
        return entityLayer === layerIndex;
      }
      return true;
    });

    // Use provided OcclusionSystem or calculate internal occlusion map
    if (occlusionSystem) {
      // Use OcclusionSystem for occlusion queries
      this.renderWithOcclusionSystem(ctx, layerEntities, parallaxFactor, wireframe, occlusionSystem);
    } else {
      // Legacy: calculate internal occlusion map
      const tileSize = this.gridSystem.getTileSize().width;
      const mapSize = this.gridSystem.getDimensions();
      this.calculateOcclusionMap(layerEntities, tileSize, mapSize.width, mapSize.height);
      this.renderWithInternalOcclusion(ctx, layerEntities, parallaxFactor, wireframe);
    }

    ctx.restore();
  }

  /**
   * Render using OcclusionSystem (Phase 2)
   * Uses southeast corner depth for fine-grained sorting
   */
  private renderWithOcclusionSystem(
    ctx: CanvasRenderingContext2D,
    entities: Entity[],
    parallaxFactor: number,
    wireframe: boolean,
    occlusionSystem: any
  ): void {
    // Determine which buildings should be semi-transparent
    const semiTransparentBuildings = new Set<string>();
    
    for (const char of entities) {
      if (char.isBuilding()) continue; // Skip buildings
      
      if (occlusionSystem.isOccluded(char)) {
        const occlusions = occlusionSystem.getOccludingBuildings(char);
        for (const occ of occlusions) {
          if (occ.height > char.height) {
            semiTransparentBuildings.add(occ.buildingId);
          }
        }
      }
    }

    // Two-pass rendering for correct occlusion visuals:
    //
    // The occlusion effect requires a semi-transparent building to be drawn ON TOP
    // of the character it occludes – regardless of which side (W, N, NW) the
    // character is on relative to the building.  A single depth-sorted pass cannot
    // achieve this for all directions (e.g. player at W of building has a smaller
    // depth than the building's NW anchor, so a unified sort would draw the building
    // first and the character on top, which is backwards for the occlusion visual).
    //
    // Solution – split into two passes:
    //   Pass 1: Draw all NON-semi-transparent buildings + all characters, sorted by
    //           NW-anchor depth (back to front).  Semi-transparent buildings are
    //           skipped here so they do not occlude characters that share the same
    //           depth bucket.
    //   Pass 2: Draw all semi-transparent buildings on top (sorted by SE-corner depth
    //           among themselves so they don't incorrectly overlap each other).
    //           Being drawn last guarantees they visually overlay the character.
    //
    // tileSize assumed 50 (matches multiTileSplitter default)
    const TILE = 50;

    // Depth comparator used for Pass 1 (SE corner for buildings, NW anchor for characters)
    // Using SE corner for buildings ensures correct visual depth sorting for multi-tile structures
    const depthBySE = (a: Entity, b: Entity) => {
      const aIsBuilding = a.isBuilding();
      const bIsBuilding = b.isBuilding();
      
      // Calculate SE corner depth for buildings, NW anchor for characters
      const aDepth = aIsBuilding
        ? (a.col + Math.ceil(((a as any).width || TILE) / TILE) - 1)
          + (a.row + Math.ceil(((a as any).length || TILE) / TILE) - 1)
        : a.col + a.row;
      const bDepth = bIsBuilding
        ? (b.col + Math.ceil(((b as any).width || TILE) / TILE) - 1)
          + (b.row + Math.ceil(((b as any).length || TILE) / TILE) - 1)
        : b.col + b.row;
      
      if (aDepth !== bDepth) return aDepth - bDepth;
      
      // Tie: buildings before characters (character visually "stands on" the tile)
      if (aIsBuilding !== bIsBuilding) return aIsBuilding ? -1 : 1;
      if (a.row !== b.row) return b.row - a.row;
      return b.col - a.col;
    };

    // Depth comparator for semi-transparent buildings among themselves (SE corner)
    const depthBySE = (a: Entity, b: Entity) => {
      const aSE = (a.col + Math.ceil(((a as any).width || TILE) / TILE) - 1)
                + (a.row + Math.ceil(((a as any).length || TILE) / TILE) - 1);
      const bSE = (b.col + Math.ceil(((b as any).width || TILE) / TILE) - 1)
                + (b.row + Math.ceil(((b as any).length || TILE) / TILE) - 1);
      return aSE - bSE;
    };

    // Partition entities
    const pass1: Entity[] = [];
    const pass2: Entity[] = []; // semi-transparent occluding buildings

    for (const entity of entities) {
      if (entity.isBuilding() && semiTransparentBuildings.has(entity.id)) {
        pass2.push(entity);
      } else {
        pass1.push(entity);
      }
    }

    pass1.sort(depthBySE);
    pass2.sort(depthBySE);

    // Pass 1: normal entities (opaque buildings + characters)
    for (const entity of pass1) {
      this.drawEntity(ctx, entity, parallaxFactor, wireframe, 1.0);
    }

    // Pass 2: semi-transparent occluding buildings drawn last (on top of characters)
    for (const entity of pass2) {
      this.drawEntity(ctx, entity, parallaxFactor, wireframe, 0.5);
    }
  }

  /**
   * Render using internal occlusion map (legacy)
   * Single-pass rendering with correct depth sorting by southeast corner
   */
  private renderWithInternalOcclusion(
    ctx: CanvasRenderingContext2D,
    entities: Entity[],
    parallaxFactor: number,
    wireframe: boolean
  ): void {
    // Determine which buildings should be semi-transparent
    const semiTransparentBuildings = new Set<string>();
    for (const char of entities) {
      if (char.isBuilding()) continue;
      
      const key = `${char.col},${char.row}`;
      const occlusions = this.occlusionMap.get(key) || [];
      
      for (const occ of occlusions) {
        if (occ.height > char.height) {
          semiTransparentBuildings.add(occ.buildingId);
        }
      }
    }

    // Two-pass rendering – same strategy as renderWithOcclusionSystem (see comment there)
    const TILE = 50;

    const pass1: Entity[] = [];
    const pass2: Entity[] = [];

    for (const entity of entities) {
      if (entity.isBuilding() && semiTransparentBuildings.has(entity.id)) {
        pass2.push(entity);
      } else {
        pass1.push(entity);
      }
    }

    // Pass 1: SE-corner depth sort for buildings (opaque buildings + characters)
    // Using SE corner for buildings ensures correct visual depth sorting for multi-tile structures
    pass1.sort((a, b) => {
      const TILE = 50;
      const aIsBuilding = a.isBuilding();
      const bIsBuilding = b.isBuilding();
      
      // Calculate SE corner depth for buildings, NW anchor for characters
      const aDepth = aIsBuilding
        ? (a.col + Math.ceil(((a as any).width || TILE) / TILE) - 1)
          + (a.row + Math.ceil(((a as any).length || TILE) / TILE) - 1)
        : a.col + a.row;
      const bDepth = bIsBuilding
        ? (b.col + Math.ceil(((b as any).width || TILE) / TILE) - 1)
          + (b.row + Math.ceil(((b as any).length || TILE) / TILE) - 1)
        : b.col + b.row;
      
      if (aDepth !== bDepth) return aDepth - bDepth;
      
      // Tie: buildings before characters
      if (aIsBuilding !== bIsBuilding) return aIsBuilding ? -1 : 1;
      if (a.row !== b.row) return b.row - a.row;
      return b.col - a.col;
    });

    // Pass 2: SE-corner sort for semi-transparent buildings (drawn last / on top)
    pass2.sort((a, b) => {
      const aSE = (a.col + Math.ceil(((a as any).width || TILE) / TILE) - 1)
                + (a.row + Math.ceil(((a as any).length || TILE) / TILE) - 1);
      const bSE = (b.col + Math.ceil(((b as any).width || TILE) / TILE) - 1)
                + (b.row + Math.ceil(((b as any).length || TILE) / TILE) - 1);
      return aSE - bSE;
    });

    for (const entity of pass1) {
      this.drawEntity(ctx, entity, parallaxFactor, wireframe, 1.0);
    }
    for (const entity of pass2) {
      this.drawEntity(ctx, entity, parallaxFactor, wireframe, 0.5);
    }
  }

  /**
   * Helper to draw a single entity
   */
  private drawEntity(
    ctx: CanvasRenderingContext2D,
    entity: Entity,
    parallaxFactor: number,
    wireframe: boolean,
    alpha: number
  ): void {
    const worldPos = this.gridSystem.gridToWorld(entity.col, entity.row);
    
    ctx.save();
    if (alpha < 1.0) {
      ctx.globalAlpha = alpha;
    }
    
    if (entity.draw) {
      entity.draw(ctx);
    } else {
      this.drawDefaultEntity(ctx, entity, worldPos, parallaxFactor, wireframe);
    }
    
    ctx.restore();
  }

  /**
   * Occlusion map: stores which tiles are occluded and by what buildings
   * Key: "col,row", Value: array of { buildingId, height } - all buildings that occlude this tile
   */
  private occlusionMap: Map<string, Array<{ buildingId: string; height: number }>> = new Map();

  /**
   * Calculate occlusion map for all tiles
   * Algorithm:
   * 1. For each building, calculate its footprint (cols x rows it occupies)
   * 2. Cast occlusion shadow northwest from each occupied tile
   * 3. Mark affected tiles with ALL occluding buildings (supports multiple buildings)
   */
  public calculateOcclusionMap(
    entities: Entity[],
    tileSize: number = 50,
    mapWidth: number = 20,
    mapHeight: number = 20
  ): void {
    this.occlusionMap.clear();

    // Initialize all tiles with empty occlusion array
    for (let c = 0; c < mapWidth; c++) {
      for (let r = 0; r < mapHeight; r++) {
        this.occlusionMap.set(`${c},${r}`, []);
      }
    }

    // For each building, calculate occlusion
    for (const entity of entities) {
      if (entity.isBuilding()) { // Only buildings cast shadows
        const width = (entity as any).width || tileSize;
        const length = (entity as any).length || tileSize;
        this.calculateBuildingOcclusion(
          entity.id,
          entity.col,
          entity.row,
          entity.height,
          width,
          length,
          tileSize,
          mapWidth,
          mapHeight
        );
      }
    }
  }

  /**
   * Calculate occlusion for a single building
   * Coordinate system: origin at northwest, col increases east, row increases south
   * Building at (col,row) extends southeast
   * 
   * Example: Building at (3,9) h=65, w=90, l=90, tileSize=50
   * - Occupies: (3,9), (4,9), (3,10), (4,10) [2x2 grid cells]
   * - Occlusion: casts shadow northwest from each occupied tile
   * - Characters in occluded tiles are drawn FIRST, then building is drawn semi-transparent
   */
  private calculateBuildingOcclusion(
    buildingId: string,
    buildingCol: number,
    buildingRow: number,
    buildingHeight: number,
    buildingWidth: number,
    buildingLength: number,
    tileSize: number,
    mapWidth: number,
    mapHeight: number
  ): void {
    const colsOccupied = Math.ceil(buildingWidth / tileSize);
    const rowsOccupied = Math.ceil(buildingLength / tileSize);
    const occlusionSteps = Math.floor(buildingHeight / tileSize);

    // For each tile occupied by the building, cast occlusion shadow
    for (let dc = 0; dc < colsOccupied; dc++) {
      for (let dr = 0; dr < rowsOccupied; dr++) {
        const col = buildingCol + dc;
        const row = buildingRow + dr;
        
        if (col >= 0 && col < mapWidth && row >= 0 && row < mapHeight) {
          const directions = [
            { dc: -1, dr: -1 },  // Northwest
            { dc: -1, dr: 0 },   // West
            { dc: 0, dr: -1 },   // North
          ];

          for (let step = 1; step <= occlusionSteps; step++) {
            for (const dir of directions) {
              const shadowCol = col + dir.dc * step;
              const shadowRow = row + dir.dr * step;

              if (shadowCol >= 0 && shadowCol < mapWidth && shadowRow >= 0 && shadowRow < mapHeight) {
                const shadowKey = `${shadowCol},${shadowRow}`;
                const occlusions = this.occlusionMap.get(shadowKey) || [];

                // Check if this building already occludes this tile
                const existing = occlusions.find(o => o.buildingId === buildingId);
                if (!existing) {
                  occlusions.push({ buildingId, height: buildingHeight });
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
   * Draw default entity representation (3D box like standalone.html)
   */
  private drawDefaultEntity(
    ctx: CanvasRenderingContext2D,
    entity: Entity,
    worldPos: { x: number; z: number },
    parallaxFactor: number,
    wireframe: boolean
  ): void {
    const w = (entity as any).width || 50;
    const l = (entity as any).length || 50;
    const h = entity.height || 50;
    const baseX = worldPos.x;
    const baseY = worldPos.z;

    // Calculate 8 corners of the box in screen space
    const corners = {
      lbb: this.camera.worldToScreen(baseX, baseY, 0, this.projection, parallaxFactor),
      rbb: this.camera.worldToScreen(baseX + w, baseY, 0, this.projection, parallaxFactor),
      rfb: this.camera.worldToScreen(baseX + w, baseY + l, 0, this.projection, parallaxFactor),
      lfb: this.camera.worldToScreen(baseX, baseY + l, 0, this.projection, parallaxFactor),
      lbt: this.camera.worldToScreen(baseX, baseY, h, this.projection, parallaxFactor),
      rbt: this.camera.worldToScreen(baseX + w, baseY, h, this.projection, parallaxFactor),
      rft: this.camera.worldToScreen(baseX + w, baseY + l, h, this.projection, parallaxFactor),
      lft: this.camera.worldToScreen(baseX, baseY + l, h, this.projection, parallaxFactor)
    };

    // Use entity-specific colors if available, otherwise use default
    const colors = (entity as any).colors || ['#f5deb3', '#deb887', '#cd853f', '#b8860b', '#daa520', '#8b4513'];

    if (!wireframe) {
      // Draw 6 faces
      const faces = [
        [corners.lbb, corners.rbb, corners.rfb, corners.lfb, colors[5]], // bottom
        [corners.lbb, corners.lfb, corners.lft, corners.lbt, colors[4]], // left
        [corners.lbb, corners.rbb, corners.rbt, corners.lbt, colors[3]], // back-right
        [corners.lfb, corners.rfb, corners.rft, corners.lft, colors[2]], // front
        [corners.rbb, corners.rfb, corners.rft, corners.rbt, colors[1]], // right
        [corners.lbt, corners.rbt, corners.rft, corners.lft, colors[0]]  // top
      ];

      for (const face of faces) {
        const [p1, p2, p3, p4, color] = face as any;
        ctx.beginPath();
        ctx.moveTo((p1 as any).sx, (p1 as any).sy);
        ctx.lineTo((p2 as any).sx, (p2 as any).sy);
        ctx.lineTo((p3 as any).sx, (p3 as any).sy);
        ctx.lineTo((p4 as any).sx, (p4 as any).sy);
        ctx.closePath();
        ctx.fillStyle = color as string;
        ctx.fill();
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    } else {
      // Wireframe mode
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      
      // Bottom edges
      ctx.beginPath();
      ctx.moveTo(corners.lbb.sx, corners.lbb.sy);
      ctx.lineTo(corners.rbb.sx, corners.rbb.sy);
      ctx.lineTo(corners.rfb.sx, corners.rfb.sy);
      ctx.lineTo(corners.lfb.sx, corners.lfb.sy);
      ctx.closePath();
      ctx.stroke();
      
      // Top edges
      ctx.beginPath();
      ctx.moveTo(corners.lbt.sx, corners.lbt.sy);
      ctx.lineTo(corners.rbt.sx, corners.rbt.sy);
      ctx.lineTo(corners.rft.sx, corners.rft.sy);
      ctx.lineTo(corners.lft.sx, corners.lft.sy);
      ctx.closePath();
      ctx.stroke();
      
      // Vertical edges
      ctx.beginPath();
      ctx.moveTo(corners.lbb.sx, corners.lbb.sy); ctx.lineTo(corners.lbt.sx, corners.lbt.sy);
      ctx.moveTo(corners.rbb.sx, corners.rbb.sy); ctx.lineTo(corners.rbt.sx, corners.rbt.sy);
      ctx.moveTo(corners.rfb.sx, corners.rfb.sy); ctx.lineTo(corners.rft.sx, corners.rft.sy);
      ctx.moveTo(corners.lfb.sx, corners.lfb.sy); ctx.lineTo(corners.lft.sx, corners.lft.sy);
      ctx.stroke();
    }

    // Draw entity ID above the building
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(entity.id, corners.lft.sx, corners.lft.sy - 15);
  }
}

/**
 * Basic entity implementation for testing
 */
export class BasicEntity extends Entity {
  public color: string;
  public size: number;

  constructor(
    id: string,
    col: number,
    row: number,
    color: string = '#ff6b6b',
    size: number = 20,
    height: number = 30
  ) {
    super(id, col, row, height);
    this.color = color;
    this.size = size;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const x = 0; // Will be transformed by camera
    const y = -this.height;
    
    // Draw a simple box/cylinder to represent the entity
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, y - this.size, this.size, this.size);
    
    // Draw outline
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(-this.size / 2, y - this.size, this.size, this.size);
  }
}

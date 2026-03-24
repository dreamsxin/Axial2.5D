/**
 * EntityManager - Manages all game entities (characters, buildings, items)
 */

import { Projection } from '../core/Projection';
import { IsoCamera } from '../core/IsoCamera';
import { GridSystem } from './GridSystem';
import { Entity, RenderItem, GridCoord } from '../core/types';

export class EntityManager {
  private entities: Map<string, Entity> = new Map();
  private gridSystem: GridSystem;
  private projection: Projection;
  private camera: IsoCamera;

  constructor(gridSystem: GridSystem, projection: Projection, camera: IsoCamera) {
    this.gridSystem = gridSystem;
    this.projection = projection;
    this.camera = camera;
  }

  /**
   * Add an entity to the manager
   */
  public addEntity(entity: Entity): void {
    if (this.entities.has(entity.id)) {
      console.warn(`Entity with id "${entity.id}" already exists`);
      return;
    }
    
    this.entities.set(entity.id, entity);
    this.syncEntityPosition(entity);
  }

  /**
   * Remove an entity from the manager
   */
  public removeEntity(id: string): void {
    const entity = this.entities.get(id);
    if (entity) {
      // Clear occupancy
      this.gridSystem.setEntity(entity.col, entity.row, null);
      this.entities.delete(id);
    }
  }

  /**
   * Get an entity by ID
   */
  public getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  /**
   * Get all entities at a grid position
   */
  public getEntitiesAt(col: number, row: number): Entity[] {
    const result: Entity[] = [];
    for (const entity of this.entities.values()) {
      if (entity.col === col && entity.row === row) {
        result.push(entity);
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
   */
  public updateAll(delta: number = 16): void {
    for (const entity of this.entities.values()) {
      if (entity.update) {
        entity.update(delta);
      }
      
      // Recalculate depth based on projection
      const worldPos = this.gridSystem.gridToWorld(entity.col, entity.row);
      const screenPos = this.projection.worldToScreen(worldPos.x, worldPos.z, entity.height);
      entity.depth = screenPos.sy;
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
  }

  /**
   * Render entities for a specific layer
   * @param ctx - Canvas rendering context
   * @param options - Render options
   */
  public render(
    ctx: CanvasRenderingContext2D,
    options?: {
      layerIndex?: number;
      layerCount?: number;
      maxDepth?: number;
      parallaxFactor?: number;
      wireframe?: boolean;
    }
  ): void {
    const layerIndex = options?.layerIndex;
    const layerCount = options?.layerCount ?? 5;
    const maxDepth = options?.maxDepth ?? 2000;
    const parallaxFactor = options?.parallaxFactor ?? 1.0;
    const wireframe = options?.wireframe ?? false;

    ctx.save();
    
    // Note: Z-axis offset is applied by the caller (Game.renderDefault)
    // Don't apply it here to avoid double-application

    // Get all entities and sort by depth
    const allEntities = this.getAllEntities().filter(e => e.visible !== false);
    
    const sortedEntities = allEntities
      .filter(e => {
        // If layerIndex specified, only render entities for this layer
        if (layerIndex !== undefined) {
          const depth = e.col + e.row;
          const entityLayer = Math.floor((depth / maxDepth) * layerCount);
          return entityLayer === layerIndex;
        }
        return true;
      })
      .sort((a, b) => a.depth - b.depth);

    for (const entity of sortedEntities) {
      const worldPos = this.gridSystem.gridToWorld(entity.col, entity.row);
      
      if (entity.draw) {
        // Entity has custom draw logic
        entity.draw(ctx);
      } else {
        // Default: draw as a box
        this.drawDefaultEntity(ctx, entity, worldPos, parallaxFactor, wireframe);
      }
    }

    ctx.restore();
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

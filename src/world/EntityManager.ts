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

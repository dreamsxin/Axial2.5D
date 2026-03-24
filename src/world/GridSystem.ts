/**
 * GridSystem - Manages map data, coordinate conversion, and ground tile rendering
 */

import { Projection } from '../core/Projection';
import { IsoCamera } from '../core/IsoCamera';
import { GridCoord, WorldCoord, RenderItem, Entity, TileData, MapConfig } from '../core/types';

export class TileRenderItem implements RenderItem {
  public depth: number;
  public col: number;
  public row: number;
  public screenX: number;
  public screenY: number;
  public color: string;
  public width: number;
  public height: number;

  constructor(
    depth: number,
    col: number,
    row: number,
    screenX: number,
    screenY: number,
    color: string = '#4a4a4a',
    width: number = 64,
    height: number = 32
  ) {
    this.depth = depth;
    this.col = col;
    this.row = row;
    this.screenX = screenX;
    this.screenY = screenY;
    this.color = color;
    this.width = width;
    this.height = height;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const w = this.width;
    const h = this.height;
    const x = this.screenX;
    const y = this.screenY;

    // Draw diamond-shaped tile
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x - w / 2, y + h / 2);
    ctx.closePath();
    
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export class GridSystem {
  private width: number;
  private height: number;
  private tiles: TileData[][];
  private tileW: number;
  private tileH: number;
  private projection: Projection;
  
  // Cache for ground render items
  private groundRenderItems: TileRenderItem[] = [];
  private groundRenderItemsDirty: boolean = true;

  constructor(config: MapConfig, projection: Projection, tileData?: TileData[][]) {
    this.width = config.width;
    this.height = config.height;
    this.tileW = config.tileW;
    this.tileH = config.tileH;
    this.projection = projection;
    
    // Initialize tiles
    this.tiles = tileData || this.createDefaultTiles();
  }

  /**
   * Create default tile data (all grass, walkable)
   */
  private createDefaultTiles(): TileData[][] {
    const tiles: TileData[][] = [];
    for (let col = 0; col < this.width; col++) {
      tiles[col] = [];
      for (let row = 0; row < this.height; row++) {
        tiles[col][row] = {
          type: 'grass',
          height: 0,
          walkable: true,
          entity: null
        };
      }
    }
    return tiles;
  }

  /**
   * Get tile data at grid coordinates
   */
  public getTile(col: number, row: number): TileData | null {
    if (col < 0 || col >= this.width || row < 0 || row >= this.height) {
      return null;
    }
    return this.tiles[col][row];
  }

  /**
   * Set tile type and walkability
   */
  public setTileType(col: number, row: number, type: string, walkable: boolean): void {
    const tile = this.getTile(col, row);
    if (tile) {
      tile.type = type;
      tile.walkable = walkable;
      this.groundRenderItemsDirty = true;
    }
  }

  /**
   * Set entity occupancy for a tile
   */
  public setEntity(col: number, row: number, entity: Entity | null): void {
    const tile = this.getTile(col, row);
    if (tile) {
      tile.entity = entity;
    }
  }

  /**
   * Convert grid coordinates to world coordinates
   */
  public gridToWorld(col: number, row: number): WorldCoord {
    const x = (col - row) * (this.tileW / 2);
    const z = (col + row) * (this.tileH / 2);
    return { x, z };
  }

  /**
   * Convert world coordinates to grid coordinates
   */
  public worldToGrid(x: number, z: number): GridCoord {
    const col = (x / (this.tileW / 2) + z / (this.tileH / 2)) / 2;
    const row = (z / (this.tileH / 2) - x / (this.tileW / 2)) / 2;
    return {
      col: Math.round(col),
      row: Math.round(row)
    };
  }

  /**
   * Get ground height at grid coordinates
   */
  public getGroundHeight(col: number, row: number): number {
    const tile = this.getTile(col, row);
    return tile ? tile.height : 0;
  }

  /**
   * Get ground height at world coordinates
   */
  public getGroundHeightAtWorld(x: number, z: number): number {
    const { col, row } = this.worldToGrid(x, z);
    return this.getGroundHeight(col, row);
  }

  /**
   * Check if a tile is walkable
   */
  public isWalkable(col: number, row: number, ignoreEntity?: Entity): boolean {
    const tile = this.getTile(col, row);
    if (!tile) return false;
    if (!tile.walkable) return false;
    if (tile.entity && tile.entity !== ignoreEntity) return false;
    return true;
  }

  /**
   * Get neighboring tiles (4-directional)
   */
  public getNeighbors(col: number, row: number): GridCoord[] {
    const neighbors: GridCoord[] = [];
    const directions = [
      { col: 0, row: -1 }, // up
      { col: 1, row: 0 },  // right
      { col: 0, row: 1 },  // down
      { col: -1, row: 0 }  // left
    ];

    for (const dir of directions) {
      const newCol = col + dir.col;
      const newRow = row + dir.row;
      if (newCol >= 0 && newCol < this.width && newRow >= 0 && newRow < this.height) {
        neighbors.push({ col: newCol, row: newRow });
      }
    }
    return neighbors;
  }

  /**
   * Build ground render items for all tiles
   */
  public buildGroundRenderItems(camera?: IsoCamera): TileRenderItem[] {
    if (!this.groundRenderItemsDirty && this.groundRenderItems.length > 0) {
      return this.groundRenderItems;
    }

    this.groundRenderItems = [];
    
    const tileColors: { [key: string]: string } = {
      'grass': '#4a7c4e',
      'water': '#4a90a4',
      'road': '#666666',
      'stone': '#888888',
      'sand': '#c2b280',
      'dirt': '#8b6914'
    };

    for (let col = 0; col < this.width; col++) {
      for (let row = 0; row < this.height; row++) {
        const tile = this.tiles[col][row];
        const worldPos = this.gridToWorld(col, row);
        const screenPos = this.projection.worldToScreen(worldPos.x, worldPos.z, tile.height);
        
        // Depth is the screen Y position (bottom of tile)
        const depth = screenPos.sy + this.tileH / 2;
        
        const color = tileColors[tile.type] || '#4a4a4a';
        
        const renderItem = new TileRenderItem(
          depth,
          col,
          row,
          screenPos.sx,
          screenPos.sy,
          color,
          this.tileW,
          this.tileH
        );
        
        this.groundRenderItems.push(renderItem);
      }
    }

    this.groundRenderItemsDirty = false;
    return this.groundRenderItems;
  }

  /**
   * Mark ground render items as dirty (needs rebuild)
   */
  public markDirty(): void {
    this.groundRenderItemsDirty = true;
  }

  /**
   * Get all tiles (for serialization)
   */
  public getAllTiles(): TileData[][] {
    return this.tiles;
  }

  /**
   * Get map dimensions
   */
  public getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * Get tile size
   */
  public getTileSize(): { width: number; height: number } {
    return { width: this.tileW, height: this.tileH };
  }

  /**
   * Render all ground tiles
   * @param ctx - Canvas rendering context
   * @param camera - Camera for coordinate conversion
   * @param options - Render options
   */
  public renderGround(
    ctx: CanvasRenderingContext2D,
    camera: IsoCamera,
    options?: {
      showGrid?: boolean;
      gridColor?: string;
      layerIndex?: number;
      parallaxFactor?: number;
      zIndexOffset?: number;
    }
  ): void {
    const showGrid = options?.showGrid ?? false;
    const gridColor = options?.gridColor ?? 'rgba(255,255,255,0.2)';
    const parallaxFactor = options?.parallaxFactor ?? 1.0;
    const zIndexOffset = options?.zIndexOffset ?? 0;

    ctx.save();
    
    // Apply Z-axis offset
    if (zIndexOffset !== 0) {
      ctx.translate(0, -zIndexOffset);
    }

    const tileColors: { [key: string]: string } = {
      'grass': '#4a7c4e',
      'water': '#4a90a4',
      'road': '#666666',
      'stone': '#888888',
      'sand': '#c2b280',
      'dirt': '#8b6914'
    };

    // Render tiles
    for (let col = 0; col < this.width; col++) {
      for (let row = 0; row < this.height; row++) {
        const tile = this.tiles[col][row];
        const worldPos = this.gridToWorld(col, row);
        const screen = camera.worldToScreen(
          worldPos.x,
          worldPos.z,
          tile.height,
          this.projection,
          parallaxFactor
        );

        const w = this.tileW;
        const h = this.tileH;
        const x = screen.sx;
        const y = screen.sy;

        // Draw diamond-shaped tile
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w / 2, y + h / 2);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x - w / 2, y + h / 2);
        ctx.closePath();

        ctx.fillStyle = tileColors[tile.type] || '#4a4a4a';
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Render grid lines if enabled
    if (showGrid) {
      this.renderGrid(ctx, camera, parallaxFactor, gridColor);
    }

    ctx.restore();
  }

  /**
   * Render grid lines
   */
  public renderGrid(
    ctx: CanvasRenderingContext2D,
    camera: IsoCamera,
    parallaxFactor: number = 1.0,
    color: string = 'rgba(255,255,255,0.2)'
  ): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    // Vertical grid lines (columns)
    for (let col = 0; col <= this.width; col++) {
      const start = this.gridToWorld(col, 0);
      const end = this.gridToWorld(col, this.height);
      const s1 = camera.worldToScreen(start.x, start.z, 0, this.projection, parallaxFactor);
      const s2 = camera.worldToScreen(end.x, end.z, 0, this.projection, parallaxFactor);
      
      ctx.beginPath();
      ctx.moveTo(s1.sx, s1.sy);
      ctx.lineTo(s2.sx, s2.sy);
      ctx.stroke();
    }

    // Horizontal grid lines (rows)
    for (let row = 0; row <= this.height; row++) {
      const start = this.gridToWorld(0, row);
      const end = this.gridToWorld(this.width, row);
      const s1 = camera.worldToScreen(start.x, start.z, 0, this.projection, parallaxFactor);
      const s2 = camera.worldToScreen(end.x, end.z, 0, this.projection, parallaxFactor);
      
      ctx.beginPath();
      ctx.moveTo(s1.sx, s1.sy);
      ctx.lineTo(s2.sx, s2.sy);
      ctx.stroke();
    }
  }
}

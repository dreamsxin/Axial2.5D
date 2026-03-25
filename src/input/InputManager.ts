/**
 * InputManager - Unified input handling for mouse, keyboard, and touch
 * Converts screen coordinates to world/grid coordinates with camera and parallax support
 * 
 * Phase 6: Provides direct mouseScreenX/mouseScreenY properties for easy access
 */

import { IsoCamera } from '../core/IsoCamera';
import { Projection } from '../core/Projection';
import { LayerManager } from '../core/LayerManager';
import { EventBus } from '../utils/EventBus';

export interface InputManagerConfig {
  canvas: HTMLCanvasElement;
  camera: IsoCamera;
  projection: Projection;
  eventBus: EventBus;
  cellSize?: number;
  /** Optional: inject a LayerManager so parallax factors stay in sync with the rest of the engine */
  layerManager?: LayerManager;
}

export interface MouseState {
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
  gridCol: number;
  gridRow: number;
  layer: number;
  isDown: boolean;
  isDragging: boolean;
}

export class InputManager {
  private canvas: HTMLCanvasElement;
  private camera: IsoCamera;
  private projection: Projection;
  private eventBus: EventBus;
  private cellSize: number;
  /** Optional LayerManager for consistent parallaxFactor calculation across the engine */
  private layerManager?: LayerManager;
  
  public mouseState: MouseState;
  private layerCount: number = 5;
  private maxDepth: number = 2000;
  private parallaxRange: number = 0.7;
  private blocking: boolean = false;

  private keyState: Map<string, boolean> = new Map();
  
  // Current player position (used for click parallax calculation)
  // Call setPlayerPosition() every frame when the player moves to keep this accurate.
  private playerCol: number = 0;
  private playerRow: number = 0;
  
  // Cached mouse positions for easy access (Phase 6)
  private cachedMouseWorld: { x: number; y: number } | null = null;
  private cachedMouseGrid: { col: number; row: number } | null = null;
  private playerColForCache: number = 0;
  private playerRowForCache: number = 0;

  constructor(config: InputManagerConfig) {
    this.canvas = config.canvas;
    this.camera = config.camera;
    this.projection = config.projection;
    this.eventBus = config.eventBus;
    this.cellSize = config.cellSize ?? 50;
    this.layerManager = config.layerManager;
    
    this.mouseState = {
      screenX: 0,
      screenY: 0,
      worldX: 0,
      worldY: 0,
      gridCol: 0,
      gridRow: 0,
      layer: 0,
      isDown: false,
      isDragging: false
    };
  }

  // ==================== Phase 6: Direct Mouse Properties ====================
  
  /**
   * Get current mouse screen X coordinate (Phase 6)
   * Automatically updated, no manual tracking needed
   */
  public get mouseScreenX(): number {
    return this.mouseState.screenX;
  }

  /**
   * Get current mouse screen Y coordinate (Phase 6)
   * Automatically updated, no manual tracking needed
   */
  public get mouseScreenY(): number {
    return this.mouseState.screenY;
  }

  /**
   * Get current mouse world X coordinate (Phase 6)
   */
  public get mouseWorldX(): number {
    return this.mouseState.worldX;
  }

  /**
   * Get current mouse world Y coordinate (Phase 6)
   */
  public get mouseWorldY(): number {
    return this.mouseState.worldY;
  }

  /**
   * Get current mouse grid column (Phase 6)
   */
  public get mouseGridCol(): number {
    return this.mouseState.gridCol;
  }

  /**
   * Get current mouse grid row (Phase 6)
   */
  public get mouseGridRow(): number {
    return this.mouseState.gridRow;
  }

  /**
   * Get current mouse layer (Phase 6)
   */
  public get mouseLayer(): number {
    return this.mouseState.layer;
  }

  /**
   * Initialize input listeners
   */
  public init(): void {
    this.setupMouseListeners();
    this.setupKeyboardListeners();
  }

  /**
   * Set layer configuration for coordinate conversion
   */
  public setLayerConfig(config: {
    layerCount?: number;
    maxDepth?: number;
    parallaxRange?: number;
  }): void {
    if (config.layerCount !== undefined) this.layerCount = config.layerCount;
    if (config.maxDepth !== undefined) this.maxDepth = config.maxDepth;
    if (config.parallaxRange !== undefined) this.parallaxRange = config.parallaxRange;
  }

  /**
   * Update the player's current grid position for parallax-accurate click conversion.
   * Call this every frame after the player moves (or at least on each move event).
   * Without this, onClick always uses (0,0) as the reference, causing coordinate
   * drift when the player is far from the map origin.
   */
  public setPlayerPosition(col: number, row: number): void {
    this.playerCol = col;
    this.playerRow = row;
    // Invalidate cached grid position so next getMouseGridPosition() recalculates
    this.cachedMouseGrid = null;
    this.cachedMouseWorld = null;
  }

  /**
   * Calculate player layer parallax for coordinate conversion.
   *
   * If a LayerManager was injected at construction time we delegate to its
   * canonical calculateParallaxFactor() so the value is always in sync with
   * what the renderer uses.  Otherwise we fall back to the local formula
   * (identical math, but kept here for environments without LayerManager).
   */
  private getPlayerLayerParallax(playerCol: number, playerRow: number): number {
    if (this.layerManager) {
      const playerDepth = playerCol + playerRow;
      const playerLayer = this.layerManager.getLayerForDepth(playerDepth);
      return this.layerManager.calculateParallaxFactor(playerLayer);
    }
    // Fallback: mirror the formula used in Game.renderDefault
    const playerDepth = playerCol + playerRow;
    const playerLayer = Math.floor((playerDepth / this.maxDepth) * this.layerCount);
    return 0.3 + (playerLayer / (this.layerCount - 1)) * this.parallaxRange;
  }

  /**
   * Convert screen coordinates to world coordinates using the engine's canonical
   * IsoCamera.screenToWorld + Projection.screenToWorld pipeline.
   *
   * The old hand-rolled inverse-isometric formula was incorrect:
   *  - It used a hard-coded 30° angle and forgot to divide by tileScale, causing
   *    coordinate drift proportional to tileScale (cellSize / something).
   *  - It also applied the camera offset before the projection inverse, which is
   *    the wrong order.
   *
   * @param screenX - Screen X coordinate (relative to canvas, 0 to canvas.width)
   * @param screenY - Screen Y coordinate (relative to canvas, 0 to canvas.height)
   * @param parallaxFactor - Parallax factor for coordinate conversion
   */
  public screenToWorld(screenX: number, screenY: number, parallaxFactor: number = 1.0): { x: number; y: number } {
    // Delegate to IsoCamera which correctly:
    //   1. Subtracts canvas center
    //   2. Removes camera offset (scaled by parallaxFactor)
    //   3. Divides by camera.scale
    //   4. Calls Projection.screenToWorld for the proper inverse transform
    const world = this.camera.screenToWorld(screenX, screenY, this.projection, parallaxFactor);
    return { x: world.x, y: world.y };
  }

  /**
   * Convert world coordinates to grid coordinates.
   * Uses cellSize (= tileW = tileH) which matches GridSystem configuration.
   */
  public worldToGrid(worldX: number, worldY: number): { col: number; row: number } {
    return {
      col: Math.floor(worldX / this.cellSize),
      row: Math.floor(worldY / this.cellSize)
    };
  }

  /**
   * Get mouse position in grid coordinates
   */
  public getMouseGridPosition(playerCol: number, playerRow: number): { col: number; row: number; layer: number } {
    // Update cache if player position changed
    if (playerCol !== this.playerColForCache || playerRow !== this.playerRowForCache) {
      this.cachedMouseGrid = null;
      this.cachedMouseWorld = null;
    }
    
    const parallax = this.getPlayerLayerParallax(playerCol, playerRow);
    const world = this.screenToWorld(this.mouseState.screenX, this.mouseState.screenY, parallax);
    
    // Handle undefined or invalid world coordinates
    if (!world || world.x === undefined || world.y === undefined) {
      return { col: 0, row: 0, layer: 0 };
    }
    
    const grid = this.worldToGrid(world.x, world.y);
    const depth = grid.col + grid.row;
    const layer = Math.floor((depth / this.maxDepth) * this.layerCount);
    
    // Update cache
    this.cachedMouseWorld = { x: world.x, y: world.y };
    this.cachedMouseGrid = { col: grid.col, row: grid.row };
    this.playerColForCache = playerCol;
    this.playerRowForCache = playerRow;
    
    return { col: grid.col, row: grid.row, layer };
  }

  /**
   * Get current mouse world position (cached, updates on mouse move)
   * @param playerCol - Player column for parallax calculation
   * @param playerRow - Player row for parallax calculation
   */
  public get mouseWorldPosition(): { x: number; y: number } | null {
    if (!this.cachedMouseWorld) {
      this.getMouseGridPosition(this.playerColForCache, this.playerRowForCache);
    }
    return this.cachedMouseWorld;
  }

  /**
   * Get current mouse grid position (cached, updates on mouse move)
   * @param playerCol - Player column for parallax calculation
   * @param playerRow - Player row for parallax calculation
   */
  public get mouseGridPosition(): { col: number; row: number } | null {
    if (!this.cachedMouseGrid) {
      this.getMouseGridPosition(this.playerColForCache, this.playerRowForCache);
    }
    return this.cachedMouseGrid;
  }

  /**
   * Setup mouse event listeners
   */
  private setupMouseListeners(): void {
    this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
    this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
    this.canvas.addEventListener('mouseup', e => this.onMouseUp(e));
    this.canvas.addEventListener('wheel', e => this.onWheel(e), { passive: false });
    this.canvas.addEventListener('click', e => this.onClick(e));
  }

  /**
   * Setup keyboard event listeners
   */
  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', e => this.onKeyDown(e));
    window.addEventListener('keyup', e => this.onKeyUp(e));
  }

  private onMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseState.screenX = e.clientX - rect.left;
    this.mouseState.screenY = e.clientY - rect.top;
    
    if (this.mouseState.isDown) {
      const deltaX = e.movementX;
      const deltaY = e.movementY;
      this.mouseState.isDragging = true;
      this.eventBus.emit('dragMove', { deltaX, deltaY, type: 'dragMove' });
    }
  }

  private onMouseDown(e: MouseEvent): void {
    this.mouseState.isDown = true;
    this.mouseState.isDragging = false;
    this.eventBus.emit('mouseDown', { x: e.clientX, y: e.clientY, type: 'mouseDown' });
  }

  private onMouseUp(e: MouseEvent): void {
    this.mouseState.isDown = false;
    this.mouseState.isDragging = false;
    this.eventBus.emit('mouseUp', { x: e.clientX, y: e.clientY, type: 'mouseUp' });
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.eventBus.emit('zoom', { delta, type: 'zoom' });
  }

  private onClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    // Use actual player position (updated via setPlayerPosition) for parallax calculation.
    // Using (0,0) when the player is far from the origin causes click-coordinate drift.
    const playerParallax = this.getPlayerLayerParallax(this.playerCol, this.playerRow);
    // Use the canonical pipeline: camera.screenToWorld → Projection.screenToWorld
    const world = this.camera.screenToWorld(screenX, screenY, this.projection, playerParallax);
    const grid = this.worldToGrid(world.x, world.y);
    
    this.eventBus.emit('click', {
      screenX,
      screenY,
      worldX: world.x,
      worldY: world.y,
      gridCol: grid.col,
      gridRow: grid.row,
      type: 'click'
    });
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keyState.set(e.key, true);
    this.eventBus.emit('keyDown', { key: e.key, type: 'keyDown' });
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keyState.set(e.key, false);
    this.eventBus.emit('keyUp', { key: e.key, type: 'keyUp' });
  }

  /**
   * Check if a key is currently pressed
   */
  public isKeyDown(key: string): boolean {
    return this.keyState.get(key) === true;
  }

  /**
   * Get movement direction from WASD/arrow keys
   */
  public getMovementDirection(): { dCol: number; dRow: number } {
    let dCol = 0, dRow = 0;
    
    if (this.isKeyDown('w') || this.isKeyDown('ArrowUp')) dRow--;
    if (this.isKeyDown('s') || this.isKeyDown('ArrowDown')) dRow++;
    if (this.isKeyDown('a') || this.isKeyDown('ArrowLeft')) dCol--;
    if (this.isKeyDown('d') || this.isKeyDown('ArrowRight')) dCol++;
    
    return { dCol, dRow };
  }

  /**
   * Set input blocking (prevent input processing)
   */
  public setBlocking(blocked: boolean): void {
    this.blocking = blocked;
  }

  /**
   * Check if input is blocked
   */
  public isBlocking(): boolean {
    return this.blocking;
  }

  /**
   * Destroy input manager and remove listeners
   */
  public destroy(): void {
    // Cleanup would go here in a full implementation
  }
}

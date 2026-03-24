/**
 * InputManager - Unified input handling for mouse, keyboard, and touch
 * Converts screen coordinates to world/grid coordinates with camera and parallax support
 */

import { IsoCamera } from '../core/IsoCamera';
import { Projection } from '../core/Projection';
import { EventBus } from '../utils/EventBus';

export interface InputManagerConfig {
  canvas: HTMLCanvasElement;
  camera: IsoCamera;
  projection: Projection;
  eventBus: EventBus;
  cellSize?: number;
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
  
  public mouseState: MouseState;
  private layerCount: number = 5;
  private maxDepth: number = 2000;
  private parallaxRange: number = 0.7;
  private blocking: boolean = false;

  private keyState: Map<string, boolean> = new Map();

  constructor(config: InputManagerConfig) {
    this.canvas = config.canvas;
    this.camera = config.camera;
    this.projection = config.projection;
    this.eventBus = config.eventBus;
    this.cellSize = config.cellSize ?? 50;
    
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
   * Calculate player layer parallax for coordinate conversion
   */
  private getPlayerLayerParallax(playerCol: number, playerRow: number): number {
    const playerDepth = playerCol + playerRow;
    const playerLayer = Math.floor((playerDepth / this.maxDepth) * this.layerCount);
    return 0.3 + (playerLayer / (this.layerCount - 1)) * this.parallaxRange;
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  public screenToWorld(screenX: number, screenY: number, parallaxFactor: number = 1.0): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const adjX = (screenX - rect.left - this.canvas.width / 2 - this.camera.offsetX * parallaxFactor) / this.camera.scale;
    const adjY = (screenY - rect.top - this.canvas.height / 2 - this.camera.offsetY * parallaxFactor) / this.camera.scale;
    
    const COS_THETA = Math.cos(30 * Math.PI / 180);
    const SIN_THETA = Math.sin(30 * Math.PI / 180);
    
    const worldX = (adjX / COS_THETA + adjY / SIN_THETA) / 2;
    const worldY = (adjY / SIN_THETA - adjX / COS_THETA) / 2;
    
    return { x: worldX, y: worldY };
  }

  /**
   * Convert world coordinates to grid coordinates
   */
  public worldToGrid(worldX: number, worldY: number): { col: number; row: number } {
    return {
      col: Math.round(worldX / this.cellSize),
      row: Math.round(worldY / this.cellSize)
    };
  }

  /**
   * Get mouse position in grid coordinates
   */
  public getMouseGridPosition(playerCol: number, playerRow: number): { col: number; row: number; layer: number } {
    const parallax = this.getPlayerLayerParallax(playerCol, playerRow);
    const world = this.screenToWorld(this.mouseState.screenX, this.mouseState.screenY, parallax);
    const grid = this.worldToGrid(world.x, world.y);
    const depth = grid.col + grid.row;
    const layer = Math.floor((depth / this.maxDepth) * this.layerCount);
    
    return { col: grid.col, row: grid.row, layer };
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
    const playerParallax = this.getPlayerLayerParallax(0, 0); // Default player position
    const world = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top, playerParallax);
    const grid = this.worldToGrid(world.x, world.y);
    
    this.eventBus.emit('click', {
      screenX: e.clientX - rect.left,
      screenY: e.clientY - rect.top,
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

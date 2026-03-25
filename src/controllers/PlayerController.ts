/**
 * PlayerController - Encapsulates player input and movement logic
 * 
 * Features:
 * - Keyboard movement (WASD/Arrow keys)
 * - Click-to-move
 * - Path validation (walkable tiles only)
 * - Boundary checking
 * - Movement events
 * - Optional auto-camera follow
 * 
 * Usage:
 * ```typescript
 * const playerController = new PlayerController('player', {
 *   inputManager: game.inputManager,
 *   gridSystem: game.gridSystem,
 *   entityManager: game.entityManager,
 *   allowClickToMove: true,
 *   allowKeyboardMove: true,
 *   boundary: { minCol: 0, maxCol: 11, minRow: 0, maxRow: 11 }
 * });
 * 
 * playerController.enable();
 * playerController.onMove((col, row) => console.log(`Moved to ${col},${row}`));
 * 
 * // Programmatic movement
 * await playerController.moveTo(5, 5);
 * ```
 */

import { InputManager } from '../input/InputManager';
import { GridSystem } from '../world/GridSystem';
import { EntityManager } from '../world/EntityManager';
import { Entity } from '../core/types';
import { EventBus } from '../utils/EventBus';

export interface PlayerControllerConfig {
  inputManager: InputManager;
  gridSystem: GridSystem;
  entityManager: EntityManager;
  eventBus: EventBus;
  
  // Movement options
  allowClickToMove?: boolean;
  allowKeyboardMove?: boolean;
  
  // Boundary (optional)
  boundary?: {
    minCol: number;
    maxCol: number;
    minRow: number;
    maxRow: number;
  };
  
  // Camera follow (optional)
  cameraController?: any; // CameraController type (circular dep)
}

export type MoveCallback = (col: number, row: number) => void;

export class PlayerController {
  private entityId: string;
  private inputManager: InputManager;
  private gridSystem: GridSystem;
  private entityManager: EntityManager;
  private eventBus: EventBus;
  
  private config: Required<PlayerControllerConfig>;
  private enabled: boolean = false;
  private moveCallbacks: MoveCallback[] = [];
  
  // Saved handler references for proper eventBus.off() cleanup
  private _boundHandleTileClick?: (data: any) => void;
  private _boundHandleKeyDown?:   (data: any) => void;
  
  private keyRepeatTimer: number = 0;
  private keyRepeatInterval: number = 150; // ms between repeated moves
  private lastMoveTime: number = 0;

  constructor(entityId: string, config: PlayerControllerConfig) {
    this.entityId = entityId;
    this.inputManager = config.inputManager;
    this.gridSystem = config.gridSystem;
    this.entityManager = config.entityManager;
    this.eventBus = config.eventBus;
    
    this.config = {
      allowClickToMove: config.allowClickToMove ?? true,
      allowKeyboardMove: config.allowKeyboardMove ?? true,
      boundary: config.boundary ?? {
        minCol: 0,
        maxCol: config.gridSystem.getDimensions().width - 1,
        minRow: 0,
        maxRow: config.gridSystem.getDimensions().height - 1
      },
      cameraController: config.cameraController ?? null,
      eventBus: config.eventBus,
      inputManager: config.inputManager,
      gridSystem: config.gridSystem,
      entityManager: config.entityManager
    };
  }

  /**
   * Enable the controller (start listening to input)
   */
  public enable(): void {
    if (this.enabled) {
      console.warn('PlayerController already enabled');
      return;
    }

    this.enabled = true;
    this.setupEventListeners();
    this.getEntity(); // Cache entity
    
    console.log(`PlayerController enabled for entity "${this.entityId}"`);
  }

  /**
   * Disable the controller (stop listening to input)
   */
  public disable(): void {
    if (!this.enabled) return;

    this.enabled = false;
    this.removeEventListeners();
    
    console.log(`PlayerController disabled for entity "${this.entityId}"`);
  }

  /**
   * Check if controller is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get the controlled entity
   */
  public getEntity(): Entity | undefined {
    return this.entityManager.getEntity(this.entityId);
  }

  /**
   * Get current player position
   */
  public getPosition(): { col: number; row: number } | null {
    const entity = this.getEntity();
    if (!entity) return null;
    return { col: entity.col, row: entity.row };
  }

  /**
   * Move player to a specific grid position
   * @returns Promise that resolves to true if move succeeded
   */
  public async moveTo(col: number, row: number): Promise<boolean> {
    // Validate bounds
    if (!this.isWithinBounds(col, row)) {
      console.warn(`PlayerController: Target (${col},${row}) out of bounds`);
      return false;
    }

    // Validate walkable
    if (!this.gridSystem.isWalkable(col, row, this.getEntity())) {
      console.warn(`PlayerController: Target (${col},${row}) not walkable`);
      return false;
    }

    // Move entity
    const entity = this.getEntity();
    if (!entity) {
      console.warn(`PlayerController: Entity "${this.entityId}" not found`);
      return false;
    }

    const success = this.entityManager.moveEntity(entity, col, row);
    
    if (success) {
      // Keep InputManager in sync so click parallax is calculated from actual player position.
      // Direct call is fastest; the eventBus 'playerMoved' below is for other listeners.
      this.inputManager.setPlayerPosition(col, row);
      
      // Broadcast movement so Game and other systems can react (e.g. auto-update camera parallax)
      this.eventBus.emit('playerMoved', { col, row, entityId: this.entityId });
      
      this.emitMove(col, row);
      
      // Update camera if configured
      if (this.config.cameraController) {
        this.config.cameraController.update();
      }
    }

    return success;
  }

  /**
   * Move player by delta (relative movement)
   */
  public async moveBy(dCol: number, dRow: number): Promise<boolean> {
    const pos = this.getPosition();
    if (!pos) return false;

    return this.moveTo(pos.col + dCol, pos.row + dRow);
  }

  /**
   * Register callback for move events
   */
  public onMove(callback: MoveCallback): void {
    this.moveCallbacks.push(callback);
  }

  /**
   * Unregister callback for move events
   */
  public offMove(callback: MoveCallback): void {
    const index = this.moveCallbacks.indexOf(callback);
    if (index > -1) {
      this.moveCallbacks.splice(index, 1);
    }
  }

  /**
   * Setup input event listeners
   */
  private setupEventListeners(): void {
    if (this.config.allowClickToMove) {
      // Listen to 'tileClick' (not 'click'). The 'click' event carries worldX/worldY
      // and is converted to grid coords by Game.setupDefaultInputHandlers, which then
      // emits 'tileClick' with { col, row }. Using 'tileClick' avoids duplicating the
      // screen→world→grid conversion and keeps the controller independent of projection.
      this._boundHandleTileClick = (data) => this.handleTileClick(data);
      this.eventBus.on('tileClick', this._boundHandleTileClick);
    }

    if (this.config.allowKeyboardMove) {
      this._boundHandleKeyDown = (data) => this.handleKeyDown(data);
      this.eventBus.on('keyDown', this._boundHandleKeyDown);
    }
  }

  /**
   * Remove input event listeners
   */
  private removeEventListeners(): void {
    if (this._boundHandleTileClick) {
      this.eventBus.off('tileClick', this._boundHandleTileClick);
      this._boundHandleTileClick = undefined;
    }
    if (this._boundHandleKeyDown) {
      this.eventBus.off('keyDown', this._boundHandleKeyDown);
      this._boundHandleKeyDown = undefined;
    }
  }

  /**
   * Handle click-to-move via tileClick event
   * data: { col: number, row: number } - already-converted grid coordinates
   */
  private handleTileClick(data: any): void {
    if (!this.enabled || !this.config.allowClickToMove) return;

    const { col, row } = data;
    if (col === undefined || row === undefined) return;

    this.moveTo(col, row);
  }

  /**
   * Handle keyboard movement with repeat
   */
  private handleKeyDown(data: any): void {
    if (!this.enabled || !this.config.allowKeyboardMove) return;

    const now = Date.now();
    if (now - this.lastMoveTime < this.keyRepeatInterval) {
      return; // Rate limit
    }

    const { dCol, dRow } = this.inputManager.getMovementDirection();
    if (dCol !== 0 || dRow !== 0) {
      this.moveBy(dCol, dRow);
      this.lastMoveTime = now;
    }
  }

  /**
   * Check if position is within bounds
   */
  private isWithinBounds(col: number, row: number): boolean {
    const { minCol, maxCol, minRow, maxRow } = this.config.boundary;
    return col >= minCol && col <= maxCol && row >= minRow && row <= maxRow;
  }

  /**
   * Emit move event to callbacks
   */
  private emitMove(col: number, row: number): void {
    for (const callback of this.moveCallbacks) {
      try {
        callback(col, row);
      } catch (error) {
        console.error('PlayerController: Move callback error', error);
      }
    }
  }

  /**
   * Update controller (called every frame)
   * Currently used for continuous movement if needed
   */
  public update(delta: number): void {
    // Could be extended for smooth movement interpolation
    // Currently handled by discrete grid movement
  }

  /**
   * Set camera controller for auto-follow
   */
  public setCameraController(cameraController: any): void {
    this.config.cameraController = cameraController;
  }

  /**
   * Set movement boundary
   */
  public setBoundary(boundary: { minCol: number; maxCol: number; minRow: number; maxRow: number }): void {
    this.config.boundary = boundary;
  }

  /**
   * Get current boundary
   */
  public getBoundary(): { minCol: number; maxCol: number; minRow: number; maxRow: number } {
    return { ...this.config.boundary };
  }
}

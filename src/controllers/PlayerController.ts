/**
 * PlayerController - Handles player movement and camera follow
 * Automatically processes keyboard input and click-to-move
 */

import { EntityManager } from '../world/EntityManager';
import { GridSystem } from '../world/GridSystem';
import { IsoCamera } from '../core/IsoCamera';
import { EventBus } from '../utils/EventBus';
import { LayerManager } from '../core/LayerManager';

import { Projection } from '../core/Projection';

export interface PlayerControllerConfig {
  playerId?: string;
  camera?: IsoCamera;
  projection: Projection;
  gridSystem: GridSystem;
  entityManager: EntityManager;
  eventBus: EventBus;
  layerManager?: LayerManager;
  maxDepth?: number;
  smoothCamera?: boolean;
  cameraSmoothness?: number;
}

export class PlayerController {
  private playerId: string;
  private camera: IsoCamera | null;
  private projection: Projection;
  private gridSystem: GridSystem;
  private entityManager: EntityManager;
  private eventBus: EventBus;
  private layerManager: LayerManager | null;
  private maxDepth: number;
  private smoothCamera: boolean;
  private cameraSmoothness: number;
  
  private playerCol: number = 0;
  private playerRow: number = 0;
  private isMoving: boolean = false;

  constructor(config: PlayerControllerConfig) {
    this.playerId = config.playerId ?? 'player';
    this.camera = config.camera ?? null;
    this.projection = config.projection;
    this.gridSystem = config.gridSystem;
    this.entityManager = config.entityManager;
    this.eventBus = config.eventBus;
    this.layerManager = config.layerManager ?? null;
    this.maxDepth = config.maxDepth ?? 2000;
    this.smoothCamera = config.smoothCamera ?? true;
    this.cameraSmoothness = config.cameraSmoothness ?? 0.1;
    
    // Initialize player position
    this.updatePlayerPosition();
    
    // Setup input handlers
    this.setupInputHandlers();
  }

  /**
   * Get current player position
   */
  public getPosition(): { col: number; row: number } {
    return { col: this.playerCol, row: this.playerRow };
  }

  /**
   * Move player to new position
   */
  public moveTo(col: number, row: number): boolean {
    const tile = this.gridSystem.getTile(col, row);
    if (!tile || !tile.walkable) {
      return false;
    }

    const player = this.entityManager.getEntity(this.playerId);
    if (!player) {
      return false;
    }

    const success = this.entityManager.moveEntity(player, col, row);
    if (success) {
      this.playerCol = col;
      this.playerRow = row;
      this.isMoving = true;
      
      // Update camera if enabled
      if (this.camera && this.smoothCamera) {
        this.updateCamera();
      }
    }

    return success;
  }

  /**
   * Move player by delta
   */
  public moveBy(dCol: number, dRow: number): boolean {
    return this.moveTo(this.playerCol + dCol, this.playerRow + dRow);
  }

  /**
   * Update player position from entity
   */
  public updatePlayerPosition(): void {
    const player = this.entityManager.getEntity(this.playerId);
    if (player) {
      this.playerCol = player.col;
      this.playerRow = player.row;
    }
  }

  /**
   * Update camera to follow player
   */
  public updateCamera(): void {
    if (!this.camera || !this.layerManager) return;

    const playerDepth = this.playerCol + this.playerRow;
    const playerLayer = this.layerManager.getLayerForDepth(playerDepth);
    const playerParallax = this.layerManager.calculateParallaxFactor(playerLayer);
    
    const worldPos = this.gridSystem.gridToWorld(this.playerCol, this.playerRow);
    
    this.camera.follow(worldPos.x, worldPos.z, 0, this.projection, {
      smoothness: this.cameraSmoothness,
      parallaxFactor: playerParallax
    });
  }

  /**
   * Set camera follow smoothness
   */
  public setCameraSmoothness(smoothness: number): void {
    this.cameraSmoothness = Math.max(0, Math.min(1, smoothness));
  }

  /**
   * Enable/disable smooth camera
   */
  public setSmoothCamera(enabled: boolean): void {
    this.smoothCamera = enabled;
  }

  /**
   * Setup input event handlers
   */
  private setupInputHandlers(): void {
    // Keyboard movement
    this.eventBus.on('keyDown', (data) => {
      const key = (data as any).key as string;
      let dCol = 0, dRow = 0;
      
      if (key === 'w' || key === 'ArrowUp') dRow = -1;
      if (key === 's' || key === 'ArrowDown') dRow = 1;
      if (key === 'a' || key === 'ArrowLeft') dCol = -1;
      if (key === 'd' || key === 'ArrowRight') dCol = 1;
      
      if (dCol !== 0 || dRow !== 0) {
        this.moveBy(dCol, dRow);
      }
    });

    // Click to move
    this.eventBus.on('click', (data) => {
      const gridCol = (data as any).gridCol as number;
      const gridRow = (data as any).gridRow as number;
      
      if (gridCol !== undefined && gridRow !== undefined) {
        this.moveTo(gridCol, gridRow);
      }
    });
  }

  /**
   * Update controller (call every frame)
   */
  public update(delta: number): void {
    // Update player position in case it changed externally
    this.updatePlayerPosition();
    
    // Update camera
    if (this.camera && this.smoothCamera) {
      this.updateCamera();
    }
    
    this.isMoving = false;
  }

  /**
   * Destroy controller and cleanup
   */
  public destroy(): void {
    // Cleanup would go here
  }
}

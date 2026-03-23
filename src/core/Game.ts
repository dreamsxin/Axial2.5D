/**
 * Game - Main game class that orchestrates all systems
 */

import { Projection } from './Projection';
import { CanvasRenderer } from './CanvasRenderer';
import { GridSystem } from '../world/GridSystem';
import { EntityManager } from '../world/EntityManager';
import { PathFinder } from '../world/PathFinder';
import { InputManager } from '../input/InputManager';
import { UIManager } from '../ui/UIManager';
import { DebugSystem } from '../debug/DebugSystem';
import { SceneManager } from '../scene/SceneManager';
import { ResourceManager } from '../resource/ResourceManager';
import { EventBus } from '../utils/EventBus';
import { MapData, DebugConfig, ProjectionConfig, MapConfig, TileData, SceneConfig } from './types';

export interface GameConfig {
  width: number;
  height: number;
  projection?: ProjectionConfig;
  debug?: Partial<DebugConfig>;
  canvas?: HTMLCanvasElement | OffscreenCanvas;
}

export class Game {
  public eventBus: EventBus;
  public projection: Projection;
  public renderer: CanvasRenderer;
  public gridSystem: GridSystem | null = null;
  public entityManager: EntityManager | null = null;
  public pathFinder: PathFinder;
  public inputManager: InputManager | null = null;
  public uiManager: UIManager;
  public debugSystem: DebugSystem;
  public sceneManager: SceneManager;
  public resourceManager: ResourceManager;

  private running: boolean = false;
  private lastTime: number = 0;
  private canvas: HTMLCanvasElement | OffscreenCanvas;

  constructor(config: GameConfig) {
    // Initialize event bus first
    this.eventBus = new EventBus();

    // Create projection
    this.projection = new Projection(
      config.projection || { type: 'isometric', viewAngle: 45 }
    );

    // Store canvas reference
    this.canvas = config.canvas || this.createOffscreenCanvas(config.width, config.height);

    // Create renderer
    this.renderer = new CanvasRenderer(
      config.width,
      config.height,
      this.projection,
      this.canvas
    );

    // Create path finder
    this.pathFinder = new PathFinder();

    // Create UI manager
    this.uiManager = new UIManager(this.eventBus);

    // Create scene manager
    this.sceneManager = new SceneManager(config.width, config.height, this.eventBus);

    // Create resource manager
    this.resourceManager = new ResourceManager();

    // Create debug system
    this.debugSystem = new DebugSystem();
    if (config.debug) {
      this.debugSystem.setConfig(config.debug);
    }
  }

  /**
   * Initialize the game with a map
   */
  public init(mapData: MapData): void {
    // Create grid system
    this.gridSystem = new GridSystem(mapData, this.projection);

    // Create entity manager
    this.entityManager = new EntityManager(
      this.gridSystem,
      this.projection,
      this.renderer.camera
    );

    // Create input manager
    this.inputManager = new InputManager(
      this.canvas,
      this.renderer.camera,
      this.projection,
      this.eventBus
    );

    // Initialize UI
    this.uiManager.setInputManager(this.inputManager);

    // Initialize debug system
    this.debugSystem.init(
      this.renderer,
      this.gridSystem,
      this.entityManager,
      this.inputManager,
      this.eventBus
    );

    // Initialize input
    this.inputManager.init();

    // Setup default input handlers
    this.setupDefaultInputHandlers();
  }

  /**
   * Setup default input handlers for camera control and interaction
   */
  private setupDefaultInputHandlers(): void {
    if (!this.inputManager || !this.gridSystem || !this.entityManager) return;

    // Camera pan on drag
    this.eventBus.on('dragMove', (data) => {
      this.renderer.camera.pan(-data.deltaX, -data.deltaY);
    });

    // Camera zoom on wheel
    this.eventBus.on('zoom', (data) => {
      this.renderer.camera.zoom(data.delta);
    });

    // Click to get grid position
    this.eventBus.on('click', (data) => {
      if (data.worldX === undefined || data.worldZ === undefined) return;
      
      const gridPos = this.gridSystem!.worldToGrid(data.worldX, data.worldZ);
      this.eventBus.emit('tileClick', { col: gridPos.col, row: gridPos.row });
    });
  }

  /**
   * Start the game loop
   */
  public start(): void {
    if (this.running) return;
    
    this.running = true;
    this.lastTime = performance.now();
    this.gameLoop();
  }

  /**
   * Stop the game loop
   */
  public stop(): void {
    this.running = false;
  }

  /**
   * Main game loop
   */
  private gameLoop(): void {
    if (!this.running) return;

    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;

    // Update
    this.update(delta);

    // Render
    this.render();

    // Continue loop
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => this.gameLoop());
    } else {
      // Node.js fallback - run at ~60fps
      setTimeout(() => this.gameLoop(), 16);
    }
  }

  /**
   * Update game state
   */
  public update(delta: number): void {
    // Update current scene
    this.sceneManager.update(delta);

    // Update entities
    if (this.entityManager) {
      this.entityManager.updateAll(delta);
    }

    // Update debug stats
    this.debugSystem.updateFrameStats(delta);
  }

  /**
   * Render the game
   */
  public render(): void {
    // Clear
    this.renderer.clear('#1a1a2e');

    // Render current scene or default
    if (this.sceneManager.getCurrentScene()) {
      this.sceneManager.render('#1a1a2e');
    } else if (this.gridSystem && this.entityManager) {
      // Default render without scene manager
      const groundItems = this.gridSystem.buildGroundRenderItems();
      this.renderer.addRenderItems(groundItems);

      const entityItems = this.entityManager.getRenderItems();
      this.renderer.addRenderItems(entityItems);

      this.renderer.render();
      this.renderer.clearRenderItems();
    }

    // Draw debug info
    const ctx = this.renderer.ctx as CanvasRenderingContext2D;
    this.debugSystem.draw(ctx);
  }

  /**
   * Create a scene and switch to it
   */
  public createScene(config: SceneConfig): void {
    const scene = this.sceneManager.createScene(config);
    this.sceneManager.switchTo(config.name);
  }

  /**
   * Set the camera position
   */
  public setCameraPosition(worldX: number, worldZ: number): void {
    this.renderer.camera.setPosition(worldX, worldZ, this.projection);
  }

  /**
   * Center camera on an entity
   */
  public centerCameraOnEntity(entityId: string): void {
    if (!this.entityManager || !this.gridSystem) return;
    
    const entity = this.entityManager.getEntity(entityId);
    if (!entity) return;

    const worldPos = this.gridSystem.gridToWorld(entity.col, entity.row);
    this.setCameraPosition(worldPos.x, worldPos.z);
  }

  /**
   * Get canvas element
   */
  public getCanvas(): HTMLCanvasElement | OffscreenCanvas {
    return this.canvas;
  }

  /**
   * Resize the game
   */
  public resize(width: number, height: number): void {
    this.renderer.resize(width, height);
  }

  /**
   * Toggle debug mode
   */
  public toggleDebug(): void {
    this.debugSystem.toggle();
  }

  /**
   * Create offscreen canvas for Node.js
   */
  private createOffscreenCanvas(width: number, height: number): OffscreenCanvas {
    // In browser, use OffscreenCanvas
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(width, height);
    }
    
    // In Node.js, will be handled by CanvasRenderer with canvas package
    return {
      width,
      height,
      getContext: () => null
    } as any;
  }
}

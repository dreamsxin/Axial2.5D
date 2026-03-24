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
import { ModuleManager, ModuleConfig } from './ModuleManager';
import { MapData, DebugConfig, ProjectionConfig, MapConfig, TileData, SceneConfig } from './types';

export interface GameConfig {
  width: number;
  height: number;
  projection?: ProjectionConfig;
  debug?: Partial<DebugConfig>;
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  
  // Module system (Phase 5)
  modules?: ModuleConfig;
  
  // Legacy render callbacks (use renderHooks for more control)
  onBeforeRender?: (ctx: CanvasRenderingContext2D) => void;
  onAfterRender?: (ctx: CanvasRenderingContext2D) => void;
  
  // Render hook callbacks
  renderHooks?: {
    /** Called before clearing the canvas */
    onBeforeClear?: (ctx: CanvasRenderingContext2D) => void;
    /** Called after clearing, before rendering layers */
    onAfterClear?: (ctx: CanvasRenderingContext2D) => void;
    /** Called after rendering all layers, before effects */
    onAfterLayers?: (ctx: CanvasRenderingContext2D) => void;
    /** Called after rendering effects, before debug */
    onAfterEffects?: (ctx: CanvasRenderingContext2D) => void;
    /** Called after everything, before presenting */
    onBeforePresent?: (ctx: CanvasRenderingContext2D) => void;
  };
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
  public occlusionSystem: any = null; // OcclusionSystem (Phase 2)
  public moduleManager: ModuleManager | null = null; // ModuleManager (Phase 5)
  public modules: any = {}; // Shortcut to moduleManager.modules

  // Stats for monitoring (Phase 5)
  public stats = {
    fps: 0,
    frameTime: 0,
    drawCalls: 0,
    entityCount: 0
  };

  // Logger (Phase 5)
  public log: any = null;

  private running: boolean = false;
  private lastTime: number = 0;
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private moduleConfig?: ModuleConfig;
  private renderOptions: {
    layerCount?: number;
    showGrid?: boolean;
    foregroundAlpha?: number;
    zIndexStep?: number;
    parallaxRange?: number;
    maxDepth?: number;
  } = {
    showGrid: true,
    layerCount: 5,
    foregroundAlpha: 0.6,
    zIndexStep: 30,
    parallaxRange: 0.7,
    maxDepth: 2000
  };
  public onBeforeRender?: (ctx: CanvasRenderingContext2D) => void;
  public onAfterRender?: (ctx: CanvasRenderingContext2D) => void;
  public renderHooks?: {
    onBeforeClear?: (ctx: CanvasRenderingContext2D) => void;
    onAfterClear?: (ctx: CanvasRenderingContext2D) => void;
    onAfterLayers?: (ctx: CanvasRenderingContext2D) => void;
    onAfterEffects?: (ctx: CanvasRenderingContext2D) => void;
    onBeforePresent?: (ctx: CanvasRenderingContext2D) => void;
  };

  constructor(config: GameConfig) {
    // Initialize event bus first
    this.eventBus = new EventBus();

    // Store module config for later initialization
    this.moduleConfig = config.modules;

    // Create projection
    // Default viewAngle: 30° for true isometric projection (matches standalone.html)
    this.projection = new Projection(
      config.projection || { type: 'isometric', viewAngle: 30 }
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
    
    // Set render callbacks
    this.onBeforeRender = config.onBeforeRender;
    this.onAfterRender = config.onAfterRender;
    this.renderHooks = config.renderHooks;
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
    this.inputManager = new InputManager({
      canvas: this.canvas as HTMLCanvasElement,
      camera: this.renderer.camera,
      projection: this.projection,
      eventBus: this.eventBus,
      cellSize: mapData.tileW
    });

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

    // Initialize modules (Phase 5)
    if (this.moduleConfig) {
      this.moduleManager = new ModuleManager(this, this.moduleConfig);
      this.moduleManager.init();
      this.modules = this.moduleManager.modules;
      
      // Setup logger if UIManager module is enabled
      if (this.modules.uiManager?.log) {
        this.log = this.modules.uiManager.log;
      }
    }

    this.log?.info('Game initialized', { mapSize: `${mapData.width}x${mapData.height}` });
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

    // Update modules (Phase 5)
    if (this.modules.cameraController) {
      this.modules.cameraController.update();
    }
    if (this.modules.occlusionSystem) {
      this.modules.occlusionSystem.update();
    }
    if (this.modules.effectSystem) {
      this.modules.effectSystem.update(delta);
    }

    // Update debug stats and store in stats object
    this.debugSystem.updateFrameStats(delta);
    this.stats.fps = (this.debugSystem as any).stats?.fps ?? 0;
    this.stats.frameTime = (this.debugSystem as any).stats?.frameTime ?? 0;
    this.stats.drawCalls = (this.debugSystem as any).stats?.drawCalls ?? 0;
    this.stats.entityCount = (this.debugSystem as any).stats?.entityCount ?? 0;
  }

  /**
   * Render the game with extensible pipeline hooks
   * 
   * Render order:
   * 1. onBeforeClear - Before clearing canvas
   * 2. Clear canvas
   * 3. onAfterClear - After clearing, before layers
   * 4. Render layers (scene or default)
   * 5. onAfterLayers - After layers, before effects
   * 6. Render effects (if any registered)
   * 7. onAfterEffects - After effects, before debug
   * 8. Draw debug
   * 9. onBeforePresent - Before presenting frame
   * 10. Present frame
   */
  public render(): void {
    const ctx = this.renderer.ctx as CanvasRenderingContext2D;
    
    // Hook: Before clear
    if (this.renderHooks?.onBeforeClear) {
      this.renderHooks.onBeforeClear(ctx);
    }
    if (this.onBeforeRender) {
      this.onBeforeRender(ctx);
    }
    
    // Clear
    this.renderer.clear('#1a1a2e');
    
    // Hook: After clear
    if (this.renderHooks?.onAfterClear) {
      this.renderHooks.onAfterClear(ctx);
    }

    // Render current scene or default
    if (this.sceneManager.getCurrentScene()) {
      this.sceneManager.render('#1a1a2e');
    } else if (this.gridSystem && this.entityManager) {
      // Default render with layer support
      this.renderDefault();
    }
    
    // Hook: After layers / Render effects (Phase 5 - auto-render from modules)
    if (this.renderHooks?.onAfterLayers) {
      this.renderHooks.onAfterLayers(ctx);
    }
    
    // Auto-render effect system if module is enabled
    if (this.modules.effectSystem && this.modules.layerManager) {
      const layerCount = this.modules.layerManager.getLayerCount?.() ?? 5;
      for (let i = 0; i < layerCount; i++) {
        const layerInfo = this.modules.layerManager.getLayerStats?.(i) ?? { parallax: 1, alpha: 1 };
        this.modules.effectSystem.render(ctx, i, {
          parallaxFactor: layerInfo.parallax,
          alpha: layerInfo.alpha
        });
      }
    }

    // Auto-render debug panel if module is enabled
    if (this.modules.debugPanel?.isEnabled()) {
      this.modules.debugPanel.render(ctx);
    } else {
      // Fallback to legacy debug system
      this.debugSystem.draw(ctx);
    }
    
    // Hook: After effects / before present
    if (this.renderHooks?.onAfterEffects) {
      this.renderHooks.onAfterEffects(ctx);
    }
    if (this.renderHooks?.onBeforePresent) {
      this.renderHooks.onBeforePresent(ctx);
    }
    
    // Auto-update UI manager if module is enabled
    if (this.modules.uiManager) {
      this.modules.uiManager.updateAll?.();
    }
    
    // After render callback (legacy)
    if (this.onAfterRender) {
      this.onAfterRender(ctx);
    }
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
   * Set render options
   */
  public setRenderOptions(options: {
    layerCount?: number;
    showGrid?: boolean;
    foregroundAlpha?: number;
    zIndexStep?: number;
    parallaxRange?: number;
    maxDepth?: number;
  }): void {
    this.renderOptions = { ...this.renderOptions, ...options };
  }

  /**
   * Get current render options
   */
  public getRenderOptions(): typeof this.renderOptions {
    return { ...this.renderOptions };
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

  /**
   * Render with layer support (default implementation)
   * Renders ground tiles, entities, and grid lines organized by layers
   */
  public renderDefault(options?: {
    layerCount?: number;
    showGrid?: boolean;
    foregroundAlpha?: number;
    zIndexStep?: number;
    parallaxRange?: number;
    maxDepth?: number;
  }): void {
    if (!this.gridSystem || !this.entityManager) return;

    // Merge options: passed options > stored renderOptions > defaults
    const layerCount = options?.layerCount ?? this.renderOptions.layerCount ?? 5;
    const showGrid = options?.showGrid ?? this.renderOptions.showGrid ?? true;
    const foregroundAlpha = options?.foregroundAlpha ?? this.renderOptions.foregroundAlpha ?? 0.6;
    const zIndexStep = options?.zIndexStep ?? this.renderOptions.zIndexStep ?? 30;
    const parallaxRange = options?.parallaxRange ?? this.renderOptions.parallaxRange ?? 0.7;
    const maxDepth = options?.maxDepth ?? this.renderOptions.maxDepth ?? 2000;

    const ctx = this.renderer.ctx as CanvasRenderingContext2D;
    const camera = this.renderer.camera;

    // Render by layers (back to front): Layer 0 → Layer N
    for (let layerIdx = 0; layerIdx < layerCount; layerIdx++) {
      // Calculate layer properties
      const parallaxFactor = 0.3 + (layerIdx / (layerCount - 1)) * parallaxRange;
      const alpha = 1.0 - (1.0 - foregroundAlpha) * (layerIdx / (layerCount - 1));
      const zIndexOffset = layerIdx * zIndexStep;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Apply Z-axis offset for this layer
      if (zIndexOffset !== 0) {
        ctx.translate(0, -zIndexOffset);
      }

      // Render ground tiles for this layer (with grid lines if enabled)
      this.gridSystem.renderGround(ctx, camera, {
        layerIndex: layerIdx,
        layerCount,
        showGrid,
        parallaxFactor,
        maxDepth
      });

      // Render entities for this layer (with occlusion support)
      this.entityManager.render(ctx, {
        layerIndex: layerIdx,
        layerCount,
        maxDepth,
        parallaxFactor,
        occlusionSystem: this.occlusionSystem
      });

      ctx.restore();
    }
  }
}

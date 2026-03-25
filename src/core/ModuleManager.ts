/**
 * ModuleManager - Manages automatic component lifecycle and dependencies
 * 
 * Provides plugin system for auto-creating and mounting common components:
 * - CameraController
 * - OcclusionSystem
 * - EffectSystem
 * - UIManager (includes UIDataBinder)
 * - DebugPanel (includes DebugRenderer)
 * - PlayerController (Phase 6)
 * 
 * Usage:
 * ```typescript
 * const game = new Game({
 *   width: 800,
 *   height: 600,
 *   modules: {
 *     cameraController: { enabled: true, followEntity: 'player' },
 *     occlusionSystem: { enabled: true },
 *     effectSystem: { enabled: true },
 *     uiManager: { enabled: true, autoUpdate: true },
 *     debugPanel: { enabled: true },
 *     playerController: { enabled: true, entityId: 'player' }
 *   }
 * });
 * 
 * // Access modules
 * game.modules.cameraController?.followEntity('player');
 * game.modules.uiManager?.bind('fps', () => game.stats.fps);
 * ```
 */

import { Game } from './Game';
import { GridSystem } from '../world/GridSystem';
import { EntityManager } from '../world/EntityManager';
import { InputManager } from '../input/InputManager';
import { Projection } from './Projection';
import { IsoCamera } from './IsoCamera';
import { EventBus } from '../utils/EventBus';

// Import modules directly (no circular dependencies)
import { CameraController } from '../controllers/CameraController';
import { OcclusionSystem } from '../systems/OcclusionSystem';
import { EffectSystem } from '../effects/EffectSystem';
import { UIManager } from '../ui/UIManager';
import { DebugPanel } from '../debug/DebugPanel';
import { LayerManager } from './LayerManager';
import { PlayerController } from '../controllers/PlayerController';

export interface ModuleConfig {
  cameraController?: {
    enabled: boolean;
    followEntity?: string;
    smoothness?: number;
    autoParallax?: boolean;
  };
  occlusionSystem?: {
    enabled: boolean;
  };
  effectSystem?: {
    enabled: boolean;
  };
  uiManager?: {
    enabled: boolean;
    autoUpdate?: boolean;
    logElementId?: string;
  };
  debugPanel?: {
    enabled: boolean;
    showFPS?: boolean;
    showEntityInfo?: boolean;
    showCameraInfo?: boolean;
    showMouseInfo?: boolean;
  };
  layerManager?: {
    enabled: boolean;
    layerCount?: number;
    foregroundAlpha?: number;
    zIndexStep?: number;
    parallaxRange?: number;
  };
  playerController?: {
    enabled: boolean;
    entityId: string;
    clickToMove?: boolean;
    wasdKeys?: boolean;
  };
}

export interface GameModules {
  cameraController?: CameraController;
  occlusionSystem?: OcclusionSystem;
  effectSystem?: EffectSystem;
  uiManager?: UIManager;
  debugPanel?: DebugPanel;
  layerManager?: LayerManager;
  playerController?: any; // PlayerController type (circular dep)
}

export class ModuleManager {
  private game: Game;
  private config: ModuleConfig;
  public modules: GameModules = {};
  private initialized: boolean = false;

  constructor(game: Game, config: ModuleConfig = {}) {
    this.game = game;
    this.config = config;
  }

  /**
   * Initialize all enabled modules
   * Called after game.init() when all core systems are ready
   */
  public init(): void {
    if (this.initialized) {
      console.warn('ModuleManager already initialized');
      return;
    }

    // Initialize in dependency order
    this.initLayerManager();
    this.initCameraController();
    this.initOcclusionSystem();
    this.initEffectSystem();
    this.initUIManager();
    this.initDebugPanel();
    this.initPlayerController(); // Phase 6

    this.initialized = true;
    this.game.log?.info('Modules initialized', Object.keys(this.modules));
  }

  /**
   * Initialize LayerManager
   */
  private initLayerManager(): void {
    const cfg = this.config.layerManager;
    if (!cfg?.enabled) return;

    try {
      this.modules.layerManager = new LayerManager({
        layerCount: cfg.layerCount ?? 5,
        foregroundAlpha: cfg.foregroundAlpha ?? this.game.config?.get('render.foregroundAlpha') ?? 0.6,
        zIndexStep: cfg.zIndexStep ?? this.game.config?.get('render.zIndexStep') ?? 30,
        parallaxRange: cfg.parallaxRange ?? this.game.config?.get('render.parallaxRange') ?? 0.7,
        eventBus: this.game.eventBus
      });
      this.game.log?.success('Module: LayerManager initialized');
    } catch (error) {
      this.game.log?.error('Failed to initialize LayerManager', error);
    }
  }

  /**
   * Initialize CameraController
   */
  private initCameraController(): void {
    const cfg = this.config.cameraController;
    if (!cfg?.enabled) return;
    if (!this.game.gridSystem || !this.game.entityManager) {
      console.warn('CameraController requires gridSystem and entityManager to be initialized');
      return;
    }

    try {
      this.modules.cameraController = new CameraController({
        camera: this.game.renderer.camera,
        projection: this.game.projection,
        gridSystem: this.game.gridSystem,
        entityManager: this.game.entityManager,
        layerCount: this.modules.layerManager?.getLayerCount() ?? 5,
        maxDepth: 2000,
        parallaxRange: cfg.autoParallax !== false ? 0.7 : 0,
        baseParallax: 0.3
      });

      // Auto-follow entity if specified
      if (cfg.followEntity) {
        this.modules.cameraController.follow({
          entityId: cfg.followEntity,
          smoothness: cfg.smoothness ?? 0.1,
          autoParallax: cfg.autoParallax ?? true
        });
        this.modules.cameraController.centerOnEntity(cfg.followEntity);
      }

      this.game.log?.success(`Module: CameraController initialized (following: ${cfg.followEntity || 'none'})`);
    } catch (error) {
      this.game.log?.error('Failed to initialize CameraController', error);
    }
  }

  /**
   * Initialize OcclusionSystem
   */
  private initOcclusionSystem(): void {
    const cfg = this.config.occlusionSystem;
    if (!cfg?.enabled) return;
    if (!this.game.entityManager || !this.game.gridSystem) {
      console.warn('OcclusionSystem requires entityManager and gridSystem to be initialized');
      return;
    }

    try {
      this.modules.occlusionSystem = new OcclusionSystem({
        entityManager: this.game.entityManager,
        gridSystem: this.game.gridSystem,
        tileSize: this.game.gridSystem.getTileSize().width
      });

      // Register with game for renderer integration
      this.game.occlusionSystem = this.modules.occlusionSystem;

      this.game.log?.success('Module: OcclusionSystem initialized');
    } catch (error) {
      this.game.log?.error('Failed to initialize OcclusionSystem', error);
    }
  }

  /**
   * Initialize EffectSystem
   */
  private initEffectSystem(): void {
    const cfg = this.config.effectSystem;
    if (!cfg?.enabled) return;

    try {
      this.modules.effectSystem = new EffectSystem(
        this.game.renderer.camera,
        this.game.projection,
        this.modules.layerManager?.getLayerCount() ?? 5,
        this.modules.layerManager  // Pass for statistics tracking (Phase 6)
      );

      this.game.log?.success('Module: EffectSystem initialized');
    } catch (error) {
      this.game.log?.error('Failed to initialize EffectSystem', error);
    }
  }

  /**
   * Initialize UIManager (includes UIDataBinder)
   */
  private initUIManager(): void {
    const cfg = this.config.uiManager;
    if (!cfg?.enabled) return;

    try {
      this.modules.uiManager = new UIManager(this.game.eventBus);
      if (this.game.inputManager) {
        this.modules.uiManager.setInputManager(this.game.inputManager);
      }
      
      // Store game reference for LayerList and other components
      (this.modules.uiManager as any).game = this.game;

      // Attach logger to DOM if specified
      if (cfg.logElementId) {
        this.modules.uiManager.attachLogToElement(cfg.logElementId);
      }

      // Enable auto-update if configured
      if (cfg.autoUpdate) {
        this.game.renderHooks = this.game.renderHooks || {};
        const originalBeforePresent = this.game.renderHooks.onBeforePresent;
        this.game.renderHooks.onBeforePresent = (ctx) => {
          originalBeforePresent?.(ctx);
          this.modules.uiManager?.updateAll();
        };
      }

      this.game.log?.success('Module: UIManager initialized');
    } catch (error) {
      this.game.log?.error('Failed to initialize UIManager', error);
    }
  }

  /**
   * Initialize DebugPanel (includes DebugRenderer)
   */
  private initDebugPanel(): void {
    const cfg = this.config.debugPanel;
    if (!cfg?.enabled) return;
    if (!this.game.gridSystem) {
      console.warn('DebugPanel requires gridSystem to be initialized');
      return;
    }

    try {
      this.modules.debugPanel = new DebugPanel(
        this.game,
        this.game.gridSystem,
        this.game.renderer.camera,
        this.game.projection
      );

      // Configure default debug items
      if (cfg.showFPS !== false) this.modules.debugPanel.showFPS(true);
      if (cfg.showEntityInfo) this.modules.debugPanel.showEntityInfo(true);
      if (cfg.showCameraInfo) this.modules.debugPanel.showCameraInfo(true);
      if (cfg.showMouseInfo) this.modules.debugPanel.showMouseInfo(true);

      // Integrate into render pipeline
      this.game.renderHooks = this.game.renderHooks || {};
      const originalAfterLayers = this.game.renderHooks.onAfterLayers;
      this.game.renderHooks.onAfterLayers = (ctx) => {
        originalAfterLayers?.(ctx);
        if (this.modules.debugPanel?.isEnabled()) {
          this.modules.debugPanel.render(ctx);
        }
      };

      this.game.log?.success('Module: DebugPanel initialized');
    } catch (error) {
      this.game.log?.error('Failed to initialize DebugPanel', error);
    }
  }

  /**
   * Initialize PlayerController (Phase 6)
   */
  private initPlayerController(): void {
    const cfg = this.config.playerController;
    if (!cfg?.enabled) return;
    if (!this.game.inputManager || !this.game.gridSystem || !this.game.entityManager) {
      console.warn('PlayerController requires inputManager, gridSystem, and entityManager');
      return;
    }

    try {
      this.modules.playerController = new PlayerController(cfg.entityId, {
        inputManager: this.game.inputManager,
        gridSystem: this.game.gridSystem,
        entityManager: this.game.entityManager,
        eventBus: this.game.eventBus,
        allowClickToMove: cfg.clickToMove !== false,
        allowKeyboardMove: cfg.wasdKeys !== false
      });

      this.modules.playerController.enable();
      this.game.log?.success(`Module: PlayerController initialized (entity: ${cfg.entityId})`);
    } catch (error) {
      this.game.log?.error('Failed to initialize PlayerController', error);
    }
  }

  /**
   * Get a module by name
   */
  public getModule<T extends keyof GameModules>(name: T): GameModules[T] {
    return this.modules[name];
  }

  /**
   * Check if a module is enabled and initialized
   */
  public isModuleEnabled(name: keyof GameModules): boolean {
    return this.modules[name] !== undefined;
  }

  /**
   * Get all initialized module names
   */
  public getInitializedModules(): string[] {
    return Object.keys(this.modules);
  }
}

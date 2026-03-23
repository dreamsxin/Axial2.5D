/**
 * SceneManager - Manages game scenes and scene transitions
 */

import { Projection } from '../core/Projection';
import { CanvasRenderer } from '../core/CanvasRenderer';
import { GridSystem } from '../world/GridSystem';
import { EntityManager, BasicEntity } from '../world/EntityManager';
import { PathFinder } from '../world/PathFinder';
import { EventBus } from '../utils/EventBus';
import { ProjectionConfig, MapData, EntityConfig, SceneConfig } from '../core/types';

export interface Scene {
  name: string;
  projection: Projection;
  renderer: CanvasRenderer;
  gridSystem: GridSystem;
  entityManager: EntityManager;
  pathFinder: PathFinder;
  update: (delta: number) => void;
  onEnter?: () => void;
  onExit?: () => void;
}

export class SceneManager {
  private scenes: Map<string, Scene> = new Map();
  private currentScene: Scene | null = null;
  private eventBus: EventBus;
  private canvasWidth: number;
  private canvasHeight: number;

  constructor(
    canvasWidth: number,
    canvasHeight: number,
    eventBus: EventBus
  ) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.eventBus = eventBus;
  }

  /**
   * Create and register a scene from config
   */
  public createScene(config: SceneConfig): Scene {
    // Create projection
    const projection = new Projection(config.projection);
    
    // Create renderer
    const renderer = new CanvasRenderer(
      this.canvasWidth,
      this.canvasHeight,
      projection
    );
    
    // Create camera (accessible via renderer)
    const camera = renderer.camera;
    
    // Create grid system
    const mapData: MapData = {
      width: config.mapData.width,
      height: config.mapData.height,
      tileW: config.mapData.tileW,
      tileH: config.mapData.tileH,
      tiles: config.mapData.tiles
    };
    
    const gridSystem = new GridSystem(mapData, projection);
    
    // Create entity manager
    const entityManager = new EntityManager(gridSystem, projection, camera);
    
    // Create path finder
    const pathFinder = new PathFinder();
    
    // Create scene object
    const scene: Scene = {
      name: config.name,
      projection,
      renderer,
      gridSystem,
      entityManager,
      pathFinder,
      update: (delta: number) => {
        entityManager.updateAll(delta);
      },
      onEnter: () => {
        // Load entities from config
        if (config.entities) {
          for (const entityConfig of config.entities) {
            const entity = new BasicEntity(
              entityConfig.id,
              entityConfig.col,
              entityConfig.row,
              '#ff6b6b',
              20,
              entityConfig.height || 30
            );
            entityManager.addEntity(entity);
          }
        }
      },
      onExit: () => {
        entityManager.clear();
      }
    };
    
    this.scenes.set(config.name, scene);
    
    return scene;
  }

  /**
   * Register an existing scene
   */
  public registerScene(scene: Scene): void {
    this.scenes.set(scene.name, scene);
  }

  /**
   * Switch to a scene by name
   */
  public switchTo(sceneName: string): void {
    const scene = this.scenes.get(sceneName);
    if (!scene) {
      console.error(`Scene "${sceneName}" not found`);
      return;
    }
    
    // Exit current scene
    if (this.currentScene) {
      if (this.currentScene.onExit) {
        this.currentScene.onExit();
      }
      this.eventBus.emit('sceneExit', { name: this.currentScene.name });
    }
    
    // Enter new scene
    this.currentScene = scene;
    
    if (scene.onEnter) {
      scene.onEnter();
    }
    
    this.eventBus.emit('sceneEnter', { name: scene.name });
  }

  /**
   * Get current scene
   */
  public getCurrentScene(): Scene | null {
    return this.currentScene;
  }

  /**
   * Get a scene by name
   */
  public getScene(name: string): Scene | undefined {
    return this.scenes.get(name);
  }

  /**
   * Get all registered scene names
   */
  public getSceneNames(): string[] {
    return Array.from(this.scenes.keys());
  }

  /**
   * Remove a scene
   */
  public removeScene(name: string): void {
    const scene = this.scenes.get(name);
    if (scene) {
      if (scene === this.currentScene) {
        this.currentScene = null;
      }
      if (scene.onExit) {
        scene.onExit();
      }
      this.scenes.delete(name);
    }
  }

  /**
   * Update current scene
   */
  public update(delta: number): void {
    if (this.currentScene) {
      this.currentScene.update(delta);
    }
  }

  /**
   * Render current scene
   */
  public render(clearColor: string = '#1a1a2e'): void {
    if (!this.currentScene) return;
    
    const { renderer, gridSystem, entityManager } = this.currentScene;
    
    // Clear and render
    renderer.clear(clearColor);
    
    // Add ground tiles
    const groundItems = gridSystem.buildGroundRenderItems();
    renderer.addRenderItems(groundItems);
    
    // Add entities
    const entityItems = entityManager.getRenderItems();
    renderer.addRenderItems(entityItems);
    
    // Render all
    renderer.render();
    
    // Clear render queue for next frame
    renderer.clearRenderItems();
  }
}

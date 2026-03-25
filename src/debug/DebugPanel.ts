/**
 * DebugPanel - Built-in debug visualization panel
 * 
 * Provides automatic debug information display:
 * - FPS and performance stats
 * - Entity information
 * - Camera information
 * - Mouse position and tile highlight
 * - Custom debug items
 * 
 * Usage:
 * ```typescript
 * // Auto-initialized via ModuleManager
 * const game = new Game({
 *   modules: {
 *     debugPanel: {
 *       enabled: true,
 *       showFPS: true,
 *       showMouseInfo: true
 *     }
 *   }
 * });
 * 
 * // Manual usage
 * const debugPanel = new DebugPanel(game, gridSystem, camera, projection);
 * debugPanel.showFPS(true);
 * debugPanel.addText('custom', () => `Custom: ${value}`);
 * debugPanel.addTileHighlight('mouse', () => mouseGridPos);
 * ```
 */

import { Game } from '../core/Game';
import { GridSystem } from '../world/GridSystem';
import { IsoCamera } from '../core/IsoCamera';
import { Projection } from '../core/Projection';
import { DebugRenderer } from './DebugRenderer';

export interface DebugPanelConfig {
  showFPS?: boolean;
  showEntityInfo?: boolean;
  showCameraInfo?: boolean;
  showMouseInfo?: boolean;
  showStats?: boolean;
}

export class DebugPanel {
  private game: Game;
  private gridSystem: GridSystem;
  private camera: IsoCamera;
  private projection: Projection;
  private debugRenderer: DebugRenderer;
  private config: DebugPanelConfig;
  private enabled: boolean = false;

  constructor(
    game: Game,
    gridSystem: GridSystem,
    camera: IsoCamera,
    projection: Projection,
    config: DebugPanelConfig = {}
  ) {
    this.game = game;
    this.gridSystem = gridSystem;
    this.camera = camera;
    this.projection = projection;
    this.debugRenderer = new DebugRenderer();
    this.config = {
      showFPS: true,
      showEntityInfo: false,
      showCameraInfo: false,
      showMouseInfo: false,
      showStats: false,
      ...config
    };

    this.setupDefaultItems();
  }

  /**
   * Setup default debug items based on config
   */
  private setupDefaultItems(): void {
    if (this.config.showFPS) {
      this.addText('fps', {
        getText: () => `FPS: ${this.game.stats?.fps ?? 0}`,
        x: 10, y: 20, color: '#0f0'
      });
    }

    if (this.config.showStats) {
      this.addText('stats', {
        getText: () => {
          const stats = this.game.stats;
          return `Entities: ${stats?.entityCount ?? 0} | Draw calls: ${stats?.drawCalls ?? 0}`;
        },
        x: 10, y: 36, color: '#fff'
      });
    }

    if (this.config.showEntityInfo) {
      this.addText('player', {
        getText: () => {
          const player = this.game.entityManager?.getEntity('player');
          return player ? `Player: (${player.col}, ${player.row})` : 'Player: N/A';
        },
        x: 10, y: 52, color: '#4a90d9'
      });
    }

    if (this.config.showCameraInfo) {
      this.addText('camera', {
        getText: () => {
          return `Camera: (${this.camera.offsetX.toFixed(0)}, ${this.camera.offsetY.toFixed(0)}) zoom:${this.camera.scale.toFixed(2)}`;
        },
        x: 10, y: 68, color: '#aaa'
      });
    }

    if (this.config.showMouseInfo) {
      this.addText('mouse', {
        getText: () => {
          const inputManager = this.game.inputManager;
          if (!inputManager) return 'Mouse: N/A';
          
          const mouseState = inputManager.mouseState;
          const player = this.game.entityManager?.getEntity('player');
          const mouseInfo = inputManager.getMouseGridPosition(
            player?.col ?? 0,
            player?.row ?? 0
          );
          
          return `Mouse: Screen(${mouseState.screenX.toFixed(0)}, ${mouseState.screenY.toFixed(0)}) Grid(${mouseInfo.col}, ${mouseInfo.row}) L${mouseInfo.layer}`;
        },
        x: 10, y: 84, color: '#ff0'
      });

      this.addTileHighlight('mouse', {
        getTile: () => {
          const inputManager = this.game.inputManager;
          if (!inputManager) return null;
          
          const player = this.game.entityManager?.getEntity('player');
          const mouseInfo = inputManager.getMouseGridPosition(
            player?.col ?? 0,
            player?.row ?? 0
          );
          return { col: mouseInfo.col, row: mouseInfo.row };
        },
        color: '#ff0',
        lineWidth: 2,
        alpha: 0.4
      });
    }
  }

  /**
   * Enable/disable the debug panel
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.debugRenderer.setEnabledGlobal(enabled);
  }

  /**
   * Toggle the debug panel
   */
  public toggle(): void {
    this.setEnabled(!this.enabled);
  }

  /**
   * Check if debug panel is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Show/hide FPS display
   */
  public showFPS(show: boolean): void {
    if (show && !this.config.showFPS) {
      this.config.showFPS = true;
      this.debugRenderer.addText('fps', {
        getText: () => `FPS: ${this.game.stats?.fps ?? 0}`,
        x: 10, y: 20, color: '#0f0'
      });
    } else if (!show) {
      this.config.showFPS = false;
      this.debugRenderer.remove('fps');
    }
  }

  /**
   * Show/hide entity info
   */
  public showEntityInfo(show: boolean): void {
    if (show && !this.config.showEntityInfo) {
      this.config.showEntityInfo = true;
      this.debugRenderer.addText('player', {
        getText: () => {
          const player = this.game.entityManager?.getEntity('player');
          return player ? `Player: (${player.col}, ${player.row})` : 'Player: N/A';
        },
        x: 10, y: 52, color: '#4a90d9'
      });
    } else if (!show) {
      this.config.showEntityInfo = false;
      this.debugRenderer.remove('player');
    }
  }

  /**
   * Show/hide camera info
   */
  public showCameraInfo(show: boolean): void {
    if (show && !this.config.showCameraInfo) {
      this.config.showCameraInfo = true;
      this.debugRenderer.addText('camera', {
        getText: () => `Camera: (${this.camera.offsetX.toFixed(0)}, ${this.camera.offsetY.toFixed(0)}) zoom:${this.camera.scale.toFixed(2)}`,
        x: 10, y: 68, color: '#aaa'
      });
    } else if (!show) {
      this.config.showCameraInfo = false;
      this.debugRenderer.remove('camera');
    }
  }

  /**
   * Show/hide mouse info (text + highlight)
   */
  public showMouseInfo(show: boolean): void {
    if (show && !this.config.showMouseInfo) {
      this.config.showMouseInfo = true;
      this.setupDefaultItems(); // Re-add mouse items
    } else if (!show) {
      this.config.showMouseInfo = false;
      this.debugRenderer.remove('mouse');
      this.debugRenderer.remove('mouseHighlight');
    }
  }

  /**
   * Add custom debug text
   */
  public addText(
    id: string,
    options: {
      getText: () => string;
      x: number;
      y: number;
      color?: string;
      font?: string;
    }
  ): void {
    this.debugRenderer.addText(id, options);
  }

  /**
   * Add custom tile highlight
   */
  public addTileHighlight(
    id: string,
    options: {
      getTile: () => { col: number; row: number } | null;
      color?: string;
      lineWidth?: number;
      alpha?: number;
    }
  ): void {
    this.debugRenderer.addTileHighlight(id, options);
  }

  /**
   * Remove a debug item
   */
  public remove(id: string): void {
    this.debugRenderer.remove(id);
  }

  /**
   * Clear all debug items
   */
  public clear(): void {
    this.debugRenderer.clear();
  }

  /**
   * Render debug panel (called by Game render pipeline)
   */
  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.enabled) return;

    const player = this.game.entityManager?.getEntity('player');
    this.debugRenderer.render(ctx, this.gridSystem, this.camera, this.projection, {
      playerCol: player?.col ?? 0,
      playerRow: player?.row ?? 0,
      layerCount: 5,
      maxDepth: 2000,
      parallaxRange: 0.7,
      baseParallax: 0.3
    });
  }

  /**
   * Get the underlying DebugRenderer instance
   */
  public getDebugRenderer(): DebugRenderer {
    return this.debugRenderer;
  }
}

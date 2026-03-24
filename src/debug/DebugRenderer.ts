/**
 * DebugRenderer - Unified debug drawing system
 * Allows registering debug text, shapes, and highlights
 */

export interface DebugTextConfig {
  getText: () => string;
  x: number;
  y: number;
  color?: string;
  font?: string;
}

export interface DebugShapeConfig {
  draw: (ctx: CanvasRenderingContext2D) => void;
  visible?: () => boolean;
}

export interface DebugTileHighlight {
  getTile: () => { col: number; row: number } | null;
  color: string;
  lineWidth?: number;
}

export class DebugRenderer {
  private texts: DebugTextConfig[] = [];
  private shapes: DebugShapeConfig[] = [];
  private tileHighlights: DebugTileHighlight[] = [];
  private enabled: boolean = false;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor() {}

  /**
   * Set canvas context for rendering
   */
  public setContext(ctx: CanvasRenderingContext2D): void {
    this.ctx = ctx;
  }

  /**
   * Enable/disable debug rendering
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if debug is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Toggle debug rendering
   */
  public toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  /**
   * Add debug text
   */
  public addText(config: DebugTextConfig): void {
    this.texts.push(config);
  }

  /**
   * Remove debug text by index
   */
  public removeText(index: number): void {
    this.texts.splice(index, 1);
  }

  /**
   * Clear all debug texts
   */
  public clearTexts(): void {
    this.texts = [];
  }

  /**
   * Add debug shape
   */
  public addShape(config: DebugShapeConfig): void {
    this.shapes.push(config);
  }

  /**
   * Remove debug shape by index
   */
  public removeShape(index: number): void {
    this.shapes.splice(index, 1);
  }

  /**
   * Clear all debug shapes
   */
  public clearShapes(): void {
    this.shapes = [];
  }

  /**
   * Add tile highlight
   */
  public addTileHighlight(config: DebugTileHighlight): void {
    this.tileHighlights.push(config);
  }

  /**
   * Remove tile highlight by index
   */
  public removeTileHighlight(index: number): void {
    this.tileHighlights.splice(index, 1);
  }

  /**
   * Clear all tile highlights
   */
  public clearTileHighlights(): void {
    this.tileHighlights = [];
  }

  /**
   * Render all debug elements
   */
  public render(ctx: CanvasRenderingContext2D, gridSystem?: any, camera?: any, projection?: any): void {
    if (!this.enabled || !ctx) return;

    this.ctx = ctx;

    // Render texts
    for (const text of this.texts) {
      this.renderText(text);
    }

    // Render shapes
    for (const shape of this.shapes) {
      if (!shape.visible || shape.visible()) {
        shape.draw(ctx);
      }
    }

    // Render tile highlights
    for (const highlight of this.tileHighlights) {
      this.renderTileHighlight(highlight, gridSystem, camera, projection);
    }
  }

  /**
   * Render debug text
   */
  private renderText(config: DebugTextConfig): void {
    const text = config.getText();
    this.ctx!.fillStyle = config.color ?? '#0f0';
    this.ctx!.font = config.font ?? '12px monospace';
    this.ctx!.textAlign = 'left';
    this.ctx!.fillText(text, config.x, config.y);
  }

  /**
   * Render tile highlight
   */
  private renderTileHighlight(
    config: DebugTileHighlight,
    gridSystem: any,
    camera: any,
    projection: any
  ): void {
    if (!gridSystem || !camera || !projection) return;

    const tile = config.getTile();
    if (!tile) return;

    const worldPos = gridSystem.gridToWorld(tile.col, tile.row);
    const cellSize = gridSystem.getTileSize ? gridSystem.getTileSize().width : 50;

    const corners = [
      camera.worldToScreen(worldPos.x, worldPos.y, 0, projection, 1.0),
      camera.worldToScreen(worldPos.x + cellSize, worldPos.y, 0, projection, 1.0),
      camera.worldToScreen(worldPos.x + cellSize, worldPos.y + cellSize, 0, projection, 1.0),
      camera.worldToScreen(worldPos.x, worldPos.y + cellSize, 0, projection, 1.0)
    ];

    this.ctx!.save();
    this.ctx!.beginPath();
    this.ctx!.moveTo(corners[0].sx, corners[0].sy);
    for (let i = 1; i < 4; i++) {
      this.ctx!.lineTo(corners[i].sx, corners[i].sy);
    }
    this.ctx!.closePath();
    this.ctx!.strokeStyle = config.color;
    this.ctx!.lineWidth = config.lineWidth ?? 2;
    this.ctx!.stroke();
    this.ctx!.restore();
  }

  /**
   * Clear all debug elements
   */
  public clear(): void {
    this.clearTexts();
    this.clearShapes();
    this.clearTileHighlights();
  }
}

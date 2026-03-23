/**
 * CanvasRenderer - Main rendering engine with depth sorting
 */

import { Projection } from './Projection';
import { IsoCamera } from './IsoCamera';
import { RenderItem } from './types';

export class CanvasRenderer {
  public canvas: HTMLCanvasElement | OffscreenCanvas;
  public ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  public camera: IsoCamera;
  public projection: Projection;
  
  private renderItems: RenderItem[] = [];
  private width: number;
  private height: number;

  constructor(
    width: number,
    height: number,
    projection: Projection,
    canvas?: HTMLCanvasElement | OffscreenCanvas
  ) {
    this.width = width;
    this.height = height;
    this.projection = projection;
    this.camera = new IsoCamera(width, height);
    
    if (canvas) {
      this.canvas = canvas;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // Canvas provided but context failed - create mock context
        console.warn('Canvas context not available. Running in mock mode.');
        this.ctx = this.createMockContext(width, height);
      } else {
        this.ctx = ctx;
      }
    } else {
      // Try browser environment first
      if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        // Browser environment - create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
      } else if (typeof OffscreenCanvas !== 'undefined' && typeof process === 'undefined') {
        // OffscreenCanvas available (modern browsers/workers, not Node.js)
        this.canvas = new OffscreenCanvas(width, height);
        this.ctx = this.canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
      } else {
        // Node.js - try to use canvas package if available
        try {
          const { createCanvas } = require('canvas');
          this.canvas = createCanvas(width, height);
          this.ctx = this.canvas.getContext('2d') as any;
        } catch (e) {
          // Fallback: create a mock canvas for testing purposes
          console.warn('Canvas package not available. Running in mock mode.');
          this.canvas = { width, height } as any;
          this.ctx = {
          save: () => {},
          restore: () => {},
          setTransform: () => {},
          fillRect: () => {},
          clearRect: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          closePath: () => {},
          fill: () => {},
          stroke: () => {},
          arc: () => {},
          rect: () => {},
          fillText: () => {},
          strokeRect: () => {},
          drawImage: () => {},
          translate: () => {},
          scale: () => {},
          rotate: () => {},
          createImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }),
          putImageData: () => {},
          getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }),
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          font: '12px sans-serif',
          textAlign: 'start',
          textBaseline: 'alphabetic',
          globalAlpha: 1,
          globalCompositeOperation: 'source-over'
        } as any;
        }
      }
    }
  }

  /**
   * Create a mock canvas context for environments without canvas support
   */
  private createMockContext(width: number, height: number): any {
    return {
      save: () => {},
      restore: () => {},
      setTransform: () => {},
      fillRect: () => {},
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      fill: () => {},
      stroke: () => {},
      arc: () => {},
      rect: () => {},
      fillText: () => {},
      strokeRect: () => {},
      drawImage: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      createImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }),
      putImageData: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '12px sans-serif',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over'
    };
  }

  /**
   * Add a single render item to the queue
   */
  public addRenderItem(item: RenderItem): void {
    this.renderItems.push(item);
  }

  /**
   * Add multiple render items to the queue
   */
  public addRenderItems(items: RenderItem[]): void {
    this.renderItems.push(...items);
  }

  /**
   * Clear all render items from the queue
   */
  public clearRenderItems(): void {
    this.renderItems = [];
  }

  /**
   * Convert world coordinates to screen coordinates (with camera applied)
   */
  public worldToScreen(x: number, z: number, y: number = 0): { sx: number; sy: number } {
    const screenPos = this.projection.worldToScreen(x, z, y);
    return this.camera.cameraToScreen(screenPos.sx, screenPos.sy);
  }

  /**
   * Clear the canvas
   */
  public clear(color: string = '#000000'): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.restore();
  }

  /**
   * Render all items with depth sorting
   */
  public render(): void {
    // Sort by depth (ascending - smaller depth = further away = drawn first)
    this.renderItems.sort((a, b) => a.depth - b.depth);
    
    // Apply camera transform
    this.camera.applyTransform(this.ctx as CanvasRenderingContext2D);
    
    // Draw all items
    for (const item of this.renderItems) {
      if (item.update) {
        item.update(16); // Default 60fps delta
      }
      item.draw(this.ctx as CanvasRenderingContext2D);
    }
    
    // Reset camera transform
    this.camera.resetTransform(this.ctx as CanvasRenderingContext2D);
  }

  /**
   * Render with a custom clear color and optional background
   */
  public renderFrame(clearColor: string = '#1a1a2e'): void {
    this.clear(clearColor);
    this.render();
  }

  /**
   * Get current render item count
   */
  public getRenderItemCount(): number {
    return this.renderItems.length;
  }

  /**
   * Resize the renderer
   */
  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    
    if ('width' in this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    
    this.camera.setCanvasSize(width, height);
  }

  /**
   * Get canvas as data URL (for screenshots)
   */
  public toDataURL(type: string = 'image/png'): string {
    if ('toDataURL' in this.canvas) {
      return this.canvas.toDataURL(type);
    }
    throw new Error('Canvas does not support toDataURL');
  }
}

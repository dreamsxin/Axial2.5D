/**
 * InputManager - Handles mouse, keyboard, and touch input
 * Converts screen coordinates to world coordinates using projection
 */

import { Projection } from '../core/Projection';
import { IsoCamera } from '../core/IsoCamera';
import { EventBus } from '../utils/EventBus';
import { InputEvent, InputEventType } from '../core/types';

export class InputManager {
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private camera: IsoCamera;
  private projection: Projection;
  private eventBus: EventBus;
  
  private blocking: boolean = false;
  private mouseState: { x: number; y: number; down: boolean } = { x: 0, y: 0, down: false };
  private keys: Map<string, boolean> = new Map();
  
  private lastClickTime: number = 0;
  private dragThreshold: number = 5;
  private isDragging: boolean = false;
  private dragStart: { x: number; y: number } | null = null;

  constructor(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    camera: IsoCamera,
    projection: Projection,
    eventBus: EventBus
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.projection = projection;
    this.eventBus = eventBus;
  }

  /**
   * Initialize input listeners
   */
  public init(): void {
    if (typeof window !== 'undefined' && this.canvas instanceof HTMLCanvasElement) {
      this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
      this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
      this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
      this.canvas.addEventListener('click', this.onClick.bind(this));
      this.canvas.addEventListener('wheel', this.onWheel.bind(this));
      this.canvas.addEventListener('keydown', this.onKeyDown.bind(this));
      this.canvas.addEventListener('keyup', this.onKeyUp.bind(this));
      
      // Touch events
      this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
      this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
      this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
    }
  }

  /**
   * Destroy input listeners
   */
  public destroy(): void {
    if (typeof window !== 'undefined' && this.canvas instanceof HTMLCanvasElement) {
      this.canvas.removeEventListener('mousedown', this.onMouseDown.bind(this));
      this.canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
      this.canvas.removeEventListener('mouseup', this.onMouseUp.bind(this));
      this.canvas.removeEventListener('click', this.onClick.bind(this));
      this.canvas.removeEventListener('wheel', this.onWheel.bind(this));
      this.canvas.removeEventListener('keydown', this.onKeyDown.bind(this));
      this.canvas.removeEventListener('keyup', this.onKeyUp.bind(this));
      this.canvas.removeEventListener('touchstart', this.onTouchStart.bind(this));
      this.canvas.removeEventListener('touchmove', this.onTouchMove.bind(this));
      this.canvas.removeEventListener('touchend', this.onTouchEnd.bind(this));
    }
  }

  /**
   * Set input blocking (used by UI manager)
   */
  public setBlocking(block: boolean): void {
    this.blocking = block;
  }

  /**
   * Check if a key is currently pressed
   */
  public isKeyPressed(key: string): boolean {
    return this.keys.get(key) || false;
  }

  /**
   * Get current mouse state
   */
  public getMouseState(): { x: number; y: number; down: boolean } {
    return { ...this.mouseState };
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  public getWorldPositionFromScreen(screenX: number, screenY: number): { x: number; z: number } {
    // Get canvas bounds
    let canvasX = screenX;
    let canvasY = screenY;
    
    if (typeof window !== 'undefined' && this.canvas instanceof HTMLCanvasElement) {
      const rect = this.canvas.getBoundingClientRect();
      canvasX = (screenX - rect.left) * (this.canvas.width / rect.width);
      canvasY = (screenY - rect.top) * (this.canvas.height / rect.height);
    }

    // Reverse camera transform
    const cameraSpace = this.camera.screenToCameraSpace(canvasX, canvasY);
    
    // Apply projection inverse
    const worldPos = this.projection.screenToWorld(cameraSpace.sx, cameraSpace.sy, 0);
    
    return { x: worldPos.x, z: worldPos.z };
  }

  // Event Handlers
  private onMouseDown(event: MouseEvent): void {
    if (this.blocking) return;
    
    this.mouseState.down = true;
    this.dragStart = { x: event.clientX, y: event.clientY };
    this.isDragging = false;
    
    this.eventBus.emit('mousedown', {
      type: 'mousedown',
      screenX: event.clientX,
      screenY: event.clientY,
      button: event.button
    });
  }

  private onMouseMove(event: MouseEvent): void {
    this.mouseState.x = event.clientX;
    this.mouseState.y = event.clientY;
    
    const worldPos = this.getWorldPositionFromScreen(event.clientX, event.clientY);
    
    // Check for drag
    if (this.mouseState.down && this.dragStart) {
      const dx = event.clientX - this.dragStart.x;
      const dy = event.clientY - this.dragStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > this.dragThreshold) {
        this.isDragging = true;
        this.eventBus.emit('dragMove', {
          type: 'mousemove',
          deltaX: dx,
          deltaY: dy
        });
      }
    }
    
    this.eventBus.emit('mousemove', {
      type: 'mousemove',
      screenX: event.clientX,
      screenY: event.clientY,
      worldX: worldPos.x,
      worldZ: worldPos.z
    });
  }

  private onMouseUp(event: MouseEvent): void {
    if (this.blocking) return;
    
    this.mouseState.down = false;
    this.dragStart = null;
    this.isDragging = false;
    
    this.eventBus.emit('mouseup', {
      type: 'mouseup',
      screenX: event.clientX,
      screenY: event.clientY,
      button: event.button
    });
  }

  private onClick(event: MouseEvent): void {
    if (this.blocking || this.isDragging) return;
    
    const worldPos = this.getWorldPositionFromScreen(event.clientX, event.clientY);
    
    // Check for double-click
    const now = Date.now();
    const isDoubleClick = now - this.lastClickTime < 300;
    this.lastClickTime = now;
    
    this.eventBus.emit('click', {
      type: 'click',
      screenX: event.clientX,
      screenY: event.clientY,
      worldX: worldPos.x,
      worldZ: worldPos.z,
      button: event.button
    });
    
    if (isDoubleClick) {
      this.eventBus.emit('dblclick', {
        type: 'dblclick',
        screenX: event.clientX,
        screenY: event.clientY,
        worldX: worldPos.x,
        worldZ: worldPos.z
      });
    }
  }

  private onWheel(event: WheelEvent): void {
    if (this.blocking) return;
    
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    
    this.eventBus.emit('zoom', {
      type: 'wheel',
      delta
    });
  }

  private onKeyDown(event: KeyboardEvent): void {
    this.keys.set(event.key, true);
    this.keys.set(event.code, true);
    
    this.eventBus.emit('keydown', {
      type: 'keydown',
      key: event.key,
      code: event.code
    });
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.keys.set(event.key, false);
    this.keys.set(event.code, false);
    
    this.eventBus.emit('keyup', {
      type: 'keyup',
      key: event.key,
      code: event.code
    });
  }

  private onTouchStart(event: TouchEvent): void {
    if (this.blocking) return;
    event.preventDefault();
    
    const touch = event.touches[0];
    this.mouseState.x = touch.clientX;
    this.mouseState.y = touch.clientY;
    this.mouseState.down = true;
    this.dragStart = { x: touch.clientX, y: touch.clientY };
    
    const worldPos = this.getWorldPositionFromScreen(touch.clientX, touch.clientY);
    
    this.eventBus.emit('touchstart', {
      type: 'touchstart',
      screenX: touch.clientX,
      screenY: touch.clientY,
      worldX: worldPos.x,
      worldZ: worldPos.z
    });
  }

  private onTouchMove(event: TouchEvent): void {
    if (this.blocking) return;
    event.preventDefault();
    
    const touch = event.touches[0];
    this.mouseState.x = touch.clientX;
    this.mouseState.y = touch.clientY;
    
    const worldPos = this.getWorldPositionFromScreen(touch.clientX, touch.clientY);
    
    this.eventBus.emit('touchmove', {
      type: 'touchmove',
      screenX: touch.clientX,
      screenY: touch.clientY,
      worldX: worldPos.x,
      worldZ: worldPos.z
    });
  }

  private onTouchEnd(event: TouchEvent): void {
    if (this.blocking) return;
    event.preventDefault();
    
    this.mouseState.down = false;
    this.dragStart = null;
    
    this.eventBus.emit('touchend', {
      type: 'touchend'
    });
  }
}

/**
 * UIDataBinder - Reactive UI data binding for game state
 * 
 * Automatically updates DOM elements when game state changes.
 * Supports text content, attributes, and custom update functions.
 * 
 * Usage:
 * ```typescript
 * const uiBinder = new UIDataBinder();
 * 
 * // Bind text content
 * uiBinder.bindText('fps', () => game.stats.fps);
 * 
 * // Bind with custom formatter
 * uiBinder.bindText('playerPos', 
 *   () => game.player,
 *   (player) => `(${player.col}, ${player.row})`
 * );
 * 
 * // Bind attribute
 * uiBinder.bindAttr('healthBar', 'width', () => player.health / player.maxHealth * 100);
 * 
 * // Bind with custom update function
 * uiBinder.bind('occlusion', (el) => {
 *   const isOccluded = occlusionSystem.isOccluded(player);
 *   el.textContent = isOccluded ? 'OCCLUDED' : 'VISIBLE';
 *   el.className = isOccluded ? 'occluded' : 'visible';
 * });
 * 
 * // Update all bindings (call every frame)
 * uiBinder.updateAll();
 * ```
 */

export type BindingUpdater = (element: HTMLElement) => void;
export type ValueProvider<T = any> = () => T;
export type ValueFormatter<T = any> = (value: T) => string;

export interface BindingConfig {
  /** Element ID or DOM element */
  element: string | HTMLElement;
  /** Update function */
  updater: BindingUpdater;
  /** Update interval in frames (1 = every frame, 60 = once per second) */
  interval?: number;
}

export class UIDataBinder {
  private bindings: Map<string, BindingConfig> = new Map();
  private frameCount: number = 0;

  /**
   * Bind text content to a value provider
   */
  bindText(
    elementId: string,
    provider: ValueProvider,
    formatter?: ValueFormatter
  ): void {
    this.bind(elementId, (el) => {
      const value = provider();
      const text = formatter ? formatter(value) : String(value);
      el.textContent = text;
    });
  }

  /**
   * Bind HTML content to a value provider
   */
  bindHTML(
    elementId: string,
    provider: ValueProvider,
    formatter?: ValueFormatter
  ): void {
    this.bind(elementId, (el) => {
      const value = provider();
      const html = formatter ? formatter(value) : String(value);
      el.innerHTML = html;
    });
  }

  /**
   * Bind attribute to a value provider
   */
  bindAttr(
    elementId: string,
    attrName: string,
    provider: ValueProvider,
    formatter?: ValueFormatter
  ): void {
    this.bind(elementId, (el) => {
      const value = provider();
      const attrValue = formatter ? formatter(value) : String(value);
      el.setAttribute(attrName, attrValue);
    });
  }

  /**
   * Bind with custom update function
   */
  bind(
    elementId: string,
    updater: BindingUpdater,
    options?: { interval?: number }
  ): void {
    const element = typeof elementId === 'string'
      ? document.getElementById(elementId)
      : elementId;

    if (!element) {
      console.warn(`UIDataBinder: Element "${elementId}" not found`);
      return;
    }

    this.bindings.set(elementId.toString(), {
      element,
      updater,
      interval: options?.interval ?? 1
    });
  }

  /**
   * Unbind a binding
   */
  unbind(elementId: string): void {
    this.bindings.delete(elementId);
  }

  /**
   * Unbind all bindings
   */
  clear(): void {
    this.bindings.clear();
  }

  /**
   * Update all bindings (call every frame)
   */
  updateAll(): void {
    this.frameCount++;

    for (const [id, binding] of this.bindings) {
      // Check interval (default to every frame if not specified)
      const interval = binding.interval ?? 1;
      if (this.frameCount % interval !== 0) {
        continue;
      }

      try {
        binding.updater(binding.element as HTMLElement);
      } catch (error) {
        console.error(`UIDataBinder: Error updating "${id}":`, error);
      }
    }
  }

  /**
   * Get number of active bindings
   */
  getBindingCount(): number {
    return this.bindings.size;
  }

  /**
   * Enable/disable a binding temporarily
   */
  setEnabled(elementId: string, enabled: boolean): void {
    const binding = this.bindings.get(elementId);
    if (binding) {
      if (!enabled) {
        this.bindings.delete(elementId);
        // Store disabled binding separately if needed
      }
    }
  }
}

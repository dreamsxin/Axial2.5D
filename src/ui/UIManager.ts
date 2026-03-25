/**
 * UIManager - Manages 2D UI components overlay
 * 
 * Provides UI component management and data binding helpers:
 * - Component lifecycle (add/remove/show/hide)
 * - Button binding with toggle support
 * - Slider binding with display update
 * - Logger attachment to DOM elements
 * - LayerList component (Phase 6)
 */

import { EventBus } from '../utils/EventBus';
import { InputManager } from '../input/InputManager';
import { Logger } from './Logger';
import { LayerList, LayerListConfig } from './LayerList';

export interface UIComponent {
  id: string;
  element: HTMLElement | null;
  visible: boolean;
  modal: boolean;
  onShow?: () => void;
  onHide?: () => void;
  onDestroy?: () => void;
}

export class UIManager {
  private container: HTMLElement | null = null;
  private components: Map<string, UIComponent> = new Map();
  private modalStack: UIComponent[] = [];
  private eventBus: EventBus;
  private inputManager: InputManager | null = null;
  private log: Logger | null = null;
  private buttonBindings: Map<string, { handler: () => void; toggle?: boolean; label?: { on: string; off: string }; activeClass?: string }> = new Map();
  private sliderBindings: Map<string, { onChange: (value: number) => void; displayId?: string }> = new Map();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Get the logger instance (created on first access)
   */
  public get logger(): Logger {
    if (!this.log) {
      this.log = new Logger();
    }
    return this.log;
  }

  /**
   * Attach logger to a DOM element
   */
  public attachLogToElement(elementId: string, maxLines?: number): void {
    this.logger.attachToElement(elementId, maxLines);
  }

  /**
   * Bind a button to a handler
   */
  public bindButton(
    buttonId: string,
    handler: () => void,
    options?: {
      toggle?: boolean;
      label?: { on: string; off: string };
      activeClass?: string;
    }
  ): void {
    if (typeof document === 'undefined') return;

    const button = document.getElementById(buttonId);
    if (!button) {
      console.warn(`UIManager: Button "${buttonId}" not found`);
      return;
    }

    const state = { active: false };

    button.addEventListener('click', () => {
      if (options?.toggle) {
        state.active = !state.active;
        
        // Update label if provided
        if (options.label) {
          button.textContent = state.active ? options.label.on : options.label.off;
        }
        
        // Update active class if provided
        if (options.activeClass) {
          if (state.active) {
            button.classList.add(options.activeClass);
          } else {
            button.classList.remove(options.activeClass);
          }
        }
      }
      
      handler();
    });

    this.buttonBindings.set(buttonId, {
      handler,
      toggle: options?.toggle,
      label: options?.label,
      activeClass: options?.activeClass
    });
  }

  /**
   * Toggle button with automatic state management (Phase 6)
   * Automatically maintains state and updates button text/class
   */
  public toggleButton(
    buttonId: string,
    options: {
      getState: () => boolean;
      onToggle: (state: boolean) => void;
      getText?: (state: boolean) => string;
      activeClass?: string;
    }
  ): void {
    if (typeof document === 'undefined') return;

    const button = document.getElementById(buttonId);
    if (!button) {
      console.warn(`UIManager: Button "${buttonId}" not found`);
      return;
    }

    // Initial button state
    const initialState = options.getState();
    if (options.getText) {
      button.textContent = options.getText(initialState);
    }
    if (options.activeClass && initialState) {
      button.classList.add(options.activeClass);
    }

    button.addEventListener('click', () => {
      const currentState = options.getState();
      const newState = !currentState;
      
      // Update state via callback
      options.onToggle(newState);
      
      // Update button text
      if (options.getText) {
        button.textContent = options.getText(newState);
      }
      
      // Update active class
      if (options.activeClass) {
        if (newState) {
          button.classList.add(options.activeClass);
        } else {
          button.classList.remove(options.activeClass);
        }
      }
    });
  }

  /**
   * Bind a slider to a handler
   */
  public bindSlider(
    sliderId: string,
    onChange: (value: number) => void,
    displayId?: string
  ): void {
    if (typeof document === 'undefined') return;

    const slider = document.getElementById(sliderId) as HTMLInputElement;
    if (!slider) {
      console.warn(`UIManager: Slider "${sliderId}" not found`);
      return;
    }

    const displayEl = displayId ? document.getElementById(displayId) : null;

    slider.addEventListener('input', () => {
      const value = parseFloat(slider.value);
      onChange(value);
      
      if (displayEl) {
        displayEl.textContent = value.toString();
      }
    });

    this.sliderBindings.set(sliderId, {
      onChange,
      displayId
    });
  }

  /**
   * Bind text content to a value provider (convenience method)
   */
  public bindText(elementId: string, provider: () => any): void {
    if (typeof document === 'undefined') return;

    const el = document.getElementById(elementId);
    if (!el) {
      console.warn(`UIManager: Element "${elementId}" not found`);
      return;
    }

    // Store update function for updateAll()
    const updateFn = () => {
      el.textContent = String(provider());
    };

    // Initial update
    updateFn();

    // For reactive updates, we'd need to call this every frame
    // For now, store in a map for updateAll() to process
    if (!(this as any)._textBindings) {
      (this as any)._textBindings = new Map();
    }
    (this as any)._textBindings.set(elementId, updateFn);
  }

  /**
   * Bind custom update function to an element
   */
  public bind(elementId: string, updater: (el: HTMLElement) => void): void {
    if (typeof document === 'undefined') return;

    const el = document.getElementById(elementId);
    if (!el) {
      console.warn(`UIManager: Element "${elementId}" not found`);
      return;
    }

    // Store update function for updateAll()
    const updateFn = () => {
      try {
        updater(el);
      } catch (e) {
        console.error(`UIManager: Error updating binding "${elementId}":`, e);
      }
    };

    // Initial update
    updateFn();

    // Store for updateAll()
    if (!(this as any)._customBindings) {
      (this as any)._customBindings = new Map();
    }
    (this as any)._customBindings.set(elementId, updateFn);
  }

  /**
   * Update all UI bindings (call every frame if needed)
   */
  public updateAll(): void {
    // Update text bindings
    if ((this as any)._textBindings) {
      for (const updateFn of (this as any)._textBindings.values()) {
        try {
          updateFn();
        } catch (e) {
          console.error('UIManager: Error updating text binding:', e);
        }
      }
    }
    
    // Update custom bindings
    if ((this as any)._customBindings) {
      for (const updateFn of (this as any)._customBindings.values()) {
        try {
          updateFn();
        } catch (e) {
          console.error('UIManager: Error updating custom binding:', e);
        }
      }
    }
    
    // Button/slider bindings are event-driven
  }

  /**
   * Add a LayerList component (Phase 6)
   * Automatically updates layer statistics display
   */
  public addLayerList(containerId: string, config?: LayerListConfig): LayerList | null {
    if (typeof document === 'undefined') {
      console.warn('UIManager: LayerList requires DOM');
      return null;
    }

    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`UIManager: Container "${containerId}" not found`);
      return null;
    }

    // Create LayerList component
    // Note: We need to pass layerManager, which should be available via game reference
    // For now, we'll create it and let the caller manage the layerManager reference
    const layerList = new LayerList(containerId, (this as any).game?.modules?.layerManager, config);
    layerList.start();

    // Store for cleanup
    if (!(this as any)._layerLists) {
      (this as any)._layerLists = [];
    }
    (this as any)._layerLists.push(layerList);

    return layerList;
  }

  /**
   * Initialize UI manager with DOM container
   */
  public init(container?: HTMLElement): void {
    if (typeof document !== 'undefined') {
      this.container = container || document.createElement('div');
      this.container.style.position = 'absolute';
      this.container.style.top = '0';
      this.container.style.left = '0';
      this.container.style.width = '100%';
      this.container.style.height = '100%';
      this.container.style.pointerEvents = 'none';
      
      if (!container && document.body) {
        document.body.appendChild(this.container);
      }
    }
  }

  /**
   * Set input manager reference for blocking
   */
  public setInputManager(inputManager: InputManager): void {
    this.inputManager = inputManager;
  }

  /**
   * Add a UI component
   */
  public addComponent(component: UIComponent): void {
    this.components.set(component.id, component);
    
    if (this.container && component.element) {
      component.element.style.pointerEvents = 'auto';
      this.container.appendChild(component.element);
    }
    
    if (component.modal) {
      this.modalStack.push(component);
      this.updateInputBlocking();
    }
    
    if (component.onShow) {
      component.onShow();
    }
  }

  /**
   * Remove a UI component
   */
  public removeComponent(id: string): void {
    const component = this.components.get(id);
    if (!component) return;
    
    if (component.element && component.element.parentNode) {
      component.element.parentNode.removeChild(component.element);
    }
    
    if (component.modal) {
      const index = this.modalStack.indexOf(component);
      if (index > -1) {
        this.modalStack.splice(index, 1);
      }
      this.updateInputBlocking();
    }
    
    if (component.onDestroy) {
      component.onDestroy();
    }
    
    this.components.delete(id);
  }

  /**
   * Show a component
   */
  public showComponent(id: string): void {
    const component = this.components.get(id);
    if (!component) return;
    
    component.visible = true;
    if (component.element) {
      component.element.style.display = 'block';
    }
    
    if (component.modal && !this.modalStack.includes(component)) {
      this.modalStack.push(component);
      this.updateInputBlocking();
    }
    
    if (component.onShow) {
      component.onShow();
    }
  }

  /**
   * Hide a component
   */
  public hideComponent(id: string): void {
    const component = this.components.get(id);
    if (!component) return;
    
    component.visible = false;
    if (component.element) {
      component.element.style.display = 'none';
    }
    
    if (component.modal) {
      const index = this.modalStack.indexOf(component);
      if (index > -1) {
        this.modalStack.splice(index, 1);
      }
      this.updateInputBlocking();
    }
    
    if (component.onHide) {
      component.onHide();
    }
  }

  /**
   * Update input blocking based on modal stack
   */
  private updateInputBlocking(): void {
    if (this.inputManager) {
      this.inputManager.setBlocking(this.modalStack.length > 0);
    }
  }

  /**
   * Create a dialog component
   */
  public createDialog(
    id: string,
    title: string,
    content: string,
    onConfirm?: () => void,
    onCancel?: () => void
  ): UIComponent {
    if (typeof document === 'undefined') {
      return { id, element: null, visible: false, modal: true };
    }

    const dialog = document.createElement('div');
    dialog.style.position = 'absolute';
    dialog.style.top = '50%';
    dialog.style.left = '50%';
    dialog.style.transform = 'translate(-50%, -50%)';
    dialog.style.background = '#2a2a3e';
    dialog.style.border = '2px solid #4a4a6a';
    dialog.style.borderRadius = '8px';
    dialog.style.padding = '20px';
    dialog.style.minWidth = '300px';
    dialog.style.maxWidth = '500px';
    dialog.style.color = '#fff';
    dialog.style.fontFamily = 'Arial, sans-serif';
    dialog.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';

    const titleEl = document.createElement('h3');
    titleEl.textContent = title;
    titleEl.style.margin = '0 0 15px 0';
    titleEl.style.fontSize = '18px';
    dialog.appendChild(titleEl);

    const contentEl = document.createElement('div');
    contentEl.textContent = content;
    contentEl.style.marginBottom = '20px';
    dialog.appendChild(contentEl);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';

    if (onConfirm) {
      const confirmBtn = document.createElement('button');
      confirmBtn.textContent = 'Confirm';
      confirmBtn.style.padding = '8px 16px';
      confirmBtn.style.background = '#4a7c4e';
      confirmBtn.style.color = '#fff';
      confirmBtn.style.border = 'none';
      confirmBtn.style.borderRadius = '4px';
      confirmBtn.style.cursor = 'pointer';
      confirmBtn.onclick = () => {
        if (onConfirm) onConfirm();
        this.removeComponent(id);
      };
      buttonContainer.appendChild(confirmBtn);
    }

    if (onCancel) {
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.padding = '8px 16px';
      cancelBtn.style.background = '#666';
      cancelBtn.style.color = '#fff';
      cancelBtn.style.border = 'none';
      cancelBtn.style.borderRadius = '4px';
      cancelBtn.style.cursor = 'pointer';
      cancelBtn.onclick = () => {
        if (onCancel) onCancel();
        this.removeComponent(id);
      };
      buttonContainer.appendChild(cancelBtn);
    }

    dialog.appendChild(buttonContainer);

    return {
      id,
      element: dialog,
      visible: true,
      modal: true,
      onDestroy: () => {
        if (dialog.parentNode) {
          dialog.parentNode.removeChild(dialog);
        }
      }
    };
  }

  /**
   * Show a temporary message
   */
  public showMessage(text: string, duration: number = 2000): void {
    if (typeof document === 'undefined') return;

    const id = `msg_${Date.now()}`;
    const msgEl = document.createElement('div');
    msgEl.textContent = text;
    msgEl.style.position = 'absolute';
    msgEl.style.bottom = '20px';
    msgEl.style.left = '50%';
    msgEl.style.transform = 'translateX(-50%)';
    msgEl.style.background = 'rgba(0,0,0,0.8)';
    msgEl.style.color = '#fff';
    msgEl.style.padding = '10px 20px';
    msgEl.style.borderRadius = '4px';
    msgEl.style.fontFamily = 'Arial, sans-serif';

    if (this.container) {
      this.container.appendChild(msgEl);
    }

    setTimeout(() => {
      if (msgEl.parentNode) {
        msgEl.parentNode.removeChild(msgEl);
      }
    }, duration);
  }
}

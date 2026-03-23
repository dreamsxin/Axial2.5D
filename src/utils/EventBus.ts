/**
 * EventBus - Global event communication system for decoupled module interaction
 */

import { EventCallback, EventListener } from '../core/types';

export class EventBus {
  private listeners: Map<string, EventListener[]> = new Map();

  /**
   * Register an event listener
   * @param event - Event name to listen for
   * @param callback - Callback function to invoke when event is emitted
   */
  public on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push({ event, callback, once: false });
  }

  /**
   * Register a one-time event listener
   * @param event - Event name to listen for
   * @param callback - Callback function to invoke when event is emitted
   */
  public once(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push({ event, callback, once: true });
  }

  /**
   * Remove an event listener
   * @param event - Event name to remove listener from
   * @param callback - The callback function to remove
   */
  public off(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      return;
    }
    
    const eventListeners = this.listeners.get(event)!;
    const filtered = eventListeners.filter(l => l.callback !== callback);
    
    if (filtered.length === 0) {
      this.listeners.delete(event);
    } else {
      this.listeners.set(event, filtered);
    }
  }

  /**
   * Emit an event to all registered listeners
   * @param event - Event name to emit
   * @param data - Optional data to pass to listeners
   */
  public emit(event: string, data?: any): void {
    if (!this.listeners.has(event)) {
      return;
    }

    const eventListeners = this.listeners.get(event)!;
    const toRemove: EventListener[] = [];

    // Copy array to avoid issues with modifications during iteration
    for (const listener of [...eventListeners]) {
      listener.callback(data);
      
      if (listener.once) {
        toRemove.push(listener);
      }
    }

    // Remove one-time listeners
    if (toRemove.length > 0) {
      const filtered = eventListeners.filter(l => !toRemove.includes(l));
      if (filtered.length === 0) {
        this.listeners.delete(event);
      } else {
        this.listeners.set(event, filtered);
      }
    }
  }

  /**
   * Remove all listeners for an event (or all events if no event specified)
   * @param event - Optional event name to clear (clears all if not provided)
   */
  public clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event
   */
  public listenerCount(event: string): number {
    return this.listeners.get(event)?.length ?? 0;
  }

  /**
   * Get all registered event names
   */
  public getEvents(): string[] {
    return Array.from(this.listeners.keys());
  }
}

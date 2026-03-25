/**
 * ConfigManager - Unified configuration management with reactive updates
 * 
 * Features:
 * - Centralized configuration storage
 * - Reactive updates with event listeners
 * - Type-safe get/set operations
 * - Nested key support (e.g., 'render.showGrid')
 * 
 * Usage:
 * ```typescript
 * const config = new ConfigManager({
 *   'render.showGrid': true,
 *   'render.foregroundAlpha': 0.6,
 *   'debug.enabled': false
 * });
 * 
 * // Get value
 * const showGrid = config.get('render.showGrid');
 * 
 * // Set value (triggers listeners)
 * config.set('render.showGrid', false);
 * 
 * // Listen for changes
 * config.on('render.showGrid', (value) => {
 *   console.log('Grid toggled:', value);
 * });
 * 
 * // Toggle boolean value
 * config.toggle('render.showGrid');
 * ```
 */

export type ConfigValue = string | number | boolean | object | null | undefined;

export type ConfigChangeListener = (value: ConfigValue, oldValue: ConfigValue, key: string) => void;

export interface ConfigManagerConfig {
  [key: string]: ConfigValue;
}

export class ConfigManager {
  private config: Map<string, ConfigValue> = new Map();
  private listeners: Map<string, Set<ConfigChangeListener>> = new Map();

  constructor(initialConfig?: ConfigManagerConfig) {
    if (initialConfig) {
      for (const [key, value] of Object.entries(initialConfig)) {
        this.set(key, value, false);
      }
    }
  }

  /**
   * Get a configuration value
   */
  public get<T extends ConfigValue>(key: string): T {
    return this.config.get(key) as T;
  }

  /**
   * Set a configuration value
   * @param key - Configuration key (supports nested keys like 'render.showGrid')
   * @param value - New value
   * @param notify - Whether to notify listeners (default: true)
   */
  public set<T extends ConfigValue>(key: string, value: T, notify: boolean = true): void {
    const oldValue = this.config.get(key);
    this.config.set(key, value);
    
    if (notify) {
      this.notify(key, value, oldValue);
    }
  }

  /**
   * Toggle a boolean configuration value
   */
  public toggle(key: string): boolean {
    const currentValue = this.get<boolean>(key) ?? false;
    const newValue = !currentValue;
    this.set(key, newValue);
    return newValue;
  }

  /**
   * Check if a configuration key exists
   */
  public has(key: string): boolean {
    return this.config.has(key);
  }

  /**
   * Delete a configuration key
   */
  public delete(key: string): boolean {
    return this.config.delete(key);
  }

  /**
   * Listen for configuration changes
   * @param key - Configuration key to listen to
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  public on(key: string, listener: ConfigChangeListener): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(key)?.delete(listener);
    };
  }

  /**
   * Listen for any configuration change
   */
  public onAny(listener: ConfigChangeListener): () => void {
    const wildcardKey = '*';
    if (!this.listeners.has(wildcardKey)) {
      this.listeners.set(wildcardKey, new Set());
    }
    this.listeners.get(wildcardKey)!.add(listener);

    return () => {
      this.listeners.get(wildcardKey)?.delete(listener);
    };
  }

  /**
   * Notify listeners of a configuration change
   */
  private notify(key: string, newValue: ConfigValue, oldValue: ConfigValue): void {
    // Notify specific key listeners
    this.listeners.get(key)?.forEach(listener => {
      try {
        listener(newValue, oldValue, key);
      } catch (error) {
        console.error(`ConfigManager: Error in listener for "${key}":`, error);
      }
    });

    // Notify wildcard listeners
    this.listeners.get('*')?.forEach(listener => {
      try {
        listener(newValue, oldValue, key);
      } catch (error) {
        console.error(`ConfigManager: Error in wildcard listener:`, error);
      }
    });
  }

  /**
   * Get all configuration keys
   */
  public keys(): IterableIterator<string> {
    return this.config.keys();
  }

  /**
   * Get all configuration entries
   */
  public entries(): IterableIterator<[string, ConfigValue]> {
    return this.config.entries();
  }

  /**
   * Get configuration as plain object
   */
  public toObject(): ConfigManagerConfig {
    const obj: ConfigManagerConfig = {};
    for (const [key, value] of this.config.entries()) {
      obj[key] = value;
    }
    return obj;
  }

  /**
   * Merge configuration with provided object
   */
  public merge(config: ConfigManagerConfig): void {
    for (const [key, value] of Object.entries(config)) {
      this.set(key, value);
    }
  }

  /**
   * Clear all configuration
   */
  public clear(): void {
    this.config.clear();
  }
}

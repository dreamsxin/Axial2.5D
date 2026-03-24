/**
 * Logger - Multi-level logging with DOM output support
 * 
 * Features:
 * - Multiple log levels (info, success, warn, error)
 * - Optional DOM attachment
 * - Auto-scrolling log container
 * - Configurable max lines
 * 
 * Usage:
 * ```typescript
 * // Via UIManager
 * uiManager.attachLogToElement('log');
 * uiManager.log.info('Game started');
 * uiManager.log.success('Player moved to (%d, %d)', col, row);
 * uiManager.log.warn('Entity not found: %s', entityId);
 * uiManager.log.error('Failed to load map: %s', error);
 * 
 * // Standalone
 * const logger = new Logger();
 * logger.attachToElement('log', 20); // max 20 lines
 * logger.info('Message with args: %s, %d', str, num);
 * ```
 */

export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export interface LoggerConfig {
  maxLines?: number;
  showTimestamp?: boolean;
  prefix?: string;
}

export class Logger {
  private element: HTMLElement | null = null;
  private config: LoggerConfig;
  private uiManager: any = null; // UIManager reference (optional)

  constructor(uiManager?: any, config: LoggerConfig = {}) {
    this.uiManager = uiManager;
    this.config = {
      maxLines: config.maxLines ?? 20,
      showTimestamp: config.showTimestamp ?? true,
      prefix: config.prefix ?? ''
    };
  }

  /**
   * Attach logger to a DOM element
   */
  public attachToElement(elementId: string, maxLines?: number): void {
    if (typeof document === 'undefined') {
      console.warn('Logger: DOM not available');
      return;
    }

    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`Logger: Element "${elementId}" not found`);
      return;
    }

    this.element = element;
    if (maxLines !== undefined) {
      this.config.maxLines = maxLines;
    }

    // Style the log container if not already styled
    if (!element.style.background) {
      element.style.background = 'rgba(0,0,0,0.3)';
      element.style.border = '1px solid #4a4a6a';
      element.style.borderRadius = '4px';
      element.style.padding = '8px';
      element.style.height = '100px';
      element.style.overflowY = 'auto';
      element.style.fontFamily = 'monospace';
      element.style.fontSize = '0.75em';
    }
  }

  /**
   * Log an info message
   */
  public info(message: string, ...args: any[]): void {
    this.log('info', message, args);
  }

  /**
   * Log a success message
   */
  public success(message: string, ...args: any[]): void {
    this.log('success', message, args);
  }

  /**
   * Log a warning message
   */
  public warn(message: string, ...args: any[]): void {
    this.log('warn', message, args);
  }

  /**
   * Log an error message
   */
  public error(message: string, ...args: any[]): void {
    this.log('error', message, args);
  }

  /**
   * Internal log implementation
   */
  private log(level: LogLevel, message: string, args: any[]): void {
    // Format message with args (printf-style)
    const formatted = this.formatMessage(message, args);
    const timestamp = this.config.showTimestamp ? `[${new Date().toLocaleTimeString()}] ` : '';
    const prefix = this.config.prefix ? `${this.config.prefix} ` : '';
    const fullMessage = `${timestamp}${prefix}${formatted}`;

    // Always log to console
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](fullMessage);

    // Also output to DOM if attached
    if (this.element) {
      this.appendToDom(fullMessage, level);
    }

    // Notify UIManager if available (for integration)
    if (this.uiManager?.onLogMessage) {
      this.uiManager.onLogMessage(level, fullMessage);
    }
  }

  /**
   * Format message with printf-style args
   */
  private formatMessage(message: string, args: any[]): string {
    if (args.length === 0) return message;

    let index = 0;
    return message.replace(/%[sdfo]/g, (match) => {
      if (index >= args.length) return match;
      const arg = args[index++];
      switch (match) {
        case '%s': return String(arg);
        case '%d': return Number(arg).toFixed(0);
        case '%f': return Number(arg).toFixed(2);
        case '%o': return JSON.stringify(arg);
        default: return match;
      }
    });
  }

  /**
   * Append message to DOM element
   */
  private appendToDom(message: string, level: LogLevel): void {
    if (!this.element) return;

    const entry = document.createElement('div');
    entry.className = `log-msg log-${level}`;
    entry.textContent = message;

    // Style by level
    const colors: Record<LogLevel, string> = {
      info: '#4a90d9',
      success: '#4ad97a',
      warn: '#d9a74a',
      error: '#d94a4a'
    };
    entry.style.color = colors[level];
    entry.style.margin = '2px 0';

    this.element.appendChild(entry);
    this.element.scrollTop = this.element.scrollHeight;

    // Trim old messages
    while (this.element.children.length > (this.config.maxLines ?? 20)) {
      const firstChild = this.element.firstChild;
      if (firstChild) {
        this.element.removeChild(firstChild);
      }
    }
  }

  /**
   * Clear the log
   */
  public clear(): void {
    if (this.element) {
      this.element.innerHTML = '';
    }
  }

  /**
   * Detach from DOM
   */
  public detach(): void {
    this.element = null;
  }
}

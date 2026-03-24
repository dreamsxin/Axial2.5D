/**
 * Logger - Unified logging system with levels and multiple outputs
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerConfig {
  level?: LogLevel;
  showTimestamp?: boolean;
  outputToConsole?: boolean;
  outputToElement?: string | HTMLElement;
}

export class Logger {
  private level: LogLevel;
  private showTimestamp: boolean;
  private outputToConsole: boolean;
  private outputElement: HTMLElement | null;
  
  private static instance: Logger | null = null;
  
  private static levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  constructor(config?: LoggerConfig) {
    this.level = config?.level ?? 'info';
    this.showTimestamp = config?.showTimestamp ?? true;
    this.outputToConsole = config?.outputToConsole ?? true;
    
    const outputEl = config?.outputToElement;
    if (typeof outputEl === 'string') {
      this.outputElement = document.getElementById(outputEl);
    } else {
      this.outputElement = outputEl ?? null;
    }
  }

  /**
   * Get or create singleton logger instance
   */
  public static getInstance(config?: LoggerConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * Set logger level
   */
  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Set output element
   */
  public setOutputElement(element: string | HTMLElement | null): void {
    if (typeof element === 'string') {
      this.outputElement = document.getElementById(element);
    } else {
      this.outputElement = element;
    }
  }

  /**
   * Log a debug message
   */
  public debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }

  /**
   * Log an info message
   */
  public info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }

  /**
   * Log a warning message
   */
  public warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }

  /**
   * Log an error message
   */
  public error(message: string, ...args: any[]): void {
    this.log('error', message, ...args);
  }

  /**
   * Clear log output
   */
  public clear(): void {
    if (this.outputElement) {
      this.outputElement.innerHTML = '';
    }
  }

  /**
   * Internal log implementation
   */
  private log(level: LogLevel, message: string, ...args: any[]): void {
    // Check if level should be logged
    if (Logger.levelPriority[level] < Logger.levelPriority[this.level]) {
      return;
    }

    // Format message
    const formattedMessage = this.formatMessage(level, message);

    // Output to console
    if (this.outputToConsole) {
      this.outputToConsoleLevel(level, formattedMessage, args);
    }

    // Output to element
    if (this.outputElement) {
      this.outputToElementLevel(level, formattedMessage);
    }
  }

  /**
   * Format message with timestamp and level
   */
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = this.showTimestamp ? `[${new Date().toLocaleTimeString()}] ` : '';
    const levelTag = `[${level.toUpperCase()}]`;
    return `${timestamp}${levelTag} ${message}`;
  }

  /**
   * Output to console with appropriate method
   */
  private outputToConsoleLevel(level: LogLevel, message: string, args: any[]): void {
    switch (level) {
      case 'debug':
        console.debug(message, ...args);
        break;
      case 'info':
        console.info(message, ...args);
        break;
      case 'warn':
        console.warn(message, ...args);
        break;
      case 'error':
        console.error(message, ...args);
        break;
    }
  }

  /**
   * Output to HTML element
   */
  private outputToElementLevel(level: LogLevel, message: string): void {
    if (!this.outputElement) return;

    const entry = document.createElement('div');
    entry.className = `log-${level}`;
    entry.textContent = message;
    
    this.outputElement.appendChild(entry);
    
    // Auto-scroll to bottom
    this.outputElement.scrollTop = this.outputElement.scrollHeight;
    
    // Limit log entries
    const maxEntries = 100;
    while (this.outputElement.children.length > maxEntries) {
      const firstChild = this.outputElement.firstChild;
      if (firstChild) {
        this.outputElement.removeChild(firstChild);
      }
    }
  }
}

// Convenience functions using singleton
export const logger = {
  debug: (msg: string, ...args: any[]) => Logger.getInstance().debug(msg, ...args),
  info: (msg: string, ...args: any[]) => Logger.getInstance().info(msg, ...args),
  warn: (msg: string, ...args: any[]) => Logger.getInstance().warn(msg, ...args),
  error: (msg: string, ...args: any[]) => Logger.getInstance().error(msg, ...args),
  setLevel: (level: LogLevel) => Logger.getInstance().setLevel(level),
  setOutput: (el: string | HTMLElement | null) => Logger.getInstance().setOutputElement(el),
  clear: () => Logger.getInstance().clear()
};

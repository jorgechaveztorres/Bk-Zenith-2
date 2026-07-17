export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  metadata?: any;
}

class LoggingServiceClass {
  private logs: LogEntry[] = [];
  private isDevMode: boolean = true; // Enabled by default in this pre-release/candidate
  private maxLogs: number = 1000;
  private listeners: ((log: LogEntry) => void)[] = [];

  constructor() {
    try {
      const saved = localStorage.getItem('zenith_dev_mode');
      if (saved !== null) {
        this.isDevMode = saved === 'true';
      } else {
        localStorage.setItem('zenith_dev_mode', 'true');
      }
    } catch (e) {
      // Offline fallback
    }
    this.info('SYSTEM', 'Logging Service inicializado con éxito.', { devMode: this.isDevMode });
  }

  public setDevMode(enabled: boolean) {
    this.isDevMode = enabled;
    try {
      localStorage.setItem('zenith_dev_mode', String(enabled));
    } catch (e) {}
    this.info('SYSTEM', `Modo desarrollador cambiado a: ${enabled}`);
  }

  public getDevMode(): boolean {
    return this.isDevMode;
  }

  private createLog(level: LogLevel, module: string, message: string, metadata?: any): LogEntry {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      metadata
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    if (this.isDevMode) {
      const styles: Record<LogLevel, string> = {
        DEBUG: 'color: #9CA3AF; font-weight: bold;',
        INFO: 'color: #3B82F6; font-weight: bold;',
        WARNING: 'color: #F59E0B; font-weight: bold;',
        ERROR: 'color: #EF4444; font-weight: bold;',
        CRITICAL: 'color: #FF1493; background: #3B0712; font-weight: bold; padding: 2px;'
      };

      console.log(
        `%c[ZENITH-${level}] [${module}] %c${message}`,
        styles[level],
        'color: inherit;',
        metadata || ''
      );
    }

    this.listeners.forEach(fn => fn(entry));
    return entry;
  }

  public debug(module: string, message: string, metadata?: any) {
    return this.createLog('DEBUG', module, message, metadata);
  }

  public info(module: string, message: string, metadata?: any) {
    return this.createLog('INFO', module, message, metadata);
  }

  public warn(module: string, message: string, metadata?: any) {
    return this.createLog('WARNING', module, message, metadata);
  }

  public error(module: string, message: string, metadata?: any) {
    return this.createLog('ERROR', module, message, metadata);
  }

  public critical(module: string, message: string, metadata?: any) {
    return this.createLog('CRITICAL', module, message, metadata);
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
    this.info('SYSTEM', 'Log Buffer limpiado.');
  }

  public subscribe(fn: (log: LogEntry) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== fn);
    };
  }

  public exportLogsAsJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const LoggingService = new LoggingServiceClass();

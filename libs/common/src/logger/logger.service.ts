import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface LogEntry {
  timestamp: string;
  level: string;
  context?: string;
  message: string;
}

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly isDevelopment: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isDevelopment =
      this.configService.get<string>('NODE_ENV', 'development') !== 'production';
  }

  log(message: string, context?: string): void {
    this.writeLog('info', message, context);
  }

  error(message: string, context?: string): void {
    this.writeLog('error', message, context);
  }

  warn(message: string, context?: string): void {
    this.writeLog('warn', message, context);
  }

  debug(message: string, context?: string): void {
    if (this.isDevelopment) {
      this.writeLog('debug', message, context);
    }
  }

  verbose(message: string, context?: string): void {
    if (this.isDevelopment) {
      this.writeLog('verbose', message, context);
    }
  }

  private writeLog(level: string, message: string, context?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      ...(context ? { context } : {}),
      message,
    };

    if (this.isDevelopment) {
      const color = this.getColor(level);
      const prefix = context ? `[${context}] ` : '';
      const formatted = `${color}${entry.timestamp} [${level.toUpperCase()}] ${prefix}${message}\x1b[0m`;

      if (level === 'error') {
        console.error(formatted);
      } else if (level === 'warn') {
        console.warn(formatted);
      } else {
        console.log(formatted);
      }
    } else {
      // JSON format for production
      const output = JSON.stringify(entry);
      if (level === 'error') {
        console.error(output);
      } else if (level === 'warn') {
        console.warn(output);
      } else {
        console.log(output);
      }
    }
  }

  private getColor(level: string): string {
    switch (level) {
      case 'error':
        return '\x1b[31m'; // red
      case 'warn':
        return '\x1b[33m'; // yellow
      case 'info':
        return '\x1b[32m'; // green
      case 'debug':
        return '\x1b[36m'; // cyan
      case 'verbose':
        return '\x1b[35m'; // magenta
      default:
        return '\x1b[0m';
    }
  }
}

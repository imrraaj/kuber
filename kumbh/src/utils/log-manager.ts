import { EventEmitter } from "events";

export interface LogEntry {
  timestamp: number;
  level: "debug" | "info" | "warn" | "error";
  strategyName: string;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Circular buffer for storing logs with a maximum size.
 */
class CircularBuffer<T> {
  private buffer: T[] = [];
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  push(item: T): void {
    this.buffer.push(item);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getAll(): T[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
  }
}

/**
 * LogManager stores logs in memory and emits events for real-time streaming.
 *
 * Events:
 * - log(entry: LogEntry) - emitted when a new log is added
 */
export class LogManager extends EventEmitter {
  private logs: Map<string, CircularBuffer<LogEntry>> = new Map();
  private globalLogs: CircularBuffer<LogEntry>;
  private maxLogsPerStrategy = 1000;
  private maxGlobalLogs = 5000;

  constructor() {
    super();
    this.globalLogs = new CircularBuffer(this.maxGlobalLogs);
  }

  /**
   * Add a log entry for a strategy.
   */
  addLog(entry: LogEntry): void {
    // Add to strategy-specific buffer
    if (!this.logs.has(entry.strategyName)) {
      this.logs.set(entry.strategyName, new CircularBuffer(this.maxLogsPerStrategy));
    }
    this.logs.get(entry.strategyName)!.push(entry);

    // Add to global buffer
    this.globalLogs.push(entry);

    // Emit event for real-time streaming
    this.emit("log", entry);
  }

  /**
   * Get logs for a specific strategy.
   */
  getLogsForStrategy(strategyName: string, limit?: number): LogEntry[] {
    const buffer = this.logs.get(strategyName);
    if (!buffer) return [];

    const logs = buffer.getAll();
    if (limit && limit > 0) {
      return logs.slice(-limit);
    }
    return logs;
  }

  /**
   * Get all logs across all strategies.
   */
  getAllLogs(limit?: number): LogEntry[] {
    const logs = this.globalLogs.getAll();
    if (limit && limit > 0) {
      return logs.slice(-limit);
    }
    return logs;
  }

  /**
   * Clear logs for a specific strategy.
   */
  clearLogsForStrategy(strategyName: string): void {
    this.logs.delete(strategyName);
  }

  /**
   * Clear all logs.
   */
  clearAllLogs(): void {
    this.logs.clear();
    this.globalLogs.clear();
  }
}

// Singleton instance
export const logManager = new LogManager();

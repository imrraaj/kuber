import { Database } from "bun:sqlite";
import { join } from "path";
import type { Interval, StrategyInfo } from "../types/index.ts";

export interface StrategyEntry {
  name: string;
  description: string;
  symbols: string[];
  timeframes: Interval[];
  filePath: string;
  isActive: boolean;
  startedAt: number | null;
  errorCount: number;
  lastError: string | null;
  lastCandleAt: number | null;
}

export class EngineDatabase {
  private db: Database;

  constructor(dataDir: string) {
    const dbPath = join(dataDir, "engine.db");
    this.db = new Database(dbPath);
    this.initTables();
  }

  private initTables(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS strategies (
        name TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        symbols TEXT NOT NULL,
        timeframes TEXT NOT NULL,
        file_path TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0,
        started_at INTEGER,
        error_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        last_candle_at INTEGER
      )
    `);
  }

  addStrategy(entry: StrategyEntry): void {
    this.db.run(
      `INSERT OR REPLACE INTO strategies 
       (name, description, symbols, timeframes, file_path, is_active, started_at, error_count, last_error, last_candle_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.name,
        entry.description,
        JSON.stringify(entry.symbols),
        JSON.stringify(entry.timeframes),
        entry.filePath,
        entry.isActive ? 1 : 0,
        entry.startedAt,
        entry.errorCount,
        entry.lastError,
        entry.lastCandleAt,
      ]
    );
  }

  getStrategy(name: string): StrategyEntry | null {
    const row = this.db.query(`SELECT * FROM strategies WHERE name = ?`).get(name) as any;
    if (!row) return null;
    return this.rowToEntry(row);
  }

  getAllStrategies(): StrategyEntry[] {
    const rows = this.db.query(`SELECT * FROM strategies`).all() as any[];
    return rows.map(row => this.rowToEntry(row));
  }

  updateStrategy(entry: StrategyEntry): void {
    this.addStrategy(entry);
  }

  removeStrategy(name: string): void {
    this.db.run(`DELETE FROM strategies WHERE name = ?`, [name]);
  }

  setActive(name: string, isActive: boolean, startedAt: number | null = null): void {
    this.db.run(
      `UPDATE strategies SET is_active = ?, started_at = ? WHERE name = ?`,
      [isActive ? 1 : 0, startedAt, name]
    );
  }

  incrementErrorCount(name: string, error: string): void {
    this.db.run(
      `UPDATE strategies SET error_count = error_count + 1, last_error = ? WHERE name = ?`,
      [error, name]
    );
  }

  updateLastCandle(name: string, timestamp: number): void {
    this.db.run(
      `UPDATE strategies SET last_candle_at = ? WHERE name = ?`,
      [timestamp, name]
    );
  }

  close(): void {
    this.db.close();
  }

  private rowToEntry(row: any): StrategyEntry {
    return {
      name: row.name,
      description: row.description,
      symbols: JSON.parse(row.symbols),
      timeframes: JSON.parse(row.timeframes),
      filePath: row.file_path,
      isActive: row.is_active === 1,
      startedAt: row.started_at,
      errorCount: row.error_count,
      lastError: row.last_error,
      lastCandleAt: row.last_candle_at,
    };
  }

  createStrategyDatabase(strategyName: string, dataDir: string): Database {
    const strategiesDir = join(dataDir, "strategies");
    const dbPath = join(strategiesDir, `${strategyName}.db`);
    return new Database(dbPath);
  }
}

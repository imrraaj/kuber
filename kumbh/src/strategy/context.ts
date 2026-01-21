import type { Database } from "bun:sqlite";
import type {
  OrderParams,
  OrderResult,
  CloseParams,
  AccountState,
  Position,
  StructuredLogger,
  Interval,
} from "../types/index.ts";
import type { HistoricalCandle } from "../engine/hyperliquid.ts";

/**
 * Context object injected into strategies.
 * Provides helpers for common operations.
 */
export interface StrategyContext {
  /**
   * Open a new position (long or short).
   */
  openPosition(params: OrderParams): Promise<OrderResult>;

  /**
   * Close an existing position.
   */
  closePosition(params: CloseParams): Promise<OrderResult>;

  /**
   * Get current account balance and margin info.
   */
  getBalance(): Promise<AccountState>;

  /**
   * Get all current open positions.
   */
  getPositions(): Promise<Position[]>;

  /**
   * Fetch historical candles for warmup/initialization.
   * @param symbol - The trading symbol (e.g., "BTC")
   * @param interval - The candle interval (e.g., "1m", "1h")
   * @param count - Number of candles to fetch (default: 200)
   */
  fetchCandles(symbol: string, interval: Interval, count?: number): Promise<HistoricalCandle[]>;

  /**
   * Pre-configured SQLite database for THIS strategy.
   */
  db: Database;

  /**
   * Structured logger for this strategy.
   */
  log: StructuredLogger;

  /**
   * True if running a backtest, false if live trading.
   */
  isBacktest: boolean;

  /**
   * True if connected to testnet, false if mainnet.
   */
  isTestnet: boolean;
}

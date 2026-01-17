/**
 * Status information returned by strategy.status()
 */
export interface StrategyStatus {
  pnl: number;
  positionCount: number;
  lastTradeAt: number | null;
  custom?: Record<string, unknown>;
}

/**
 * Strategy metadata and runtime information
 */
export interface StrategyInfo {
  name: string;
  description: string;
  symbols: string[];
  timeframes: string[];
  isActive: boolean;
  startedAt: Date | null;
  errorCount: number;
  lastError: string | null;
  lastCandleAt: Date | null;
}

/**
 * Backtest result types
 */

export interface BacktestResult {
  totalPnl: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
}

export interface BacktestTrade {
  timestamp: number;
  symbol: string;
  side: "long" | "short" | "close";
  size: number;
  price: number;
  pnl?: number;
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
}

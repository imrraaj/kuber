import type { Interval, StrategyInfo } from "../types/index.ts";

/**
 * API Request/Response types for Elysia server
 */

// ============================================================
// Strategy Endpoints
// ============================================================

export interface AddStrategyRequest {
  path: string;
}

export interface AddStrategyResponse {
  success: boolean;
  name: string;
  message?: string;
}

export interface StrategyResponse {
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
  status?: StrategyStatusInfo | null;
}

export interface StrategyStatusInfo {
  pnl: number;
  positionCount: number;
  lastTradeAt: number | null;
  custom?: Record<string, unknown>;
}

export interface OperationResponse {
  success: boolean;
  message?: string;
}

// ============================================================
// Backtest Endpoints
// ============================================================

export interface BacktestRequest {
  from: string;
  to: string;
  initialBalance: number;
}

export interface BacktestResponse {
  strategyName: string;
  period: { from: string; to: string };
  duration: number;
  initialBalance: number;
  finalBalance: number;
  totalPnl: number;
  totalPnlPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  maxDrawdown: number;
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
}

export interface BacktestTrade {
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  openedAt: number;
  closedAt: number;
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
}

// ============================================================
// Health Endpoints
// ============================================================

export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: number;
  uptime: number;
}

export interface StatusResponse {
  version: string;
  network: "testnet" | "mainnet";
  strategiesCount: number;
  activeStrategiesCount: number;
}

// ============================================================
// WebSocket Messages
// ============================================================

export type WSServerMessage =
  | WSInitialStateMessage
  | WSStrategyUpdateMessage
  | WSStrategyLogMessage
  | WSErrorMessage
  | WSPongMessage;

export interface WSInitialStateMessage {
  type: "initial_state";
  payload: StrategyResponse[];
  timestamp: number;
}

export interface WSStrategyUpdateMessage {
  type: "strategy_update";
  payload: {
    name: string;
    isActive: boolean;
    status: StrategyStatusInfo | null;
    event: "started" | "stopped" | "updated" | "error" | "candle_processed" | "added" | "removed";
  };
  timestamp: number;
}

export interface WSStrategyLogMessage {
  type: "strategy_log";
  payload: {
    name: string;
    log: LogEntryResponse;
  };
  timestamp: number;
}

export interface LogEntryResponse {
  timestamp: number;
  level: "debug" | "info" | "warn" | "error";
  strategyName: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface WSErrorMessage {
  type: "error";
  payload: { message: string };
  timestamp: number;
}

export interface WSPongMessage {
  type: "pong";
  timestamp: number;
}

export type WSClientMessage =
  | WSPingMessage
  | WSSubscribeMessage;

export interface WSPingMessage {
  type: "ping";
}

export interface WSSubscribeMessage {
  type: "subscribe";
  payload: { strategies: string[] };
}

// ============================================================
// Error Response
// ============================================================

export interface ErrorResponse {
  success: false;
  error: string;
}

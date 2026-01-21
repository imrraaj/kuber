// Re-export API types for frontend use
// These match the backend types in src/api/types.ts

export interface Strategy {
  name: string;
  description: string;
  symbols: string[];
  timeframes: string[];
  filePath: string;
  isActive: boolean;
  startedAt: number | null;
  errorCount: number;
  lastError: string | null;
  lastCandleAt: number | null;
  status: StrategyStatus | null;
}

export interface StrategyStatus {
  pnl: number;
  positionCount: number;
  lastTradeAt: number | null;
  custom?: Record<string, unknown>;
}

export interface LogEntry {
  timestamp: number;
  level: "debug" | "info" | "warn" | "error";
  strategyName: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface Trade {
  id: number;
  symbol: string;
  side: "long" | "short";
  size: number;
  price: number;
  pnl: number | null;
  timestamp: number;
}

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

// WebSocket message types
export type WSServerMessage =
  | WSInitialStateMessage
  | WSStrategyUpdateMessage
  | WSStrategyLogMessage
  | WSErrorMessage
  | WSPongMessage;

export interface WSInitialStateMessage {
  type: "initial_state";
  payload: Strategy[];
  timestamp: number;
}

export interface WSStrategyUpdateMessage {
  type: "strategy_update";
  payload: {
    name: string;
    isActive: boolean;
    status: StrategyStatus | null;
    event: "started" | "stopped" | "updated" | "error" | "candle_processed" | "added" | "removed";
  };
  timestamp: number;
}

export interface WSStrategyLogMessage {
  type: "strategy_log";
  payload: {
    name: string;
    log: LogEntry;
  };
  timestamp: number;
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

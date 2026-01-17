/**
 * IPC message types for CLI <-> Engine communication via Unix socket
 */

export type IPCRequest =
  | { type: "add"; path: string }
  | { type: "start"; name: string }
  | { type: "stop"; name: string }
  | { type: "remove"; name: string }
  | { type: "reload"; name: string }
  | { type: "list" }
  | { type: "status"; name?: string }
  | { type: "backtest"; name: string; options: BacktestOptions };

export interface BacktestOptions {
  from: string;
  to: string;
  initialBalance: number;
}

export type IPCResponse =
  | { type: "success"; data?: unknown }
  | { type: "error"; error: string };

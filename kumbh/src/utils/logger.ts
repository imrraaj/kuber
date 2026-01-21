import type { StructuredLogger } from "../types/index.ts";
import { logManager } from "./log-manager.ts";

export function createLogger(strategyName: string): StructuredLogger {
  const log = (level: "debug" | "info" | "warn" | "error", message: string, data?: Record<string, unknown>) => {
    const timestamp = Date.now();

    // Console output
    const isoTime = new Date(timestamp).toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";
    console.log(`[${isoTime}] [${level.toUpperCase()}] [${strategyName}] ${message}${dataStr}`);

    // Send to LogManager for storage and WebSocket broadcast
    logManager.addLog({
      timestamp,
      level,
      strategyName,
      message,
      data,
    });
  };

  return {
    debug: (message: string, data?: Record<string, unknown>) => log("debug", message, data),
    info: (message: string, data?: Record<string, unknown>) => log("info", message, data),
    warn: (message: string, data?: Record<string, unknown>) => log("warn", message, data),
    error: (message: string, data?: Record<string, unknown>) => log("error", message, data),
  };
}

export function createEngineLogger(): StructuredLogger {
  return createLogger("ENGINE");
}

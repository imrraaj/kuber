import type { StructuredLogger } from "../types/index.ts";

export function createLogger(strategyName: string): StructuredLogger {
  const log = (level: string, message: string, data?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";
    console.log(`[${timestamp}] [${level.toUpperCase()}] [${strategyName}] ${message}${dataStr}`);
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

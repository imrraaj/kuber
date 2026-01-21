import { Elysia } from "elysia";
import type { Config } from "../../config.ts";
import type { StrategyManager } from "../../engine/strategy-manager.ts";
import type { HealthResponse, StatusResponse } from "../types.ts";

const VERSION = "0.1.0";

/**
 * Create health check routes.
 *
 * Endpoints:
 * - GET /health     - Basic health check
 * - GET /api/status - Detailed status information
 */
export function createHealthRoutes(
  config: Config,
  strategyManager: StrategyManager,
  startTime: number
): Elysia {
  return new Elysia()
    // GET /health - Basic health check
    .get("/health", (): HealthResponse => {
      return {
        status: "healthy",
        timestamp: Date.now(),
        uptime: Date.now() - startTime,
      };
    })

    // GET /api/status - Detailed status
    .get("/api/status", (): StatusResponse => {
      const strategies = strategyManager.getAllStrategies();
      const activeCount = strategies.filter((s) => s.isActive).length;

      return {
        version: VERSION,
        network: config.isTestnet ? "testnet" : "mainnet",
        strategiesCount: strategies.length,
        activeStrategiesCount: activeCount,
      };
    });
}

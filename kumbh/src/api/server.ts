import { Elysia } from "elysia";
import type { Config } from "../config.ts";
import type { StrategyManager } from "../engine/strategy-manager.ts";
import { createStrategiesRoutes } from "./routes/strategies.ts";
import { createBacktestRoutes } from "./routes/backtest.ts";
import { createHealthRoutes } from "./routes/health.ts";
import { createWebSocketHandler } from "./websocket/handler.ts";

/**
 * Create and configure the Elysia API server.
 *
 * This server exposes:
 * - REST API for strategy management
 * - WebSocket for real-time updates
 */
export function createApiServer(
  config: Config,
  strategyManager: StrategyManager,
  startTime: number
): Elysia {
  const app = new Elysia();

  // Health check routes
  const healthRoutes = createHealthRoutes(config, strategyManager, startTime);
  app.use(healthRoutes);

  // Strategy CRUD routes
  const strategiesRoutes = createStrategiesRoutes(strategyManager);
  app.use(strategiesRoutes);

  // Backtest routes
  const backtestRoutes = createBacktestRoutes(strategyManager, config);
  app.use(backtestRoutes);

  // WebSocket handler
  const wsHandler = createWebSocketHandler(strategyManager);
  app.use(wsHandler);

  return app;
}

/**
 * Start the API server and return a cleanup function.
 */
export async function startApiServer(
  config: Config,
  strategyManager: StrategyManager,
  startTime: number
): Promise<{ server: Elysia; stop: () => void }> {
  const app = createApiServer(config, strategyManager, startTime);

  const server = app.listen({
    hostname: config.apiHost,
    port: config.apiPort,
  });

  console.log(`API server listening on http://${config.apiHost}:${config.apiPort}`);

  return {
    server: app,
    stop: () => {
      server.stop();
    },
  };
}

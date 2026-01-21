import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import type { Config } from "../config.ts";
import type { StrategyManager } from "../engine/strategy-manager.ts";
import { createStrategiesRoutes } from "./routes/strategies.ts";
import { createBacktestRoutes } from "./routes/backtest.ts";
import { createHealthRoutes } from "./routes/health.ts";
import { createLogsRoutes } from "./routes/logs.ts";
import { createTradesRoutes } from "./routes/trades.ts";
import { createWebSocketHandler } from "./websocket/handler.ts";
import { logManager } from "../utils/log-manager.ts";

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
) {
  const app = new Elysia()
    // Enable CORS for frontend dev
    .use(cors({
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    }));

  // Health check routes
  const healthRoutes = createHealthRoutes(config, strategyManager, startTime);
  app.use(healthRoutes);

  // Strategy CRUD routes
  const strategiesRoutes = createStrategiesRoutes(strategyManager);
  app.use(strategiesRoutes);

  // Backtest routes
  const backtestRoutes = createBacktestRoutes(strategyManager, config);
  app.use(backtestRoutes);

  // Logs routes
  const logsRoutes = createLogsRoutes();
  app.use(logsRoutes);

  // Trades routes
  const tradesRoutes = createTradesRoutes(strategyManager);
  app.use(tradesRoutes);

  // WebSocket handler
  const wsHandler = createWebSocketHandler(strategyManager, logManager);
  app.use(wsHandler);

  return app;
}

/**
 * Export the app type for Eden client
 */
export type App = ReturnType<typeof createApiServer>;

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

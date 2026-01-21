import { Elysia, t } from "elysia";
import type { Config } from "../../config.ts";
import type { StrategyManager } from "../../engine/strategy-manager.ts";
import type { BacktestRequest, BacktestResponse, ErrorResponse } from "../types.ts";

/**
 * Create backtest routes.
 *
 * Endpoints:
 * - POST /api/backtest/:name - Run backtest on a strategy
 */
export function createBacktestRoutes(
  strategyManager: StrategyManager,
  config: Config
): Elysia {
  return new Elysia({ prefix: "/api/backtest" })
    // POST /api/backtest/:name - Run backtest
    .post(
      "/:name",
      async ({ params, body, set }): Promise<BacktestResponse | ErrorResponse> => {
        try {
          const strategy = strategyManager.getStrategy(params.name);
          if (!strategy) {
            set.status = 404;
            return {
              success: false,
              error: `Strategy '${params.name}' not found`,
            };
          }

          // Run the backtest
          const result = await strategyManager.runBacktest(
            params.name,
            {
              from: body.from,
              to: body.to,
              initialBalance: body.initialBalance,
            },
            config
          );

          return result;
        } catch (error) {
          set.status = 500;
          return {
            success: false,
            error: error instanceof Error ? error.message : "Backtest failed",
          };
        }
      },
      {
        params: t.Object({
          name: t.String(),
        }),
        body: t.Object({
          from: t.String({ description: "Start date: YYYY-MM-DD" }),
          to: t.String({ description: "End date: YYYY-MM-DD" }),
          initialBalance: t.Number({ description: "Starting balance in USD" }),
        }),
      }
    );
}

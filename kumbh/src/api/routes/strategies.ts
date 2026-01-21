import { Elysia, t } from "elysia";
import { resolve } from "path";
import type { StrategyManager } from "../../engine/strategy-manager.ts";
import type {
  AddStrategyRequest,
  AddStrategyResponse,
  StrategyResponse,
  OperationResponse,
  ErrorResponse,
} from "../types.ts";

/**
 * Create strategy CRUD routes.
 *
 * Endpoints:
 * - GET    /api/strategies           - List all strategies
 * - GET    /api/strategies/:name     - Get single strategy details
 * - POST   /api/strategies           - Add new strategy
 * - POST   /api/strategies/:name/start  - Start strategy
 * - POST   /api/strategies/:name/stop   - Stop strategy
 * - POST   /api/strategies/:name/reload - Reload strategy code
 * - DELETE /api/strategies/:name     - Remove strategy
 */
export function createStrategiesRoutes(strategyManager: StrategyManager): Elysia {
  return new Elysia({ prefix: "/api/strategies" })
    // GET /api/strategies - List all strategies
    .get("/", async (): Promise<StrategyResponse[]> => {
      const strategies = strategyManager.getAllStrategies();
      return strategies.map((s) => ({
        name: s.name,
        description: s.description,
        symbols: s.symbols,
        timeframes: s.timeframes,
        filePath: s.filePath,
        isActive: s.isActive,
        startedAt: s.startedAt,
        errorCount: s.errorCount,
        lastError: s.lastError,
        lastCandleAt: s.lastCandleAt,
        status: s.isActive ? strategyManager.getStrategyStatus(s.name) : null,
      }));
    })

    // GET /api/strategies/:name - Get single strategy
    .get(
      "/:name",
      async ({ params, set }): Promise<StrategyResponse | ErrorResponse> => {
        const strategy = strategyManager.getStrategy(params.name);
        if (!strategy) {
          set.status = 404;
          return { success: false, error: `Strategy '${params.name}' not found` };
        }

        return {
          name: strategy.name,
          description: strategy.description,
          symbols: strategy.symbols,
          timeframes: strategy.timeframes,
          filePath: strategy.filePath,
          isActive: strategy.isActive,
          startedAt: strategy.startedAt,
          errorCount: strategy.errorCount,
          lastError: strategy.lastError,
          lastCandleAt: strategy.lastCandleAt,
          status: strategy.isActive
            ? strategyManager.getStrategyStatus(strategy.name)
            : null,
        };
      },
      {
        params: t.Object({
          name: t.String(),
        }),
      }
    )

    // POST /api/strategies - Add new strategy
    .post(
      "/",
      async ({ body, set }): Promise<AddStrategyResponse | ErrorResponse> => {
        try {
          const absolutePath = resolve(body.path);
          const name = await strategyManager.addStrategy(absolutePath);
          return {
            success: true,
            name,
            message: `Strategy '${name}' added successfully`,
          };
        } catch (error) {
          set.status = 400;
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to add strategy",
          };
        }
      },
      {
        body: t.Object({
          path: t.String(),
        }),
      }
    )

    // POST /api/strategies/:name/start - Start strategy
    .post(
      "/:name/start",
      async ({ params, set }): Promise<OperationResponse | ErrorResponse> => {
        try {
          await strategyManager.startStrategy(params.name);
          return {
            success: true,
            message: `Strategy '${params.name}' started`,
          };
        } catch (error) {
          set.status = 400;
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to start strategy",
          };
        }
      },
      {
        params: t.Object({
          name: t.String(),
        }),
      }
    )

    // POST /api/strategies/:name/stop - Stop strategy
    .post(
      "/:name/stop",
      async ({ params, set }): Promise<OperationResponse | ErrorResponse> => {
        try {
          await strategyManager.stopStrategy(params.name);
          return {
            success: true,
            message: `Strategy '${params.name}' stopped`,
          };
        } catch (error) {
          set.status = 400;
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to stop strategy",
          };
        }
      },
      {
        params: t.Object({
          name: t.String(),
        }),
      }
    )

    // POST /api/strategies/:name/reload - Reload strategy code
    .post(
      "/:name/reload",
      async ({ params, set }): Promise<OperationResponse | ErrorResponse> => {
        try {
          await strategyManager.reloadStrategy(params.name);
          return {
            success: true,
            message: `Strategy '${params.name}' reloaded`,
          };
        } catch (error) {
          set.status = 400;
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to reload strategy",
          };
        }
      },
      {
        params: t.Object({
          name: t.String(),
        }),
      }
    )

    // DELETE /api/strategies/:name - Remove strategy
    .delete(
      "/:name",
      async ({ params, set }): Promise<OperationResponse | ErrorResponse> => {
        try {
          await strategyManager.removeStrategy(params.name);
          return {
            success: true,
            message: `Strategy '${params.name}' removed`,
          };
        } catch (error) {
          set.status = 400;
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to remove strategy",
          };
        }
      },
      {
        params: t.Object({
          name: t.String(),
        }),
      }
    );
}

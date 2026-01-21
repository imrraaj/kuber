import { Elysia, t } from "elysia";
import type { StrategyManager } from "../../engine/strategy-manager.ts";

export interface Trade {
  id: number;
  symbol: string;
  side: "long" | "short";
  size: number;
  price: number;
  pnl: number | null;
  timestamp: number;
}

/**
 * Create trades routes.
 *
 * Endpoints:
 * - GET /api/strategies/:name/trades - Get trades for a specific strategy
 */
export function createTradesRoutes(strategyManager: StrategyManager): Elysia {
  return new Elysia()
    // GET /api/strategies/:name/trades - Get trades for a strategy
    .get(
      "/api/strategies/:name/trades",
      ({ params, query, set }): Trade[] | { success: false; error: string } => {
        const strategy = strategyManager.getStrategy(params.name);
        if (!strategy) {
          set.status = 404;
          return { success: false, error: `Strategy '${params.name}' not found` };
        }

        const limit = query.limit ? parseInt(query.limit, 10) : 50;

        // Try to get trades from strategy's database
        // Strategies store trades in their own SQLite databases
        try {
          const db = strategyManager.getStrategyDatabase(params.name);
          if (!db) {
            return [];
          }

          const trades = db.query(`
            SELECT id, symbol, side, size, price, pnl, timestamp
            FROM trades
            ORDER BY timestamp DESC
            LIMIT ?
          `).all(limit) as Trade[];

          return trades;
        } catch {
          // Table might not exist or other error
          return [];
        }
      },
      {
        params: t.Object({
          name: t.String(),
        }),
        query: t.Object({
          limit: t.Optional(t.String()),
        }),
      }
    );
}

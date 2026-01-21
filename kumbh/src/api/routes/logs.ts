import { Elysia, t } from "elysia";
import { logManager, type LogEntry } from "../../utils/log-manager.ts";

/**
 * Create logs routes.
 *
 * Endpoints:
 * - GET /api/logs                  - Get all logs (global)
 * - GET /api/strategies/:name/logs - Get logs for a specific strategy
 */
export function createLogsRoutes(): Elysia {
  return new Elysia()
    // GET /api/logs - Get all logs
    .get(
      "/api/logs",
      ({ query }): LogEntry[] => {
        const limit = query.limit ? parseInt(query.limit, 10) : 100;
        return logManager.getAllLogs(limit);
      },
      {
        query: t.Object({
          limit: t.Optional(t.String()),
        }),
      }
    )

    // GET /api/strategies/:name/logs - Get logs for a strategy
    .get(
      "/api/strategies/:name/logs",
      ({ params, query }): LogEntry[] => {
        const limit = query.limit ? parseInt(query.limit, 10) : 100;
        return logManager.getLogsForStrategy(params.name, limit);
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

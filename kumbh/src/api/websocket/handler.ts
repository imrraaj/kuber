import { Elysia } from "elysia";
import type { StrategyManager } from "../../engine/strategy-manager.ts";
import type {
  WSServerMessage,
  WSClientMessage,
  WSInitialStateMessage,
  WSStrategyUpdateMessage,
  StrategyResponse,
} from "../types.ts";

/**
 * Set of connected WebSocket clients.
 */
const connectedClients = new Set<{
  send: (message: string) => void;
  subscribedStrategies: Set<string> | null; // null means subscribed to all
}>();

/**
 * Broadcast a message to all connected WebSocket clients.
 */
export function broadcastToClients(message: WSServerMessage): void {
  const messageStr = JSON.stringify(message);

  for (const client of connectedClients) {
    try {
      // If it's a strategy update, check subscription filter
      if (message.type === "strategy_update" && client.subscribedStrategies !== null) {
        const strategyName = message.payload.name;
        if (!client.subscribedStrategies.has(strategyName)) {
          continue;
        }
      }
      client.send(messageStr);
    } catch {
      // Client disconnected, will be cleaned up
    }
  }
}

/**
 * Create WebSocket handler for real-time updates.
 *
 * Endpoint: /ws
 *
 * Server -> Client Messages:
 * - initial_state: Sent on connection with all strategies
 * - strategy_update: Sent when strategy state changes
 * - error: Sent on errors
 * - pong: Response to ping
 *
 * Client -> Server Messages:
 * - ping: Keepalive
 * - subscribe: Filter to specific strategies
 */
export function createWebSocketHandler(strategyManager: StrategyManager): Elysia {
  // Listen to strategy manager events and broadcast
  strategyManager.on("strategyStarted", (name: string) => {
    const strategy = strategyManager.getStrategy(name);
    if (strategy) {
      broadcastToClients({
        type: "strategy_update",
        payload: {
          name,
          isActive: true,
          status: strategyManager.getStrategyStatus(name),
          event: "started",
        },
        timestamp: Date.now(),
      });
    }
  });

  strategyManager.on("strategyStopped", (name: string) => {
    broadcastToClients({
      type: "strategy_update",
      payload: {
        name,
        isActive: false,
        status: null,
        event: "stopped",
      },
      timestamp: Date.now(),
    });
  });

  strategyManager.on("strategyAdded", (name: string) => {
    const strategy = strategyManager.getStrategy(name);
    if (strategy) {
      broadcastToClients({
        type: "strategy_update",
        payload: {
          name,
          isActive: false,
          status: null,
          event: "added",
        },
        timestamp: Date.now(),
      });
    }
  });

  strategyManager.on("strategyRemoved", (name: string) => {
    broadcastToClients({
      type: "strategy_update",
      payload: {
        name,
        isActive: false,
        status: null,
        event: "removed",
      },
      timestamp: Date.now(),
    });
  });

  strategyManager.on("strategyError", (name: string, error: string) => {
    broadcastToClients({
      type: "strategy_update",
      payload: {
        name,
        isActive: true,
        status: strategyManager.getStrategyStatus(name),
        event: "error",
      },
      timestamp: Date.now(),
    });
  });

  strategyManager.on("candleProcessed", (name: string) => {
    broadcastToClients({
      type: "strategy_update",
      payload: {
        name,
        isActive: true,
        status: strategyManager.getStrategyStatus(name),
        event: "candle_processed",
      },
      timestamp: Date.now(),
    });
  });

  return new Elysia().ws("/ws", {
    open(ws) {
      // Create client entry
      const client = {
        send: (message: string) => ws.send(message),
        subscribedStrategies: null as Set<string> | null,
      };
      connectedClients.add(client);

      // Store client reference on ws for later access
      (ws as any).__client = client;

      // Send initial state
      const strategies = strategyManager.getAllStrategies();
      const initialState: WSInitialStateMessage = {
        type: "initial_state",
        payload: strategies.map((s): StrategyResponse => ({
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
        })),
        timestamp: Date.now(),
      };

      ws.send(JSON.stringify(initialState));
    },

    message(ws, message) {
      try {
        const parsed = typeof message === "string"
          ? JSON.parse(message)
          : message as WSClientMessage;

        const client = (ws as any).__client;

        switch (parsed.type) {
          case "ping":
            ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
            break;

          case "subscribe":
            if (client && parsed.payload?.strategies) {
              client.subscribedStrategies = new Set(parsed.payload.strategies);
            }
            break;
        }
      } catch {
        ws.send(
          JSON.stringify({
            type: "error",
            payload: { message: "Invalid message format" },
            timestamp: Date.now(),
          })
        );
      }
    },

    close(ws) {
      const client = (ws as any).__client;
      if (client) {
        connectedClients.delete(client);
      }
    },
  });
}

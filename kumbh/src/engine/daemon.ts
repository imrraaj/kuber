import type { Config } from "../config.ts";
import { EngineDatabase } from "../db/engine-db.ts";
import { SubscriptionManager } from "./subscription-manager.ts";
import { StrategyManager } from "./strategy-manager.ts";
import { SocketServer } from "./socket-server.ts";
import { HyperliquidAPI } from "./hyperliquid.ts";
import { BacktestRunner } from "./backtest-runner.ts";
import type { IPCRequest, IPCResponse } from "../types/index.ts";

export async function runDaemon(config: Config): Promise<void> {
  console.log("Starting Kumbh Engine Daemon...");
  console.log(`Network: ${config.isTestnet ? "TESTNET" : "MAINNET"}`);

  const db = new EngineDatabase(config.dataDir);
  const api = new HyperliquidAPI(
    config.hyperliquid.privateKey,
    config.hyperliquid.walletAddress,
    config.isTestnet
  );
  const subscriptionManager = new SubscriptionManager(config.isTestnet);
  await subscriptionManager.init();

  const strategyManager = new StrategyManager(db, subscriptionManager, api, config);
  const socketServer = new SocketServer(config.socketPath);
  const backtestRunner = new BacktestRunner(config.isTestnet);

  await strategyManager.loadFromDatabase();

  subscriptionManager.onCandle(async (candle) => {
    await strategyManager.dispatchCandle(candle);
  });

  socketServer.onRequest(async (request: IPCRequest): Promise<IPCResponse> => {
    try {
      switch (request.type) {
        case "add": {
          const name = await strategyManager.addStrategy(request.path);
          return { type: "success", data: { name } };
        }

        case "start": {
          await strategyManager.startStrategy(request.name);
          return { type: "success" };
        }

        case "stop": {
          await strategyManager.stopStrategy(request.name);
          return { type: "success" };
        }

        case "remove": {
          await strategyManager.removeStrategy(request.name);
          return { type: "success" };
        }

        case "reload": {
          await strategyManager.reloadStrategy(request.name);
          return { type: "success" };
        }

        case "list": {
          const strategies = strategyManager.getAllStrategyEntries();
          return { type: "success", data: strategies };
        }

        case "status": {
          if (request.name) {
            const status = strategyManager.getStrategyStatus(request.name);
            return { type: "success", data: status };
          } else {
            const strategies = strategyManager.getAllStrategyEntries();
            const statuses = strategies.map(entry => ({
              ...entry,
              status: strategyManager.getStrategyStatus(entry.name),
            }));
            return { type: "success", data: statuses };
          }
        }

        case "backtest": {
          const entries = strategyManager.getAllStrategyEntries();
          const entry = entries.find(e => e.name === request.name);
          if (!entry) {
            throw new Error(`Strategy not found: ${request.name}`);
          }
          const result = await backtestRunner.runBacktest(
            entry.filePath,
            request.options
          );
          return { type: "success", data: result };
        }

        default:
          return { type: "error", error: "Unknown command" };
      }
    } catch (error) {
      return {
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await socketServer.close();
    await subscriptionManager.closeAll();
    await strategyManager.cleanup();
    db.close();
    console.log("Shutdown complete");
    process.exit(0);
  });

  await socketServer.listen();
  console.log("Kumbh Engine ready. Listening for strategies...");
}

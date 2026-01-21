import type { Config } from "../config.ts";
import { EngineDatabase } from "../db/engine-db.ts";
import { SubscriptionManager } from "./subscription-manager.ts";
import { StrategyManager } from "./strategy-manager.ts";
import { HyperliquidAPI } from "./hyperliquid.ts";
import { startApiServer } from "../api/server.ts";

export async function runDaemon(config: Config): Promise<void> {
  const startTime = Date.now();

  console.log("Starting Kumbh Engine Daemon...");
  console.log(`Network: ${config.isTestnet ? "TESTNET" : "MAINNET"}`);
  console.log(`Data directory: ${config.dataDir}`);

  // Initialize database
  const db = new EngineDatabase(config.dataDir);

  // Initialize Hyperliquid API
  const api = new HyperliquidAPI(
    config.hyperliquid.privateKey,
    config.hyperliquid.walletAddress,
    config.isTestnet
  );

  // Initialize subscription manager for WebSocket data
  const subscriptionManager = new SubscriptionManager(config.isTestnet);
  await subscriptionManager.init();

  // Initialize strategy manager
  const strategyManager = new StrategyManager(db, subscriptionManager, api, config);

  // Load strategies from database (will auto-start previously active ones)
  await strategyManager.loadFromDatabase();

  // Connect candle events to strategy manager
  subscriptionManager.onCandle(async (candle) => {
    await strategyManager.dispatchCandle(candle);
  });

  // Start Elysia API server
  const { stop: stopServer } = await startApiServer(config, strategyManager, startTime);

  // Graceful shutdown handler
  const shutdown = async () => {
    console.log("\nShutting down...");

    // Stop API server
    stopServer();

    // Close WebSocket subscriptions
    await subscriptionManager.closeAll();

    // Cleanup strategies
    await strategyManager.cleanup();

    // Close database
    db.close();

    console.log("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("Kumbh Engine ready.");
  console.log(`Strategies loaded: ${strategyManager.getAllStrategies().length}`);
  console.log(`Active strategies: ${strategyManager.getAllStrategies().filter(s => s.isActive).length}`);
}

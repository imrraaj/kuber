import { Strategy } from "../strategy/base.ts";
import { loadStrategyFromFile } from "../strategy/loader.ts";
import { LiveStrategyContext } from "../strategy/live-context.ts";
import { createLogger } from "../utils/logger.ts";
import { validateStrategyName, validateFilePath } from "../utils/validation.ts";
import { EngineDatabase, StrategyEntry } from "../db/engine-db.ts";
import { SubscriptionManager } from "./subscription-manager.ts";
import { HyperliquidAPI } from "./hyperliquid.ts";
import type { Config } from "../config.ts";
import type { CandleEvent, StrategyStatus } from "../types/index.ts";

export class StrategyManager {
  private allStrategies: Map<string, StrategyEntry> = new Map();
  private activeStrategies: Map<string, Strategy> = new Map();
  private db: EngineDatabase;
  private subscriptionManager: SubscriptionManager;
  private api: HyperliquidAPI;
  private config: Config;

  constructor(
    db: EngineDatabase,
    subscriptionManager: SubscriptionManager,
    api: HyperliquidAPI,
    config: Config
  ) {
    this.db = db;
    this.subscriptionManager = subscriptionManager;
    this.api = api;
    this.config = config;
  }

  async loadFromDatabase(): Promise<void> {
    const entries = this.db.getAllStrategies();
    
    for (const entry of entries) {
      this.allStrategies.set(entry.name, entry);
      
      if (entry.isActive) {
        try {
          await this.startStrategy(entry.name);
        } catch (error) {
          console.error(`Failed to auto-start strategy ${entry.name}:`, error);
        }
      }
    }
  }

  async addStrategy(filePath: string): Promise<string> {
    validateFilePath(filePath);

    const StrategyClass = await loadStrategyFromFile(filePath);

    const tempDb = this.db.createStrategyDatabase("temp", this.config.dataDir);
    const tempLogger = createLogger("temp");
    const tempCtx = new LiveStrategyContext(tempDb, tempLogger, this.config.isTestnet, this.api);
    const tempInstance = new StrategyClass(tempCtx);

    const entry: StrategyEntry = {
      name: tempInstance.name,
      description: tempInstance.description,
      symbols: tempInstance.symbols,
      timeframes: tempInstance.timeframes,
      filePath: filePath,
      isActive: false,
      startedAt: null,
      errorCount: 0,
      lastError: null,
      lastCandleAt: null,
    };

    validateStrategyName(entry.name);

    this.allStrategies.set(entry.name, entry);
    this.db.addStrategy(entry);

    tempDb.close();

    return entry.name;
  }

  async startStrategy(name: string): Promise<void> {
    const entry = this.allStrategies.get(name);
    if (!entry) {
      throw new Error(`Strategy not found: ${name}`);
    }

    if (this.activeStrategies.has(name)) {
      throw new Error(`Strategy already active: ${name}`);
    }

    const StrategyClass = await loadStrategyFromFile(entry.filePath);
    const strategyDb = this.db.createStrategyDatabase(name, this.config.dataDir);
    const logger = createLogger(name);
    const ctx = new LiveStrategyContext(strategyDb, logger, this.config.isTestnet, this.api);
    const instance = new StrategyClass(ctx);

    await instance.init();

    for (const symbol of entry.symbols) {
      for (const timeframe of entry.timeframes) {
        await this.subscriptionManager.subscribe(symbol, timeframe, name);
      }
    }

    this.activeStrategies.set(name, instance);
    entry.isActive = true;
    entry.startedAt = Date.now();
    this.db.setActive(name, true, entry.startedAt);
  }

  async stopStrategy(name: string): Promise<void> {
    const instance = this.activeStrategies.get(name);
    if (!instance) {
      throw new Error(`Strategy not active: ${name}`);
    }

    const entry = this.allStrategies.get(name);
    if (!entry) {
      throw new Error(`Strategy not found: ${name}`);
    }

    await instance.cleanup();

    for (const symbol of entry.symbols) {
      for (const timeframe of entry.timeframes) {
        await this.subscriptionManager.unsubscribe(symbol, timeframe, name);
      }
    }

    this.activeStrategies.delete(name);
    entry.isActive = false;
    entry.startedAt = null;
    this.db.setActive(name, false, null);
  }

  async removeStrategy(name: string): Promise<void> {
    if (this.activeStrategies.has(name)) {
      throw new Error(`Stop strategy before removing: ${name}`);
    }

    this.allStrategies.delete(name);
    this.db.removeStrategy(name);
  }

  async reloadStrategy(name: string): Promise<void> {
    if (this.activeStrategies.has(name)) {
      throw new Error(`Stop strategy before reloading: ${name}`);
    }

    const entry = this.allStrategies.get(name);
    if (!entry) {
      throw new Error(`Strategy not found: ${name}`);
    }

    const StrategyClass = await loadStrategyFromFile(entry.filePath);
    const tempDb = this.db.createStrategyDatabase("temp", this.config.dataDir);
    const tempLogger = createLogger("temp");
    const tempCtx = new LiveStrategyContext(tempDb, tempLogger, this.config.isTestnet, this.api);
    const tempInstance = new StrategyClass(tempCtx);

    entry.description = tempInstance.description;
    entry.symbols = tempInstance.symbols;
    entry.timeframes = tempInstance.timeframes;
    
    this.db.updateStrategy(entry);
    tempDb.close();
  }

  async dispatchCandle(candle: CandleEvent): Promise<void> {
    const subscribers = this.subscriptionManager.getSubscribersFor(candle.coin, candle.interval);
    
    for (const strategyName of subscribers) {
      const instance = this.activeStrategies.get(strategyName);
      const entry = this.allStrategies.get(strategyName);
      
      if (instance && entry) {
        try {
          await instance.onCandle(candle);
          this.db.updateLastCandle(strategyName, Date.now());
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`Strategy ${strategyName} error:`, errorMsg);
          this.db.incrementErrorCount(strategyName, errorMsg);
          
          setTimeout(() => this.restartStrategy(strategyName), 1000);
        }
      }
    }
  }

  private async restartStrategy(name: string): Promise<void> {
    try {
      await this.stopStrategy(name);
      await this.startStrategy(name);
      console.log(`Strategy ${name} restarted successfully`);
    } catch (error) {
      console.error(`Failed to restart strategy ${name}:`, error);
    }
  }

  getStrategyStatus(name: string): StrategyStatus | null {
    const instance = this.activeStrategies.get(name);
    if (!instance) return null;
    return instance.status();
  }

  getAllStrategyEntries(): StrategyEntry[] {
    return Array.from(this.allStrategies.values());
  }

  async cleanup(): Promise<void> {
    for (const [name, instance] of this.activeStrategies) {
      try {
        await instance.cleanup();
      } catch (error) {
        console.error(`Error cleaning up strategy ${name}:`, error);
      }
    }
  }
}

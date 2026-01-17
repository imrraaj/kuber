import type { Database } from "bun:sqlite";
import type {
  OrderParams,
  OrderResult,
  CloseParams,
  AccountState,
  Position,
  StructuredLogger,
} from "../types/index.ts";
import type { StrategyContext } from "./context.ts";
import type { HyperliquidAPI } from "../engine/hyperliquid.ts";

export class LiveStrategyContext implements StrategyContext {
  db: Database;
  log: StructuredLogger;
  isBacktest = false;
  isTestnet: boolean;
  private api: HyperliquidAPI;

  constructor(
    db: Database,
    logger: StructuredLogger,
    isTestnet: boolean,
    api: HyperliquidAPI
  ) {
    this.db = db;
    this.log = logger;
    this.isTestnet = isTestnet;
    this.api = api;
  }

  async openPosition(params: OrderParams): Promise<OrderResult> {
    return this.api.openPosition(params);
  }

  async closePosition(params: CloseParams): Promise<OrderResult> {
    return this.api.closePosition(params);
  }

  async getBalance(): Promise<AccountState> {
    return this.api.getBalance();
  }

  async getPositions(): Promise<Position[]> {
    return this.api.getPositions();
  }
}

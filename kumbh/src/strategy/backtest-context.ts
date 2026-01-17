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

export class BacktestContext implements StrategyContext {
  db: Database;
  log: StructuredLogger;
  isBacktest = true;
  isTestnet: boolean;

  private balance: number;
  private positions: Map<string, Position> = new Map();

  constructor(
    db: Database,
    logger: StructuredLogger,
    isTestnet: boolean,
    initialBalance: number
  ) {
    this.db = db;
    this.log = logger;
    this.isTestnet = isTestnet;
    this.balance = initialBalance;
  }

  async openPosition(params: OrderParams): Promise<OrderResult> {
    const cost = params.size * (params.price || 0);
    
    if (cost > this.balance) {
      return {
        orderId: `backtest-${Date.now()}`,
        status: "failed",
        error: "Insufficient balance"
      };
    }

    this.balance -= cost;

    const position: Position = {
      symbol: params.symbol,
      side: params.side,
      size: params.size,
      entryPrice: params.price || 0,
      markPrice: params.price || 0,
      unrealizedPnl: 0,
      liquidationPrice: 0,
      leverage: params.leverage || 1,
      marginUsed: cost
    };

    this.positions.set(params.symbol, position);

    return {
      orderId: `backtest-${Date.now()}`,
      status: "filled",
      filledPrice: params.price,
      filledSize: params.size
    };
  }

  async closePosition(params: CloseParams): Promise<OrderResult> {
    const position = this.positions.get(params.symbol);
    
    if (!position) {
      return {
        orderId: `backtest-${Date.now()}`,
        status: "failed",
        error: "No position to close"
      };
    }

    const pnl = position.side === "long"
      ? (params.price || 0 - position.entryPrice) * params.size
      : (position.entryPrice - (params.price || 0)) * params.size;

    this.balance += position.marginUsed + pnl;
    this.positions.delete(params.symbol);

    return {
      orderId: `backtest-${Date.now()}`,
      status: "filled",
      filledPrice: params.price,
      filledSize: params.size
    };
  }

  async getBalance(): Promise<AccountState> {
    const marginUsed = Array.from(this.positions.values())
      .reduce((sum, p) => sum + p.marginUsed, 0);

    return {
      accountValue: this.balance,
      availableBalance: this.balance - marginUsed,
      marginUsed,
      withdrawable: this.balance - marginUsed
    };
  }

  async getPositions(): Promise<Position[]> {
    return Array.from(this.positions.values());
  }

  getBalanceSync(): number {
    return this.balance;
  }
}

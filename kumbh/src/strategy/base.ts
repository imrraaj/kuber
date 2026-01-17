import type { CandleEvent, Interval, StrategyStatus } from "../types/index.ts";
import type { StrategyContext } from "./context.ts";

/**
 * Abstract base class that all strategies must extend.
 *
 * A strategy is a trading algorithm that:
 * 1. Receives candle data
 * 2. Decides when to buy/sell
 * 3. Manages its own positions
 * 4. Tracks its own state
 */
export abstract class Strategy {
  /**
   * The context provides helpers for trading, persistence, and logging.
   * Injected by the engine when the strategy is instantiated.
   */
  protected ctx: StrategyContext;

  constructor(ctx: StrategyContext) {
    this.ctx = ctx;
  }

  /**
   * Unique name for this strategy.
   */
  abstract get name(): string;

  /**
   * Human-readable description.
   */
  abstract get description(): string;

  /**
   * List of symbols this strategy wants data for.
   */
  abstract get symbols(): string[];

  /**
   * List of timeframes this strategy wants candles for.
   */
  abstract get timeframes(): Interval[];

  /**
   * Called once when the strategy is started.
   */
  abstract init(): Promise<void>;

  /**
   * Called when the strategy is stopped.
   */
  abstract cleanup(): Promise<void>;

  /**
   * Called for each new candle during LIVE trading.
   */
  abstract onCandle(candle: CandleEvent): Promise<void>;

  /**
   * Called for each historical candle during BACKTESTING.
   */
  abstract onBacktestCandle(candle: CandleEvent): Promise<void>;

  /**
   * Return current status information for display in CLI.
   */
  abstract status(): StrategyStatus;
}

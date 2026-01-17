import { Database } from "bun:sqlite";
import { loadStrategyFromFile } from "../strategy/loader.ts";
import { BacktestContext } from "../strategy/backtest-context.ts";
import { createLogger } from "../utils/logger.ts";
import type { BacktestOptions, BacktestResult, BacktestTrade, EquityPoint, CandleEvent } from "../types/index.ts";
import { InfoClient, HttpTransport } from "@nktkas/hyperliquid";

export class BacktestRunner {
  private isTestnet: boolean;

  constructor(isTestnet: boolean) {
    this.isTestnet = isTestnet;
  }

  async runBacktest(
    strategyPath: string,
    options: BacktestOptions
  ): Promise<BacktestResult> {
    const StrategyClass = await loadStrategyFromFile(strategyPath);
    const tempDb = new Database(":memory:");
    const logger = createLogger("BACKTEST");
    const ctx = new BacktestContext(tempDb, logger, this.isTestnet, options.initialBalance);
    const instance = new StrategyClass(ctx);

    await instance.init();

    const candles = await this.fetchHistoricalCandles(
      instance.symbols,
      instance.timeframes,
      options.from,
      options.to
    );

    console.log(`Fetched ${candles.length} candles for backtest`);
    if (candles.length > 0) {
      console.log(`First candle: ${new Date(candles[0].t).toISOString()}`);
      console.log(`Last candle: ${new Date(candles[candles.length - 1].t).toISOString()}`);
    }

    const trades: BacktestTrade[] = [];
    const equityCurve: EquityPoint[] = [];

    for (const candle of candles) {
      const balanceBefore = ctx.getBalanceSync();

      await instance.onBacktestCandle(candle);

      const balanceAfter = ctx.getBalanceSync();

      equityCurve.push({
        timestamp: candle.t,
        equity: balanceAfter,
      });
    }

    await instance.cleanup();
    tempDb.close();

    const finalEquity = equityCurve[equityCurve.length - 1]?.equity || options.initialBalance;
    const totalPnl = finalEquity - options.initialBalance;

    // Calculate metrics from equity curve
    let winningTrades = 0;
    let losingTrades = 0;
    let maxEquity = options.initialBalance;
    let maxDrawdown = 0;

    for (let i = 1; i < equityCurve.length; i++) {
      const prevEquity = equityCurve[i - 1].equity;
      const currentEquity = equityCurve[i].equity;
      const change = currentEquity - prevEquity;

      // Detect trades by equity changes (ignoring small floating point differences)
      if (Math.abs(change) > 0.001) {
        if (change > 0) {
          winningTrades++;
        } else {
          losingTrades++;
        }
      }

      // Track max drawdown
      if (currentEquity > maxEquity) {
        maxEquity = currentEquity;
      }
      const drawdown = (maxEquity - currentEquity) / maxEquity;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    const totalTrades = winningTrades + losingTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    return {
      totalPnl,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      maxDrawdown: maxDrawdown * 100, // Convert to percentage
      sharpeRatio: 0, // Would need returns series to calculate
      trades,
      equityCurve,
    };
  }

  private async fetchHistoricalCandles(
    symbols: string[],
    timeframes: string[],
    from: string,
    to: string
  ): Promise<CandleEvent[]> {
    // Always use mainnet for historical data (testnet doesn't have historical candles)
    const transport = new HttpTransport({ testnet: false });
    const info = new InfoClient({ transport });
    const allCandles: CandleEvent[] = [];

    for (const symbol of symbols) {
      for (const timeframe of timeframes) {
        try {
          const startTime = new Date(from).getTime();
          const endTime = new Date(to).getTime();

          const candles = await info.candleSnapshot({
            coin: symbol,
            interval: timeframe,
            startTime,
            endTime,
          });

          allCandles.push(...candles as CandleEvent[]);
        } catch (error) {
          console.error(`Failed to fetch candles for ${symbol}:${timeframe}:`, error);
        }
      }
    }

    allCandles.sort((a, b) => a.t - b.t);
    return allCandles;
  }
}

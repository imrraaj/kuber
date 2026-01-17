import { Strategy } from "../src/strategy/base.ts";
import type { StrategyContext } from "../src/strategy/context.ts";
import type { CandleEvent, Interval, StrategyStatus } from "../src/types/index.ts";

export default class BTCMomentumStrategy extends Strategy {
  private closes: number[] = [];
  private readonly SMA_PERIOD = 20;
  private isLong: boolean = false;
  private entryPrice: number = 0;
  private positionSize: number = 0.01;

  constructor(ctx: StrategyContext) {
    super(ctx);
  }

  get name(): string {
    return "BTC-Momentum-1H";
  }

  get description(): string {
    return "Simple momentum strategy: Long when price > 20 SMA";
  }

  get symbols(): string[] {
    return ["BTC"];
  }

  get timeframes(): Interval[] {
    return ["1h"];
  }

  async init(): Promise<void> {
    this.ctx.db.run(`
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        side TEXT NOT NULL,
        size REAL NOT NULL,
        price REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        pnl REAL
      )
    `);

    this.ctx.db.run(`
      CREATE TABLE IF NOT EXISTS state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    const stateRow = this.ctx.db.query(`
      SELECT value FROM state WHERE key = 'position'
    `).get() as { value: string } | undefined;

    if (stateRow) {
      const state = JSON.parse(stateRow.value);
      this.isLong = state.isLong;
      this.entryPrice = state.entryPrice;
      this.closes = state.closes || [];
    }

    this.ctx.log.info("Strategy initialized", { isLong: this.isLong });
  }

  async cleanup(): Promise<void> {
    const state = {
      isLong: this.isLong,
      entryPrice: this.entryPrice,
      closes: this.closes.slice(-this.SMA_PERIOD),
    };

    this.ctx.db.run(`
      INSERT OR REPLACE INTO state (key, value) VALUES ('position', ?)
    `, [JSON.stringify(state)]);

    this.ctx.log.info("Strategy state saved");
  }

  async onCandle(candle: CandleEvent): Promise<void> {
    const close = parseFloat(candle.c);
    this.closes.push(close);

    if (this.closes.length > this.SMA_PERIOD) {
      this.closes.shift();
    }

    if (this.closes.length < this.SMA_PERIOD) {
      return;
    }

    const sma = this.closes.reduce((a, b) => a + b, 0) / this.SMA_PERIOD;

    if (close > sma && !this.isLong) {
      // Open long position
      if (this.ctx.isBacktest) {
        await this.ctx.openPosition({
          symbol: "BTC",
          side: "long",
          size: this.positionSize,
          price: close,
          orderType: "market",
        });
      }
      this.isLong = true;
      this.entryPrice = close;
      this.ctx.log.info("SIGNAL: Open long", { price: close });
    } else if (close < sma && this.isLong) {
      // Close long position
      const pnl = (close - this.entryPrice) * this.positionSize;
      if (this.ctx.isBacktest) {
        await this.ctx.closePosition({
          symbol: "BTC",
          size: this.positionSize,
          price: close,
          orderType: "market",
        });
      }
      this.isLong = false;
      this.entryPrice = 0;
      this.ctx.log.info("SIGNAL: Close long", { price: close, pnl });
    }
  }

  async onBacktestCandle(candle: CandleEvent): Promise<void> {
    await this.onCandle(candle);
  }

  status(): StrategyStatus {
    const totalPnl = (this.ctx.db.query(`
      SELECT COALESCE(SUM(pnl), 0) as total FROM trades WHERE pnl IS NOT NULL
    `).get() as { total: number } | undefined)?.total || 0;

    const trades = this.ctx.db.query(`
      SELECT * FROM trades ORDER BY timestamp DESC LIMIT 10
    `).all();

    return {
      pnl: totalPnl,
      positionCount: this.isLong ? 1 : 0,
      lastTradeAt: (trades[0] as any)?.timestamp || null,
      custom: {
        position: this.isLong ? `LONG @ ${this.entryPrice}` : "FLAT",
        smaValue: this.closes.length >= this.SMA_PERIOD
          ? (this.closes.reduce((a, b) => a + b, 0) / this.SMA_PERIOD).toFixed(2)
          : "Warming up...",
      },
    };
  }
}

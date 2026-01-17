import { Strategy } from "../src/strategy/base.ts";
import type { StrategyContext } from "../src/strategy/context.ts";
import type { CandleEvent, Interval, StrategyStatus } from "../src/types/index.ts";

export default class MaxTrendPointsStrategy extends Strategy {
  private highs: number[] = [];
  private lows: number[] = [];
  private closes: number[] = [];
  private hmaIntermediateValues: number[] = []; // For proper HMA calculation

  private readonly FACTOR = 2.5;
  private readonly HMA_PERIOD = 200;

  private direction: number = 1;
  private prevDirection: number = 1;
  private trendLine: number = 0;
  private prevTrendLine: number = 0;
  private upperBand: number = 0;
  private lowerBand: number = 0;
  private prevUpperBand: number = 0;
  private prevLowerBand: number = 0;
  private dist: number = 0;
  private prevDist: number | null = null;

  private isLong: boolean = false;
  private entryPrice: number = 0;
  private positionSize: number = 0.01;

  constructor(ctx: StrategyContext) {
    super(ctx);
  }

  get name(): string {
    return "Max-Trend-Points";
  }

  get description(): string {
    return "Max Trend Points strategy using HMA-based dynamic bands";
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
      this.direction = state.direction || 1;
      this.prevDirection = state.prevDirection || 1;
      this.trendLine = state.trendLine || 0;
      this.prevTrendLine = state.prevTrendLine || 0;
      this.upperBand = state.upperBand || 0;
      this.lowerBand = state.lowerBand || 0;
      this.prevUpperBand = state.prevUpperBand || 0;
      this.prevLowerBand = state.prevLowerBand || 0;
      this.dist = state.dist || 0;
      this.prevDist = state.prevDist !== undefined ? state.prevDist : null;
      this.highs = state.highs || [];
      this.lows = state.lows || [];
      this.closes = state.closes || [];
      this.hmaIntermediateValues = state.hmaIntermediateValues || [];
    }

    this.ctx.log.info("Strategy initialized", {
      isLong: this.isLong,
      direction: this.direction
    });
  }

  async cleanup(): Promise<void> {
    const state = {
      isLong: this.isLong,
      entryPrice: this.entryPrice,
      direction: this.direction,
      prevDirection: this.prevDirection,
      trendLine: this.trendLine,
      prevTrendLine: this.prevTrendLine,
      upperBand: this.upperBand,
      lowerBand: this.lowerBand,
      prevUpperBand: this.prevUpperBand,
      prevLowerBand: this.prevLowerBand,
      dist: this.dist,
      prevDist: this.prevDist,
      highs: this.highs.slice(-this.HMA_PERIOD),
      lows: this.lows.slice(-this.HMA_PERIOD),
      closes: this.closes.slice(-this.HMA_PERIOD),
      hmaIntermediateValues: this.hmaIntermediateValues,
    };

    this.ctx.db.run(`
      INSERT OR REPLACE INTO state (key, value) VALUES ('position', ?)
    `, [JSON.stringify(state)]);

    this.ctx.log.info("Strategy state saved");
  }

  // Weighted Moving Average
  private wma(values: number[], period: number): number {
    if (values.length < period) {
      return 0;
    }

    const slice = values.slice(-period);
    let sum = 0;
    let weightSum = 0;

    for (let i = 0; i < period; i++) {
      const weight = i + 1;
      sum += slice[i] * weight;
      weightSum += weight;
    }

    return sum / weightSum;
  }

  // Hull Moving Average
  private hma(values: number[], period: number): number {
    if (values.length < period) {
      return 0;
    }

    const halfPeriod = Math.floor(period / 2);
    const sqrtPeriod = Math.floor(Math.sqrt(period));

    const wmaHalf = this.wma(values, halfPeriod);
    const wmaFull = this.wma(values, period);
    const rawValue = 2 * wmaHalf - wmaFull;

    // Store intermediate value for final WMA calculation
    this.hmaIntermediateValues.push(rawValue);

    // Keep only what we need for sqrt(period)
    if (this.hmaIntermediateValues.length > sqrtPeriod) {
      this.hmaIntermediateValues.shift();
    }

    // Apply final WMA to the intermediate values
    if (this.hmaIntermediateValues.length >= sqrtPeriod) {
      return this.wma(this.hmaIntermediateValues, sqrtPeriod);
    }

    // Not enough data yet, return raw value
    return rawValue;
  }

  async onCandle(candle: CandleEvent): Promise<void> {
    const high = parseFloat(candle.h);
    const low = parseFloat(candle.l);
    const close = parseFloat(candle.c);
    const hl2 = (high + low) / 2;

    this.highs.push(high);
    this.lows.push(low);
    this.closes.push(close);

    if (this.highs.length > this.HMA_PERIOD) {
      this.highs.shift();
      this.lows.shift();
      this.closes.shift();
    }

    // Need enough data for HMA calculation
    if (this.highs.length < this.HMA_PERIOD) {
      return;
    }

    // Calculate high-low range for each candle
    const ranges: number[] = [];
    for (let i = 0; i < this.highs.length; i++) {
      ranges.push(this.highs[i] - this.lows[i]);
    }

    // Calculate HMA of the range (dist in Pine script)
    this.dist = this.hma(ranges, this.HMA_PERIOD);

    // Calculate bands
    this.prevUpperBand = this.upperBand;
    this.prevLowerBand = this.lowerBand;
    this.prevTrendLine = this.trendLine;

    let newUpperBand = hl2 + this.FACTOR * this.dist;
    let newLowerBand = hl2 - this.FACTOR * this.dist;

    // Adjust bands based on previous values and close (Pine logic)
    if (this.prevLowerBand !== 0 && this.closes.length >= 2) {
      const prevClose = this.closes[this.closes.length - 2];
      // lowerBand := lowerBand > prevLowerBand or close[1] < prevLowerBand ? lowerBand : prevLowerBand
      this.lowerBand = (newLowerBand > this.prevLowerBand || prevClose < this.prevLowerBand)
        ? newLowerBand
        : this.prevLowerBand;
    } else {
      this.lowerBand = newLowerBand;
    }

    if (this.prevUpperBand !== 0 && this.closes.length >= 2) {
      const prevClose = this.closes[this.closes.length - 2];
      // upperBand := upperBand < prevUpperBand or close[1] > prevUpperBand ? upperBand : prevUpperBand
      this.upperBand = (newUpperBand < this.prevUpperBand || prevClose > this.prevUpperBand)
        ? newUpperBand
        : this.prevUpperBand;
    } else {
      this.upperBand = newUpperBand;
    }

    // Determine direction (Pine logic)
    this.prevDirection = this.direction;

    if (this.prevDist === null) {
      // if na(dist[1]) then _direction := 1
      this.direction = 1;
    } else if (this.prevTrendLine === this.prevUpperBand) {
      // else if prevTrendLine == prevUpperBand then _direction := close > upperBand ? -1 : 1
      this.direction = close > this.upperBand ? -1 : 1;
    } else {
      // else _direction := close < lowerBand ? 1 : -1
      this.direction = close < this.lowerBand ? 1 : -1;
    }

    // trend_line := _direction == -1 ? lowerBand : upperBand
    this.trendLine = this.direction === -1 ? this.lowerBand : this.upperBand;

    this.prevDist = this.dist;

    // Detect trend change
    const trendChange = this.direction !== this.prevDirection && this.prevDirection !== 0;

    // Trading logic based on trend changes
    if (trendChange && this.direction === -1 && !this.isLong) {
      // Trend changed to -1 (price crossed above upper band) = LONG signal
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
      this.ctx.log.info("SIGNAL: Open long", {
        price: close,
        direction: this.direction
      });
    } else if (trendChange && this.direction === 1 && this.isLong) {
      // Trend changed to 1 (price crossed below lower band) = CLOSE signal
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
      this.ctx.log.info("SIGNAL: Close long", {
        price: close,
        pnl,
        direction: this.direction
      });
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
        direction: this.direction === -1 ? "DOWN" : "UP",
        trendLine: this.trendLine.toFixed(2),
        upperBand: this.upperBand.toFixed(2),
        lowerBand: this.lowerBand.toFixed(2),
      },
    };
  }
}

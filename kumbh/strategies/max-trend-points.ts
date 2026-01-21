import { Strategy } from "../src/strategy/base.ts";
import type { StrategyContext } from "../src/strategy/context.ts";
import type { CandleEvent, Interval, StrategyStatus } from "../src/types/index.ts";

/**
 * Max Trend Points Strategy
 *
 * Based on the "Max Trend Points [BigBeluga]" TradingView indicator.
 *
 * Direction meanings:
 * - direction = -1 → UPTREND (bullish) - trend_line = lowerBand
 * - direction = 1  → DOWNTREND (bearish) - trend_line = upperBand
 *
 * Trading signals:
 * - When direction changes from 1 to -1 → BUY (entering uptrend)
 * - When direction changes from -1 to 1 → SELL (entering downtrend)
 */
export default class MaxTrendPointsStrategy extends Strategy {
  // Price data arrays
  private highs: number[] = [];
  private lows: number[] = [];
  private closes: number[] = [];
  private hl2s: number[] = [];  // (high + low) / 2
  private ranges: number[] = []; // high - low for HMA calculation

  // HMA calculation state
  private hmaIntermediateValues: number[] = [];

  // Configuration
  private readonly FACTOR = 2.5;
  private readonly HMA_PERIOD = 200;

  // Band state
  private upperBand: number = 0;
  private lowerBand: number = 0;
  private prevUpperBand: number = 0;
  private prevLowerBand: number = 0;

  // Direction state
  // -1 = UPTREND (bullish), 1 = DOWNTREND (bearish)
  private direction: number = 0;  // Start with 0 (unknown)
  private prevDirection: number = 0;

  // Trend line
  private trendLine: number = 0;
  private prevTrendLine: number = 0;

  // HMA dist value
  private dist: number = 0;
  private hasPrevDist: boolean = false;

  // Position tracking
  private isLong: boolean = false;
  private entryPrice: number = 0;
  private positionSize: number = 0.01;

  // Display state
  private lastPrice: number = 0;
  private lastCandleTime: number = 0;
  private lastSignal: string = "NONE";
  private lastProcessedCandleTime: number = 0;
  private candleCount: number = 0;

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
    return ["1m"];
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
      this.isLong = state.isLong ?? false;
      this.entryPrice = state.entryPrice ?? 0;
      this.direction = state.direction ?? 0;
      this.prevDirection = state.prevDirection ?? 0;
      this.trendLine = state.trendLine ?? 0;
      this.prevTrendLine = state.prevTrendLine ?? 0;
      this.upperBand = state.upperBand ?? 0;
      this.lowerBand = state.lowerBand ?? 0;
      this.prevUpperBand = state.prevUpperBand ?? 0;
      this.prevLowerBand = state.prevLowerBand ?? 0;
      this.dist = state.dist ?? 0;
      this.hasPrevDist = state.hasPrevDist ?? false;
      this.highs = state.highs ?? [];
      this.lows = state.lows ?? [];
      this.closes = state.closes ?? [];
      this.hl2s = state.hl2s ?? [];
      this.ranges = state.ranges ?? [];
      this.hmaIntermediateValues = state.hmaIntermediateValues ?? [];
      this.lastProcessedCandleTime = state.lastProcessedCandleTime ?? 0;
      this.candleCount = state.candleCount ?? 0;
    }

    // If we don't have enough data, fetch historical candles
    if (this.ranges.length < this.HMA_PERIOD) {
      this.ctx.log.info("Fetching historical candles for warmup...");

      try {
        const historicalCandles = await this.ctx.fetchCandles("BTC", "1m", this.HMA_PERIOD + 10);

        this.ctx.log.info(`Fetched ${historicalCandles.length} historical candles`);

        // Process each historical candle to populate our data arrays
        for (const candle of historicalCandles) {
          const high = parseFloat(candle.h);
          const low = parseFloat(candle.l);
          const close = parseFloat(candle.c);
          const hl2 = (high + low) / 2;
          const range = high - low;

          this.highs.push(high);
          this.lows.push(low);
          this.closes.push(close);
          this.hl2s.push(hl2);
          this.ranges.push(range);
          this.lastProcessedCandleTime = candle.t;
          this.candleCount++;
        }

        // Now calculate the initial state using the historical data
        if (this.ranges.length >= this.HMA_PERIOD) {
          // Calculate dist = HMA(high-low, 200)
          this.dist = this.calculateHMA(this.ranges, this.HMA_PERIOD);

          // Get current values
          const currentHl2 = this.hl2s[this.hl2s.length - 1];
          const currentClose = this.closes[this.closes.length - 1];

          // Calculate initial bands
          this.upperBand = currentHl2 + this.FACTOR * this.dist;
          this.lowerBand = currentHl2 - this.FACTOR * this.dist;

          // Initialize direction (start in downtrend as per Pine Script)
          this.direction = 1;
          this.hasPrevDist = true;

          // Set trend line based on direction
          this.trendLine = this.direction === -1 ? this.lowerBand : this.upperBand;

          // Update display values
          this.lastPrice = currentClose;
          this.lastCandleTime = this.lastProcessedCandleTime;

          const trendText = this.direction === -1 ? "UP" : "DOWN";
          this.lastSignal = `READY (${trendText}trend)`;

          this.ctx.log.info("Historical warmup complete", {
            candleCount: this.candleCount,
            direction: trendText,
            trendLine: this.trendLine.toFixed(2),
            upperBand: this.upperBand.toFixed(2),
            lowerBand: this.lowerBand.toFixed(2),
            lastPrice: currentClose.toFixed(2)
          });
        }
      } catch (error) {
        this.ctx.log.error("Failed to fetch historical candles", {
          error: error instanceof Error ? error.message : String(error)
        });
        // Continue without historical data - will warm up with live data
      }
    }

    this.ctx.log.info("Strategy initialized", {
      isLong: this.isLong,
      direction: this.direction,
      candleCount: this.candleCount,
      hasEnoughData: this.ranges.length >= this.HMA_PERIOD
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
      hasPrevDist: this.hasPrevDist,
      highs: this.highs.slice(-this.HMA_PERIOD - 10),
      lows: this.lows.slice(-this.HMA_PERIOD - 10),
      closes: this.closes.slice(-this.HMA_PERIOD - 10),
      hl2s: this.hl2s.slice(-this.HMA_PERIOD - 10),
      ranges: this.ranges.slice(-this.HMA_PERIOD - 10),
      hmaIntermediateValues: this.hmaIntermediateValues,
      lastProcessedCandleTime: this.lastProcessedCandleTime,
      candleCount: this.candleCount,
    };

    this.ctx.db.run(`
      INSERT OR REPLACE INTO state (key, value) VALUES ('position', ?)
    `, [JSON.stringify(state)]);

    this.ctx.log.info("Strategy state saved");
  }

  /**
   * Weighted Moving Average
   */
  private wma(values: number[], period: number): number {
    if (values.length < period) {
      return values.length > 0 ? values[values.length - 1] : 0;
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

  /**
   * Hull Moving Average
   * HMA = WMA(2 * WMA(n/2) - WMA(n), sqrt(n))
   */
  private calculateHMA(values: number[], period: number): number {
    if (values.length < period) {
      return values.length > 0 ? values[values.length - 1] : 0;
    }

    const halfPeriod = Math.floor(period / 2);
    const sqrtPeriod = Math.floor(Math.sqrt(period));

    const wmaHalf = this.wma(values, halfPeriod);
    const wmaFull = this.wma(values, period);
    const rawValue = 2 * wmaHalf - wmaFull;

    // Store intermediate value for final WMA calculation
    this.hmaIntermediateValues.push(rawValue);

    // Keep only what we need
    if (this.hmaIntermediateValues.length > sqrtPeriod + 5) {
      this.hmaIntermediateValues.shift();
    }

    // Apply final WMA to the intermediate values
    if (this.hmaIntermediateValues.length >= sqrtPeriod) {
      return this.wma(this.hmaIntermediateValues, sqrtPeriod);
    }

    return rawValue;
  }

  async onCandle(candle: CandleEvent): Promise<void> {
    const high = parseFloat(candle.h);
    const low = parseFloat(candle.l);
    const close = parseFloat(candle.c);
    const hl2 = (high + low) / 2;
    const range = high - low;

    // Always update for real-time display
    this.lastPrice = close;
    this.lastCandleTime = candle.t;

    // Only process each candle ONCE
    if (candle.t === this.lastProcessedCandleTime) {
      return;
    }

    if (this.lastProcessedCandleTime !== 0 && candle.t <= this.lastProcessedCandleTime) {
      return;
    }

    this.lastProcessedCandleTime = candle.t;
    this.candleCount++;

    // Add to arrays
    this.highs.push(high);
    this.lows.push(low);
    this.closes.push(close);
    this.hl2s.push(hl2);
    this.ranges.push(range);

    // Keep arrays manageable
    const maxLen = this.HMA_PERIOD + 50;
    if (this.highs.length > maxLen) {
      this.highs.shift();
      this.lows.shift();
      this.closes.shift();
      this.hl2s.shift();
      this.ranges.shift();
    }

    // Need enough data for HMA calculation
    if (this.ranges.length < this.HMA_PERIOD) {
      this.lastSignal = `WARMING UP (${this.ranges.length}/${this.HMA_PERIOD})`;
      this.ctx.log.info("Warming up", {
        candles: this.ranges.length,
        required: this.HMA_PERIOD
      });
      return;
    }

    // Store previous values
    this.prevUpperBand = this.upperBand;
    this.prevLowerBand = this.lowerBand;
    this.prevTrendLine = this.trendLine;
    this.prevDirection = this.direction;
    const prevDist = this.dist;

    // Calculate dist = HMA(high-low, 200)
    this.dist = this.calculateHMA(this.ranges, this.HMA_PERIOD);

    // Calculate raw bands: src = hl2
    const src = hl2;
    let newUpperBand = src + this.FACTOR * this.dist;
    let newLowerBand = src - this.FACTOR * this.dist;

    // Get previous close (close[1] in Pine)
    const prevClose = this.closes.length >= 2
      ? this.closes[this.closes.length - 2]
      : close;

    // Band logic from Pine:
    // lowerBand := lowerBand > prevLowerBand or close[1] < prevLowerBand ? lowerBand : prevLowerBand
    if (this.prevLowerBand !== 0) {
      this.lowerBand = (newLowerBand > this.prevLowerBand || prevClose < this.prevLowerBand)
        ? newLowerBand
        : this.prevLowerBand;
    } else {
      this.lowerBand = newLowerBand;
    }

    // upperBand := upperBand < prevUpperBand or close[1] > prevUpperBand ? upperBand : prevUpperBand
    if (this.prevUpperBand !== 0) {
      this.upperBand = (newUpperBand < this.prevUpperBand || prevClose > this.prevUpperBand)
        ? newUpperBand
        : this.prevUpperBand;
    } else {
      this.upperBand = newUpperBand;
    }

    // Direction logic from Pine:
    // if na(dist[1])
    //     _direction := 1
    // else if prevTrendLine == prevUpperBand
    //     _direction := close > upperBand ? -1 : 1
    // else
    //     _direction := close < lowerBand ? 1 : -1

    if (!this.hasPrevDist) {
      // First time - initialize to downtrend (direction = 1)
      this.direction = 1;
      this.hasPrevDist = true;
    } else if (this.prevTrendLine === this.prevUpperBand) {
      // Was in DOWNTREND (using upperBand as trend line)
      // If close > upperBand, switch to UPTREND (-1), else stay DOWNTREND (1)
      this.direction = close > this.upperBand ? -1 : 1;
    } else {
      // Was in UPTREND (using lowerBand as trend line)
      // If close < lowerBand, switch to DOWNTREND (1), else stay UPTREND (-1)
      this.direction = close < this.lowerBand ? 1 : -1;
    }

    // trend_line := _direction == -1 ? lowerBand : upperBand
    // direction -1 (UPTREND) → use lowerBand
    // direction 1 (DOWNTREND) → use upperBand
    this.trendLine = this.direction === -1 ? this.lowerBand : this.upperBand;

    // Detect trend change: ta.cross(_direction, 0) in Pine
    // This detects when direction changes sign
    const trendChange = this.prevDirection !== 0 && this.direction !== this.prevDirection;

    // Direction display:
    // -1 = UPTREND (bullish, cyan color in indicator)
    // 1 = DOWNTREND (bearish, orange color in indicator)
    const trendText = this.direction === -1 ? "UP" : "DOWN";

    this.ctx.log.info("Candle processed", {
      close: close.toFixed(2),
      trend: trendText,
      trendLine: this.trendLine.toFixed(2),
      upperBand: this.upperBand.toFixed(2),
      lowerBand: this.lowerBand.toFixed(2),
      direction: this.direction,
      trendChange
    });

    // Update signal status
    if (trendChange) {
      if (this.direction === -1) {
        // Changed to UPTREND → BUY signal
        this.lastSignal = "BUY SIGNAL (Uptrend)";
      } else {
        // Changed to DOWNTREND → SELL signal
        this.lastSignal = "SELL SIGNAL (Downtrend)";
      }
    } else {
      if (this.isLong) {
        this.lastSignal = `HOLDING LONG @ $${this.entryPrice.toFixed(2)}`;
      } else {
        this.lastSignal = `WAITING (${trendText}trend)`;
      }
    }

    // Trading logic
    if (trendChange && this.direction === -1 && !this.isLong) {
      // Entered UPTREND → Open long
      try {
        const result = await this.ctx.openPosition({
          symbol: "BTC",
          side: "long",
          size: this.positionSize,
          price: close,
          orderType: "market",
        });

        // Only mark as long if order succeeded
        if (result.status === "filled" || result.status === "pending") {
          this.isLong = true;
          this.entryPrice = result.filledPrice || close;
          this.lastSignal = "OPENED LONG";
          this.ctx.log.info("TRADE: Opened long position", {
            price: result.filledPrice || close,
            size: this.positionSize,
            trendLine: this.trendLine.toFixed(2),
            orderId: result.orderId,
            status: result.status
          });
        } else {
          this.ctx.log.error("Order failed to open long", {
            orderId: result.orderId,
            status: result.status,
            error: result.error,
            price: close
          });
          this.lastSignal = `OPEN FAILED: ${result.error || "Unknown error"}`;
        }
      } catch (error) {
        this.ctx.log.error("Exception opening long position", {
          error: error instanceof Error ? error.message : String(error),
          price: close
        });
        this.lastSignal = `OPEN ERROR: ${error instanceof Error ? error.message : String(error)}`;
      }
    } else if (trendChange && this.direction === 1 && this.isLong) {
      // Entered DOWNTREND → Close long
      const pnl = (close - this.entryPrice) * this.positionSize;
      try {
        const result = await this.ctx.closePosition({
          symbol: "BTC",
          size: this.positionSize,
          price: close,
          orderType: "market",
        });

        // Only mark as closed if order succeeded
        if (result.status === "filled" || result.status === "pending") {
          this.lastSignal = `CLOSED LONG (PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)})`;
          this.isLong = false;
          this.entryPrice = 0;
          this.ctx.log.info("TRADE: Closed long position", {
            price: result.filledPrice || close,
            pnl: pnl.toFixed(2),
            trendLine: this.trendLine.toFixed(2),
            orderId: result.orderId,
            status: result.status
          });
        } else {
          this.ctx.log.error("Order failed to close long", {
            orderId: result.orderId,
            status: result.status,
            error: result.error,
            price: close
          });
          this.lastSignal = `CLOSE FAILED: ${result.error || "Unknown error"}`;
        }
      } catch (error) {
        this.ctx.log.error("Exception closing long position", {
          error: error instanceof Error ? error.message : String(error),
          price: close,
          pnl: pnl.toFixed(2)
        });
        this.lastSignal = `CLOSE ERROR: ${error instanceof Error ? error.message : String(error)}`;
      }
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

    // Direction display: -1 = UP (bullish), 1 = DOWN (bearish)
    const trendText = this.direction === -1 ? "UP" : "DOWN";

    return {
      pnl: totalPnl,
      positionCount: this.isLong ? 1 : 0,
      lastTradeAt: (trades[0] as any)?.timestamp || null,
      custom: {
        lastPrice: this.lastPrice,
        lastCandleTime: this.lastCandleTime,
        lastSignal: this.lastSignal,
        position: this.isLong ? `LONG @ $${this.entryPrice.toFixed(2)}` : "FLAT",
        direction: trendText,
        trendLine: this.trendLine.toFixed(2),
        upperBand: this.upperBand.toFixed(2),
        lowerBand: this.lowerBand.toFixed(2),
        candleCount: this.candleCount,
      },
    };
  }
}

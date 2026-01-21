import { InfoClient, ExchangeClient, HttpTransport } from "@nktkas/hyperliquid";
import { SymbolConverter } from "@nktkas/hyperliquid/utils";
import { privateKeyToAccount } from "viem/accounts";
import type { OrderParams, OrderResult, CloseParams, AccountState, Position, Interval } from "../types/index.ts";

export interface HistoricalCandle {
  t: number;      // Open time
  T: number;      // Close time
  s: string;      // Symbol
  i: Interval;    // Interval
  o: string;      // Open
  h: string;      // High
  l: string;      // Low
  c: string;      // Close
  v: string;      // Volume
  n: number;      // Number of trades
}

export class HyperliquidAPI {
  private info: InfoClient;
  private exchange: ExchangeClient;
  private walletAddress: string;
  private symbolConverter: SymbolConverter | null = null;
  private transport: HttpTransport;

  constructor(privateKey: string, walletAddress: string, testnet: boolean = false) {
    const wallet = privateKeyToAccount(privateKey as `0x${string}`);
    this.transport = new HttpTransport({ isTestnet: testnet });
    this.info = new InfoClient({ transport: this.transport, wallet });
    console.log(`[HyperliquidAPI] Using ${testnet ? "TESTNET" : "MAINNET"} endpoint`);

    // Create wallet from private key using viem
    this.exchange = new ExchangeClient({ transport: this.transport, wallet });

    // Use the address derived from the private key (this is what the SDK uses for signing)
    // The walletAddress parameter is used for reading account info
    const derivedAddress = wallet.address.toLowerCase();
    const configAddress = walletAddress.toLowerCase();

    if (derivedAddress !== configAddress) {
      console.warn(`[HyperliquidAPI] WARNING: Wallet address mismatch!`);
      console.warn(`  Derived from private key: ${derivedAddress}`);
      console.warn(`  Configured address:       ${configAddress}`);
      console.warn(`  Using derived address for trading.`);
    }

    // Use derived address - this is the address that will be used for trading
    this.walletAddress = derivedAddress;
    console.log(`[HyperliquidAPI] Initialized with wallet: ${this.walletAddress}`);
  }

  /**
   * Initialize the symbol converter (call once before trading)
   */
  async init(): Promise<void> {
    this.symbolConverter = await SymbolConverter.create({ transport: this.transport });
  }

  /**
   * Get asset ID for a symbol, returns 0 for BTC if converter not initialized
   */
  private getAssetId(symbol: string): number {
    if (this.symbolConverter) {
      const id = this.symbolConverter.getAssetId(symbol);
      if (id !== undefined) return id;
    }
    // Fallback for common symbols
    const fallback: Record<string, number> = {
      "BTC": 0,
      "ETH": 1,
      "SOL": 5,
    };
    return fallback[symbol] ?? 0;
  }

  /**
   * Get size decimals for a symbol
   */
  private getSzDecimals(symbol: string): number {
    if (this.symbolConverter) {
      const decimals = this.symbolConverter.getSzDecimals(symbol);
      if (decimals !== undefined) return decimals;
    }
    // Fallback
    return 5;
  }

  /**
   * Format size to correct decimal places
   */
  private formatSize(size: number, symbol: string): string {
    const decimals = this.getSzDecimals(symbol);
    return size.toFixed(decimals);
  }

  async openPosition(params: OrderParams): Promise<OrderResult> {
    try {
      console.log("[HyperliquidAPI] Opening position:", params);

      const assetId = this.getAssetId(params.symbol);
      const formattedSize = this.formatSize(params.size, params.symbol);

      // For market orders, we use limit with Ioc (Immediate or Cancel)
      // Price for market orders should be set high for buy, low for sell to ensure fill
      let price: string;
      if (params.orderType === "market") {
        // For market orders, set a price that will definitely fill
        // For long (buy), set price high; for short (sell), set price low
        if (params.side === "long") {
          price = params.price ? (params.price * 1.01).toFixed(0) : "999999"; // 1% above or very high
        } else {
          price = params.price ? (params.price * 0.99).toFixed(0) : "1"; // 1% below or very low
        }
      } else {
        price = params.price?.toString() || "0";
      }

      console.log("[HyperliquidAPI] Order params:", {
        assetId,
        isBuy: params.side === "long",
        price,
        size: formattedSize,
        orderType: params.orderType
      });

      const result = await this.exchange.order({
        orders: [{
          a: assetId,                    // Asset ID (0 for BTC)
          b: params.side === "long",     // true for long/buy, false for short/sell
          p: price,                      // Price as string
          s: formattedSize,              // Size as string
          r: false,                      // reduceOnly = false for opening
          t: { limit: { tif: "Ioc" } }, // Immediate or Cancel for market
        }],
        grouping: "na",
      });

      console.log("[HyperliquidAPI] Order result:", JSON.stringify(result, null, 2));

      // Check for errors in the response
      const status = result?.response?.data?.statuses?.[0];
      if (typeof status === "object" && "error" in status) {
        return {
          orderId: "failed",
          status: "failed",
          error: status.error,
        };
      }

      // For market orders (Ioc), check if it was filled
      if (typeof status === "object" && "filled" in status) {
        return {
          orderId: status.filled.oid.toString(),
          status: "filled",
          filledPrice: parseFloat(status.filled.avgPx),
          filledSize: parseFloat(status.filled.totalSz),
        };
      }

      // For limit orders, it might be resting
      if (typeof status === "object" && "resting" in status) {
        return {
          orderId: status.resting.oid.toString(),
          status: "pending",
          filledPrice: params.price,
          filledSize: params.size,
        };
      }

      // Other statuses
      if (status === "waitingForFill" || status === "waitingForTrigger") {
        return {
          orderId: "pending",
          status: "pending",
          filledPrice: params.price,
          filledSize: params.size,
        };
      }

      return {
        orderId: "unknown",
        status: "failed",
        error: `Unexpected status: ${JSON.stringify(status)}`,
      };
    } catch (error) {
      console.error("[HyperliquidAPI] Order error:", error);
      return {
        orderId: "failed",
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async closePosition(params: CloseParams): Promise<OrderResult> {
    try {
      console.log("[HyperliquidAPI] Closing position:", params);

      const positions = await this.getPositions();
      const position = positions.find(p => p.symbol === params.symbol);

      if (!position) {
        return {
          orderId: "failed",
          status: "failed",
          error: "No position found",
        };
      }

      const assetId = this.getAssetId(params.symbol);
      const formattedSize = this.formatSize(params.size, params.symbol);
      const orderType = params.orderType || "market";

      // For closing, we do opposite of position side
      // If we're long, we sell (isBuy = false)
      // If we're short, we buy (isBuy = true)
      const isBuy = position.side === "short";

      // For market orders, set price that will definitely fill
      let price: string;
      if (orderType === "market") {
        if (isBuy) {
          price = params.price ? (params.price * 1.01).toFixed(0) : "999999";
        } else {
          price = params.price ? (params.price * 0.99).toFixed(0) : "1";
        }
      } else {
        price = params.price?.toString() || "0";
      }

      console.log("[HyperliquidAPI] Close order params:", {
        assetId,
        isBuy,
        price,
        size: formattedSize,
        positionSide: position.side,
        orderType
      });

      const result = await this.exchange.order({
        orders: [{
          a: assetId,
          b: isBuy,
          p: price,
          s: formattedSize,
          r: true,  // reduceOnly = true for closing
          t: orderType === "limit"
            ? { limit: { tif: "Gtc" } }
            : { limit: { tif: "Ioc" } },
        }],
        grouping: "na",
      });

      console.log("[HyperliquidAPI] Close order result:", JSON.stringify(result, null, 2));

      const status = result?.response?.data?.statuses?.[0];

      if (typeof status === "object" && "error" in status) {
        return {
          orderId: "failed",
          status: "failed",
          error: status.error,
        };
      }

      if (typeof status === "object" && "filled" in status) {
        return {
          orderId: status.filled.oid.toString(),
          status: "filled",
          filledPrice: parseFloat(status.filled.avgPx),
          filledSize: parseFloat(status.filled.totalSz),
        };
      }

      if (typeof status === "object" && "resting" in status) {
        return {
          orderId: status.resting.oid.toString(),
          status: "pending",
          filledPrice: params.price,
          filledSize: params.size,
        };
      }

      return {
        orderId: "unknown",
        status: "failed",
        error: `Unexpected status: ${JSON.stringify(status)}`,
      };
    } catch (error) {
      console.error("[HyperliquidAPI] Close error:", error);
      return {
        orderId: "failed",
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getBalance(): Promise<AccountState> {
    try {
      const state = await this.info.clearinghouseState({ user: this.walletAddress });

      return {
        accountValue: parseFloat(state.marginSummary.accountValue),
        availableBalance: parseFloat(state.withdrawable),
        marginUsed: parseFloat(state.marginSummary.totalMarginUsed),
        withdrawable: parseFloat(state.withdrawable),
      };
    } catch (error) {
      return {
        accountValue: 0,
        availableBalance: 0,
        marginUsed: 0,
        withdrawable: 0,
      };
    }
  }

  async getPositions(): Promise<Position[]> {
    try {
      const state = await this.info.clearinghouseState({ user: this.walletAddress });

      return state.assetPositions.map((pos: any) => ({
        symbol: pos.position.coin,
        side: parseFloat(pos.position.szi) > 0 ? "long" as const : "short" as const,
        size: Math.abs(parseFloat(pos.position.szi)),
        entryPrice: parseFloat(pos.position.entryPx || "0"),
        markPrice: parseFloat(pos.position.positionValue) / Math.abs(parseFloat(pos.position.szi)),
        unrealizedPnl: parseFloat(pos.position.unrealizedPnl),
        liquidationPrice: parseFloat(pos.position.liquidationPx || "0"),
        leverage: parseFloat(pos.position.leverage.value),
        marginUsed: parseFloat(pos.position.marginUsed),
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Fetch historical candles for a symbol and interval
   */
  async fetchCandles(
    symbol: string,
    interval: Interval,
    count: number = 200
  ): Promise<HistoricalCandle[]> {
    try {
      // Calculate startTime based on interval
      const intervalMs = this.intervalToMs(interval);
      const endTime = Date.now();
      const startTime = endTime - (count + 10) * intervalMs; // Fetch a few extra

      const candles = await this.info.candleSnapshot({
        coin: symbol,
        interval: interval,
        startTime: startTime,
        endTime: endTime,
      });

      // Map to our HistoricalCandle format and take the last 'count' candles
      return candles.slice(-count).map((c: any) => ({
        t: c.t,
        T: c.T,
        s: c.s,
        i: c.i as Interval,
        o: c.o,
        h: c.h,
        l: c.l,
        c: c.c,
        v: c.v,
        n: c.n,
      }));
    } catch (error) {
      console.error("Failed to fetch candles:", error);
      return [];
    }
  }

  private intervalToMs(interval: Interval): number {
    const map: Record<Interval, number> = {
      "1m": 60 * 1000,
      "3m": 3 * 60 * 1000,
      "5m": 5 * 60 * 1000,
      "15m": 15 * 60 * 1000,
      "30m": 30 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "2h": 2 * 60 * 60 * 1000,
      "4h": 4 * 60 * 60 * 1000,
      "8h": 8 * 60 * 60 * 1000,
      "12h": 12 * 60 * 60 * 1000,
      "1d": 24 * 60 * 60 * 1000,
      "3d": 3 * 24 * 60 * 60 * 1000,
      "1w": 7 * 24 * 60 * 60 * 1000,
      "1M": 30 * 24 * 60 * 60 * 1000,
    };
    return map[interval] || 60 * 1000;
  }
}

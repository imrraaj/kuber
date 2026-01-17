import { InfoClient, ExchangeClient, HttpTransport } from "@nktkas/hyperliquid";
import type { OrderParams, OrderResult, CloseParams, AccountState, Position } from "../types/index.ts";

export class HyperliquidAPI {
  private info: InfoClient;
  private exchange: ExchangeClient;
  private walletAddress: string;

  constructor(privateKey: string, walletAddress: string, testnet: boolean = false) {
    const transport = new HttpTransport({ testnet });
    this.info = new InfoClient({ transport });
    this.exchange = new ExchangeClient({ transport, privateKey });
    this.walletAddress = walletAddress;
  }

  async openPosition(params: OrderParams): Promise<OrderResult> {
    try {
      const result = await this.exchange.order({
        coin: params.symbol,
        isBuy: params.side === "long",
        sz: params.size,
        limitPx: params.price || 0,
        orderType: params.orderType === "limit" ? { limit: { tif: "Gtc" } } : { market: {} },
        reduceOnly: false,
      });

      return {
        orderId: result?.response?.data?.statuses?.[0]?.resting?.oid || "unknown",
        status: "filled",
        filledPrice: params.price,
        filledSize: params.size,
      };
    } catch (error) {
      return {
        orderId: "failed",
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async closePosition(params: CloseParams): Promise<OrderResult> {
    try {
      const positions = await this.getPositions();
      const position = positions.find(p => p.symbol === params.symbol);

      if (!position) {
        return {
          orderId: "failed",
          status: "failed",
          error: "No position found",
        };
      }

      const result = await this.exchange.order({
        coin: params.symbol,
        isBuy: position.side === "short",
        sz: params.size,
        limitPx: params.price || 0,
        orderType: params.orderType === "limit" ? { limit: { tif: "Gtc" } } : { market: {} },
        reduceOnly: true,
      });

      return {
        orderId: result?.response?.data?.statuses?.[0]?.resting?.oid || "unknown",
        status: "filled",
        filledPrice: params.price,
        filledSize: params.size,
      };
    } catch (error) {
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
}

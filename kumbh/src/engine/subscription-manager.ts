import { SubscriptionClient, WebSocketTransport } from "@nktkas/hyperliquid";
import type { CandleEvent, Interval } from "../types/index.ts";

export class SubscriptionManager {
  private client: SubscriptionClient | null = null;
  private transport: WebSocketTransport | null = null;
  private subscriptions: Map<string, any> = new Map();
  private subscribers: Map<string, Set<string>> = new Map();
  private onCandleCallback: ((candle: CandleEvent) => void) | null = null;
  private isTestnet: boolean;

  constructor(isTestnet: boolean) {
    this.isTestnet = isTestnet;
  }

  async init(): Promise<void> {
    this.transport = new WebSocketTransport({ testnet: this.isTestnet });
    await this.transport.ready();
    this.client = new SubscriptionClient({ transport: this.transport });
  }

  onCandle(callback: (candle: CandleEvent) => void): void {
    this.onCandleCallback = callback;
  }

  async subscribe(symbol: string, timeframe: Interval, strategyName: string): Promise<void> {
    const key = `${symbol}:${timeframe}`;

    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(strategyName);

    if (this.subscriptions.has(key)) {
      return;
    }

    if (!this.client) {
      throw new Error("SubscriptionManager not initialized");
    }

    const subscription = await this.client.candle(
      { coin: symbol, interval: timeframe },
      (data) => {
        if (this.onCandleCallback) {
          this.onCandleCallback(data);
        }
      }
    );

    this.subscriptions.set(key, subscription);
    console.log(`Subscribed to ${key}`);
  }

  async unsubscribe(symbol: string, timeframe: Interval, strategyName: string): Promise<void> {
    const key = `${symbol}:${timeframe}`;

    const subs = this.subscribers.get(key);
    if (!subs) return;

    subs.delete(strategyName);

    if (subs.size === 0) {
      const subscription = this.subscriptions.get(key);
      if (subscription) {
        await subscription.unsubscribe();
        this.subscriptions.delete(key);
        console.log(`Unsubscribed from ${key}`);
      }
      this.subscribers.delete(key);
    }
  }

  getSubscribersFor(symbol: string, timeframe: Interval): Set<string> {
    const key = `${symbol}:${timeframe}`;
    return this.subscribers.get(key) || new Set();
  }

  async closeAll(): Promise<void> {
    for (const [key, subscription] of this.subscriptions) {
      await subscription.unsubscribe();
    }
    this.subscriptions.clear();
    this.subscribers.clear();

    if (this.transport) {
      await this.transport.close();
      this.transport = null;
      this.client = null;
    }
  }
}

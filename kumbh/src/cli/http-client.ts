import type { Config } from "../config.ts";
import { getApiUrl, getWsUrl } from "../config.ts";
import type {
  StrategyResponse,
  AddStrategyResponse,
  OperationResponse,
  BacktestRequest,
  BacktestResponse,
  HealthResponse,
  StatusResponse,
  ErrorResponse,
  WSServerMessage,
} from "../api/types.ts";

/**
 * HTTP client for communicating with the Kumbh engine API.
 */
export class HttpClient {
  private baseUrl: string;
  private wsUrl: string;

  constructor(config: Config) {
    this.baseUrl = getApiUrl(config);
    this.wsUrl = getWsUrl(config);
  }

  /**
   * Check if the engine is running and healthy.
   */
  async health(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error("Engine is not running or unhealthy");
    }
    return response.json();
  }

  /**
   * Get engine status information.
   */
  async status(): Promise<StatusResponse> {
    const response = await fetch(`${this.baseUrl}/api/status`);
    if (!response.ok) {
      throw new Error("Failed to get status");
    }
    return response.json();
  }

  /**
   * Get all strategies.
   */
  async listStrategies(): Promise<StrategyResponse[]> {
    const response = await fetch(`${this.baseUrl}/api/strategies`);
    if (!response.ok) {
      throw new Error("Failed to list strategies");
    }
    return response.json();
  }

  /**
   * Get a single strategy by name.
   */
  async getStrategy(name: string): Promise<StrategyResponse> {
    const response = await fetch(`${this.baseUrl}/api/strategies/${encodeURIComponent(name)}`);
    if (!response.ok) {
      const error = (await response.json()) as ErrorResponse;
      throw new Error(error.error || `Strategy '${name}' not found`);
    }
    return response.json();
  }

  /**
   * Add a new strategy from a file path.
   */
  async addStrategy(filePath: string): Promise<AddStrategyResponse> {
    const response = await fetch(`${this.baseUrl}/api/strategies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error((result as ErrorResponse).error || "Failed to add strategy");
    }
    return result as AddStrategyResponse;
  }

  /**
   * Start a strategy.
   */
  async startStrategy(name: string): Promise<OperationResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/strategies/${encodeURIComponent(name)}/start`,
      { method: "POST" }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error((result as ErrorResponse).error || "Failed to start strategy");
    }
    return result as OperationResponse;
  }

  /**
   * Stop a strategy.
   */
  async stopStrategy(name: string): Promise<OperationResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/strategies/${encodeURIComponent(name)}/stop`,
      { method: "POST" }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error((result as ErrorResponse).error || "Failed to stop strategy");
    }
    return result as OperationResponse;
  }

  /**
   * Reload a strategy's code from disk.
   */
  async reloadStrategy(name: string): Promise<OperationResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/strategies/${encodeURIComponent(name)}/reload`,
      { method: "POST" }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error((result as ErrorResponse).error || "Failed to reload strategy");
    }
    return result as OperationResponse;
  }

  /**
   * Remove a strategy.
   */
  async removeStrategy(name: string): Promise<OperationResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/strategies/${encodeURIComponent(name)}`,
      { method: "DELETE" }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error((result as ErrorResponse).error || "Failed to remove strategy");
    }
    return result as OperationResponse;
  }

  /**
   * Run a backtest on a strategy.
   */
  async runBacktest(name: string, params: BacktestRequest): Promise<BacktestResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/backtest/${encodeURIComponent(name)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error((result as ErrorResponse).error || "Backtest failed");
    }
    return result as BacktestResponse;
  }

  /**
   * Connect to WebSocket for real-time updates.
   * Returns the WebSocket instance and a cleanup function.
   */
  connectWebSocket(
    onMessage: (message: WSServerMessage) => void,
    onError?: (error: Event) => void,
    onClose?: () => void
  ): { ws: WebSocket; close: () => void } {
    const ws = new WebSocket(this.wsUrl);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WSServerMessage;
        onMessage(message);
      } catch {
        console.error("Invalid WebSocket message:", event.data);
      }
    };

    ws.onerror = (event) => {
      if (onError) {
        onError(event);
      }
    };

    ws.onclose = () => {
      if (onClose) {
        onClose();
      }
    };

    // Set up ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);

    return {
      ws,
      close: () => {
        clearInterval(pingInterval);
        ws.close();
      },
    };
  }

  /**
   * Check if the engine is reachable.
   */
  async isEngineRunning(): Promise<boolean> {
    try {
      await this.health();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create an HTTP client from config.
 */
export function createHttpClient(config: Config): HttpClient {
  return new HttpClient(config);
}

import { HttpClient } from "./http-client.ts";
import { createLayout } from "./ui/layout.ts";
import { HeaderComponent } from "./ui/components/header.ts";
import { StrategiesTableComponent, type StrategyWithStatus } from "./ui/components/strategies-table.ts";
import { PnLChartComponent } from "./ui/components/pnl-chart.ts";
import { PositionDetailsComponent } from "./ui/components/position-details.ts";
import { theme } from "./ui/theme.ts";
import type { Config } from "../config.ts";
import type { WSServerMessage, StrategyResponse } from "../api/types.ts";

export class Dashboard {
  private client: HttpClient;
  private network: string;
  private wsCleanup: (() => void) | null = null;
  private pollInterval: Timer | null = null;
  private updateFrequency = 2000; // 2 seconds (fallback polling)

  // UI components
  private layout!: ReturnType<typeof createLayout>;
  private header!: HeaderComponent;
  private strategiesTable!: StrategiesTableComponent;
  private pnlChart!: PnLChartComponent;
  private positionDetails!: PositionDetailsComponent;

  // Strategy data cache
  private strategies: Map<string, StrategyWithStatus> = new Map();

  constructor(config: Config, network: string) {
    this.client = new HttpClient(config);
    this.network = network;
  }

  async start() {
    // Create layout
    this.layout = createLayout();

    // Initialize components
    this.header = new HeaderComponent(this.layout.header, this.network);
    this.strategiesTable = new StrategiesTableComponent(this.layout.strategiesTable);
    this.pnlChart = new PnLChartComponent(this.layout.pnlChart);
    this.positionDetails = new PositionDetailsComponent(this.layout.positionDetails);

    // Setup event handlers
    this.setupEventHandlers();

    // Initial render
    this.header.update();
    this.updateFooter("[↑↓] Navigate  [s] Start/Stop  [r] Reload  [q] Quit");

    // Connect to WebSocket for real-time updates
    this.connectWebSocket();

    // Initial data fetch (WebSocket will send initial state, but this is backup)
    await this.fetchAndUpdate();

    // Start fallback polling (in case WebSocket disconnects)
    this.startPolling();

    // Render screen
    this.layout.screen.render();
  }

  private connectWebSocket() {
    const { ws, close } = this.client.connectWebSocket(
      (message) => this.handleWSMessage(message),
      () => {
        // On error, rely on polling
        this.showError("WebSocket error - using polling");
      },
      () => {
        // On close, try to reconnect after a delay
        setTimeout(() => {
          if (this.wsCleanup) {
            this.connectWebSocket();
          }
        }, 5000);
      }
    );

    this.wsCleanup = close;
  }

  private handleWSMessage(message: WSServerMessage) {
    switch (message.type) {
      case "initial_state":
        // Replace all strategies with initial state
        this.strategies.clear();
        for (const strategy of message.payload) {
          this.strategies.set(strategy.name, this.toStrategyWithStatus(strategy));
        }
        this.updateUIFromCache();
        break;

      case "strategy_update":
        // Update specific strategy
        const existing = this.strategies.get(message.payload.name);
        if (existing) {
          existing.isActive = message.payload.isActive;
          if (message.payload.status) {
            existing.status = message.payload.status;
          }
          // Track P&L for chart
          if (message.payload.status) {
            this.pnlChart.addDataPoint(message.payload.name, message.payload.status.pnl);
          }
        }
        this.updateUIFromCache();
        break;

      case "error":
        this.showError(message.payload.message);
        break;
    }
  }

  private toStrategyWithStatus(response: StrategyResponse): StrategyWithStatus {
    return {
      name: response.name,
      description: response.description,
      symbols: response.symbols,
      timeframes: response.timeframes,
      filePath: response.filePath,
      isActive: response.isActive,
      startedAt: response.startedAt,
      errorCount: response.errorCount,
      lastError: response.lastError,
      lastCandleAt: response.lastCandleAt,
      status: response.status || null,
    };
  }

  private updateUIFromCache() {
    const strategiesList = Array.from(this.strategies.values());

    // Update UI components
    this.strategiesTable.update(strategiesList);

    // Update selected strategy details
    const selected = this.strategiesTable.getSelectedStrategy();
    this.positionDetails.update(selected);
    this.pnlChart.update(selected ? selected.name : null);

    // Update header with last update time
    this.header.update(new Date());

    this.layout.screen.render();
  }

  private setupEventHandlers() {
    const { screen } = this.layout;

    // Quit on q or Ctrl+C
    screen.key(["q", "C-c"], () => {
      this.stop();
      process.exit(0);
    });

    // Table selection change
    this.strategiesTable.onSelect((strategy) => {
      if (strategy) {
        this.positionDetails.update(strategy);
        this.pnlChart.update(strategy.name);
      } else {
        this.positionDetails.update(null);
        this.pnlChart.update(null);
      }
    });

    // Keyboard shortcuts
    screen.key(["s"], async () => {
      this.strategiesTable.updateSelection();
      const selected = this.strategiesTable.getSelectedStrategy();
      if (selected) {
        await this.toggleStrategy(selected);
      }
    });

    screen.key(["r"], async () => {
      this.strategiesTable.updateSelection();
      const selected = this.strategiesTable.getSelectedStrategy();
      if (selected) {
        await this.reloadStrategy(selected);
      }
    });

    // Manual refresh
    screen.key(["f5", "R"], async () => {
      await this.fetchAndUpdate();
    });

    // Arrow key navigation - update right panels when selection changes
    screen.key(["up", "down", "k", "j"], () => {
      // Small delay to let the table update its selection first
      setImmediate(() => {
        this.strategiesTable.updateSelection();
        const selected = this.strategiesTable.getSelectedStrategy();
        if (selected) {
          this.positionDetails.update(selected);
          this.pnlChart.update(selected.name);
        } else {
          this.positionDetails.update(null);
          this.pnlChart.update(null);
        }
        this.layout.screen.render();
      });
    });
  }

  private async startPolling() {
    this.pollInterval = setInterval(async () => {
      await this.fetchAndUpdate();
    }, this.updateFrequency);
  }

  private async fetchAndUpdate() {
    try {
      const strategies = await this.client.listStrategies();

      // Update cache
      this.strategies.clear();
      for (const strategy of strategies) {
        const withStatus = this.toStrategyWithStatus(strategy);
        this.strategies.set(strategy.name, withStatus);

        // Update P&L history for all strategies
        if (strategy.status) {
          this.pnlChart.addDataPoint(strategy.name, strategy.status.pnl);
        }
      }

      // Update UI
      this.updateUIFromCache();

      // Clear error message
      this.updateFooter("[↑↓] Navigate  [s] Start/Stop  [r] Reload  [q] Quit");
    } catch (error) {
      this.showError(
        `Connection error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    this.layout.screen.render();
  }

  private async toggleStrategy(strategy: StrategyWithStatus) {
    try {
      if (strategy.isActive) {
        await this.client.stopStrategy(strategy.name);
        this.updateFooter(
          `{${theme.colors.success}-fg}Strategy stopped: ${strategy.name}{/${theme.colors.success}-fg}`
        );
      } else {
        await this.client.startStrategy(strategy.name);
        this.updateFooter(
          `{${theme.colors.success}-fg}Strategy started: ${strategy.name}{/${theme.colors.success}-fg}`
        );
      }
      // Immediate refresh
      await this.fetchAndUpdate();
    } catch (error) {
      this.showError(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async reloadStrategy(strategy: StrategyWithStatus) {
    try {
      await this.client.reloadStrategy(strategy.name);
      this.updateFooter(
        `{${theme.colors.success}-fg}Strategy reloaded: ${strategy.name}{/${theme.colors.success}-fg}`
      );
      // Immediate refresh
      await this.fetchAndUpdate();
    } catch (error) {
      this.showError(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private updateFooter(message: string) {
    this.layout.footer.setContent(` ${message}`);
    this.layout.screen.render();
  }

  private showError(message: string) {
    this.updateFooter(`{${theme.colors.error}-fg}${message}{/${theme.colors.error}-fg}`);
  }

  private stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.wsCleanup) {
      this.wsCleanup();
      this.wsCleanup = null;
    }
  }
}

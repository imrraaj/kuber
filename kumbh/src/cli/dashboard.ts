import { SocketClient } from "./socket-client.ts";
import { createLayout } from "./ui/layout.ts";
import { HeaderComponent } from "./ui/components/header.ts";
import { StrategiesTableComponent, type StrategyWithStatus } from "./ui/components/strategies-table.ts";
import { PnLChartComponent } from "./ui/components/pnl-chart.ts";
import { PositionDetailsComponent } from "./ui/components/position-details.ts";
import { theme } from "./ui/theme.ts";

export class Dashboard {
  private client: SocketClient;
  private network: string;
  private pollInterval: Timer | null = null;
  private updateFrequency = 2000; // 2 seconds

  // UI components
  private layout!: ReturnType<typeof createLayout>;
  private header!: HeaderComponent;
  private strategiesTable!: StrategiesTableComponent;
  private pnlChart!: PnLChartComponent;
  private positionDetails!: PositionDetailsComponent;

  constructor(socketPath: string, network: string) {
    this.client = new SocketClient(socketPath);
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

    // Initial data fetch
    await this.fetchAndUpdate();

    // Start polling
    this.startPolling();

    // Render screen
    this.layout.screen.render();
  }

  private setupEventHandlers() {
    const { screen, strategiesTable } = this.layout;

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
      const response = await this.client.sendRequest({ type: "status" });

      if (response.type === "success") {
        const strategies = response.data as StrategyWithStatus[];

        // Update P&L history for all strategies
        for (const strategy of strategies) {
          if (strategy.status) {
            this.pnlChart.addDataPoint(strategy.name, strategy.status.pnl);
          }
        }

        // Update UI components
        this.strategiesTable.update(strategies);

        // Update selected strategy details
        const selected = this.strategiesTable.getSelectedStrategy();
        this.positionDetails.update(selected);
        this.pnlChart.update(selected ? selected.name : null);

        // Update header with last update time
        this.header.update(new Date());

        // Clear error message
        this.updateFooter("[↑↓] Navigate  [s] Start/Stop  [r] Reload  [q] Quit");
      } else {
        this.showError(`Error: ${response.error}`);
      }
    } catch (error) {
      this.showError(
        `Connection error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    this.layout.screen.render();
  }

  private async toggleStrategy(strategy: StrategyWithStatus) {
    try {
      const command = strategy.isActive ? "stop" : "start";
      const response = await this.client.sendRequest({
        type: command,
        name: strategy.name,
      });

      if (response.type === "success") {
        this.updateFooter(
          `{${theme.colors.success}-fg}Strategy ${strategy.isActive ? "stopped" : "started"}: ${strategy.name}{/${theme.colors.success}-fg}`
        );
        // Immediate refresh
        await this.fetchAndUpdate();
      } else {
        this.showError(`Error: ${response.error}`);
      }
    } catch (error) {
      this.showError(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async reloadStrategy(strategy: StrategyWithStatus) {
    try {
      const response = await this.client.sendRequest({
        type: "reload",
        name: strategy.name,
      });

      if (response.type === "success") {
        this.updateFooter(
          `{${theme.colors.success}-fg}Strategy reloaded: ${strategy.name}{/${theme.colors.success}-fg}`
        );
        // Immediate refresh
        await this.fetchAndUpdate();
      } else {
        this.showError(`Error: ${response.error}`);
      }
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
  }
}

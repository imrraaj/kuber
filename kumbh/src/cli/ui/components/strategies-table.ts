import type contrib from "blessed-contrib";
import type { StrategyEntry } from "../../../db/engine-db.ts";
import type { StrategyStatus } from "../../../types/strategy.ts";
import { formatTimeAgo } from "../../../utils/time.ts";
import { formatPnL, formatStatus, formatErrorCount, theme } from "../theme.ts";

export interface StrategyWithStatus extends StrategyEntry {
  status: StrategyStatus | null;
}

export class StrategiesTableComponent {
  private widget: contrib.widget.Table;
  private strategies: StrategyWithStatus[] = [];
  private selectedIndex: number = 0;

  constructor(widget: contrib.widget.Table) {
    this.widget = widget;
    this.setupHeaders();
    this.setupSelectionTracking();
  }

  private setupSelectionTracking() {
    // Track up/down navigation
    this.widget.rows.on("select", (item: any, index: number) => {
      this.selectedIndex = index;
    });

    // Also listen to key events on the widget
    (this.widget as any).on("select", (item: any, index: number) => {
      this.selectedIndex = index;
    });
  }

  private setupHeaders() {
    this.widget.setData({
      headers: ["NAME", "STATUS", "P&L", "POSITIONS", "ERRORS", "LAST CANDLE"],
      data: [],
    });
  }

  update(strategies: StrategyWithStatus[]) {
    this.strategies = strategies;

    if (strategies.length === 0) {
      this.widget.setData({
        headers: ["NAME", "STATUS", "P&L", "POSITIONS", "ERRORS", "LAST CANDLE"],
        data: [["No strategies loaded", "", "", "", "", ""]],
      });
      this.widget.screen.render();
      return;
    }

    const tableData = strategies.map((strategy) => {
      const status = strategy.isActive ? "RUNNING" : "STOPPED";
      const pnl = strategy.status?.pnl ?? 0;
      const positions = strategy.status?.positionCount ?? 0;
      const lastCandle = formatTimeAgo(strategy.lastCandleAt);

      return [
        strategy.name,
        formatStatus(status),
        formatPnL(pnl),
        positions.toString(),
        formatErrorCount(strategy.errorCount),
        lastCandle,
      ];
    });

    this.widget.setData({
      headers: ["NAME", "STATUS", "P&L", "POSITIONS", "ERRORS", "LAST CANDLE"],
      data: tableData,
    });

    this.widget.screen.render();
  }

  getSelectedStrategy(): StrategyWithStatus | null {
    if (this.strategies.length === 0) {
      return null;
    }

    // Use our tracked selected index
    return this.strategies[this.selectedIndex] || this.strategies[0] || null;
  }

  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  updateSelection() {
    // Force update the selected index from the widget's internal state
    const rowsWidget = this.widget.rows as any;
    if (rowsWidget && typeof rowsWidget.selected === "number") {
      this.selectedIndex = rowsWidget.selected;
    }
  }

  onSelect(callback: (strategy: StrategyWithStatus | null) => void) {
    this.widget.rows.on("select", () => {
      callback(this.getSelectedStrategy());
    });
  }

  focus() {
    this.widget.focus();
  }
}

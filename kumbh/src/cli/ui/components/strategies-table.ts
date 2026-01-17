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

    // The table widget maintains its own selected index
    const selected = (this.widget as any).selected;
    const index = typeof selected === "number" ? selected : 0;

    return this.strategies[index] || null;
  }

  getSelectedIndex(): number {
    const selected = (this.widget as any).selected;
    return typeof selected === "number" ? selected : 0;
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

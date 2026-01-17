import type blessed from "blessed";
import type { StrategyWithStatus } from "./strategies-table.ts";
import { theme, formatPnL } from "../theme.ts";

export class PositionDetailsComponent {
  private widget: blessed.Widgets.BoxElement;

  constructor(widget: blessed.Widgets.BoxElement) {
    this.widget = widget;
  }

  update(strategy: StrategyWithStatus | null) {
    if (!strategy || !strategy.status) {
      this.widget.setContent(
        `\n  {${theme.colors.textMuted}-fg}No strategy selected{/${theme.colors.textMuted}-fg}`
      );
      this.widget.screen.render();
      return;
    }

    const status = strategy.status;
    const custom = status.custom || {};

    let content = "";

    // Strategy name
    content += `\n  {bold}${strategy.name}{/bold}\n\n`;

    // Status
    const statusText = strategy.isActive ? "RUNNING" : "STOPPED";
    const statusColor = strategy.isActive
      ? theme.colors.running
      : theme.colors.stopped;
    content += `  Status: {${statusColor}-fg}${statusText}{/${statusColor}-fg}\n`;

    // P&L
    content += `  P&L: ${formatPnL(status.pnl)}\n`;

    // Position count
    content += `  Positions: {${theme.colors.info}-fg}${status.positionCount}{/${theme.colors.info}-fg}\n\n`;

    // Symbols and timeframes
    content += `  Symbols: {${theme.colors.textMuted}-fg}${strategy.symbols.join(", ")}{/${theme.colors.textMuted}-fg}\n`;
    content += `  Timeframes: {${theme.colors.textMuted}-fg}${strategy.timeframes.join(", ")}{/${theme.colors.textMuted}-fg}\n\n`;

    // Custom metrics
    if (Object.keys(custom).length > 0) {
      content += `  {bold}Custom Metrics:{/bold}\n`;
      for (const [key, value] of Object.entries(custom)) {
        const valueStr =
          typeof value === "number" ? value.toFixed(2) : String(value);
        content += `  ${key}: {${theme.colors.info}-fg}${valueStr}{/${theme.colors.info}-fg}\n`;
      }
      content += "\n";
    }

    // Errors
    if (strategy.errorCount > 0) {
      content += `  {${theme.colors.error}-fg}Errors: ${strategy.errorCount}{/${theme.colors.error}-fg}\n`;
      if (strategy.lastError) {
        content += `  {${theme.colors.textMuted}-fg}Last: ${strategy.lastError}{/${theme.colors.textMuted}-fg}\n`;
      }
    }

    this.widget.setContent(content);
    this.widget.screen.render();
  }
}

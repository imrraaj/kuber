/**
 * Color scheme and styling constants for the TUI dashboard
 */

export const theme = {
  colors: {
    // Primary colors
    primary: "cyan",
    success: "green",
    warning: "yellow",
    error: "red",
    info: "blue",

    // Text colors
    text: "white",
    textMuted: "gray",
    textBright: "white",

    // Background colors
    bgPrimary: "black",
    bgSelected: "blue",
    bgHighlight: "gray",

    // Status colors
    running: "green",
    stopped: "gray",
    error: "red",

    // Chart colors
    chartLine: "yellow",
    chartText: "green",
    chartBaseline: "black",
    chartPositive: "green",
    chartNegative: "red",
  },

  styles: {
    border: {
      type: "line" as const,
      fg: "cyan",
    },

    selectedBorder: {
      type: "line" as const,
      fg: "yellow",
    },

    label: {
      bold: true,
    },
  },

  symbols: {
    bullet: "●",
    arrow: "→",
    check: "✓",
    cross: "✗",
    ellipsis: "...",
  },
} as const;

/**
 * Format currency value with color based on positive/negative
 */
export function formatPnL(value: number): string {
  const sign = value >= 0 ? "+" : "";
  const color = value >= 0 ? theme.colors.chartPositive : theme.colors.chartNegative;
  return `{${color}-fg}${sign}${value.toFixed(2)}{/${color}-fg}`;
}

/**
 * Format status with color
 */
export function formatStatus(status: string): string {
  const isRunning = status === "RUNNING";
  const color = isRunning ? theme.colors.running : theme.colors.stopped;
  return `{${color}-fg}${status}{/${color}-fg}`;
}

/**
 * Format error count with color
 */
export function formatErrorCount(count: number): string {
  if (count === 0) {
    return `{${theme.colors.success}-fg}0{/${theme.colors.success}-fg}`;
  }
  return `{${theme.colors.error}-fg}${count}{/${theme.colors.error}-fg}`;
}

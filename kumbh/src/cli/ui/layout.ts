import blessed from "blessed";
import contrib from "blessed-contrib";
import { theme } from "./theme.ts";

export interface DashboardWidgets {
  screen: blessed.Widgets.Screen;
  header: blessed.Widgets.BoxElement;
  strategiesTable: contrib.widget.Table;
  pnlChart: contrib.widget.LineChart;
  positionDetails: blessed.Widgets.BoxElement;
  footer: blessed.Widgets.BoxElement;
}

/**
 * Create the main dashboard layout with blessed-contrib grid
 */
export function createLayout(): DashboardWidgets {
  // Create screen
  const screen = blessed.screen({
    smartCSR: true,
    title: "Kumbh Trading Engine",
    fullUnicode: true,
  });

  // Create grid
  const grid = new contrib.grid({
    rows: 12,
    cols: 12,
    screen: screen,
  });

  // Header - row 0, full width
  const header = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: "100%",
    height: 1,
    tags: true,
    style: {
      fg: theme.colors.text,
      bg: theme.colors.bgPrimary,
    },
  });

  // Strategies table - rows 1-6, full width
  const strategiesTable = grid.set(1, 0, 5, 12, contrib.table, {
    keys: true,
    vi: true,
    fg: theme.colors.text,
    selectedFg: theme.colors.text,
    selectedBg: theme.colors.bgSelected,
    interactive: true,
    label: " Strategies ",
    border: theme.styles.border,
    columnSpacing: 2,
    columnWidth: [20, 12, 14, 12, 10, 18],
  });

  // P&L Chart - rows 6-11, left 2/3
  const pnlChart = grid.set(6, 0, 6, 8, contrib.line, {
    style: {
      line: theme.colors.chartLine,
      text: theme.colors.chartText,
      baseline: theme.colors.chartBaseline,
    },
    label: " P&L Over Time ",
    border: theme.styles.border,
    showLegend: true,
    legend: { width: 12 },
  });

  // Position details - rows 6-11, right 1/3
  const positionDetails = grid.set(6, 8, 6, 4, blessed.box, {
    label: " Position Details ",
    content: "",
    tags: true,
    border: theme.styles.border,
    style: {
      fg: theme.colors.text,
    },
  });

  // Footer - bottom row
  const footer = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: "100%",
    height: 1,
    tags: true,
    style: {
      fg: theme.colors.textMuted,
      bg: theme.colors.bgPrimary,
    },
  });

  // Focus on the table by default
  strategiesTable.focus();

  return {
    screen,
    header,
    strategiesTable,
    pnlChart,
    positionDetails,
    footer,
  };
}

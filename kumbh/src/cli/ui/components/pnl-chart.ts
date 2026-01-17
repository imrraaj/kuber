import type contrib from "blessed-contrib";
import { theme } from "../theme.ts";

interface PnLDataPoint {
  timestamp: number;
  pnl: number;
}

export class PnLChartComponent {
  private widget: contrib.widget.LineChart;
  private history: Map<string, PnLDataPoint[]> = new Map();
  private readonly maxPoints = 100;
  private readonly colors = [
    "green",
    "magenta",
    "cyan",
    "yellow",
    "blue",
    "red",
  ];

  constructor(widget: contrib.widget.LineChart) {
    this.widget = widget;
  }

  addDataPoint(strategyName: string, pnl: number) {
    const points = this.history.get(strategyName) || [];
    const timestamp = Date.now();

    points.push({ timestamp, pnl });

    // Keep only the last maxPoints
    if (points.length > this.maxPoints) {
      points.shift();
    }

    this.history.set(strategyName, points);
  }

  update(selectedStrategy: string | null) {
    const series: any[] = [];

    if (selectedStrategy && this.history.has(selectedStrategy)) {
      // Show only selected strategy
      const points = this.history.get(selectedStrategy) || [];
      if (points.length > 0) {
        series.push({
          title: selectedStrategy,
          x: points.map((_, i) => i.toString()),
          y: points.map((p) => p.pnl),
          style: {
            line: theme.colors.chartLine,
          },
        });
      }
    } else {
      // Show all strategies
      let colorIndex = 0;
      for (const [name, points] of this.history.entries()) {
        if (points.length > 0) {
          series.push({
            title: name,
            x: points.map((_, i) => i.toString()),
            y: points.map((p) => p.pnl),
            style: {
              line: this.colors[colorIndex % this.colors.length],
            },
          });
          colorIndex++;
        }
      }
    }

    // If no data, show empty chart with placeholder
    if (series.length === 0) {
      series.push({
        title: "No Data",
        x: ["0"],
        y: [0],
        style: {
          line: theme.colors.textMuted,
        },
      });
    }

    this.widget.setData(series);
    this.widget.screen.render();
  }

  clearHistory() {
    this.history.clear();
  }

  clearStrategy(strategyName: string) {
    this.history.delete(strategyName);
  }
}

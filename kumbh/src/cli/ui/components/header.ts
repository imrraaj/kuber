import type blessed from "blessed";
import { theme } from "../theme.ts";

export class HeaderComponent {
  private widget: blessed.Widgets.BoxElement;
  private network: string;
  private lastUpdate: Date | null = null;

  constructor(widget: blessed.Widgets.BoxElement, network: string) {
    this.widget = widget;
    this.network = network;
  }

  update(lastUpdate?: Date) {
    if (lastUpdate) {
      this.lastUpdate = lastUpdate;
    }

    const timeStr = this.lastUpdate
      ? this.formatTime(this.lastUpdate)
      : "Never";

    const networkColor =
      this.network === "TESTNET"
        ? theme.colors.warning
        : theme.colors.success;

    this.widget.setContent(
      ` {bold}Kumbh Trading Engine{/bold} | ` +
        `Network: {${networkColor}-fg}${this.network}{/${networkColor}-fg} | ` +
        `Last Update: {${theme.colors.textMuted}-fg}${timeStr}{/${theme.colors.textMuted}-fg}`
    );
  }

  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }
}

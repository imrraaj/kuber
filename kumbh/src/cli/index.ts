import { SocketClient } from "./socket-client.ts";
import { loadConfig } from "../config.ts";
import { formatTimeAgo } from "../utils/time.ts";
import type { StrategyEntry } from "../db/engine-db.ts";

export async function runCli(args: string[]): Promise<void> {
  const config = await loadConfig();
  const client = new SocketClient(config.socketPath);
  const command = args[0];

  try {
    switch (command) {
      case "add": {
        const filePath = args[1];
        if (!filePath) {
          console.error("Usage: kumbh add <file.ts>");
          process.exit(1);
        }
        const response = await client.sendRequest({ type: "add", path: filePath });
        if (response.type === "success") {
          console.log(`Strategy added: ${(response.data as any).name}`);
        } else {
          console.error(`Error: ${response.error}`);
          process.exit(1);
        }
        break;
      }

      case "start": {
        const name = args[1];
        if (!name) {
          console.error("Usage: kumbh start <name>");
          process.exit(1);
        }
        const response = await client.sendRequest({ type: "start", name });
        if (response.type === "success") {
          console.log(`Strategy started: ${name}`);
        } else {
          console.error(`Error: ${response.error}`);
          process.exit(1);
        }
        break;
      }

      case "stop": {
        const name = args[1];
        if (!name) {
          console.error("Usage: kumbh stop <name>");
          process.exit(1);
        }
        const response = await client.sendRequest({ type: "stop", name });
        if (response.type === "success") {
          console.log(`Strategy stopped: ${name}`);
        } else {
          console.error(`Error: ${response.error}`);
          process.exit(1);
        }
        break;
      }

      case "remove": {
        const name = args[1];
        if (!name) {
          console.error("Usage: kumbh remove <name>");
          process.exit(1);
        }
        const response = await client.sendRequest({ type: "remove", name });
        if (response.type === "success") {
          console.log(`Strategy removed: ${name}`);
        } else {
          console.error(`Error: ${response.error}`);
          process.exit(1);
        }
        break;
      }

      case "reload": {
        const name = args[1];
        if (!name) {
          console.error("Usage: kumbh reload <name>");
          process.exit(1);
        }
        const response = await client.sendRequest({ type: "reload", name });
        if (response.type === "success") {
          console.log(`Strategy reloaded: ${name}`);
        } else {
          console.error(`Error: ${response.error}`);
          process.exit(1);
        }
        break;
      }

      case "show": {
        const name = args[1];
        const response = await client.sendRequest({
          type: "status",
          name: name || undefined
        });

        if (response.type === "success") {
          if (name) {
            console.log(JSON.stringify(response.data, null, 2));
          } else {
            const strategies = response.data as StrategyEntry[];
            console.log("\nSTRATEGIES:\n");
            console.log("NAME".padEnd(20) + "STATUS".padEnd(12) + "ERRORS".padEnd(10) + "LAST CANDLE");
            console.log("=".repeat(60));
            for (const strategy of strategies) {
              const status = strategy.isActive ? "RUNNING" : "STOPPED";
              const lastCandle = formatTimeAgo(strategy.lastCandleAt);
              console.log(
                strategy.name.padEnd(20) +
                status.padEnd(12) +
                strategy.errorCount.toString().padEnd(10) +
                lastCandle
              );
            }
            console.log("");
          }
        } else {
          console.error(`Error: ${response.error}`);
          process.exit(1);
        }
        break;
      }

      case "backtest": {
        const name = args[1];
        if (!name) {
          console.error("Usage: kumbh backtest <name> --from <date> --to <date> --initial-balance <amount>");
          process.exit(1);
        }

        const fromIdx = args.indexOf("--from");
        const toIdx = args.indexOf("--to");
        const balanceIdx = args.indexOf("--initial-balance");

        const from = fromIdx >= 0 ? args[fromIdx + 1] : "2024-01-01";
        const to = toIdx >= 0 ? args[toIdx + 1] : "2024-01-31";
        const initialBalance = balanceIdx >= 0 ? parseFloat(args[balanceIdx + 1]) : 10000;

        const response = await client.sendRequest({
          type: "backtest",
          name,
          options: { from, to, initialBalance },
        });

        if (response.type === "success") {
          const result = response.data as any;
          console.log(`\nBacktest Results for ${name}:`);
          console.log(`Total PnL: ${result.totalPnl.toFixed(2)}`);
          console.log(`Win Rate: ${result.winRate.toFixed(2)}%`);
          console.log(`Total Trades: ${result.totalTrades}`);
        } else {
          console.error(`Error: ${response.error}`);
          process.exit(1);
        }
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error("Run \"kumbh --help\" for usage");
        process.exit(1);
    }
  } catch (error) {
    console.error(`CLI Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

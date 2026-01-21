import { resolve } from "path";
import { HttpClient } from "./http-client.ts";
import { loadConfig } from "../config.ts";
import { Dashboard } from "./dashboard.ts";

export async function runCli(args: string[]): Promise<void> {
  const config = await loadConfig();
  const client = new HttpClient(config);
  const command = args[0];

  try {
    // Check if engine is running for commands that need it
    if (command !== "daemon" && command !== "--help" && command !== "-h") {
      const isRunning = await client.isEngineRunning();
      if (!isRunning) {
        console.error("Engine is not running. Start it with: kumbh daemon");
        process.exit(1);
      }
    }

    switch (command) {
      case "list": {
        const strategies = await client.listStrategies();
        if (strategies.length === 0) {
          console.log("No strategies registered.");
        } else {
          console.log("\n  Strategies:");
          console.log("  " + "─".repeat(60));
          for (const s of strategies) {
            const status = s.isActive ? "\x1b[32m●\x1b[0m" : "\x1b[90m○\x1b[0m";
            const pnl = s.status?.pnl ?? 0;
            const pnlStr = pnl >= 0 ? `\x1b[32m+${pnl.toFixed(2)}\x1b[0m` : `\x1b[31m${pnl.toFixed(2)}\x1b[0m`;
            console.log(`  ${status} ${s.name.padEnd(25)} ${pnlStr.padStart(15)}`);
          }
          console.log();
        }
        break;
      }

      case "dashboard": {
        // Launch interactive TUI dashboard
        const dashboard = new Dashboard(
          config,
          config.isTestnet ? "TESTNET" : "MAINNET"
        );
        await dashboard.start();
        break;
      }

      case "add": {
        const filePath = args[1];
        if (!filePath) {
          console.error("Usage: kumbh add <file.ts>");
          process.exit(1);
        }
        const absolutePath = resolve(filePath);
        const result = await client.addStrategy(absolutePath);
        console.log(`Strategy added: ${result.name}`);
        break;
      }

      case "start": {
        const name = args[1];
        if (!name) {
          console.error("Usage: kumbh start <name>");
          process.exit(1);
        }
        await client.startStrategy(name);
        console.log(`Strategy started: ${name}`);
        break;
      }

      case "stop": {
        const name = args[1];
        if (!name) {
          console.error("Usage: kumbh stop <name>");
          process.exit(1);
        }
        await client.stopStrategy(name);
        console.log(`Strategy stopped: ${name}`);
        break;
      }

      case "remove": {
        const name = args[1];
        if (!name) {
          console.error("Usage: kumbh remove <name>");
          process.exit(1);
        }
        await client.removeStrategy(name);
        console.log(`Strategy removed: ${name}`);
        break;
      }

      case "reload": {
        const name = args[1];
        if (!name) {
          console.error("Usage: kumbh reload <name>");
          process.exit(1);
        }
        await client.reloadStrategy(name);
        console.log(`Strategy reloaded: ${name}`);
        break;
      }

      case "show": {
        const name = args[1];

        // If no strategy name specified, launch dashboard
        if (!name) {
          const dashboard = new Dashboard(
            config,
            config.isTestnet ? "TESTNET" : "MAINNET"
          );
          await dashboard.start();
          break;
        }

        // Otherwise, show formatted output for specific strategy
        const strategy = await client.getStrategy(name);

        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`  Strategy: ${strategy.name}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        console.log(`  Description:      ${strategy.description}`);
        console.log(`  Status:           ${strategy.isActive ? "\x1b[32mRUNNING\x1b[0m" : "\x1b[90mSTOPPED\x1b[0m"}`);
        console.log(`  Symbols:          ${strategy.symbols.join(", ")}`);
        console.log(`  Timeframes:       ${strategy.timeframes.join(", ")}`);
        console.log(`  File Path:        ${strategy.filePath}`);
        console.log(`  Error Count:      ${strategy.errorCount}`);

        if (strategy.lastError) {
          console.log(`  Last Error:       \x1b[31m${strategy.lastError}\x1b[0m`);
        }

        if (strategy.startedAt) {
          const startDate = new Date(strategy.startedAt);
          console.log(`  Started At:       ${startDate.toLocaleString()}`);
        }

        // Status info (if active)
        if (strategy.status) {
          const status = strategy.status;
          console.log();
          console.log(`  ── Live Status ──────────────────────────────────`);

          // P&L with color
          const pnl = status.pnl || 0;
          const pnlColor = pnl >= 0 ? "\x1b[32m" : "\x1b[31m"; // green or red
          const pnlSign = pnl >= 0 ? "+" : "";
          console.log(`  P&L:              ${pnlColor}${pnlSign}${pnl.toFixed(2)}\x1b[0m`);

          console.log(`  Positions:        ${status.positionCount || 0}`);

          if (status.lastTradeAt) {
            const tradeDate = new Date(status.lastTradeAt);
            console.log(`  Last Trade:       ${tradeDate.toLocaleString()}`);
          } else {
            console.log(`  Last Trade:       Never`);
          }

          // Custom metrics
          if (status.custom && Object.keys(status.custom).length > 0) {
            console.log(`\n  ── Custom Metrics ───────────────────────────────`);
            for (const [key, value] of Object.entries(status.custom)) {
              const displayValue =
                typeof value === "number" ? value.toFixed(2) : String(value);
              console.log(`  ${key.padEnd(16)} ${displayValue}`);
            }
          }
        }

        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        break;
      }

      case "backtest": {
        const name = args[1];
        if (!name) {
          console.error(
            "Usage: kumbh backtest <name> --from <date> --to <date> --initial-balance <amount>"
          );
          process.exit(1);
        }

        const fromIdx = args.indexOf("--from");
        const toIdx = args.indexOf("--to");
        const balanceIdx = args.indexOf("--initial-balance");

        const from = fromIdx >= 0 ? args[fromIdx + 1] : "2024-01-01";
        const to = toIdx >= 0 ? args[toIdx + 1] : "2024-01-31";
        const initialBalance =
          balanceIdx >= 0 ? parseFloat(args[balanceIdx + 1]) : 10000;

        console.log(`Running backtest for ${name}...`);
        const result = await client.runBacktest(name, {
          from,
          to,
          initialBalance,
        });

        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`  Backtest Results: ${result.strategyName}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        console.log(`  Period:           ${result.period.from} to ${result.period.to}`);
        console.log(`  Duration:         ${result.duration}ms`);
        console.log();

        console.log(`  ── Performance ─────────────────────────────────`);
        console.log(`  Initial Balance:  $${result.initialBalance.toFixed(2)}`);
        console.log(`  Final Balance:    $${result.finalBalance.toFixed(2)}`);

        const pnlColor = result.totalPnl >= 0 ? "\x1b[32m" : "\x1b[31m";
        const pnlSign = result.totalPnl >= 0 ? "+" : "";
        console.log(
          `  Total P&L:        ${pnlColor}${pnlSign}$${result.totalPnl.toFixed(2)} (${result.totalPnlPercent.toFixed(2)}%)\x1b[0m`
        );
        console.log(`  Max Drawdown:     \x1b[31m${result.maxDrawdown.toFixed(2)}%\x1b[0m`);
        console.log();

        console.log(`  ── Trade Statistics ────────────────────────────`);
        console.log(`  Total Trades:     ${result.totalTrades}`);
        console.log(`  Winning Trades:   ${result.winningTrades}`);
        console.log(`  Losing Trades:    ${result.losingTrades}`);
        console.log(`  Win Rate:         ${result.winRate.toFixed(1)}%`);

        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        break;
      }

      case "status": {
        const status = await client.status();
        const health = await client.health();

        console.log(`\n  Kumbh Engine Status`);
        console.log(`  ` + "─".repeat(40));
        console.log(`  Version:          ${status.version}`);
        console.log(`  Network:          ${status.network.toUpperCase()}`);
        console.log(`  Health:           \x1b[32m${health.status}\x1b[0m`);
        console.log(`  Uptime:           ${formatUptime(health.uptime)}`);
        console.log(`  Strategies:       ${status.strategiesCount}`);
        console.log(`  Active:           ${status.activeStrategiesCount}`);
        console.log();
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "kumbh --help" for usage');
        process.exit(1);
    }
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

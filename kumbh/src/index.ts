#!/usr/bin/env bun

import { loadConfig } from "./config.ts";
import { runDaemon } from "./engine/daemon.ts";
import { runCli } from "./cli/index.ts";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    printUsage();
    process.exit(1);
  }

  try {
    if (command === "daemon") {
      const config = await loadConfig();
      await runDaemon(config);
    } else {
      await runCli(args);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
Kumbh - Strategy Engine for Hyperliquid

Usage:
  kumbh daemon              Start the engine daemon
  kumbh dashboard           Open interactive TUI dashboard
  kumbh show                Open interactive TUI dashboard
  kumbh show <name>         Show strategy details (JSON)
  kumbh add <file.ts>       Add a strategy
  kumbh start <name>        Start a strategy
  kumbh stop <name>         Stop a strategy
  kumbh remove <name>       Remove a strategy
  kumbh reload <name>       Reload strategy code
  kumbh backtest <name>     Run backtest

Options:
  --help                    Show this help message
  --version                 Show version
`);
}

main();

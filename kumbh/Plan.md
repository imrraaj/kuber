Kumbh: Complete Implementation Plan & Documentation
Table of Contents
Introduction & Philosophy
What is Kumbh?
Why These Technology Choices?
Architecture Deep Dive
The Engine Daemon
The CLI Client
Strategy System
Data Flow & WebSockets
Persistence & Databases
Inter-Process Communication
Backtesting System
Configuration System
File Structure & Code Organization
Type Definitions
Implementation Details
Error Handling
Testing Strategy
Deployment & Operations
Security Considerations
Future Considerations
1. Introduction & Philosophy
1.1 The Name
Kuber is the Hindu god of wealth. Kumbh represents the sacred pot (utensil) that contains infinite gold coins. Together, this name represents an engine that generates wealth on Hyperliquid based on the trading strategies you provide.

1.2 Core Philosophy
This project follows several strict principles:

1.2.1 No Technical Debt
Every decision you make will eventually become technical debt. This means:

Think twice before adding ANY code
If something isn't absolutely necessary, don't add it
Simple code that works > clever code that's hard to maintain
Delete code you don't need rather than commenting it out
1.2.2 Strict Type Safety
No any types anywhere in the codebase
No loose types like object or {}
Every function parameter must be typed
Every return value must be typed
Use TypeScript's strict mode ("strict": true in tsconfig.json)
1.2.3 Performance vs User Experience Split
Engine side: Optimize for PERFORMANCE

Every millisecond matters when trading
Use efficient data structures
Minimize allocations
Keep the hot path fast
CLI side: Optimize for USER EXPERIENCE

Pretty output matters more than speed
A few milliseconds slower is fine if it looks better
Colors, formatting, and readability are priorities
1.2.4 Separation of Concerns
The ENGINE runs strategies, it does NOT implement them
The ENGINE fetches data and dispatches it, it does NOT trade
The STRATEGY manages its own positions and state
The CLI displays information, it does NOT process it
2. What is Kumbh?
2.1 High-Level Overview
Kumbh is a strategy execution engine for Hyperliquid (a decentralized perpetual futures exchange). It has two main functions:

Live Trading: Execute trading strategies in real-time with real money
Backtesting: Test strategies against historical data before risking real money
2.2 What Kumbh Does
Fetches real-time price data from Hyperliquid via WebSocket
Manages trading strategies (add, start, stop, remove, reload)
Dispatches candle data to active strategies
Provides a CLI interface for humans to interact with the engine
Runs backtests using historical data
Persists state so strategies survive restarts
2.3 What Kumbh Does NOT Do
Does NOT implement trading strategies - you bring your own
Does NOT manage positions - each strategy tracks its own
Does NOT have global risk controls - each strategy manages its own risk
Does NOT know about your trades - strategies are fully autonomous
2.4 The Two Components

┌─────────────────────────────────────────────────────────────────────────┐
│                              YOUR COMPUTER                               │
│                                                                          │
│   ┌─────────────────────┐         ┌─────────────────────────────────┐   │
│   │     CLI Client      │  Unix   │         Engine Daemon           │   │
│   │                     │ Socket  │                                 │   │
│   │  - You type here    │◄───────►│  - Runs in background           │   │
│   │  - See dashboard    │         │  - Manages strategies           │   │
│   │  - Add strategies   │         │  - Fetches market data          │   │
│   │  - Start/stop       │         │  - Dispatches to strategies     │   │
│   └─────────────────────┘         └─────────────────────────────────┘   │
│                                              │                           │
│                                              │ WebSocket                 │
│                                              ▼                           │
│                                   ┌─────────────────────┐               │
│                                   │    Hyperliquid      │               │
│                                   │    Exchange         │               │
│                                   └─────────────────────┘               │
└─────────────────────────────────────────────────────────────────────────┘
2.4.1 The Engine Daemon
This is a background process that:

Runs continuously (like a server)
Connects to Hyperliquid via WebSocket
Receives real-time candle (OHLCV) data
Manages all registered strategies
Dispatches data to active strategies
Handles strategy lifecycle (start, stop, crash recovery)
Think of it like pm2 or Docker daemon - it runs in the background and manages things.

2.4.2 The CLI Client
This is what you interact with:

A command-line tool
Talks to the engine daemon via Unix socket
Lets you add, start, stop, remove strategies
Shows a live dashboard (like htop)
Runs backtests
Think of it like the docker command - you type commands and it talks to the daemon.

3. Why These Technology Choices?
3.1 Linux (Mandatory)
Why Linux only?

Unix sockets work best on Linux
Better process management
Server environments are typically Linux
systemd for daemon management
More predictable behavior
What about macOS?

It might work, but not officially supported
Unix sockets work on macOS too
But some edge cases may differ
What about Windows?

NOT supported
Unix sockets don't work the same way
WSL2 might work, but not tested
3.2 Bun (NOT Node.js)
What is Bun?
Bun is a JavaScript/TypeScript runtime, like Node.js, but faster.

Why Bun specifically?

Built-in SQLite: Bun has SQLite support built-in (bun:sqlite)

No need for external packages
Very fast
Works synchronously (simpler code)
Native TypeScript: Bun runs .ts files directly

No compilation step needed
No ts-node or similar tools
Just bun run file.ts
Faster startup: Bun starts faster than Node.js

Matters for CLI commands
Built-in test runner: bun test works out of the box

Compatible package manager: bun install works with npm packages

IMPORTANT: Do NOT use Node.js. The code will use Bun-specific features like bun:sqlite.

3.3 TypeScript
Why TypeScript?

Catch errors at compile time, not runtime
Better IDE support (autocomplete, refactoring)
Self-documenting code through types
Required for end-to-end type safety
Configuration:


{
  "compilerOptions": {
    "strict": true,           // Enable all strict checks
    "noImplicitAny": true,    // Error on implicit any
    "strictNullChecks": true, // Null/undefined must be handled
    "noUnusedLocals": true,   // Error on unused variables
    "noUnusedParameters": true // Error on unused parameters
  }
}
3.4 @nktkas/hyperliquid SDK
What is it?
A TypeScript SDK for interacting with Hyperliquid exchange.

Why this SDK?

Official community SDK
Full TypeScript types
Supports both HTTP and WebSocket
Handles authentication
Well-maintained
What it provides:

InfoClient - Read market data, account info
ExchangeClient - Place orders, modify, cancel
SubscriptionClient - Real-time WebSocket data
3.5 blessed-contrib (for CLI UI)
What is it?
A library for building terminal dashboards with widgets.

Why this library?

Battle-tested for dashboards
Provides tables, charts, gauges
Works like ncurses (terminal UI library)
Good for htop-style interfaces
What we'll use it for:

Live-updating strategy dashboard
Tables showing strategy status
Maybe charts for P&L visualization
3.6 SQLite (via Bun)
What is SQLite?
A file-based database. No server needed.

Why SQLite?

Simple: Just a file on disk
No setup: No database server to run
Built into Bun: import { Database } from "bun:sqlite"
Fast: Good for our use case
Reliable: Battle-tested, used everywhere
What we store:

Engine state (which strategies are registered)
Strategy metadata
Each strategy's own data (positions, history)
4. Architecture Deep Dive
4.1 The Big Picture

                                    HYPERLIQUID EXCHANGE
                                           │
                                           │ WebSocket (real-time candle data)
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              ENGINE DAEMON                                    │
│                                                                               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐  │
│  │  Socket Server  │    │ Subscription    │    │    Strategy Manager     │  │
│  │                 │    │ Manager         │    │                         │  │
│  │ Listens on      │    │                 │    │  - Loads strategies     │  │
│  │ /tmp/kumbh.sock │    │ - Manages WS    │    │  - Tracks active ones   │  │
│  │                 │    │ - Auto-reconnect│    │  - Dispatches candles   │  │
│  │ Handles CLI     │    │ - Only active   │    │  - Handles lifecycle    │  │
│  │ commands        │    │   subscriptions │    │                         │  │
│  └────────┬────────┘    └────────┬────────┘    └────────────┬────────────┘  │
│           │                      │                          │                │
│           │                      │ Candle Events            │                │
│           │                      │                          │                │
│           │                      └────────────┬─────────────┘                │
│           │                                   │                              │
│           │                                   ▼                              │
│           │             ┌─────────────────────────────────────────────┐     │
│           │             │            STRATEGY INSTANCES               │     │
│           │             │                                             │     │
│           │             │  ┌───────────┐ ┌───────────┐ ┌───────────┐ │     │
│           │             │  │ Strategy  │ │ Strategy  │ │ Strategy  │ │     │
│           │             │  │ A         │ │ B         │ │ C         │ │     │
│           │             │  │           │ │           │ │           │ │     │
│           │             │  │ Own DB    │ │ Own DB    │ │ Own DB    │ │     │
│           │             │  │ Own State │ │ Own State │ │ Own State │ │     │
│           │             │  └───────────┘ └───────────┘ └───────────┘ │     │
│           │             └─────────────────────────────────────────────┘     │
│           │                                                                  │
│  ┌────────┴────────┐    ┌─────────────────┐                                 │
│  │   Engine DB     │    │  Backtest       │                                 │
│  │                 │    │  Runner         │                                 │
│  │ - Strategy list │    │                 │                                 │
│  │ - Active flags  │    │ - Fetch history │                                 │
│  │ - Metadata      │    │ - Simulate      │                                 │
│  └─────────────────┘    └─────────────────┘                                 │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
           ▲
           │ Unix Socket (/tmp/kumbh.sock)
           │
┌──────────┴───────────────────────────────────────────────────────────────────┐
│                              CLI CLIENT                                       │
│                                                                               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐  │
│  │  Socket Client  │    │ Command Router  │    │    Dashboard UI         │  │
│  │                 │    │                 │    │                         │  │
│  │ Connects to     │    │ - add           │    │ - htop-like display     │  │
│  │ engine socket   │    │ - start         │    │ - Live updating         │  │
│  │                 │    │ - stop          │    │ - Strategy status       │  │
│  │ Sends requests  │    │ - show          │    │ - PnL, positions        │  │
│  │ Gets responses  │    │ - remove        │    │ - Errors, uptime        │  │
│  │                 │    │ - reload        │    │                         │  │
│  │                 │    │ - backtest      │    │                         │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────┘  │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
4.2 Data Structures
4.2.1 Strategy Maps
The engine maintains two key data structures:


// All strategies that have been added (registered)
// Key: strategy name
// Value: strategy metadata and instance
const allStrategies: Map<string, StrategyEntry> = new Map();

// Only the strategies that are currently running (active)
// Key: strategy name
// Value: same StrategyEntry
const activeStrategies: Map<string, StrategyEntry> = new Map();
Flow:

cli add mystrat.ts → Strategy added to allStrategies
cli start mystrat → Strategy moved to activeStrategies (still in allStrategies)
cli stop mystrat → Strategy removed from activeStrategies (still in allStrategies)
cli remove mystrat → Strategy removed from both maps
4.2.2 Subscription Map
For efficient WebSocket management:


// Key: "BTC:1h" (symbol:timeframe)
// Value: Set of strategy names subscribed to this
const subscriptions: Map<string, Set<string>> = new Map();
Why this structure?

When a candle arrives for BTC on 1h timeframe
We look up "BTC:1h" in the map
We get all strategies interested in that data
We dispatch to each of them
4.2.3 Strategy Entry

interface StrategyEntry {
  // Metadata (from the strategy class)
  name: string;
  description: string;
  symbols: string[];      // ["BTC", "ETH"]
  timeframes: Interval[]; // ["1m", "1h"]

  // File info
  filePath: string;       // Where the .ts file is stored

  // Runtime state
  instance: Strategy | null;  // The actual strategy object
  isActive: boolean;
  startedAt: Date | null;
  errorCount: number;
  lastError: string | null;
  lastCandleAt: Date | null;
}
4.3 Process Model
4.3.1 The Daemon
The engine runs as a foreground process. This means:

It runs in your terminal and shows output
When you close the terminal, it stops
To run in background, use systemd
Why foreground?

Simpler code (no daemonization logic)
Easier to debug (just look at terminal)
systemd handles background, restarts, logs better than we could
How to run in background with systemd:


# Create service file: /etc/systemd/system/kumbh.service
[Unit]
Description=Kumbh Strategy Engine
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/.kumbh
ExecStart=/home/youruser/.bun/bin/bun run /path/to/kumbh/src/index.ts daemon
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
Then:


sudo systemctl enable kumbh    # Start on boot
sudo systemctl start kumbh     # Start now
sudo systemctl status kumbh    # Check status
journalctl -u kumbh -f         # View logs
4.3.2 Strategy Isolation
Each strategy runs in the same process but is logically isolated:

Strategies don't know about each other
Each has its own SQLite database
Each has its own context (trading helpers, logger)
Crashes are caught and the strategy is restarted
Why not separate processes per strategy?

Overhead of IPC between processes
Complexity of managing many processes
Shared WebSocket connections are more efficient
Future consideration: Could use Worker threads for true isolation

5. The Engine Daemon
5.1 Starting the Engine

kumbh daemon
# or
bun run src/index.ts daemon
This starts the engine in foreground mode.

5.2 What Happens on Startup

1. Load configuration from ~/.kumbh/config.ts
   │
   ▼
2. Initialize Engine SQLite database
   │ (Create tables if they don't exist)
   │
   ▼
3. Start Unix socket server on /tmp/kumbh.sock
   │
   ▼
4. Load previously registered strategies from database
   │
   ▼
5. For each strategy that was "active" when engine stopped:
   │  - Load the strategy file
   │  - Create instance
   │  - Mark as active
   │
   ▼
6. Start WebSocket connections for active subscriptions
   │
   ▼
7. Begin dispatching candle data to strategies
   │
   ▼
8. Listen for CLI commands on the socket
5.3 The Main Loop

// Pseudocode of the engine's main loop

async function runEngine() {
  // Setup
  const config = await loadConfig();
  const engineDb = new EngineDatabase();
  const socketServer = new SocketServer(config.socketPath);
  const strategyManager = new StrategyManager(engineDb);
  const subscriptionManager = new SubscriptionManager();

  // Load saved state
  await strategyManager.loadFromDatabase();

  // Start socket server for CLI
  socketServer.onRequest(async (request) => {
    switch (request.type) {
      case "add":
        return await strategyManager.addStrategy(request.path);
      case "start":
        return await strategyManager.startStrategy(request.name);
      case "stop":
        return await strategyManager.stopStrategy(request.name);
      // ... etc
    }
  });

  // Handle incoming candle data
  subscriptionManager.onCandle((candle) => {
    // Find all strategies interested in this candle
    const key = `${candle.s}:${candle.i}`; // e.g., "BTC:1h"
    const interestedStrategies = strategyManager.getStrategiesForSubscription(key);

    // Dispatch to each
    for (const strategy of interestedStrategies) {
      try {
        strategy.instance.onCandle(candle);
      } catch (error) {
        handleStrategyError(strategy, error);
      }
    }
  });

  // Keep running until killed
  await socketServer.listen();
}
5.4 Handling Strategy Crashes
When a strategy throws an error:


function handleStrategyError(strategy: StrategyEntry, error: Error) {
  // Log the error
  console.error(`Strategy ${strategy.name} crashed:`, error);

  // Increment error count
  strategy.errorCount++;
  strategy.lastError = error.message;

  // Auto-restart (as per user's decision)
  setTimeout(async () => {
    try {
      // Create fresh instance
      strategy.instance = await loadStrategy(strategy.filePath);
      await strategy.instance.init();
      console.log(`Strategy ${strategy.name} restarted successfully`);
    } catch (restartError) {
      console.error(`Failed to restart ${strategy.name}:`, restartError);
      // Will try again on next error or manual restart
    }
  }, 1000); // 1 second delay before restart
}
Key point: Fresh state on restart. The strategy must recover its position/state from its own SQLite database.

5.5 Graceful Shutdown
When you press Ctrl+C or the process receives SIGTERM:


process.on("SIGINT", async () => {
  console.log("Shutting down...");

  // 1. Stop accepting new CLI connections
  await socketServer.close();

  // 2. Close WebSocket connections
  await subscriptionManager.closeAll();

  // 3. Call cleanup() on each active strategy
  for (const strategy of activeStrategies.values()) {
    try {
      await strategy.instance.cleanup();
    } catch (error) {
      console.error(`Error cleaning up ${strategy.name}:`, error);
    }
  }

  // 4. Save state to database
  await engineDb.saveState(allStrategies, activeStrategies);

  // 5. Close database
  engineDb.close();

  console.log("Shutdown complete");
  process.exit(0);
});
6. The CLI Client
6.1 Available Commands
Command	Description
kumbh daemon	Start the engine (foreground)
kumbh add <file.ts>	Register a new strategy
kumbh start <name>	Activate a strategy
kumbh stop <name>	Deactivate a strategy
kumbh show	Show htop-like dashboard
kumbh show <name>	Show detailed status of one strategy
kumbh remove <name>	Unregister and delete a strategy
kumbh reload <name>	Reload strategy code (must be stopped first)
kumbh backtest <name> [options]	Run a backtest
6.2 Command: add

kumbh add ./my-strategy.ts
What happens:

CLI reads the file path from arguments
CLI connects to engine via Unix socket
CLI sends: { type: "add", path: "/full/path/to/my-strategy.ts" }
Engine receives the request
Engine copies the file to ~/.kumbh/strategies/my-strategy.ts
Engine dynamically imports the file: const module = await import(path)
Engine validates it exports a class extending Strategy
Engine extracts metadata (name, description, symbols, timeframes)
Engine saves to database
Engine responds: { type: "success", data: { name: "MyStrategy" } }
CLI shows: "Strategy 'MyStrategy' added successfully"
If you add the same file again:

It overwrites the existing file
The strategy is NOT automatically reloaded
You need to run kumbh reload MyStrategy to pick up changes
6.3 Command: start

kumbh start MyStrategy
What happens:

Engine looks up "MyStrategy" in allStrategies
If not found → error
If already active → error (or just acknowledge)
Engine creates a fresh instance of the strategy
Engine calls strategy.init() to let it set up
Engine adds to activeStrategies map
Engine subscribes to the symbols/timeframes the strategy needs
Engine saves active state to database
Strategy starts receiving candle data
6.4 Command: stop

kumbh stop MyStrategy
What happens:

Engine looks up "MyStrategy" in activeStrategies
If not active → error
Engine calls strategy.cleanup() to let it clean up
Engine removes from activeStrategies map
Engine unsubscribes from symbols/timeframes if no other strategy needs them
Engine saves state to database
Strategy instance is destroyed
Note: Stopping does NOT close any open positions. The strategy is responsible for that in its cleanup() method if desired.

6.5 Command: show (Dashboard)

kumbh show
What you see:


┌─────────────────────────────────────────────────────────────────────────────┐
│                           KUMBH STRATEGY ENGINE                              │
│                          Network: MAINNET | Uptime: 2d 5h 32m               │
├──────────────────────────────────────────────────────────────────────────────┤
│ NAME            │ STATUS  │ PNL      │ POSITIONS │ LAST TRADE   │ ERRORS   │
├──────────────────────────────────────────────────────────────────────────────┤
│ BTC-Momentum    │ RUNNING │ +$1,234  │ 2         │ 5 min ago    │ 0        │
│ ETH-MeanRevert  │ RUNNING │ -$56     │ 1         │ 2 hours ago  │ 0        │
│ SOL-Breakout    │ STOPPED │ $0       │ 0         │ Never        │ 0        │
│ DOGE-Scalper    │ RUNNING │ +$89     │ 0         │ 30 sec ago   │ 3        │
└──────────────────────────────────────────────────────────────────────────────┘
│ Press 'q' to quit | Arrow keys to scroll | Enter for details               │
└──────────────────────────────────────────────────────────────────────────────┘
Features:

Live updating (refreshes every second)
Shows all registered strategies
Status: RUNNING, STOPPED, CRASHED
PnL: Profit/Loss (from strategy's status() method)
Positions: Number of open positions
Last Trade: When the strategy last traded
Errors: Number of times the strategy crashed
6.6 Command: show <name> (Detailed Status)

kumbh show BTC-Momentum
What you see:


┌─────────────────────────────────────────────────────────────────────────────┐
│                         STRATEGY: BTC-Momentum                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ Description: Momentum-based strategy for BTC using 1h and 4h timeframes     │
│ Status: RUNNING                                                              │
│ Started: 2024-01-15 10:30:00 (2 days ago)                                   │
│ Symbols: BTC                                                                 │
│ Timeframes: 1h, 4h                                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                              STRATEGY CUSTOM STATUS                          │
│   (This section is controlled by the strategy's status() method)            │
├──────────────────────────────────────────────────────────────────────────────┤
│ Current Position: LONG 0.5 BTC @ $42,000                                    │
│ Unrealized PnL: +$500 (+2.4%)                                               │
│ Today's Trades: 3                                                           │
│ Win Rate: 67%                                                               │
│ Current Signal: HOLD                                                        │
│ Next Check: 45 minutes (on 1h candle close)                                 │
└──────────────────────────────────────────────────────────────────────────────┘
Key point: The bottom section is entirely controlled by the strategy. The engine calls strategy.status() and displays whatever the strategy returns.

6.7 Command: remove

kumbh remove MyStrategy
What happens:

If strategy is active → error ("stop it first")
Engine removes from allStrategies map
Engine deletes the strategy file from ~/.kumbh/strategies/
Engine deletes the strategy's SQLite database
Engine removes from database
Strategy is completely gone
Warning: This deletes the strategy's data permanently!

6.8 Command: reload

kumbh reload MyStrategy
What happens:

If strategy is active → error ("stop it first")
Engine re-imports the strategy file
Engine updates metadata if changed
Engine saves to database
Next time you start, the new code runs
Use case: You modified the strategy code and want to use the new version.

6.9 Command: backtest

kumbh backtest BTC-Momentum --from 2024-01-01 --to 2024-01-31 --initial-balance 10000
What happens:

Engine fetches historical candle data from Hyperliquid
Engine creates a fresh strategy instance
Engine calls onBacktestCandle() for each historical candle (in order)
Strategy simulates trades (but doesn't execute real ones)
Engine collects results
CLI displays:
Total P&L
Win rate
Number of trades
Max drawdown
Trade log
Equity curve (ASCII chart)
7. Strategy System
7.1 The Abstract Strategy Class
Every strategy must extend this class:


// src/strategy/base.ts

import type { CandleEvent } from "@nktkas/hyperliquid";

/**
 * Abstract base class that all strategies must extend.
 *
 * A strategy is a trading algorithm that:
 * 1. Receives candle data
 * 2. Decides when to buy/sell
 * 3. Manages its own positions
 * 4. Tracks its own state
 */
export abstract class Strategy {
  /**
   * The context provides helpers for trading, persistence, and logging.
   * Injected by the engine when the strategy is instantiated.
   */
  protected ctx: StrategyContext;

  constructor(ctx: StrategyContext) {
    this.ctx = ctx;
  }

  // ============================================================
  // METADATA - These tell the engine about your strategy
  // ============================================================

  /**
   * Unique name for this strategy.
   * Used in CLI commands: `kumbh start MyStrategy`
   *
   * Example: "BTC-Momentum-1H"
   */
  abstract get name(): string;

  /**
   * Human-readable description of what this strategy does.
   * Shown in the dashboard and status views.
   *
   * Example: "Momentum strategy for BTC using 1h candles with RSI confirmation"
   */
  abstract get description(): string;

  /**
   * List of symbols (coins) this strategy wants data for.
   * The engine will subscribe to candle data for these.
   *
   * Example: ["BTC", "ETH", "SOL"]
   */
  abstract get symbols(): string[];

  /**
   * List of timeframes this strategy wants candles for.
   * Combined with symbols, determines all subscriptions.
   *
   * Example: ["1m", "1h", "4h"]
   *
   * If you have symbols=["BTC","ETH"] and timeframes=["1h","4h"],
   * you'll get candles for: BTC-1h, BTC-4h, ETH-1h, ETH-4h
   */
  abstract get timeframes(): Interval[];

  // ============================================================
  // LIFECYCLE - Called by the engine at specific times
  // ============================================================

  /**
   * Called once when the strategy is started.
   * Use this to:
   * - Load state from your database
   * - Set up any data structures
   * - Check for existing positions
   *
   * If this throws, the strategy won't start.
   */
  abstract init(): Promise<void>;

  /**
   * Called when the strategy is stopped.
   * Use this to:
   * - Save state to database
   * - Optionally close positions
   * - Clean up resources
   */
  abstract cleanup(): Promise<void>;

  // ============================================================
  // TRADING - Called when market data arrives
  // ============================================================

  /**
   * Called for each new candle during LIVE trading.
   * This is your main trading logic.
   *
   * @param candle - The OHLCV candle data from Hyperliquid
   *
   * Example:
   * ```
   * async onCandle(candle: CandleEvent) {
   *   if (this.shouldBuy(candle)) {
   *     await this.ctx.openPosition({ ... });
   *   }
   * }
   * ```
   */
  abstract onCandle(candle: CandleEvent): Promise<void>;

  /**
   * Called for each historical candle during BACKTESTING.
   * Identical to onCandle, but you should NOT execute real trades.
   *
   * Instead, simulate trades and track theoretical P&L.
   * The engine provides the same candle format for consistency.
   *
   * @param candle - Historical OHLCV candle data
   */
  abstract onBacktestCandle(candle: CandleEvent): Promise<void>;

  // ============================================================
  // STATUS - For the dashboard
  // ============================================================

  /**
   * Return current status information for display in CLI.
   *
   * This is called by the engine when someone runs:
   * - `kumbh show` (for the dashboard row)
   * - `kumbh show MyStrategy` (for detailed view)
   *
   * Return whatever information is useful for monitoring.
   */
  abstract status(): StrategyStatus;
}
7.2 The Strategy Context
The engine injects this into every strategy:


// src/strategy/context.ts

import { Database } from "bun:sqlite";

/**
 * Context object injected into strategies.
 * Provides helpers for common operations.
 */
export interface StrategyContext {
  // ============================================================
  // TRADING HELPERS
  // ============================================================

  /**
   * Open a new position (long or short).
   *
   * @example
   * await this.ctx.openPosition({
   *   symbol: "BTC",
   *   side: "long",
   *   size: 0.1,        // 0.1 BTC
   *   price: 42000,     // Limit price (optional for market)
   *   orderType: "limit"
   * });
   */
  openPosition(params: OrderParams): Promise<OrderResult>;

  /**
   * Close an existing position.
   *
   * @example
   * await this.ctx.closePosition({
   *   symbol: "BTC",
   *   size: 0.1,        // How much to close
   *   price: 43000      // Limit price (optional for market)
   * });
   */
  closePosition(params: CloseParams): Promise<OrderResult>;

  /**
   * Get current account balance and margin info.
   *
   * @returns Account value, available balance, margin used, etc.
   */
  getBalance(): Promise<AccountState>;

  /**
   * Get all current open positions.
   *
   * @returns Array of positions with entry price, size, PnL, etc.
   */
  getPositions(): Promise<Position[]>;

  // ============================================================
  // PERSISTENCE
  // ============================================================

  /**
   * Pre-configured SQLite database for THIS strategy.
   * Each strategy gets its own database file.
   *
   * Location: ~/.kumbh/data/<strategy-name>.db
   *
   * Use this to store:
   * - Trade history
   * - Current positions
   * - Strategy state (indicators, signals, etc.)
   *
   * @example
   * // Save a trade
   * this.ctx.db.run(`
   *   INSERT INTO trades (symbol, side, size, price, timestamp)
   *   VALUES (?, ?, ?, ?, ?)
   * `, [symbol, side, size, price, Date.now()]);
   *
   * // Load positions on init
   * const positions = this.ctx.db.query(`
   *   SELECT * FROM positions WHERE status = 'open'
   * `).all();
   */
  db: Database;

  // ============================================================
  // LOGGING
  // ============================================================

  /**
   * Structured logger for this strategy.
   * Logs are saved and can be viewed in the CLI.
   *
   * @example
   * this.ctx.log.info("Opening long position", { symbol: "BTC", size: 0.1 });
   * this.ctx.log.warn("Low balance", { available: 100 });
   * this.ctx.log.error("Order failed", { error: err.message });
   */
  log: StructuredLogger;

  // ============================================================
  // MODE DETECTION
  // ============================================================

  /**
   * True if running a backtest, false if live trading.
   *
   * Use this to avoid making real API calls during backtests:
   *
   * @example
   * if (this.ctx.isBacktest) {
   *   // Simulate the trade
   *   this.simulateTrade(order);
   * } else {
   *   // Real trade
   *   await this.ctx.openPosition(order);
   * }
   */
  isBacktest: boolean;

  /**
   * True if connected to testnet, false if mainnet.
   *
   * Useful for logging or adjusting behavior:
   *
   * @example
   * if (this.ctx.isTestnet) {
   *   this.ctx.log.info("Running on TESTNET - trades are not real");
   * }
   */
  isTestnet: boolean;
}
7.3 Example Strategy Implementation
Here's a complete example strategy:


// my-btc-strategy.ts

import { Strategy, StrategyContext, StrategyStatus } from "kumbh";
import type { CandleEvent } from "@nktkas/hyperliquid";

/**
 * Simple momentum strategy for BTC.
 *
 * Logic:
 * - If price closes above 20-period SMA, go long
 * - If price closes below 20-period SMA, close long
 * - Only trade on 1h timeframe
 */
export default class BTCMomentumStrategy extends Strategy {
  // Store recent closes for SMA calculation
  private closes: number[] = [];
  private readonly SMA_PERIOD = 20;

  // Track our position
  private isLong: boolean = false;
  private entryPrice: number = 0;
  private positionSize: number = 0.1; // 0.1 BTC

  // ============================================================
  // METADATA
  // ============================================================

  get name(): string {
    return "BTC-Momentum-1H";
  }

  get description(): string {
    return "Simple momentum strategy: Long when price > 20 SMA";
  }

  get symbols(): string[] {
    return ["BTC"];
  }

  get timeframes(): Interval[] {
    return ["1h"];
  }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  async init(): Promise<void> {
    // Create our tables if they don't exist
    this.ctx.db.run(`
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        side TEXT NOT NULL,
        size REAL NOT NULL,
        price REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        pnl REAL
      )
    `);

    this.ctx.db.run(`
      CREATE TABLE IF NOT EXISTS state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Load previous state
    const stateRow = this.ctx.db.query(`
      SELECT value FROM state WHERE key = 'position'
    `).get() as { value: string } | null;

    if (stateRow) {
      const state = JSON.parse(stateRow.value);
      this.isLong = state.isLong;
      this.entryPrice = state.entryPrice;
      this.closes = state.closes || [];
    }

    // Check if we have an actual position on Hyperliquid
    const positions = await this.ctx.getPositions();
    const btcPosition = positions.find(p => p.symbol === "BTC");

    if (btcPosition && btcPosition.size > 0) {
      this.isLong = true;
      this.entryPrice = btcPosition.entryPrice;
      this.ctx.log.info("Found existing BTC position", {
        size: btcPosition.size,
        entryPrice: btcPosition.entryPrice
      });
    }

    this.ctx.log.info("Strategy initialized", { isLong: this.isLong });
  }

  async cleanup(): Promise<void> {
    // Save state before stopping
    const state = {
      isLong: this.isLong,
      entryPrice: this.entryPrice,
      closes: this.closes.slice(-this.SMA_PERIOD) // Keep only what we need
    };

    this.ctx.db.run(`
      INSERT OR REPLACE INTO state (key, value) VALUES ('position', ?)
    `, [JSON.stringify(state)]);

    this.ctx.log.info("Strategy state saved");
  }

  // ============================================================
  // TRADING LOGIC
  // ============================================================

  async onCandle(candle: CandleEvent): Promise<void> {
    // Only process 1h candles for BTC
    if (candle.i !== "1h" || candle.s !== "BTC") {
      return;
    }

    const close = parseFloat(candle.c);
    this.closes.push(close);

    // Keep only what we need
    if (this.closes.length > this.SMA_PERIOD) {
      this.closes.shift();
    }

    // Need enough data for SMA
    if (this.closes.length < this.SMA_PERIOD) {
      this.ctx.log.info("Warming up...", {
        candles: this.closes.length,
        needed: this.SMA_PERIOD
      });
      return;
    }

    // Calculate SMA
    const sma = this.closes.reduce((a, b) => a + b, 0) / this.SMA_PERIOD;

    this.ctx.log.info("Candle processed", { close, sma, isLong: this.isLong });

    // Trading logic
    if (close > sma && !this.isLong) {
      // Price above SMA and we're not long → open long
      try {
        const result = await this.ctx.openPosition({
          symbol: "BTC",
          side: "long",
          size: this.positionSize,
          orderType: "market"
        });

        this.isLong = true;
        this.entryPrice = close;

        // Log the trade
        this.ctx.db.run(`
          INSERT INTO trades (side, size, price, timestamp)
          VALUES (?, ?, ?, ?)
        `, ["long", this.positionSize, close, Date.now()]);

        this.ctx.log.info("Opened long position", {
          price: close,
          orderId: result.orderId
        });
      } catch (error) {
        this.ctx.log.error("Failed to open long", { error: error.message });
      }

    } else if (close < sma && this.isLong) {
      // Price below SMA and we're long → close long
      try {
        const pnl = (close - this.entryPrice) * this.positionSize;

        const result = await this.ctx.closePosition({
          symbol: "BTC",
          size: this.positionSize,
          orderType: "market"
        });

        // Log the trade with PnL
        this.ctx.db.run(`
          INSERT INTO trades (side, size, price, timestamp, pnl)
          VALUES (?, ?, ?, ?, ?)
        `, ["close", this.positionSize, close, Date.now(), pnl]);

        this.isLong = false;
        this.entryPrice = 0;

        this.ctx.log.info("Closed long position", {
          price: close,
          pnl,
          orderId: result.orderId
        });
      } catch (error) {
        this.ctx.log.error("Failed to close long", { error: error.message });
      }
    }
  }

  async onBacktestCandle(candle: CandleEvent): Promise<void> {
    // Same logic as onCandle, but don't make real trades
    if (candle.i !== "1h" || candle.s !== "BTC") {
      return;
    }

    const close = parseFloat(candle.c);
    this.closes.push(close);

    if (this.closes.length > this.SMA_PERIOD) {
      this.closes.shift();
    }

    if (this.closes.length < this.SMA_PERIOD) {
      return;
    }

    const sma = this.closes.reduce((a, b) => a + b, 0) / this.SMA_PERIOD;

    if (close > sma && !this.isLong) {
      // Simulate opening long
      this.isLong = true;
      this.entryPrice = close;

      // Log to backtest results (the engine collects these)
      this.ctx.log.info("BACKTEST: Open long", { price: close });

    } else if (close < sma && this.isLong) {
      // Simulate closing long
      const pnl = (close - this.entryPrice) * this.positionSize;
      this.isLong = false;
      this.entryPrice = 0;

      this.ctx.log.info("BACKTEST: Close long", { price: close, pnl });
    }
  }

  // ============================================================
  // STATUS
  // ============================================================

  status(): StrategyStatus {
    // Get recent trades for stats
    const trades = this.ctx.db.query(`
      SELECT * FROM trades ORDER BY timestamp DESC LIMIT 10
    `).all() as any[];

    const totalPnl = this.ctx.db.query(`
      SELECT COALESCE(SUM(pnl), 0) as total FROM trades WHERE pnl IS NOT NULL
    `).get() as { total: number };

    const winCount = this.ctx.db.query(`
      SELECT COUNT(*) as count FROM trades WHERE pnl > 0
    `).get() as { count: number };

    const totalTrades = this.ctx.db.query(`
      SELECT COUNT(*) as count FROM trades WHERE pnl IS NOT NULL
    `).get() as { count: number };

    return {
      // Basic info for dashboard row
      pnl: totalPnl.total,
      positionCount: this.isLong ? 1 : 0,
      lastTradeAt: trades[0]?.timestamp || null,

      // Detailed info for status view
      custom: {
        position: this.isLong ? `LONG @ $${this.entryPrice}` : "FLAT",
        smaValue: this.closes.length >= this.SMA_PERIOD
          ? (this.closes.reduce((a, b) => a + b, 0) / this.SMA_PERIOD).toFixed(2)
          : "Warming up...",
        totalTrades: totalTrades.count,
        winRate: totalTrades.count > 0
          ? `${((winCount.count / totalTrades.count) * 100).toFixed(1)}%`
          : "N/A",
        recentTrades: trades.slice(0, 5).map(t => ({
          side: t.side,
          price: t.price,
          pnl: t.pnl,
          time: new Date(t.timestamp).toISOString()
        }))
      }
    };
  }
}
7.4 Strategy Status Type

// src/types/strategy.ts

/**
 * Status information returned by strategy.status()
 */
export interface StrategyStatus {
  /**
   * Current P&L (profit/loss) in USD.
   * Shown in the dashboard.
   */
  pnl: number;

  /**
   * Number of open positions.
   * Shown in the dashboard.
   */
  positionCount: number;

  /**
   * Timestamp of the last trade, or null if never traded.
   * Shown as "5 min ago" in the dashboard.
   */
  lastTradeAt: number | null;

  /**
   * Custom data for detailed status view.
   * Can be any structure - displayed as-is in `kumbh show <name>`.
   *
   * Example:
   * {
   *   position: "LONG @ $42,000",
   *   signal: "HOLD",
   *   winRate: "65%",
   *   recentTrades: [...]
   * }
   */
  custom?: Record<string, unknown>;
}
8. Data Flow & WebSockets
8.1 Candle Data Structure
This is what Hyperliquid sends and what your strategy receives:


/**
 * OHLCV Candle event from Hyperliquid WebSocket.
 *
 * Note: All prices and volumes are STRINGS for precision.
 * You need to parseFloat() them for calculations.
 */
interface CandleEvent {
  /** Opening timestamp in milliseconds since epoch */
  t: number;

  /** Closing timestamp in milliseconds since epoch */
  T: number;

  /** Symbol (e.g., "BTC", "ETH") */
  s: string;

  /** Interval/timeframe (e.g., "1h", "4h", "1d") */
  i: string;

  /** Opening price (as string for precision) */
  o: string;

  /** Closing price (as string for precision) */
  c: string;

  /** Highest price (as string for precision) */
  h: string;

  /** Lowest price (as string for precision) */
  l: string;

  /** Volume traded (as string for precision) */
  v: string;

  /** Number of trades in this candle */
  n: number;
}

// Example candle:
{
  t: 1705432800000,        // 2024-01-16 22:00:00 UTC
  T: 1705436399999,        // 2024-01-16 22:59:59.999 UTC
  s: "BTC",
  i: "1h",
  o: "42150.50",
  c: "42300.75",
  h: "42350.00",
  l: "42100.00",
  v: "1234.5678",
  n: 5432
}
8.2 Available Timeframes

// src/types/timeframe.ts

/**
 * All supported candle timeframes.
 * These match Hyperliquid's supported intervals.
 */
export type Interval =
  | "1m"   // 1 minute
  | "3m"   // 3 minutes
  | "5m"   // 5 minutes
  | "15m"  // 15 minutes
  | "30m"  // 30 minutes
  | "1h"   // 1 hour
  | "2h"   // 2 hours
  | "4h"   // 4 hours
  | "8h"   // 8 hours
  | "12h"  // 12 hours
  | "1d"   // 1 day
  | "3d"   // 3 days
  | "1w"   // 1 week
  | "1M";  // 1 month

/**
 * All intervals as an array (for iteration)
 */
export const ALL_INTERVALS: Interval[] = [
  "1m", "3m", "5m", "15m", "30m",
  "1h", "2h", "4h", "8h", "12h",
  "1d", "3d", "1w", "1M"
];

/**
 * Convert interval to milliseconds
 */
export function intervalToMs(interval: Interval): number {
  const map: Record<Interval, number> = {
    "1m": 60 * 1000,
    "3m": 3 * 60 * 1000,
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "30m": 30 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "2h": 2 * 60 * 60 * 1000,
    "4h": 4 * 60 * 60 * 1000,
    "8h": 8 * 60 * 60 * 1000,
    "12h": 12 * 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
    "3d": 3 * 24 * 60 * 60 * 1000,
    "1w": 7 * 24 * 60 * 60 * 1000,
    "1M": 30 * 24 * 60 * 60 * 1000, // Approximate
  };
  return map[interval];
}
8.3 Subscription Manager
The SubscriptionManager handles WebSocket connections efficiently:


// src/engine/subscription-manager.ts

import { WebSocketTransport, SubscriptionClient } from "@nktkas/hyperliquid";

/**
 * Manages WebSocket subscriptions to Hyperliquid candle data.
 *
 * Key responsibilities:
 * 1. Only subscribe to symbols/timeframes that active strategies need
 * 2. Share subscriptions when multiple strategies want the same data
 * 3. Auto-reconnect on disconnection
 * 4. Dispatch candles to interested strategies
 */
export class SubscriptionManager {
  private transport: WebSocketTransport;
  private client: SubscriptionClient;

  // Active subscriptions: "BTC:1h" -> subscription object
  private subscriptions: Map<string, Subscription> = new Map();

  // Who wants what: "BTC:1h" -> Set of strategy names
  private subscribers: Map<string, Set<string>> = new Map();

  // Callback for when candles arrive
  private onCandleCallback: ((candle: CandleEvent) => void) | null = null;

  constructor(isTestnet: boolean) {
    this.transport = new WebSocketTransport({ isTestnet });
    this.client = new SubscriptionClient({ transport: this.transport });
  }

  /**
   * Set the callback for incoming candles.
   * The engine uses this to dispatch to strategies.
   */
  onCandle(callback: (candle: CandleEvent) => void): void {
    this.onCandleCallback = callback;
  }

  /**
   * Subscribe to a symbol/timeframe combination.
   * If already subscribed, just add the strategy to the subscriber list.
   */
  async subscribe(
    symbol: string,
    timeframe: Interval,
    strategyName: string
  ): Promise<void> {
    const key = `${symbol}:${timeframe}`;

    // Add to subscriber list
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(strategyName);

    // If already subscribed, we're done
    if (this.subscriptions.has(key)) {
      return;
    }

    // Create new subscription
    const subscription = await this.client.candle(
      { coin: symbol, interval: timeframe },
      (candle) => {
        // Dispatch to our callback
        if (this.onCandleCallback) {
          this.onCandleCallback(candle);
        }
      }
    );

    this.subscriptions.set(key, subscription);
    console.log(`Subscribed to ${key}`);
  }

  /**
   * Unsubscribe a strategy from a symbol/timeframe.
   * Only closes the WebSocket subscription if no strategies need it anymore.
   */
  async unsubscribe(
    symbol: string,
    timeframe: Interval,
    strategyName: string
  ): Promise<void> {
    const key = `${symbol}:${timeframe}`;

    // Remove from subscriber list
    const subs = this.subscribers.get(key);
    if (subs) {
      subs.delete(strategyName);

      // If no one needs this anymore, close the subscription
      if (subs.size === 0) {
        this.subscribers.delete(key);

        const subscription = this.subscriptions.get(key);
        if (subscription) {
          await subscription.unsubscribe();
          this.subscriptions.delete(key);
          console.log(`Unsubscribed from ${key}`);
        }
      }
    }
  }

  /**
   * Unsubscribe a strategy from ALL its subscriptions.
   * Called when a strategy is stopped.
   */
  async unsubscribeAll(strategyName: string): Promise<void> {
    for (const [key, subs] of this.subscribers.entries()) {
      if (subs.has(strategyName)) {
        const [symbol, timeframe] = key.split(":");
        await this.unsubscribe(symbol, timeframe as Interval, strategyName);
      }
    }
  }

  /**
   * Get list of strategy names interested in a specific subscription.
   */
  getSubscribers(symbol: string, timeframe: Interval): string[] {
    const key = `${symbol}:${timeframe}`;
    const subs = this.subscribers.get(key);
    return subs ? Array.from(subs) : [];
  }

  /**
   * Close all subscriptions and disconnect.
   */
  async closeAll(): Promise<void> {
    for (const [key, subscription] of this.subscriptions.entries()) {
      await subscription.unsubscribe();
      console.log(`Closed subscription: ${key}`);
    }
    this.subscriptions.clear();
    this.subscribers.clear();
  }
}
8.4 Data Flow Diagram

HYPERLIQUID EXCHANGE
        │
        │ WebSocket: "New 1h BTC candle closed"
        ▼
┌───────────────────────────────────────────────────────┐
│              SUBSCRIPTION MANAGER                      │
│                                                        │
│  Receives: CandleEvent { s: "BTC", i: "1h", ... }     │
│                                                        │
│  Looks up: subscribers["BTC:1h"] → ["Strategy-A",     │
│                                      "Strategy-C"]    │
│                                                        │
│  Calls: onCandleCallback(candle)                      │
└───────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────┐
│              STRATEGY MANAGER                          │
│                                                        │
│  Gets the candle                                       │
│  Looks up which strategies want BTC:1h                │
│  For each strategy:                                    │
│    try {                                               │
│      await strategy.onCandle(candle);                  │
│    } catch (e) {                                       │
│      handleCrash(strategy, e);                         │
│    }                                                   │
└───────────────────────────────────────────────────────┘
        │
        ├──────────────────────┐
        ▼                      ▼
┌───────────────┐      ┌───────────────┐
│  Strategy A   │      │  Strategy C   │
│               │      │               │
│ onCandle() {  │      │ onCandle() {  │
│   // analyze  │      │   // analyze  │
│   // trade    │      │   // trade    │
│ }             │      │ }             │
└───────────────┘      └───────────────┘
8.5 Auto-Reconnect Logic
The SDK handles reconnection, but we add logging:


// Inside SubscriptionManager constructor

this.transport = new WebSocketTransport({
  isTestnet,
  // The SDK handles reconnection automatically
  // We just log events for visibility
});

// Log connection events
this.transport.on("connected", () => {
  console.log("WebSocket connected to Hyperliquid");
});

this.transport.on("disconnected", () => {
  console.log("WebSocket disconnected, will auto-reconnect...");
});

this.transport.on("reconnected", () => {
  console.log("WebSocket reconnected successfully");
});
Key point: Strategies don't know about disconnections. They just stop receiving candles temporarily. This is intentional - keeps strategy code simple.

9. Persistence & Databases
9.1 Two Types of Databases
Engine Database: One database for the engine itself
Strategy Databases: One database per strategy
9.2 Engine Database
Location: ~/.kumbh/data/engine.db

Purpose: Store engine state that survives restarts

Schema:


-- Table: strategies
-- Stores all registered strategies
CREATE TABLE strategies (
  name TEXT PRIMARY KEY,           -- Unique strategy name
  description TEXT NOT NULL,       -- From strategy.description
  symbols TEXT NOT NULL,           -- JSON array: ["BTC", "ETH"]
  timeframes TEXT NOT NULL,        -- JSON array: ["1h", "4h"]
  file_path TEXT NOT NULL,         -- Where the .ts file is stored
  is_active INTEGER DEFAULT 0,     -- 1 if should be running
  created_at INTEGER NOT NULL,     -- Timestamp when added
  updated_at INTEGER NOT NULL      -- Timestamp of last update
);

-- Table: strategy_state
-- Runtime state for recovery after restart
CREATE TABLE strategy_state (
  name TEXT PRIMARY KEY,           -- Strategy name (FK to strategies)
  started_at INTEGER,              -- When it was started (null if stopped)
  error_count INTEGER DEFAULT 0,   -- Number of crashes
  last_error TEXT,                 -- Last error message
  last_candle_at INTEGER           -- Last candle timestamp received
);

-- Table: engine_config
-- Engine-level settings that can change at runtime
CREATE TABLE engine_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
Example queries:


// Get all strategies
const strategies = db.query(`SELECT * FROM strategies`).all();

// Get active strategies (for startup recovery)
const active = db.query(`
  SELECT s.*, ss.started_at
  FROM strategies s
  JOIN strategy_state ss ON s.name = ss.name
  WHERE s.is_active = 1
`).all();

// Mark strategy as active
db.run(`UPDATE strategies SET is_active = 1, updated_at = ? WHERE name = ?`,
  [Date.now(), strategyName]);

// Save error info
db.run(`
  UPDATE strategy_state
  SET error_count = error_count + 1, last_error = ?
  WHERE name = ?
`, [errorMessage, strategyName]);
9.3 Strategy Databases
Location: ~/.kumbh/data/<strategy-name>.db

Purpose: Each strategy stores its own data here

No fixed schema: Each strategy creates its own tables

Example (from the BTC-Momentum strategy):


-- Created by the strategy in init()
CREATE TABLE trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  side TEXT NOT NULL,
  size REAL NOT NULL,
  price REAL NOT NULL,
  timestamp INTEGER NOT NULL,
  pnl REAL
);

CREATE TABLE state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
9.4 Database Initialization

// src/db/engine-db.ts

import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "fs";

/**
 * Initialize and manage the engine's SQLite database.
 */
export class EngineDatabase {
  private db: Database;

  constructor(dataDir: string) {
    // Ensure directory exists
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = `${dataDir}/engine.db`;
    this.db = new Database(dbPath);

    // Create tables if they don't exist
    this.initSchema();
  }

  private initSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS strategies (
        name TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        symbols TEXT NOT NULL,
        timeframes TEXT NOT NULL,
        file_path TEXT NOT NULL,
        is_active INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS strategy_state (
        name TEXT PRIMARY KEY,
        started_at INTEGER,
        error_count INTEGER DEFAULT 0,
        last_error TEXT,
        last_candle_at INTEGER
      )
    `);
  }

  // ... methods for CRUD operations
}
9.5 Creating a Strategy's Database

// src/strategy/context.ts

import { Database } from "bun:sqlite";

/**
 * Create the context for a specific strategy.
 */
export function createStrategyContext(
  strategyName: string,
  dataDir: string,
  isBacktest: boolean,
  isTestnet: boolean,
  hyperliquidClient: ExchangeClient
): StrategyContext {
  // Create/open the strategy's database
  const dbPath = `${dataDir}/${strategyName}.db`;
  const db = new Database(dbPath);

  return {
    db,
    isBacktest,
    isTestnet,

    // Trading helpers use the Hyperliquid client
    openPosition: async (params) => {
      if (isBacktest) {
        throw new Error("Cannot open real positions during backtest");
      }
      return await hyperliquidClient.order({
        orders: [{
          a: getAssetId(params.symbol),
          b: params.side === "long",
          p: params.price?.toString() || "0",
          s: params.size.toString(),
          r: false,
          t: params.orderType === "limit"
            ? { limit: { tif: "Gtc" } }
            : { trigger: { /* market order config */ } }
        }],
        grouping: "na"
      });
    },

    closePosition: async (params) => {
      if (isBacktest) {
        throw new Error("Cannot close real positions during backtest");
      }
      // Similar to openPosition but with r: true (reduce only)
      // ...
    },

    getBalance: async () => {
      return await hyperliquidClient.info.clearinghouseState({
        user: walletAddress
      });
    },

    getPositions: async () => {
      const state = await hyperliquidClient.info.clearinghouseState({
        user: walletAddress
      });
      return state.assetPositions.map(/* transform to our Position type */);
    },

    log: createLogger(strategyName)
  };
}
10. Inter-Process Communication
10.1 What is IPC?
IPC = Inter-Process Communication

The CLI and Engine are separate processes. They need a way to talk to each other.

We use Unix Domain Sockets - like network sockets, but local-only and faster.

10.2 Why Unix Sockets?
Option	Pros	Cons
Unix Socket	Fast, secure, simple	Linux/Mac only
TCP Socket	Works everywhere	More complex, less secure
Named Pipes	Simple	One-way only
Shared Memory	Very fast	Complex, error-prone
Unix sockets are perfect because:

Linux only (our requirement)
Very fast (no network overhead)
Secure (file permissions)
Bidirectional (request/response)
Docker uses them (proven pattern)
10.3 Socket Location
Default: /tmp/kumbh.sock

This is a file on the filesystem. When the engine starts, it creates this file. When the CLI wants to talk to the engine, it connects to this file.

10.4 Message Format
We use JSON for messages. Simple and debuggable.


// src/types/messages.ts

/**
 * Messages sent FROM CLI TO Engine
 */
export type IPCRequest =
  | { type: "add"; path: string }
  | { type: "start"; name: string }
  | { type: "stop"; name: string }
  | { type: "remove"; name: string }
  | { type: "reload"; name: string }
  | { type: "show" }
  | { type: "show-one"; name: string }
  | { type: "backtest"; name: string; params: BacktestParams };

/**
 * Messages sent FROM Engine TO CLI
 */
export type IPCResponse =
  | { type: "success"; message?: string; data?: unknown }
  | { type: "error"; message: string }
  | { type: "status"; strategies: StrategyInfo[] }
  | { type: "strategy-status"; strategy: StrategyDetailedInfo }
  | { type: "backtest-result"; result: BacktestResult };

/**
 * Backtest parameters
 */
export interface BacktestParams {
  from: string;      // Start date: "2024-01-01"
  to: string;        // End date: "2024-01-31"
  initialBalance: number;
  // Strategy-specific params can be added
  [key: string]: unknown;
}

/**
 * Strategy info for the dashboard
 */
export interface StrategyInfo {
  name: string;
  description: string;
  status: "running" | "stopped" | "crashed";
  pnl: number;
  positionCount: number;
  lastTradeAt: number | null;
  errorCount: number;
  uptime: number | null;  // Milliseconds since started
}

/**
 * Detailed strategy info
 */
export interface StrategyDetailedInfo extends StrategyInfo {
  symbols: string[];
  timeframes: string[];
  startedAt: number | null;
  lastError: string | null;
  custom: Record<string, unknown>;  // From strategy.status().custom
}
10.5 Socket Server (Engine Side)

// src/engine/socket-server.ts

import { createServer, Socket } from "net";
import { unlinkSync, existsSync } from "fs";

/**
 * Unix socket server for handling CLI requests.
 */
export class SocketServer {
  private server: ReturnType<typeof createServer>;
  private socketPath: string;
  private requestHandler: ((request: IPCRequest) => Promise<IPCResponse>) | null = null;

  constructor(socketPath: string) {
    this.socketPath = socketPath;

    // Remove old socket file if it exists
    if (existsSync(socketPath)) {
      unlinkSync(socketPath);
    }

    this.server = createServer((socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Set the handler for incoming requests.
   */
  onRequest(handler: (request: IPCRequest) => Promise<IPCResponse>): void {
    this.requestHandler = handler;
  }

  /**
   * Start listening for connections.
   */
  async listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.socketPath, () => {
        console.log(`Socket server listening on ${this.socketPath}`);
        resolve();
      });

      this.server.on("error", reject);
    });
  }

  /**
   * Handle a new connection from the CLI.
   */
  private handleConnection(socket: Socket): void {
    let buffer = "";

    socket.on("data", async (data) => {
      buffer += data.toString();

      // Messages are newline-delimited JSON
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";  // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const request: IPCRequest = JSON.parse(line);

          if (!this.requestHandler) {
            socket.write(JSON.stringify({ type: "error", message: "No handler" }) + "\n");
            continue;
          }

          const response = await this.requestHandler(request);
          socket.write(JSON.stringify(response) + "\n");

        } catch (error) {
          socket.write(JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : "Unknown error"
          }) + "\n");
        }
      }
    });

    socket.on("error", (err) => {
      console.error("Socket error:", err.message);
    });
  }

  /**
   * Close the server.
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        if (existsSync(this.socketPath)) {
          unlinkSync(this.socketPath);
        }
        resolve();
      });
    });
  }
}
10.6 Socket Client (CLI Side)

// src/cli/socket-client.ts

import { createConnection, Socket } from "net";

/**
 * Client for connecting to the engine's Unix socket.
 */
export class SocketClient {
  private socketPath: string;
  private socket: Socket | null = null;

  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  /**
   * Send a request to the engine and wait for response.
   */
  async send(request: IPCRequest): Promise<IPCResponse> {
    return new Promise((resolve, reject) => {
      const socket = createConnection(this.socketPath);
      let buffer = "";

      socket.on("connect", () => {
        // Send the request
        socket.write(JSON.stringify(request) + "\n");
      });

      socket.on("data", (data) => {
        buffer += data.toString();

        // Look for complete response (newline-delimited)
        const newlineIndex = buffer.indexOf("\n");
        if (newlineIndex !== -1) {
          const responseStr = buffer.substring(0, newlineIndex);
          try {
            const response: IPCResponse = JSON.parse(responseStr);
            socket.end();
            resolve(response);
          } catch (e) {
            socket.end();
            reject(new Error("Invalid response from engine"));
          }
        }
      });

      socket.on("error", (err) => {
        if (err.code === "ENOENT") {
          reject(new Error("Engine is not running. Start it with: kumbh daemon"));
        } else if (err.code === "ECONNREFUSED") {
          reject(new Error("Cannot connect to engine. Is it running?"));
        } else {
          reject(err);
        }
      });

      // Timeout after 30 seconds
      socket.setTimeout(30000, () => {
        socket.end();
        reject(new Error("Request timed out"));
      });
    });
  }

  /**
   * For streaming responses (like the dashboard).
   * Returns a function to close the connection.
   */
  stream(
    request: IPCRequest,
    onData: (response: IPCResponse) => void
  ): () => void {
    const socket = createConnection(this.socketPath);
    let buffer = "";

    socket.on("connect", () => {
      socket.write(JSON.stringify(request) + "\n");
    });

    socket.on("data", (data) => {
      buffer += data.toString();

      // Process all complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const response: IPCResponse = JSON.parse(line);
          onData(response);
        } catch (e) {
          console.error("Invalid response:", line);
        }
      }
    });

    // Return close function
    return () => {
      socket.end();
    };
  }
}
11. Backtesting System
11.1 What is Backtesting?
Backtesting is running your strategy on historical data to see how it would have performed. Instead of waiting months to see if your strategy works, you can test it on past data in seconds.

Example: You have a strategy that buys when RSI < 30. You want to know:

Would this have made money in the last year?
How many trades would it have made?
What was the maximum loss (drawdown)?
Backtesting answers these questions without risking real money.

11.2 How Backtesting Works in Kumbh

┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKTEST FLOW                                      │
└─────────────────────────────────────────────────────────────────────────────┘

1. User runs: kumbh backtest BTC-Momentum --from 2024-01-01 --to 2024-01-31
   │
   ▼
2. CLI sends request to engine via socket
   │
   ▼
3. Engine creates BacktestRunner
   │
   ▼
4. BacktestRunner fetches historical candles from Hyperliquid
   │  (Uses candleSnapshot API for each timeframe the strategy needs)
   │
   ▼
5. BacktestRunner creates a fresh strategy instance
   │  (With isBacktest=true in context)
   │
   ▼
6. BacktestRunner calls strategy.init()
   │
   ▼
7. For each candle (in chronological order):
   │  └── BacktestRunner calls strategy.onBacktestCandle(candle)
   │      └── Strategy records simulated trades
   │
   ▼
8. BacktestRunner calls strategy.cleanup()
   │
   ▼
9. BacktestRunner collects results from strategy
   │
   ▼
10. Engine sends results back to CLI
    │
    ▼
11. CLI displays results in terminal
11.3 The BacktestRunner Class

// src/engine/backtest-runner.ts

import { InfoClient, HttpTransport } from "@nktkas/hyperliquid";

/**
 * Runs backtests on strategies using historical data.
 */
export class BacktestRunner {
  private infoClient: InfoClient;

  constructor(isTestnet: boolean) {
    const transport = new HttpTransport({ isTestnet });
    this.infoClient = new InfoClient({ transport });
  }

  /**
   * Run a backtest on a strategy.
   */
  async run(
    strategyFilePath: string,
    params: BacktestParams
  ): Promise<BacktestResult> {
    const startTime = Date.now();

    // 1. Load the strategy class
    const StrategyClass = await this.loadStrategy(strategyFilePath);

    // 2. Create context with isBacktest=true
    const context = createBacktestContext(params.initialBalance);

    // 3. Instantiate strategy
    const strategy = new StrategyClass(context);

    // 4. Get metadata
    const symbols = strategy.symbols;
    const timeframes = strategy.timeframes;

    // 5. Fetch historical data
    const candles = await this.fetchHistoricalCandles(
      symbols,
      timeframes,
      params.from,
      params.to
    );

    // 6. Sort candles chronologically
    candles.sort((a, b) => a.t - b.t);

    // 7. Initialize strategy
    await strategy.init();

    // 8. Feed candles one by one
    for (const candle of candles) {
      try {
        await strategy.onBacktestCandle(candle);
      } catch (error) {
        // Log but continue
        console.error(`Backtest error at ${candle.t}:`, error);
      }
    }

    // 9. Cleanup
    await strategy.cleanup();

    // 10. Collect results from context
    const results = context.getBacktestResults();

    return {
      strategyName: strategy.name,
      period: { from: params.from, to: params.to },
      duration: Date.now() - startTime,
      initialBalance: params.initialBalance,
      finalBalance: results.finalBalance,
      totalPnl: results.finalBalance - params.initialBalance,
      totalPnlPercent: ((results.finalBalance - params.initialBalance) / params.initialBalance) * 100,
      totalTrades: results.trades.length,
      winningTrades: results.trades.filter(t => t.pnl > 0).length,
      losingTrades: results.trades.filter(t => t.pnl < 0).length,
      winRate: results.trades.length > 0
        ? (results.trades.filter(t => t.pnl > 0).length / results.trades.length) * 100
        : 0,
      maxDrawdown: this.calculateMaxDrawdown(results.equityCurve),
      trades: results.trades,
      equityCurve: results.equityCurve
    };
  }

  /**
   * Fetch historical candles from Hyperliquid.
   */
  private async fetchHistoricalCandles(
    symbols: string[],
    timeframes: Interval[],
    from: string,
    to: string
  ): Promise<CandleEvent[]> {
    const allCandles: CandleEvent[] = [];
    const fromTs = new Date(from).getTime();
    const toTs = new Date(to).getTime();

    for (const symbol of symbols) {
      for (const timeframe of timeframes) {
        // Hyperliquid API: candleSnapshot
        const candles = await this.infoClient.candleSnapshot({
          coin: symbol,
          interval: timeframe,
          startTime: fromTs,
          endTime: toTs
        });

        allCandles.push(...candles);
      }
    }

    return allCandles;
  }

  /**
   * Calculate maximum drawdown from equity curve.
   *
   * Drawdown = how much you lost from the peak before recovering.
   * Max drawdown = the worst drawdown during the backtest.
   */
  private calculateMaxDrawdown(equityCurve: EquityPoint[]): number {
    if (equityCurve.length === 0) return 0;

    let maxDrawdown = 0;
    let peak = equityCurve[0].equity;

    for (const point of equityCurve) {
      if (point.equity > peak) {
        peak = point.equity;
      }
      const drawdown = (peak - point.equity) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown * 100; // As percentage
  }

  /**
   * Load a strategy class from file.
   */
  private async loadStrategy(filePath: string): Promise<typeof Strategy> {
    const module = await import(filePath);
    return module.default;
  }
}
11.4 Backtest Context
During backtesting, the strategy gets a special context that simulates trades:


// src/strategy/backtest-context.ts

/**
 * Context for backtesting - simulates trades instead of executing them.
 */
export function createBacktestContext(initialBalance: number): BacktestContext {
  let balance = initialBalance;
  const trades: BacktestTrade[] = [];
  const equityCurve: EquityPoint[] = [];
  const positions: Map<string, SimulatedPosition> = new Map();

  return {
    isBacktest: true,
    isTestnet: false, // Doesn't matter for backtest

    // Simulated database (in-memory for backtest)
    db: createInMemoryDatabase(),

    log: createBacktestLogger(),

    // Simulated trading
    async openPosition(params: OrderParams): Promise<OrderResult> {
      // Simulate opening a position
      const position: SimulatedPosition = {
        symbol: params.symbol,
        side: params.side,
        size: params.size,
        entryPrice: params.price || 0, // Will be filled with current price
        openedAt: Date.now()
      };
      positions.set(params.symbol, position);

      // Deduct margin (simplified)
      const margin = params.size * position.entryPrice * 0.1; // 10x leverage
      balance -= margin;

      return {
        orderId: `backtest-${Date.now()}`,
        status: "filled",
        filledPrice: position.entryPrice,
        filledSize: params.size
      };
    },

    async closePosition(params: CloseParams): Promise<OrderResult> {
      const position = positions.get(params.symbol);
      if (!position) {
        throw new Error(`No position for ${params.symbol}`);
      }

      // Calculate P&L
      const exitPrice = params.price || 0;
      const priceDiff = position.side === "long"
        ? exitPrice - position.entryPrice
        : position.entryPrice - exitPrice;
      const pnl = priceDiff * position.size;

      // Update balance
      const margin = position.size * position.entryPrice * 0.1;
      balance += margin + pnl;

      // Record trade
      trades.push({
        symbol: params.symbol,
        side: position.side,
        size: position.size,
        entryPrice: position.entryPrice,
        exitPrice: exitPrice,
        pnl: pnl,
        openedAt: position.openedAt,
        closedAt: Date.now()
      });

      // Record equity point
      equityCurve.push({
        timestamp: Date.now(),
        equity: balance
      });

      // Remove position
      positions.delete(params.symbol);

      return {
        orderId: `backtest-${Date.now()}`,
        status: "filled",
        filledPrice: exitPrice,
        filledSize: params.size
      };
    },

    async getBalance(): Promise<AccountState> {
      return {
        accountValue: balance,
        availableBalance: balance,
        marginUsed: 0
      };
    },

    async getPositions(): Promise<Position[]> {
      return Array.from(positions.values()).map(p => ({
        symbol: p.symbol,
        side: p.side,
        size: p.size,
        entryPrice: p.entryPrice,
        unrealizedPnl: 0 // Would need current price
      }));
    },

    // Method to get results at the end
    getBacktestResults(): BacktestResults {
      return {
        finalBalance: balance,
        trades,
        equityCurve
      };
    }
  };
}
11.5 Backtest Result Types

// src/types/backtest.ts

/**
 * Parameters for running a backtest.
 */
export interface BacktestParams {
  from: string;           // Start date: "2024-01-01"
  to: string;             // End date: "2024-01-31"
  initialBalance: number; // Starting balance in USD
}

/**
 * A single trade during backtest.
 */
export interface BacktestTrade {
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  openedAt: number;   // Timestamp
  closedAt: number;   // Timestamp
}

/**
 * A point on the equity curve.
 */
export interface EquityPoint {
  timestamp: number;
  equity: number;
}

/**
 * Complete backtest results.
 */
export interface BacktestResult {
  strategyName: string;
  period: { from: string; to: string };
  duration: number;        // How long the backtest took (ms)

  // Balance
  initialBalance: number;
  finalBalance: number;
  totalPnl: number;
  totalPnlPercent: number;

  // Trade statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;         // Percentage
  maxDrawdown: number;     // Percentage

  // Detailed data
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
}
11.6 Displaying Backtest Results

// src/cli/commands/backtest.ts

/**
 * Display backtest results in the terminal.
 */
function displayBacktestResults(result: BacktestResult): void {
  console.log("\n");
  console.log("═".repeat(60));
  console.log(`  BACKTEST RESULTS: ${result.strategyName}`);
  console.log("═".repeat(60));
  console.log();

  // Summary
  console.log("  SUMMARY");
  console.log("  " + "─".repeat(40));
  console.log(`  Period:          ${result.period.from} to ${result.period.to}`);
  console.log(`  Duration:        ${result.duration}ms`);
  console.log();

  // Performance
  console.log("  PERFORMANCE");
  console.log("  " + "─".repeat(40));
  console.log(`  Initial Balance: $${result.initialBalance.toFixed(2)}`);
  console.log(`  Final Balance:   $${result.finalBalance.toFixed(2)}`);
  const pnlColor = result.totalPnl >= 0 ? "\x1b[32m" : "\x1b[31m";
  console.log(`  Total P&L:       ${pnlColor}$${result.totalPnl.toFixed(2)} (${result.totalPnlPercent.toFixed(2)}%)\x1b[0m`);
  console.log(`  Max Drawdown:    \x1b[31m${result.maxDrawdown.toFixed(2)}%\x1b[0m`);
  console.log();

  // Trade Statistics
  console.log("  TRADE STATISTICS");
  console.log("  " + "─".repeat(40));
  console.log(`  Total Trades:    ${result.totalTrades}`);
  console.log(`  Winning Trades:  ${result.winningTrades}`);
  console.log(`  Losing Trades:   ${result.losingTrades}`);
  console.log(`  Win Rate:        ${result.winRate.toFixed(1)}%`);
  console.log();

  // Recent Trades
  console.log("  RECENT TRADES (last 10)");
  console.log("  " + "─".repeat(40));
  const recentTrades = result.trades.slice(-10);
  for (const trade of recentTrades) {
    const pnlStr = trade.pnl >= 0 ? `+$${trade.pnl.toFixed(2)}` : `-$${Math.abs(trade.pnl).toFixed(2)}`;
    const pnlColor = trade.pnl >= 0 ? "\x1b[32m" : "\x1b[31m";
    console.log(`  ${trade.side.toUpperCase().padEnd(5)} ${trade.symbol.padEnd(6)} ${pnlColor}${pnlStr}\x1b[0m`);
  }
  console.log();

  // Equity Curve (ASCII)
  console.log("  EQUITY CURVE");
  console.log("  " + "─".repeat(40));
  displayAsciiChart(result.equityCurve);
  console.log();

  console.log("═".repeat(60));
}

/**
 * Display a simple ASCII chart of the equity curve.
 */
function displayAsciiChart(equityCurve: EquityPoint[]): void {
  if (equityCurve.length === 0) {
    console.log("  No equity data");
    return;
  }

  const height = 10;
  const width = 50;

  // Sample data to fit width
  const step = Math.max(1, Math.floor(equityCurve.length / width));
  const samples = equityCurve.filter((_, i) => i % step === 0);

  // Find min/max
  const values = samples.map(p => p.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Build chart
  for (let row = height - 1; row >= 0; row--) {
    let line = "  ";
    for (const sample of samples) {
      const normalized = (sample.equity - min) / range;
      const barHeight = Math.floor(normalized * height);
      if (barHeight >= row) {
        line += "█";
      } else {
        line += " ";
      }
    }
    console.log(line);
  }

  // X-axis
  console.log("  " + "─".repeat(samples.length));
}
12. Configuration System
12.1 Configuration File Location
Path: ~/.kumbh/config.ts

We use a TypeScript file for configuration because:

Full type safety
Can use environment variables
Can have comments
Bun imports it directly
12.2 Configuration Structure

// ~/.kumbh/config.ts

/**
 * Kumbh Engine Configuration
 *
 * This file configures the Kumbh strategy engine.
 * Edit this file to change settings.
 */

export default {
  /**
   * Path to the Unix socket for CLI-Engine communication.
   * Default: /tmp/kumbh.sock
   */
  socketPath: "/tmp/kumbh.sock",

  /**
   * Directory where strategy files are stored.
   * When you run `kumbh add strategy.ts`, the file is copied here.
   */
  strategiesDir: "~/.kumbh/strategies",

  /**
   * Directory for data files (databases, logs, etc.)
   */
  dataDir: "~/.kumbh/data",

  /**
   * Use testnet (true) or mainnet (false).
   * IMPORTANT: Start with testnet to avoid losing real money!
   */
  isTestnet: true,

  /**
   * Hyperliquid credentials.
   * These are used to execute trades.
   *
   * Get your private key from your wallet.
   * Get your wallet address from Hyperliquid.
   *
   * SECURITY: Use environment variables, not hardcoded values!
   */
  hyperliquid: {
    privateKey: process.env.HL_PRIVATE_KEY!,
    walletAddress: process.env.HL_WALLET_ADDRESS!,
  },

  /**
   * Logging configuration.
   */
  logging: {
    /**
     * Log level: "debug" | "info" | "warn" | "error"
     */
    level: "info",

    /**
     * Whether to log to a file in addition to console.
     */
    fileLogging: true,

    /**
     * Max size of log file before rotation (in bytes).
     * Default: 10MB
     */
    maxFileSize: 10 * 1024 * 1024,
  },

  /**
   * Dashboard refresh interval in milliseconds.
   * How often the `kumbh show` dashboard updates.
   */
  dashboardRefreshMs: 1000,
};
12.3 Configuration Loader

// src/config.ts

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

/**
 * Configuration type definition.
 */
export interface Config {
  socketPath: string;
  strategiesDir: string;
  dataDir: string;
  isTestnet: boolean;
  hyperliquid: {
    privateKey: string;
    walletAddress: string;
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
    fileLogging: boolean;
    maxFileSize: number;
  };
  dashboardRefreshMs: number;
}

/**
 * Default configuration.
 */
const DEFAULT_CONFIG: Config = {
  socketPath: "/tmp/kumbh.sock",
  strategiesDir: join(homedir(), ".kumbh", "strategies"),
  dataDir: join(homedir(), ".kumbh", "data"),
  isTestnet: true,
  hyperliquid: {
    privateKey: "",
    walletAddress: "",
  },
  logging: {
    level: "info",
    fileLogging: true,
    maxFileSize: 10 * 1024 * 1024,
  },
  dashboardRefreshMs: 1000,
};

/**
 * Load configuration from ~/.kumbh/config.ts
 * Creates default config if it doesn't exist.
 */
export async function loadConfig(): Promise<Config> {
  const configDir = join(homedir(), ".kumbh");
  const configPath = join(configDir, "config.ts");

  // Create directory if needed
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Create default config if needed
  if (!existsSync(configPath)) {
    const defaultConfigContent = generateDefaultConfigFile();
    writeFileSync(configPath, defaultConfigContent, "utf-8");
    console.log(`Created default config at ${configPath}`);
    console.log("Please edit this file to add your Hyperliquid credentials.");
    process.exit(1);
  }

  // Load config
  const userConfig = await import(configPath);
  const config = { ...DEFAULT_CONFIG, ...userConfig.default };

  // Expand ~ in paths
  config.strategiesDir = expandPath(config.strategiesDir);
  config.dataDir = expandPath(config.dataDir);

  // Validate
  validateConfig(config);

  // Create directories
  if (!existsSync(config.strategiesDir)) {
    mkdirSync(config.strategiesDir, { recursive: true });
  }
  if (!existsSync(config.dataDir)) {
    mkdirSync(config.dataDir, { recursive: true });
  }

  return config;
}

/**
 * Expand ~ to home directory.
 */
function expandPath(path: string): string {
  if (path.startsWith("~")) {
    return join(homedir(), path.slice(1));
  }
  return path;
}

/**
 * Validate configuration.
 */
function validateConfig(config: Config): void {
  if (!config.hyperliquid.privateKey) {
    throw new Error(
      "Missing Hyperliquid private key. " +
      "Set HL_PRIVATE_KEY environment variable or edit ~/.kumbh/config.ts"
    );
  }

  if (!config.hyperliquid.walletAddress) {
    throw new Error(
      "Missing Hyperliquid wallet address. " +
      "Set HL_WALLET_ADDRESS environment variable or edit ~/.kumbh/config.ts"
    );
  }
}

/**
 * Generate default config file content.
 */
function generateDefaultConfigFile(): string {
  return `/**
 * Kumbh Engine Configuration
 *
 * Edit this file to configure the Kumbh strategy engine.
 * Documentation: https://github.com/your-repo/kumbh
 */

export default {
  // Unix socket path for CLI-Engine communication
  socketPath: "/tmp/kumbh.sock",

  // Where strategy files are stored
  strategiesDir: "~/.kumbh/strategies",

  // Where databases and logs are stored
  dataDir: "~/.kumbh/data",

  // Use testnet (true) or mainnet (false)
  // START WITH TESTNET to avoid losing real money!
  isTestnet: true,

  // Hyperliquid credentials
  // SECURITY: Use environment variables!
  hyperliquid: {
    privateKey: process.env.HL_PRIVATE_KEY || "",
    walletAddress: process.env.HL_WALLET_ADDRESS || "",
  },

  // Logging settings
  logging: {
    level: "info",
    fileLogging: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
  },

  // Dashboard refresh rate (milliseconds)
  dashboardRefreshMs: 1000,
};
`;
}
12.4 Environment Variables
For security, credentials should be in environment variables:


# Add to ~/.bashrc or ~/.zshrc
export HL_PRIVATE_KEY="your-private-key-here"
export HL_WALLET_ADDRESS="0xYourWalletAddress"
Or use a .env file in your home directory:


# ~/.kumbh/.env
HL_PRIVATE_KEY=your-private-key-here
HL_WALLET_ADDRESS=0xYourWalletAddress
13. File Structure & Code Organization
13.1 Complete Directory Structure

kumbh/
│
├── src/
│   │
│   ├── index.ts                      # Main entry point
│   │                                  # Decides: run daemon or CLI command
│   │
│   ├── config.ts                     # Configuration loader
│   │
│   ├── types/                         # TypeScript type definitions
│   │   ├── index.ts                  # Re-exports all types
│   │   ├── timeframe.ts              # Interval type and helpers
│   │   ├── candle.ts                 # CandleEvent type (re-export from SDK)
│   │   ├── messages.ts               # IPC message types
│   │   ├── strategy.ts               # StrategyStatus, StrategyInfo types
│   │   ├── backtest.ts               # Backtest-related types
│   │   └── trading.ts                # OrderParams, Position, etc.
│   │
│   ├── engine/                        # Engine daemon code
│   │   ├── daemon.ts                 # Main EngineDaemon class
│   │   ├── strategy-manager.ts       # Manages strategy lifecycle
│   │   ├── subscription-manager.ts   # Manages WebSocket subscriptions
│   │   ├── socket-server.ts          # Unix socket server
│   │   └── backtest-runner.ts        # Runs backtests
│   │
│   ├── strategy/                      # Strategy system
│   │   ├── base.ts                   # Abstract Strategy class
│   │   ├── context.ts                # StrategyContext interface & factory
│   │   ├── backtest-context.ts       # Backtest-specific context
│   │   └── loader.ts                 # Dynamic strategy loading
│   │
│   ├── cli/                           # CLI client code
│   │   ├── index.ts                  # CLI entry point, command routing
│   │   ├── socket-client.ts          # Unix socket client
│   │   │
│   │   ├── commands/                  # Individual CLI commands
│   │   │   ├── add.ts
│   │   │   ├── start.ts
│   │   │   ├── stop.ts
│   │   │   ├── show.ts
│   │   │   ├── remove.ts
│   │   │   ├── reload.ts
│   │   │   └── backtest.ts
│   │   │
│   │   └── ui/                        # Terminal UI components
│   │       ├── dashboard.ts          # htop-like dashboard
│   │       ├── table.ts              # Table formatting
│   │       └── chart.ts              # ASCII charts
│   │
│   ├── db/                            # Database code
│   │   ├── engine-db.ts              # Engine's SQLite database
│   │   └── migrations.ts             # Schema migrations (if needed)
│   │
│   └── utils/                         # Utility functions
│       ├── logger.ts                 # Logging utilities
│       ├── time.ts                   # Time formatting ("5 min ago")
│       └── validation.ts             # Input validation
│
├── strategies/                        # Example strategies (for reference)
│   └── example-momentum.ts
│
├── tests/                             # Test files
│   ├── strategy.test.ts
│   ├── engine.test.ts
│   └── cli.test.ts
│
├── package.json
├── tsconfig.json
├── bun.lockb
└── README.md
13.2 Entry Point (src/index.ts)

// src/index.ts

/**
 * Main entry point for Kumbh.
 *
 * Usage:
 *   kumbh daemon           - Start the engine
 *   kumbh add <file>       - Add a strategy
 *   kumbh start <name>     - Start a strategy
 *   kumbh stop <name>      - Stop a strategy
 *   kumbh show             - Show dashboard
 *   kumbh show <name>      - Show strategy details
 *   kumbh remove <name>    - Remove a strategy
 *   kumbh reload <name>    - Reload strategy code
 *   kumbh backtest <name>  - Run backtest
 */

import { loadConfig } from "./config";
import { runDaemon } from "./engine/daemon";
import { runCli } from "./cli";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    printUsage();
    process.exit(1);
  }

  try {
    if (command === "daemon") {
      // Run the engine daemon
      const config = await loadConfig();
      await runDaemon(config);
    } else {
      // Run CLI command
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
  kumbh add <file.ts>       Add a strategy
  kumbh start <name>        Start a strategy
  kumbh stop <name>         Stop a strategy
  kumbh show                Show dashboard
  kumbh show <name>         Show strategy details
  kumbh remove <name>       Remove a strategy
  kumbh reload <name>       Reload strategy code
  kumbh backtest <name>     Run backtest

Options:
  --help                    Show this help message
  --version                 Show version
`);
}

main();
13.3 Module Dependencies

                    ┌─────────────────┐
                    │   index.ts      │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │   config    │   │   engine/   │   │    cli/     │
    └─────────────┘   └──────┬──────┘   └──────┬──────┘
                             │                 │
           ┌─────────┬───────┼─────────┬───────┘
           ▼         ▼       ▼         ▼
    ┌───────────┐ ┌───────┐ ┌───────┐ ┌───────────┐
    │ strategy/ │ │  db/  │ │ types │ │  utils/   │
    └───────────┘ └───────┘ └───────┘ └───────────┘
Key dependencies:

index.ts → imports config, engine/daemon, cli
engine/* → imports strategy/*, db/*, types/*
cli/* → imports types/*, utils/*
strategy/* → imports types/*
14. Type Definitions
14.1 Trading Types

// src/types/trading.ts

/**
 * Parameters for opening a position.
 */
export interface OrderParams {
  symbol: string;              // e.g., "BTC"
  side: "long" | "short";
  size: number;                // Position size in base currency
  price?: number;              // Limit price (optional for market)
  orderType: "limit" | "market";
  leverage?: number;           // Optional, defaults to current setting
}

/**
 * Result of placing an order.
 */
export interface OrderResult {
  orderId: string;
  status: "pending" | "filled" | "partial" | "cancelled" | "failed";
  filledPrice?: number;
  filledSize?: number;
  error?: string;
}

/**
 * Parameters for closing a position.
 */
export interface CloseParams {
  symbol: string;
  size: number;                // How much to close
  price?: number;              // Limit price (optional for market)
  orderType?: "limit" | "market";
}

/**
 * Current account state.
 */
export interface AccountState {
  accountValue: number;        // Total account value
  availableBalance: number;    // Balance available for new trades
  marginUsed: number;          // Margin currently in use
  withdrawable: number;        // Amount that can be withdrawn
}

/**
 * An open position.
 */
export interface Position {
  symbol: string;
  side: "long" | "short";
  size: number;                // Position size
  entryPrice: number;          // Average entry price
  markPrice: number;           // Current mark price
  unrealizedPnl: number;       // Unrealized profit/loss
  liquidationPrice: number;    // Price at which position is liquidated
  leverage: number;            // Current leverage
  marginUsed: number;          // Margin used by this position
}
14.2 Logger Type

// src/types/logger.ts

/**
 * Structured logger for strategies.
 */
export interface StructuredLogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}
14.3 Re-exports (src/types/index.ts)

// src/types/index.ts

// Re-export everything for easy imports
export * from "./timeframe";
export * from "./candle";
export * from "./messages";
export * from "./strategy";
export * from "./trading";
export * from "./backtest";
export * from "./logger";
15. Implementation Details
15.1 Strategy Dynamic Loading
How we load strategy files at runtime:


// src/strategy/loader.ts

import { resolve, dirname } from "path";
import { existsSync, copyFileSync, mkdirSync } from "fs";
import { Strategy } from "./base";

/**
 * Load a strategy class from a TypeScript file.
 */
export async function loadStrategyFromFile(filePath: string): Promise<typeof Strategy> {
  // Resolve to absolute path
  const absolutePath = resolve(filePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Strategy file not found: ${absolutePath}`);
  }

  // Clear from cache (for reloading)
  delete require.cache[require.resolve(absolutePath)];

  // Dynamic import
  const module = await import(absolutePath);

  // Get the default export
  const StrategyClass = module.default;

  if (!StrategyClass) {
    throw new Error(`Strategy file must have a default export: ${filePath}`);
  }

  // Validate it's a class that extends Strategy
  if (typeof StrategyClass !== "function") {
    throw new Error(`Default export must be a class: ${filePath}`);
  }

  // Try to instantiate to validate
  // (We'll create a proper context later)
  // For now, just check it has the right shape

  return StrategyClass;
}

/**
 * Copy a strategy file to the strategies directory.
 */
export function copyStrategyToDir(
  sourcePath: string,
  strategiesDir: string
): string {
  const absoluteSource = resolve(sourcePath);
  const fileName = absoluteSource.split("/").pop()!;
  const destPath = resolve(strategiesDir, fileName);

  // Ensure directory exists
  if (!existsSync(strategiesDir)) {
    mkdirSync(strategiesDir, { recursive: true });
  }

  // Copy file
  copyFileSync(absoluteSource, destPath);

  return destPath;
}

/**
 * Extract metadata from a strategy class.
 */
export function extractStrategyMetadata(
  StrategyClass: typeof Strategy,
  mockContext: any
): StrategyMetadata {
  const instance = new StrategyClass(mockContext);

  return {
    name: instance.name,
    description: instance.description,
    symbols: instance.symbols,
    timeframes: instance.timeframes,
  };
}

interface StrategyMetadata {
  name: string;
  description: string;
  symbols: string[];
  timeframes: string[];
}
15.2 Hyperliquid Client Setup

// src/engine/hyperliquid.ts

import {
  HttpTransport,
  WebSocketTransport,
  InfoClient,
  ExchangeClient,
  SubscriptionClient
} from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Create Hyperliquid clients from configuration.
 */
export function createHyperliquidClients(config: Config) {
  // Create wallet account from private key
  const wallet = privateKeyToAccount(config.hyperliquid.privateKey as `0x${string}`);

  // HTTP transport for regular API calls
  const httpTransport = new HttpTransport({
    isTestnet: config.isTestnet
  });

  // WebSocket transport for subscriptions
  const wsTransport = new WebSocketTransport({
    isTestnet: config.isTestnet
  });

  // Info client (read-only data)
  const infoClient = new InfoClient({
    transport: httpTransport
  });

  // Exchange client (trading)
  const exchangeClient = new ExchangeClient({
    transport: httpTransport,
    wallet
  });

  // Subscription client (real-time data)
  const subscriptionClient = new SubscriptionClient({
    transport: wsTransport
  });

  return {
    wallet,
    infoClient,
    exchangeClient,
    subscriptionClient,
    wsTransport
  };
}
15.3 Logger Implementation

// src/utils/logger.ts

import { Database } from "bun:sqlite";

/**
 * Create a structured logger for a strategy.
 */
export function createLogger(
  strategyName: string,
  db?: Database
): StructuredLogger {
  const format = (level: string, message: string, data?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";
    return `[${timestamp}] [${level}] [${strategyName}] ${message}${dataStr}`;
  };

  const log = (level: string, message: string, data?: Record<string, unknown>) => {
    const formatted = format(level, message, data);
    console.log(formatted);

    // Optionally save to database
    if (db) {
      db.run(`
        INSERT INTO logs (timestamp, level, message, data)
        VALUES (?, ?, ?, ?)
      `, [Date.now(), level, message, JSON.stringify(data)]);
    }
  };

  return {
    debug: (message, data) => log("DEBUG", message, data),
    info: (message, data) => log("INFO", message, data),
    warn: (message, data) => log("WARN", message, data),
    error: (message, data) => log("ERROR", message, data),
  };
}
16. Error Handling
16.1 Error Types

// src/utils/errors.ts

/**
 * Base error class for Kumbh errors.
 */
export class KumbhError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KumbhError";
  }
}

/**
 * Configuration-related errors.
 */
export class ConfigError extends KumbhError {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Strategy-related errors.
 */
export class StrategyError extends KumbhError {
  constructor(
    message: string,
    public strategyName: string
  ) {
    super(`[${strategyName}] ${message}`);
    this.name = "StrategyError";
  }
}

/**
 * Trading-related errors.
 */
export class TradingError extends KumbhError {
  constructor(
    message: string,
    public orderId?: string
  ) {
    super(message);
    this.name = "TradingError";
  }
}

/**
 * Connection-related errors.
 */
export class ConnectionError extends KumbhError {
  constructor(message: string) {
    super(message);
    this.name = "ConnectionError";
  }
}
16.2 Error Handling Patterns

// In the engine's candle dispatch:

async function dispatchCandle(candle: CandleEvent, strategy: StrategyEntry) {
  try {
    await strategy.instance!.onCandle(candle);
    strategy.lastCandleAt = new Date();
  } catch (error) {
    // Log the error
    console.error(`Strategy ${strategy.name} error:`, error);

    // Track error count
    strategy.errorCount++;
    strategy.lastError = error instanceof Error ? error.message : String(error);

    // Auto-restart
    await restartStrategy(strategy);
  }
}

async function restartStrategy(strategy: StrategyEntry) {
  console.log(`Restarting strategy: ${strategy.name}`);

  try {
    // Create fresh instance
    const StrategyClass = await loadStrategyFromFile(strategy.filePath);
    const context = createStrategyContext(/* ... */);
    strategy.instance = new StrategyClass(context);
    await strategy.instance.init();

    console.log(`Strategy ${strategy.name} restarted successfully`);
  } catch (error) {
    console.error(`Failed to restart ${strategy.name}:`, error);
    // Keep in active list, will try again on next candle
  }
}
16.3 CLI Error Display

// In CLI commands:

try {
  const response = await client.send({ type: "start", name: strategyName });

  if (response.type === "error") {
    console.error(`\x1b[31mError:\x1b[0m ${response.message}`);
    process.exit(1);
  }

  console.log(`\x1b[32mStarted strategy: ${strategyName}\x1b[0m`);
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes("not running")) {
      console.error("\x1b[31mError:\x1b[0m Engine is not running.");
      console.error("Start it with: kumbh daemon");
    } else {
      console.error(`\x1b[31mError:\x1b[0m ${error.message}`);
    }
  }
  process.exit(1);
}
17. Testing Strategy
17.1 Test Structure

tests/
├── unit/
│   ├── config.test.ts         # Config loading tests
│   ├── strategy-loader.test.ts # Dynamic loading tests
│   ├── messages.test.ts       # IPC message tests
│   └── utils.test.ts          # Utility function tests
│
├── integration/
│   ├── engine.test.ts         # Engine lifecycle tests
│   ├── socket.test.ts         # Socket communication tests
│   └── strategy.test.ts       # Strategy execution tests
│
└── e2e/
    ├── add-strategy.test.ts   # Full flow: add strategy
    ├── start-stop.test.ts     # Full flow: start/stop
    └── backtest.test.ts       # Full flow: backtest
17.2 Example Tests

// tests/unit/strategy-loader.test.ts

import { describe, expect, test } from "bun:test";
import { loadStrategyFromFile, extractStrategyMetadata } from "../../src/strategy/loader";

describe("Strategy Loader", () => {
  test("loads a valid strategy file", async () => {
    const StrategyClass = await loadStrategyFromFile("./tests/fixtures/valid-strategy.ts");
    expect(StrategyClass).toBeDefined();
  });

  test("throws for non-existent file", async () => {
    await expect(
      loadStrategyFromFile("./tests/fixtures/nonexistent.ts")
    ).rejects.toThrow("Strategy file not found");
  });

  test("extracts metadata correctly", async () => {
    const StrategyClass = await loadStrategyFromFile("./tests/fixtures/valid-strategy.ts");
    const metadata = extractStrategyMetadata(StrategyClass, mockContext);

    expect(metadata.name).toBe("Test-Strategy");
    expect(metadata.symbols).toEqual(["BTC"]);
    expect(metadata.timeframes).toEqual(["1h"]);
  });
});

// tests/integration/socket.test.ts

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { SocketServer } from "../../src/engine/socket-server";
import { SocketClient } from "../../src/cli/socket-client";

describe("Socket Communication", () => {
  let server: SocketServer;
  let client: SocketClient;
  const socketPath = "/tmp/kumbh-test.sock";

  beforeAll(async () => {
    server = new SocketServer(socketPath);
    server.onRequest(async (request) => {
      if (request.type === "show") {
        return { type: "status", strategies: [] };
      }
      return { type: "error", message: "Unknown command" };
    });
    await server.listen();

    client = new SocketClient(socketPath);
  });

  afterAll(async () => {
    await server.close();
  });

  test("sends and receives messages", async () => {
    const response = await client.send({ type: "show" });
    expect(response.type).toBe("status");
  });
});
17.3 Running Tests

# Run all tests
bun test

# Run specific test file
bun test tests/unit/config.test.ts

# Run with coverage
bun test --coverage
18. Deployment & Operations
18.1 Installation

# Clone the repository
git clone https://github.com/your-repo/kumbh.git
cd kumbh

# Install dependencies
bun install

# Create config file
mkdir -p ~/.kumbh
cp examples/config.ts ~/.kumbh/config.ts

# Edit config with your credentials
nano ~/.kumbh/config.ts
18.2 Running Manually

# Start engine in foreground
bun run src/index.ts daemon

# In another terminal, add a strategy
bun run src/index.ts add ./my-strategy.ts

# Start the strategy
bun run src/index.ts start MyStrategy

# View dashboard
bun run src/index.ts show
18.3 Running with systemd
Create service file:


sudo nano /etc/systemd/system/kumbh.service
Content:


[Unit]
Description=Kumbh Strategy Engine
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/.kumbh
Environment="HL_PRIVATE_KEY=your-private-key"
Environment="HL_WALLET_ADDRESS=0xYourAddress"
ExecStart=/home/YOUR_USERNAME/.bun/bin/bun run /path/to/kumbh/src/index.ts daemon
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
Enable and start:


sudo systemctl daemon-reload
sudo systemctl enable kumbh
sudo systemctl start kumbh
sudo systemctl status kumbh
View logs:


journalctl -u kumbh -f
18.4 Monitoring

# Check if engine is running
pgrep -f "kumbh.*daemon"

# View resource usage
top -p $(pgrep -f "kumbh.*daemon")

# Check socket file exists
ls -la /tmp/kumbh.sock
19. Security Considerations
19.1 Private Key Security
NEVER commit private keys to git!

Best practices:

Use environment variables
Use a secrets manager
Restrict file permissions

# Set permissions on config file
chmod 600 ~/.kumbh/config.ts

# Use environment variables
export HL_PRIVATE_KEY="0x..."
19.2 Unix Socket Permissions
The socket file inherits directory permissions:


# Socket is in /tmp which is world-readable
# For more security, put it in a user-only directory:
socketPath: "/home/YOUR_USERNAME/.kumbh/kumbh.sock"
19.3 Strategy Sandboxing
Currently, strategies run in the same process and have full access. Future improvements:

Worker threads: Run each strategy in a separate thread
Subprocess: Run each strategy in a separate process
Resource limits: Limit CPU/memory per strategy
19.4 Rate Limiting
Hyperliquid has rate limits. The SDK handles them, but be aware:

Don't make too many API calls per second
Batch operations when possible
Use WebSocket for real-time data (no rate limit for receiving)
20. Future Considerations
20.1 Planned Features
Remote CLI: Allow CLI to connect to engine over network (TCP sockets)
Log streaming: kumbh logs MyStrategy to stream logs in real-time
Multiple accounts: Support different API keys per strategy
Web dashboard: Optional web UI for monitoring
Alerts: Notify via Telegram/Discord when events occur
20.2 Performance Optimizations
Worker threads: Run strategies in parallel
Shared memory: For high-frequency strategies
Candle caching: Cache historical candles locally
Connection pooling: Reuse HTTP connections
20.3 Additional Trading Features
Order types: Support more order types (stop-loss, take-profit)
Position sizing: Helper functions for risk-based sizing
Portfolio tracking: Cross-strategy portfolio view
Execution reports: Detailed execution quality metrics
20.4 Testing Improvements
Mocked exchange: Full mock of Hyperliquid for testing
Replay testing: Replay historical market conditions
Stress testing: Test with high-frequency data
Fuzzing: Random input testing for robustness
Appendix A: Quick Reference
CLI Commands
Command	Description
kumbh daemon	Start engine
kumbh add <file>	Add strategy
kumbh start <name>	Start strategy
kumbh stop <name>	Stop strategy
kumbh show	Dashboard
kumbh show <name>	Strategy details
kumbh remove <name>	Remove strategy
kumbh reload <name>	Reload code
kumbh backtest <name>	Run backtest
File Locations
File	Path
Config	~/.kumbh/config.ts
Strategies	~/.kumbh/strategies/
Engine DB	~/.kumbh/data/engine.db
Strategy DBs	~/.kumbh/data/<name>.db
Socket	/tmp/kumbh.sock
Environment Variables
Variable	Description
HL_PRIVATE_KEY	Hyperliquid private key
HL_WALLET_ADDRESS	Hyperliquid wallet address
Appendix B: Glossary
Term	Definition
Candle	OHLCV data point (Open, High, Low, Close, Volume)
OHLCV	Open, High, Low, Close, Volume
Timeframe	Candle duration (1m, 1h, 4h, 1d, etc.)
Strategy	Trading algorithm that decides when to buy/sell
Backtest	Testing strategy on historical data
PnL	Profit and Loss
Drawdown	Peak-to-trough decline during trading
Long	Buying, betting price will go up
Short	Selling, betting price will go down
Position	An open trade
Leverage	Borrowed funds to increase position size
Liquidation	Forced closure of position due to losses
Testnet	Test environment with fake money
Mainnet	Real environment with real money
SDK	Software Development Kit
IPC	Inter-Process Communication
Unix Socket	Local-only socket for IPC
Daemon	Background process
CLI	Command Line Interface
Appendix C: Implementation Phases
Phase 1: Core Infrastructure (Week 1)
 Project setup (package.json, tsconfig.json)
 Type definitions
 Config loader
 Engine SQLite schema
 Unix socket server
 Unix socket client
 Basic CLI routing
Phase 2: Strategy System (Week 2)
 Abstract Strategy class
 StrategyContext implementation
 Strategy loader (dynamic import)
 StrategyManager
 Add/remove strategies
Phase 3: Data Pipeline (Week 3)
 SubscriptionManager
 WebSocket connection management
 Candle dispatch to strategies
 Auto-reconnect logic
Phase 4: CLI Commands (Week 4)
 add command
 start command
 stop command
 show command (dashboard)
 remove command
 reload command
Phase 5: Backtesting (Week 5)
 BacktestRunner
 Historical data fetching
 Backtest context (simulated trading)
 Results collection and display
Phase 6: Polish (Week 6)
 Error handling improvements
 Dashboard UI polish
 Documentation
 Example strategies
 Testing
End of Documentation
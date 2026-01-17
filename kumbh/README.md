# kumbh

Strategy Engine for Hyperliquid. For both Backtesting (shows the results from client) and Actual execution engine (takes actul trade on hyperliquid)


Interface:
Terminal only. CLI will display the status and everything. You can start and stop strategies using CLI commands.


Tech Stack:
Linux (mandatory due to architecural choices), Typescript, Bun (DO NOT USE NODE.JS), Hyperliquid SDK, A good CLI Library to show different things in terminal and A good logging thing (sqlite or something to track everthing happening) 


Hard Things:
- every decision you will make, will eventually become techdebt. Think wisely before adding code that is not necessary and will only create headaches for the futures
- No loose types. End to end typscript required.
- Make everything on engine side optimise for performace. 
- Make everthing on cli side optimised for better user experiecce. (Needs to look pretty, even if it is some milliseconds slower)

## Description

Kuber is god of wealth and Kumbh represnets the utensil which has infinite gold coins in it. The name represents an engine that generates wealth on hyperliquid based on the strategies provided.


The engine is solely responsible for running the strategies not implementing them.
Bring your own strategies.


Engine uses `@nktkas/hyperliquid` sdk to talk to hyperliquid, fetch prices and execute trades.

Engine has a strategy abstract class that user need to implement according to their strategy.


Engine is implemented as a background runner inspired by pm2. How PM2 manages the long running process, re-runs them if they crashes, and shows status and other valuable information.
Engine is a process running in background. There is client implementation that will talk to engine to add strategies, start/stop strategies and show status.


Engine has 2 functions
```
engine.add(stragey class implementation);
```

internally it uses datastructure along these lines
```ts
map<timeframes, vec<strategies>> all_strategies.
map<timeframes, vec<strategies>> active_strategies.
```
Engine has few websockets open to listen for the incoming OHLCV data on different timeframe, all defined in `timeframe.ts` file

Engine recieves the OHLCV candle data, it dispatches the candle data as event to relevant strategy. The strategy code that can handle that data and open/close the position.

Important: Engine does never open/closes the position. Engine doesn't even know about the active trades. it is the sole resposibility of the strategy to track and manage the positions.

Engine is basically 1. Fetches the latest candle data, 2. Manages different stragegies (add, start, stop, status, etc)

When someone starts strategy, it will be putted into the all_stragey map.
Remved when someone removes the strategy.
added to active_strategy when someone starts and removed when someone stops the strategy.


How do I add strategy?

remember I told you about the engine client? Yes we will call it CLI

Engine is the main thing that is running the strategies and managing them. Stratgies are running in their own separate threads/coroutines, without any knowledge of other stratgies. 


Engine CLI talks to the main running Engine via linux native sockets. just like how docker client and docker daemon talks to each other. I can specify and socket locally or in the same network so I can run the engine on my server and run the client on my computer with giving the socket address of the server.

API I am looking for 

```
cli add strategy_impl.ts (all the metadata and everything will be defined in the class itself)
cli show (Prints all the strategy metadata)
cli start "strat_name" (match from the metadata)
cli stop "strat_name" (match from the metadata)
cli show "strat_name" (print specific status of the stratgy.)
cli remove "strat_name" (print specific status of the stratgy.)

cli backtest "strat_name" .... (variable params that that strategy expects for backtesting)

//// add whatever you think necessary for a better user experience


```

Important thing to remember. When I say I print the status of the stragies, Server prints the strategy status ie, metadata and whether it is running or not.

When I say show status of a specific strategy, it means engine will call a function in the stragey class called status() or something and stragy class will be responsible for showing to the CLI.



# Claude Design Questions

Questions to Refine Your Design
1. Strategy Lifecycle & State
Q1.1: When the engine restarts (e.g., server reboot), should strategies automatically resume their previous state? This would require persisting:

Which strategies were active
Each strategy's internal state (open positions, pending orders, etc.)


ANS: Need to store all the things. When a strategy becomes active or stops etc. We will use bun's built in sqlite support for this.


Q1.2: How should the engine handle strategy crashes? Options:

Auto-restart with exponential backoff
Mark as failed and notify (require manual restart)

Both (configurable per strategy)


ANS: Auto restart


2. Strategy Implementation Details
Q2.1: You mentioned strategies manage their own positions. How should a strategy track positions across restarts? Should the engine provide a persistence layer (SQLite) that strategies can use, or should each strategy handle its own persistence?

ANS: Persistance per strategy.Every strategy implements it's own persistence in a separate sqlite db for that strategy. essentially making it a db per strategy.



Q2.2: Should strategies be able to listen to multiple timeframes simultaneously (e.g., use 1h for trend and 5m for entry), or strictly one timeframe per strategy instance?

They need to register and maintain inner state for that. Upto strategy implementor. No restriction from the engine.



Q2.3: For the cli add strategy_impl.ts command - are you dynamically loading TypeScript files at runtime? This has implications:

Bun can do this, but it means the strategy file must exist on the engine's filesystem, not just the CLI's
Alternative: compile strategies as plugins or require them to be bundled with the engine


ANS: Is is possible that when I do cli add .ts file, it copies to the engine's directory in /strategies/ folder and then runs it. If I run the same command again but with modified strategy.ts with the same name, it will simply overwrite the strategy file on the engine directory.



3. Backtesting Architecture
Q3.1: Should backtesting run in the same engine process or as a separate isolated process? Running separately prevents backtest bugs from affecting live trading.

ANS: No, the same instace will run the backtest. backtest never opens the trade and if it does, that is fault of the strategy not the engine.



Q3.2: For backtesting, where does historical OHLCV data come from?



Fetch from Hyperliquid API on-demand
Pre-downloaded and stored locally (faster, works offline)
Both options

ANS: Fetch from hyperliduid SDK functions

Q3.3: Should backtest results include:

Just P&L summary
Full trade log
Equity curve data for visualization
All of the above


ALL of above, that can be supported in terminal

4. Multi-Asset Support
Q4.1: Can a single strategy trade multiple symbols (e.g., BTC and ETH), or is it one symbol per strategy instance?


ANS: Doesn't matter to the engine. Srategy can do whatever it wants. Engine will provide the data 

Q4.2: How should the engine handle symbol subscription? Should it:

Subscribe to all available symbols always
Only subscribe to symbols that active strategies need (more efficient)

ANS: only subscribed things


5. CLI & Monitoring
Q5.1: For cli show, what's the expected output format?

Simple table
Live-updating dashboard (like htop)
Both (default table, flag for live mode)


HTOP like thing


Q5.2: Should there be a log streaming command like cli logs "strat_name" to see real-time strategy output?

For now no


Q5.3: Should the CLI support remote connections from day one, or start with local-only Unix sockets and add TCP later?


Local only for now


6. Risk & Safety
Q6.1: Should the engine have any global risk controls? Examples:

Max total positions across all strategies
Daily loss limit (stop all strategies if hit)
Or leave all risk management to individual strategies?

ANS: leave all risk management to individual strategies



Q6.2: Should there be a paper trading mode where everything works but orders aren't actually submitted?

YES a flag for testnet or mainnet

7. Configuration
Q7.1: Where should engine configuration live?

Config file (e.g., ~/.kumbh/config.toml)
Environment variables
CLI flags
Combination

I prefer the file, it is obvious for that reason


Q7.2: How should API keys be handled? The Hyperliquid SDK needs credentials. Should:

Each strategy have its own keys (multi-account support)
Engine has one set of keys shared by all strategies
Both options supported

ANS: Engine has one set of keys shared by all strategies
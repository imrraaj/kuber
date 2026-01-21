import { useStore } from '@/store';
import { Panel } from '@/components/layout/Panel';

export function StrategyDetail() {
  const { strategies, selectedStrategy, startStrategy, stopStrategy, reloadStrategy } = useStore();

  const strategy = selectedStrategy ? strategies.get(selectedStrategy) : null;

  if (!strategy) {
    return (
      <Panel title="Strategy" className="h-full">
        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
          Select a strategy to view details
        </div>
      </Panel>
    );
  }

  const status = strategy.status;

  return (
    <Panel
      title={`Strategy: ${strategy.name}`}
      className="h-full"
      actions={
        <div className="flex items-center gap-2">
          {strategy.isActive ? (
            <button
              className="btn btn-danger text-[10px] px-2 py-1"
              onClick={() => stopStrategy(strategy.name)}
            >
              Stop
            </button>
          ) : (
            <>
              <button
                className="btn btn-success text-[10px] px-2 py-1"
                onClick={() => startStrategy(strategy.name)}
              >
                Start
              </button>
              <button
                className="btn btn-ghost text-[10px] px-2 py-1"
                onClick={() => reloadStrategy(strategy.name)}
              >
                Reload
              </button>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              strategy.isActive
                ? 'bg-profit/20 text-profit'
                : 'bg-gray-700 text-gray-400'
            }`}
          >
            {strategy.isActive ? 'RUNNING' : 'STOPPED'}
          </span>
          {strategy.errorCount > 0 && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-loss/20 text-loss">
              {strategy.errorCount} errors
            </span>
          )}
        </div>

        {/* Live Price & Signal - Prominent Display */}
        {status?.custom && (
          <div className="bg-terminal-bg border border-terminal-border rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Last Price */}
              <div className="text-center">
                <div className="text-gray-500 text-xs uppercase mb-1">Last Price</div>
                <div className="text-2xl font-bold font-mono text-accent">
                  {status.custom.lastPrice
                    ? `$${Number(status.custom.lastPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '-'}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                  {status.custom.lastCandleTime
                    ? new Date(Number(status.custom.lastCandleTime)).toLocaleTimeString()
                    : '-'}
                </div>
              </div>
              {/* Signal */}
              <div className="text-center">
                <div className="text-gray-500 text-xs uppercase mb-1">Signal</div>
                <div className={`text-xl font-bold font-mono ${
                  String(status.custom.lastSignal || '').includes('LONG') || String(status.custom.lastSignal || '').includes('BUY')
                    ? 'text-profit'
                    : String(status.custom.lastSignal || '').includes('SELL') || String(status.custom.lastSignal || '').includes('CLOSED')
                    ? 'text-loss'
                    : String(status.custom.lastSignal || '').includes('WARMING')
                    ? 'text-warning'
                    : 'text-gray-400'
                }`}>
                  {status.custom.lastSignal || 'NONE'}
                </div>
                <div className={`text-[10px] mt-1 ${
                  status.custom.direction === 'UP' ? 'text-profit' : 'text-loss'
                }`}>
                  Trend: {status.custom.direction || '-'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* P&L */}
        {status && (
          <div className="space-y-1">
            <div className="text-gray-500 text-xs uppercase">P&L</div>
            <div
              className={`text-3xl font-bold font-mono ${
                status.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'
              }`}
            >
              {status.pnl >= 0 ? '+' : ''}${status.pnl.toFixed(2)}
            </div>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-gray-500 text-xs uppercase mb-1">Positions</div>
            <div className="text-lg font-mono">{status?.positionCount ?? 0}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase mb-1">Symbols</div>
            <div className="text-sm font-mono text-accent">
              {strategy.symbols.join(', ')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase mb-1">Timeframes</div>
            <div className="text-sm font-mono">{strategy.timeframes.join(', ')}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase mb-1">Last Candle</div>
            <div className="text-sm font-mono">
              {strategy.lastCandleAt
                ? new Date(strategy.lastCandleAt).toLocaleTimeString()
                : '-'}
            </div>
          </div>
        </div>

        {/* Custom metrics (excluding already displayed fields) */}
        {status?.custom && Object.keys(status.custom).length > 0 && (
          <div>
            <div className="text-gray-500 text-xs uppercase mb-2">Strategy Metrics</div>
            <div className="space-y-1">
              {Object.entries(status.custom)
                .filter(([key]) => !['lastPrice', 'lastCandleTime', 'lastSignal', 'direction'].includes(key))
                .map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-gray-400">{key}</span>
                  <span className="font-mono">
                    {typeof value === 'number' ? value.toFixed(2) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last error */}
        {strategy.lastError && (
          <div>
            <div className="text-gray-500 text-xs uppercase mb-1">Last Error</div>
            <div className="text-sm text-loss font-mono bg-loss/10 p-2 rounded">
              {strategy.lastError}
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <div className="text-gray-500 text-xs uppercase mb-1">Description</div>
          <div className="text-sm text-gray-400">{strategy.description}</div>
        </div>
      </div>
    </Panel>
  );
}

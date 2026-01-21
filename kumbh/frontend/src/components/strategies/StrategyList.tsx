import { useStore } from '@/store';
import { Panel } from '@/components/layout/Panel';

export function StrategyList() {
  const { strategies, selectedStrategy, selectStrategy, startStrategy, stopStrategy } = useStore();

  const strategiesList = Array.from(strategies.values());

  return (
    <Panel title="Strategies" className="h-full">
      {strategiesList.length === 0 ? (
        <div className="text-gray-500 text-sm">No strategies loaded</div>
      ) : (
        <div className="space-y-1">
          {strategiesList.map((strategy) => (
            <div
              key={strategy.name}
              className={`p-2 rounded cursor-pointer transition-colors ${
                selectedStrategy === strategy.name
                  ? 'bg-accent/10 border border-accent/30'
                  : 'hover:bg-terminal-hover'
              }`}
              onClick={() => selectStrategy(strategy.name)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`status-dot ${
                      strategy.isActive ? 'status-dot-active' : 'status-dot-inactive'
                    }`}
                  />
                  <span className="text-sm font-medium truncate">{strategy.name}</span>
                </div>
                {strategy.status && (
                  <span
                    className={`text-xs font-mono ${
                      strategy.status.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'
                    }`}
                  >
                    {strategy.status.pnl >= 0 ? '+' : ''}
                    {strategy.status.pnl.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions for selected strategy */}
      {selectedStrategy && (
        <div className="mt-4 pt-4 border-t border-terminal-border space-y-2">
          {strategies.get(selectedStrategy)?.isActive ? (
            <button
              className="btn btn-danger w-full"
              onClick={() => stopStrategy(selectedStrategy)}
            >
              Stop
            </button>
          ) : (
            <button
              className="btn btn-success w-full"
              onClick={() => startStrategy(selectedStrategy)}
            >
              Start
            </button>
          )}
        </div>
      )}
    </Panel>
  );
}

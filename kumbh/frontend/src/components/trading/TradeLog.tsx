import { useEffect } from 'react';
import { useStore } from '@/store';
import { Panel } from '@/components/layout/Panel';

export function TradeLog() {
  const { selectedStrategy, trades, fetchTrades } = useStore();

  const strategyTrades = selectedStrategy ? trades.get(selectedStrategy) || [] : [];

  // Fetch trades when strategy changes
  useEffect(() => {
    if (selectedStrategy) {
      fetchTrades(selectedStrategy);
    }
  }, [selectedStrategy, fetchTrades]);

  return (
    <Panel title="Trades" className="h-full">
      {!selectedStrategy ? (
        <div className="text-gray-500 text-sm">Select a strategy</div>
      ) : strategyTrades.length === 0 ? (
        <div className="text-gray-500 text-sm">No trades yet</div>
      ) : (
        <div className="space-y-0.5 text-xs font-mono">
          {/* Header */}
          <div className="grid grid-cols-6 gap-2 text-gray-500 pb-1 border-b border-terminal-border mb-1">
            <span>Time</span>
            <span>Side</span>
            <span>Symbol</span>
            <span className="text-right">Size</span>
            <span className="text-right">Price</span>
            <span className="text-right">P&L</span>
          </div>

          {/* Trades */}
          {strategyTrades.map((trade, i) => (
            <div
              key={trade.id || i}
              className="grid grid-cols-6 gap-2 py-1 hover:bg-terminal-hover rounded"
            >
              <span className="text-gray-400">
                {new Date(trade.timestamp).toLocaleTimeString()}
              </span>
              <span className={trade.side === 'long' ? 'trade-long' : 'trade-short'}>
                {trade.side === 'long' ? 'BUY' : 'SELL'}
              </span>
              <span>{trade.symbol}</span>
              <span className="text-right">{trade.size}</span>
              <span className="text-right">${trade.price.toLocaleString()}</span>
              <span
                className={`text-right ${
                  trade.pnl !== null
                    ? trade.pnl >= 0
                      ? 'pnl-positive'
                      : 'pnl-negative'
                    : 'text-gray-500'
                }`}
              >
                {trade.pnl !== null
                  ? `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}`
                  : '-'}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

import { useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useStore } from '@/store';
import { api } from '@/api/client';
import { Header } from '@/components/layout/Header';
import { StrategyList } from '@/components/strategies/StrategyList';
import { StrategyDetail } from '@/components/strategies/StrategyDetail';
import { TradeLog } from '@/components/trading/TradeLog';
import { LogViewer } from '@/components/logs/LogViewer';

function App() {
  // Initialize WebSocket connection
  useWebSocket();

  const { setEngineStatus, strategies, selectStrategy, selectedStrategy } = useStore();

  // Fetch engine status on mount
  useEffect(() => {
    api.status().then(setEngineStatus).catch(console.error);
  }, [setEngineStatus]);

  // Auto-select first strategy if none selected
  useEffect(() => {
    if (!selectedStrategy && strategies.size > 0) {
      const first = Array.from(strategies.keys())[0];
      selectStrategy(first);
    }
  }, [strategies, selectedStrategy, selectStrategy]);

  return (
    <div className="h-screen flex flex-col bg-terminal-bg">
      {/* Header */}
      <Header />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden p-2 gap-2">
        {/* Left sidebar - Strategy list */}
        <div className="w-56 shrink-0">
          <StrategyList />
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          {/* Top row - Strategy detail */}
          <div className="h-64 shrink-0">
            <StrategyDetail />
          </div>

          {/* Middle row - Trades */}
          <div className="h-48 shrink-0">
            <TradeLog />
          </div>

          {/* Bottom row - Logs (takes remaining space) */}
          <div className="flex-1 min-h-0 relative">
            <LogViewer />
          </div>
        </div>
      </div>

      {/* Footer status bar */}
      <footer className="h-6 bg-terminal-panel border-t border-terminal-border flex items-center px-4 text-[10px] text-gray-500">
        <span>Kumbh Terminal v0.1.0</span>
        <span className="mx-2">|</span>
        <span>Press F5 to refresh</span>
      </footer>
    </div>
  );
}

export default App;

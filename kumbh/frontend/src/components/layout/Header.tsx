import { useStore } from '@/store';

export function Header() {
  const { connected, strategies, engineStatus } = useStore();

  const totalStrategies = strategies.size;
  const activeStrategies = Array.from(strategies.values()).filter(s => s.isActive).length;

  return (
    <header className="h-10 bg-terminal-panel border-b border-terminal-border flex items-center justify-between px-4">
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <span className="text-accent font-bold tracking-wider">KUMBH</span>
        <span className="text-gray-500 text-xs">TERMINAL</span>
      </div>

      {/* Right: Status */}
      <div className="flex items-center gap-6 text-xs">
        {/* Network */}
        {engineStatus && (
          <div className="flex items-center gap-2">
            <span className={engineStatus.network === 'testnet' ? 'text-warning' : 'text-profit'}>
              {engineStatus.network.toUpperCase()}
            </span>
          </div>
        )}

        {/* Strategy counts */}
        <div className="flex items-center gap-2 text-gray-400">
          <span>{totalStrategies} strategies</span>
          <span className="text-gray-600">|</span>
          <span className="text-profit">{activeStrategies} active</span>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2">
          <div className={`status-dot ${connected ? 'status-dot-active' : 'bg-loss'}`} />
          <span className={connected ? 'text-gray-400' : 'text-loss'}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
    </header>
  );
}

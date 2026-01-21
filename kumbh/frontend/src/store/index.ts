import { create } from 'zustand';
import type { Strategy, LogEntry, Trade, StatusResponse } from '@/types';
import { api } from '@/api/client';

interface AppState {
  // Connection state
  connected: boolean;
  setConnected: (connected: boolean) => void;

  // Engine status
  engineStatus: StatusResponse | null;
  setEngineStatus: (status: StatusResponse | null) => void;

  // Strategies
  strategies: Map<string, Strategy>;
  setStrategies: (strategies: Strategy[]) => void;
  updateStrategy: (name: string, updates: Partial<Strategy>) => void;
  removeStrategy: (name: string) => void;

  // Selected strategy
  selectedStrategy: string | null;
  selectStrategy: (name: string | null) => void;

  // Logs (per strategy)
  logs: Map<string, LogEntry[]>;
  addLog: (strategyName: string, log: LogEntry) => void;
  setLogs: (strategyName: string, logs: LogEntry[]) => void;

  // Trades (per strategy)
  trades: Map<string, Trade[]>;
  setTrades: (strategyName: string, trades: Trade[]) => void;
  addTrade: (strategyName: string, trade: Trade) => void;

  // Actions
  startStrategy: (name: string) => Promise<void>;
  stopStrategy: (name: string) => Promise<void>;
  reloadStrategy: (name: string) => Promise<void>;
  fetchTrades: (name: string) => Promise<void>;
  fetchLogs: (name: string) => Promise<void>;
}

const MAX_LOGS_PER_STRATEGY = 500;

export const useStore = create<AppState>((set, get) => ({
  // Connection
  connected: false,
  setConnected: (connected) => set({ connected }),

  // Engine status
  engineStatus: null,
  setEngineStatus: (engineStatus) => set({ engineStatus }),

  // Strategies
  strategies: new Map(),
  setStrategies: (strategies) => {
    const map = new Map<string, Strategy>();
    for (const s of strategies) {
      map.set(s.name, s);
    }
    set({ strategies: map });
  },
  updateStrategy: (name, updates) => {
    const strategies = new Map(get().strategies);
    const existing = strategies.get(name);
    if (existing) {
      strategies.set(name, { ...existing, ...updates });
      set({ strategies });
    }
  },
  removeStrategy: (name) => {
    const strategies = new Map(get().strategies);
    strategies.delete(name);
    set({ strategies });
  },

  // Selected strategy
  selectedStrategy: null,
  selectStrategy: (name) => set({ selectedStrategy: name }),

  // Logs
  logs: new Map(),
  addLog: (strategyName, log) => {
    const logs = new Map(get().logs);
    const existing = logs.get(strategyName) || [];
    const updated = [...existing, log].slice(-MAX_LOGS_PER_STRATEGY);
    logs.set(strategyName, updated);
    set({ logs });
  },
  setLogs: (strategyName, newLogs) => {
    const logs = new Map(get().logs);
    logs.set(strategyName, newLogs.slice(-MAX_LOGS_PER_STRATEGY));
    set({ logs });
  },

  // Trades
  trades: new Map(),
  setTrades: (strategyName, newTrades) => {
    const trades = new Map(get().trades);
    trades.set(strategyName, newTrades);
    set({ trades });
  },
  addTrade: (strategyName, trade) => {
    const trades = new Map(get().trades);
    const existing = trades.get(strategyName) || [];
    trades.set(strategyName, [trade, ...existing].slice(0, 100));
    set({ trades });
  },

  // Actions
  startStrategy: async (name) => {
    await api.startStrategy(name);
  },
  stopStrategy: async (name) => {
    await api.stopStrategy(name);
  },
  reloadStrategy: async (name) => {
    await api.reloadStrategy(name);
  },
  fetchTrades: async (name) => {
    const trades = await api.getTrades(name);
    get().setTrades(name, trades);
  },
  fetchLogs: async (name) => {
    const logs = await api.getLogs(name);
    get().setLogs(name, logs);
  },
}));

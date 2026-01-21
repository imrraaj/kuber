import type { Strategy, Trade, LogEntry, HealthResponse, StatusResponse } from '@/types';

const API_BASE = '/api';

/**
 * API client for Kumbh backend
 */
export const api = {
  // Health & Status
  async health(): Promise<HealthResponse> {
    const res = await fetch('/health');
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  async status(): Promise<StatusResponse> {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error('Status check failed');
    return res.json();
  },

  // Strategies
  async listStrategies(): Promise<Strategy[]> {
    const res = await fetch(`${API_BASE}/strategies`);
    if (!res.ok) throw new Error('Failed to list strategies');
    return res.json();
  },

  async getStrategy(name: string): Promise<Strategy> {
    const res = await fetch(`${API_BASE}/strategies/${encodeURIComponent(name)}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to get strategy');
    }
    return res.json();
  },

  async addStrategy(path: string): Promise<{ success: boolean; name: string }> {
    const res = await fetch(`${API_BASE}/strategies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add strategy');
    }
    return res.json();
  },

  async startStrategy(name: string): Promise<void> {
    const res = await fetch(`${API_BASE}/strategies/${encodeURIComponent(name)}/start`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to start strategy');
    }
  },

  async stopStrategy(name: string): Promise<void> {
    const res = await fetch(`${API_BASE}/strategies/${encodeURIComponent(name)}/stop`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to stop strategy');
    }
  },

  async reloadStrategy(name: string): Promise<void> {
    const res = await fetch(`${API_BASE}/strategies/${encodeURIComponent(name)}/reload`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to reload strategy');
    }
  },

  async removeStrategy(name: string): Promise<void> {
    const res = await fetch(`${API_BASE}/strategies/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to remove strategy');
    }
  },

  // Trades
  async getTrades(strategyName: string, limit = 50): Promise<Trade[]> {
    const res = await fetch(
      `${API_BASE}/strategies/${encodeURIComponent(strategyName)}/trades?limit=${limit}`
    );
    if (!res.ok) return [];
    return res.json();
  },

  // Logs
  async getLogs(strategyName: string, limit = 100): Promise<LogEntry[]> {
    const res = await fetch(
      `${API_BASE}/strategies/${encodeURIComponent(strategyName)}/logs?limit=${limit}`
    );
    if (!res.ok) return [];
    return res.json();
  },

  async getAllLogs(limit = 100): Promise<LogEntry[]> {
    const res = await fetch(`${API_BASE}/logs?limit=${limit}`);
    if (!res.ok) return [];
    return res.json();
  },
};

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store';
import type { WSServerMessage } from '@/types';

const WS_URL = `ws://${window.location.host}/ws`;
const RECONNECT_DELAY = 3000;
const PING_INTERVAL = 30000;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const {
    setConnected,
    setStrategies,
    updateStrategy,
    addLog,
  } = useStore();

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WSServerMessage = JSON.parse(event.data);
      console.log('[WebSocket] Received message:', message.type, message);

      switch (message.type) {
        case 'initial_state':
          console.log('[WebSocket] Setting initial strategies:', message.payload);
          setStrategies(message.payload);
          break;

        case 'strategy_update':
          console.log('[WebSocket] Strategy update:', message.payload.name, message.payload);
          updateStrategy(message.payload.name, {
            isActive: message.payload.isActive,
            status: message.payload.status,
          });
          break;

        case 'strategy_log':
          console.log('[WebSocket] Log received:', message.payload.name, message.payload.log);
          addLog(message.payload.name, message.payload.log);
          break;

        case 'error':
          console.error('WebSocket error:', message.payload.message);
          break;

        case 'pong':
          // Heartbeat response, connection is alive
          break;
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  }, [setStrategies, updateStrategy, addLog]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);

      // Start ping interval
      pingIntervalRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);

      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Schedule reconnect
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, RECONNECT_DELAY);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;
  }, [handleMessage, setConnected]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    connected: wsRef.current?.readyState === WebSocket.OPEN,
    reconnect: connect,
  };
}

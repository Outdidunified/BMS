import { useEffect, useRef, useState } from "react";

export type LiveMessage = {
  type?: string; // 'hello' | 'live'
  aggregated?: boolean;
  data?: any; // backend payload
  ts?: number;
};

interface UseDeviceWebSocketOptions {
  url?: string; // default to ws://192.168.1.8:8070
  onMessage?: (msg: LiveMessage) => void;
  reconnect?: boolean;
  reconnectDelayMs?: number;
}

// Reusable WebSocket hook for backend live frames
export function useDeviceWebSocket(options: UseDeviceWebSocketOptions = {}) {
  const {
    url = "ws://192.168.1.8:8070",
    onMessage,
    reconnect = true,
    reconnectDelayMs = 2000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<LiveMessage | null>(null);
  const reconnectTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => setConnected(true);
        ws.onclose = () => {
          setConnected(false);
          wsRef.current = null;
          if (reconnect && !cancelled) {
            if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
            reconnectTimer.current = window.setTimeout(connect, reconnectDelayMs);
          }
        };
        ws.onerror = () => {
          // allow reconnect flow to handle
        };
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data) as LiveMessage;
            setLastMessage(msg);
            onMessage?.(msg);
          } catch {
            // ignore malformed frames
          }
        };
      } catch {
        // swallow and retry
        if (reconnect && !cancelled) {
          if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
          reconnectTimer.current = window.setTimeout(connect, reconnectDelayMs);
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        try { wsRef.current.close(); } catch {}
      }
      wsRef.current = null;
    };
  }, [url, reconnect, reconnectDelayMs, onMessage]);

  const send = (data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === "string" ? data : JSON.stringify(data));
    }
  };

  return { connected, lastMessage, send };
}
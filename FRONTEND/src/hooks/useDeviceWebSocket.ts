import { useEffect, useRef, useState } from "react";

export type LiveMessage = {
  type?: string; // 'hello' | 'live'
  aggregated?: boolean;
  data?: any; // backend payload
  ts?: number;
};

interface UseDeviceWebSocketOptions {
  url?: string; // default to ws://192.168.0.35:8070
  onMessage?: (msg: LiveMessage) => void;
  reconnect?: boolean;
  reconnectDelayMs?: number;
  key?: string; // key to force reconnect when changed
}

// Reusable WebSocket hook for backend live frames
export function useDeviceWebSocket(options: UseDeviceWebSocketOptions = {}) {
  const {
    url,
    onMessage,
    reconnect = true,
    reconnectDelayMs = 2000,
    key,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<LiveMessage | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const messageQueue = useRef<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      messageQueue.current = []; // Clear queue for new connection
      try {
        let finalUrl = url || "ws://localhost:8071";
        if (finalUrl.startsWith("/")) {
          const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
          finalUrl = `${protocol}//${window.location.host}${finalUrl}`;
        }
        const ws = new WebSocket(finalUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          // Send queued messages
          while (messageQueue.current.length > 0) {
            const msg = messageQueue.current.shift();
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(typeof msg === "string" ? msg : JSON.stringify(msg));
              console.log('Sent queued WS message');
            }
          }
        };
        ws.onclose = (event) => {
          console.log('WebSocket closed', event.code, event.reason);
          setConnected(false);
          wsRef.current = null;
          if (reconnect && !cancelled) {
            if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
            reconnectTimer.current = window.setTimeout(connect, reconnectDelayMs);
          }
        };
        ws.onerror = (event) => {
          console.log('WebSocket error', event);
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
  }, [url, reconnect, reconnectDelayMs, onMessage, key]);

  const send = (data: any) => {
    console.log('Sending WS message:', data);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === "string" ? data : JSON.stringify(data));
      console.log('Sent WS message');
    } else {
      console.log('WS not open, queueing message, readyState:', wsRef.current?.readyState);
      messageQueue.current.push(data);
    }
  };

  return { connected, lastMessage, send };
}
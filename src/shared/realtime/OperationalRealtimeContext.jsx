import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { buildOperationalWsUrl } from './buildOperationalWsUrl';
import {
  OPERATIONAL_WS_CLOSE_TOKEN_REJECTED,
  OPERATIONAL_WS_PROTOCOL_VERSION,
  OPERATIONAL_WS_TOKEN_REJECTED_EVENT,
} from './operationalWsConstants';

const WS_RECONNECT_BASE_MS = 1000;
const WS_RECONNECT_MAX_MS = 30000;

const OperationalRealtimeContext = createContext({
  connected: false,
  subscribe: () => () => {},
});

const sendPong = (ws) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(
      JSON.stringify({
        event: 'pong',
        protocol_version: OPERATIONAL_WS_PROTOCOL_VERSION,
      }),
    );
  } catch {
    /* ignore */
  }
};

const dispatchMessage = (ws, listenersRef, msg, onConnected) => {
  const pv = msg?.protocol_version;
  if (pv != null && pv !== OPERATIONAL_WS_PROTOCOL_VERSION && process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.warn(
      '[WS operational] protocol_version',
      pv,
      '≠ ожидаемого',
      OPERATIONAL_WS_PROTOCOL_VERSION,
      '— при смене мажорной логики обновите клиент или делайте полный REST refetch.',
    );
  }

  const ev = String(msg?.event ?? '').toLowerCase();
  if (ev === 'ping') {
    sendPong(ws);
    return;
  }
  if (ev === 'pong') {
    return;
  }
  if (ev === 'connected') {
    if (typeof onConnected === 'function') onConnected();
    return;
  }

  const evKind = String(msg?.event ?? msg?.action ?? '').toLowerCase();
  const isChange =
    evKind === 'change'
    || evKind === 'changed'
    || evKind === 'created'
    || evKind === 'updated'
    || evKind === 'deleted';
  if (!isChange) return;
  const normalized = { ...msg, event: 'change' };
  listenersRef.current.forEach((fn) => {
    try {
      fn(normalized);
    } catch {
      /* ignore subscriber errors */
    }
  });
};

/**
 * Один канал `/ws/operational/?token=…` — кадры `connected` и `change` (см. `docs/WEBSOCKET_API.md`).
 * @param {{ children: React.ReactNode, active: boolean, sessionKey?: string }} props
 */
export function OperationalRealtimeProvider({ children, active, sessionKey = '' }) {
  const listenersRef = useRef(new Set());
  const wsRef = useRef(null);
  const [connected, setConnected] = React.useState(false);

  const subscribe = useCallback((fn) => {
    if (typeof fn !== 'function') return () => {};
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  }, []);

  useEffect(() => {
    if (!active) {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          /* ignore */
        }
        wsRef.current = null;
      }
      setConnected(false);
      return undefined;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setConnected(false);
      return undefined;
    }

    const url = buildOperationalWsUrl(token);
    let closed = false;
    let retryAttempt = 0;
    let retryTimer = null;

    const clearRetry = () => {
      if (retryTimer != null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (closed) return;
      clearRetry();
      const delay = Math.min(WS_RECONNECT_MAX_MS, WS_RECONNECT_BASE_MS * 2 ** retryAttempt);
      retryAttempt += 1;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (closed) return;
      clearRetry();

      let ws;
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (closed) return;
        retryAttempt = 0;
      };

      ws.onclose = (ev) => {
        if (wsRef.current === ws) wsRef.current = null;
        if (!closed && ev?.code === OPERATIONAL_WS_CLOSE_TOKEN_REJECTED) {
          window.dispatchEvent(new CustomEvent(OPERATIONAL_WS_TOKEN_REJECTED_EVENT));
          closed = true;
          clearRetry();
          setConnected(false);
          return;
        }
        if (!closed) setConnected(false);
        if (!closed) scheduleReconnect();
      };

      ws.onerror = () => {
        if (!closed) setConnected(false);
      };

      ws.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        dispatchMessage(ws, listenersRef, msg, () => {
          if (!closed) setConnected(true);
        });
      };
    };

    connect();

    return () => {
      closed = true;
      clearRetry();
      const ws = wsRef.current;
      if (ws) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        if (wsRef.current === ws) wsRef.current = null;
      }
      setConnected(false);
    };
  }, [active, sessionKey]);

  const value = useMemo(() => ({ connected, subscribe }), [connected, subscribe]);

  return (
    <OperationalRealtimeContext.Provider value={value}>{children}</OperationalRealtimeContext.Provider>
  );
}

export function useOperationalRealtime() {
  return useContext(OperationalRealtimeContext);
}

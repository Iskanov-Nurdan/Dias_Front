import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { buildOperationalWsUrl } from './buildOperationalWsUrl';
import {
  OPERATIONAL_WS_CLOSE_TOKEN_REJECTED,
  OPERATIONAL_WS_PROTOCOL_VERSION,
  OPERATIONAL_WS_TOKEN_REJECTED_EVENT,
} from './operationalWsConstants';

const OperationalRealtimeContext = createContext({
  connected: false,
  subscribe: () => () => {},
});

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
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!closed) setConnected(true);
    };

    ws.onclose = (ev) => {
      if (!closed && ev?.code === OPERATIONAL_WS_CLOSE_TOKEN_REJECTED) {
        window.dispatchEvent(new CustomEvent(OPERATIONAL_WS_TOKEN_REJECTED_EVENT));
      }
      if (!closed) setConnected(false);
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
      if (msg?.event === 'connected') {
        return;
      }
      if (msg?.event !== 'change') return;
      listenersRef.current.forEach((fn) => {
        try {
          fn(msg);
        } catch {
          /* ignore subscriber errors */
        }
      });
    };

    return () => {
      closed = true;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      if (wsRef.current === ws) wsRef.current = null;
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

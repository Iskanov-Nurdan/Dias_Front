import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import Toast from '../../shared/ui/Toast';

const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) return { show: () => {}, success: () => {}, error: () => {} };
  return ctx;
};

const DEFAULT_DURATION = 4000;

export const ToastProvider = ({ children }) => {
  const [items, setItems] = useState([]);

  const show = useCallback((message, type = 'info', duration = DEFAULT_DURATION) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, type, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const success = useCallback((message, duration = DEFAULT_DURATION) => {
    show(message, 'success', duration);
  }, [show]);

  const error = useCallback((message, duration = DEFAULT_DURATION) => {
    show(message, 'error', duration);
  }, [show]);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ show, success, error }), [show, success, error]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" aria-live="polite">
        {items.map((t) => (
          <Toast key={t.id} id={t.id} message={t.message} type={t.type} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

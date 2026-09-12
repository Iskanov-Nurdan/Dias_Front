import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import Toast from '../../shared/ui/Toast';

const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) return { show: () => {}, success: () => {}, error: () => {}, withUndo: () => {} };
  return ctx;
};

const DEFAULT_DURATION = 4000;

export const ToastProvider = ({ children }) => {
  const [items, setItems] = useState([]);

  const show = useCallback((message, type = 'info', duration = DEFAULT_DURATION, extra = {}) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, type, duration, ...extra }]);
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

  /**
   * Тост с кнопкой действия и обратным отсчётом — для отменяемых операций.
   * onExpire срабатывает, если пользователь не нажал «Отменить»: именно там
   * выполняется само действие (удаление уходит на сервер только после паузы).
   */
  const withUndo = useCallback((message, { actionLabel = 'Отменить', onUndo, onExpire, duration = 6000 }) => {
    const id = Date.now() + Math.random();
    let undone = false;
    setItems((prev) => [...prev, {
      id,
      message,
      type: 'info',
      duration,
      actionLabel,
      onAction: () => { undone = true; onUndo?.(); },
    }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
      if (!undone) onExpire?.();
    }, duration);
    return id;
  }, []);

  const value = useMemo(() => ({ show, success, error, withUndo }), [show, success, error, withUndo]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" aria-live="polite">
        {items.map((t) => (
          <Toast
            key={t.id}
            id={t.id}
            message={t.message}
            type={t.type}
            actionLabel={t.actionLabel}
            onAction={t.onAction}
            onClose={() => remove(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

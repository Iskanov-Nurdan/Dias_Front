import React, { createContext, useContext, useState, useCallback } from 'react';
import { getErrorPayloadMessage } from '../../lib/apiError';
import './Toast.scss';

const formatToastMessage = (message) => {
  if (typeof message === 'string') return message;
  if (message == null || message === '') return 'Готово';
  if (typeof message === 'object') return getErrorPayloadMessage(message, 'Сообщение недоступно');
  return String(message);
};

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message = 'Успешно сохранено', type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            {formatToastMessage(t.message)}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

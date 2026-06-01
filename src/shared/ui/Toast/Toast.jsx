import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { getApiErrorMessage, getErrorPayloadMessage, isCanceledError } from '../../lib/apiError';
import './Toast.scss';

const MAX_TOASTS = 4;

const TOAST_DURATION = {
  success: 3200,
  error: 5200,
  warning: 4500,
  info: 4000,
};

const TOAST_LABELS = {
  success: 'Готово',
  error: 'Ошибка',
  warning: 'Внимание',
  info: 'Сообщение',
};

const formatToastMessage = (message) => {
  if (typeof message === 'string') return message.trim();
  if (message == null || message === '') return 'Готово';
  if (typeof message === 'object') return getErrorPayloadMessage(message, 'Сообщение недоступно');
  return String(message);
};

const inferToastType = (message, explicitType) => {
  if (explicitType && TOAST_LABELS[explicitType]) return explicitType;
  const text = formatToastMessage(message);

  if (
    /^(Не удалось|Ошибка|Произошла ошибка|Нет соединения|Нет доступа|Сессия истекла|Ошибка сервера|Неверные|Недостаточно|Слишком много|Операция невозможна)/i.test(
      text,
    ) ||
    /\b(не совпадают|конфликт состояния)\b/i.test(text)
  ) {
    return 'error';
  }

  if (
    /^(Укажите|Введите|Выберите|Откройте|Нет данных|Нет открытой|Нет массы|От \d|По плану|больше доступн|только для|В группе|Для короба|Смена |Линия |Заготовка не|Одна и та же|Неизвестн|Для каждого|В каждой|Брак не)/i.test(
      text,
    )
  ) {
    return 'warning';
  }

  return 'success';
};

const ToastIcon = ({ type }) => {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  if (type === 'success') {
    return (
      <svg {...common}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (type === 'error') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6M9 9l6 6" />
      </svg>
    );
  }
  if (type === 'warning') {
    return (
      <svg {...common}>
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
};

const ToastItem = ({ toast, onDismiss }) => {
  const { id, message, type, duration } = toast;
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const leavingRef = useRef(false);
  const timerRef = useRef(null);
  const showLabel = type !== 'success';

  const dismiss = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    window.setTimeout(() => onDismiss(id), 200);
  }, [id, onDismiss]);

  useEffect(() => {
    timerRef.current = window.setTimeout(dismiss, duration);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [dismiss, duration]);

  const pause = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setPaused(true);
  };

  const resume = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(dismiss, 1800);
    setPaused(false);
  };

  return (
    <div
      className={`toast toast--${type}${leaving ? ' toast--leave' : ''}${paused ? ' toast--paused' : ''}`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      style={{ '--toast-duration': `${duration}ms` }}
    >
      <span className="toast__icon" aria-hidden="true">
        <ToastIcon type={type} />
      </span>
      <div className="toast__body">
        {showLabel ? <p className="toast__label">{TOAST_LABELS[type]}</p> : null}
        <p className={`toast__message${showLabel ? '' : ' toast__message--solo'}`}>{message}</p>
      </div>
      <button type="button" className="toast__close" onClick={dismiss} aria-label="Закрыть уведомление">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      <span className="toast__progress" aria-hidden="true" />
    </div>
  );
};

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message = 'Успешно сохранено', type) => {
    const text = formatToastMessage(message);
    const resolvedType = inferToastType(text, type);
    const duration = TOAST_DURATION[resolvedType] ?? TOAST_DURATION.success;
    idRef.current += 1;
    const id = `${Date.now()}-${idRef.current}`;

    setToasts((prev) => {
      const next = [...prev, { id, message: text, type: resolvedType, duration }];
      return next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next;
    });
  }, []);

  const apiError = useCallback(
    (err, fallback = 'Произошла ошибка. Попробуйте снова.') => {
      if (isCanceledError(err)) return;
      const text = getApiErrorMessage(err, fallback);
      if (!text) return;
      show(text, 'error');
    },
    [show],
  );

  const value = {
    show,
    success: (msg) => show(msg, 'success'),
    error: (msg) => {
      if (msg == null || msg === '') return;
      show(msg, 'error');
    },
    warning: (msg) => show(msg, 'warning'),
    info: (msg) => show(msg, 'info'),
    apiError,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={remove} />
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

import React from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import './Toast.scss';

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

// Автозакрытие по таймеру — на стороне ToastProvider (там же хранится
// фактическая duration каждого тоста); здесь только отображение.
const Toast = ({ id, message, type = 'info', onClose, actionLabel, onAction }) => {
  const Icon = ICONS[type] || Info;

  return (
    <div className={`toast toast--${type}`} role="alert">
      <Icon className="toast__icon" size={18} aria-hidden />
      <span className="toast__message">{message}</span>
      {/* Кнопка действия — например «Отменить» у удаления: пока тост висит,
          операцию ещё можно вернуть */}
      {actionLabel && onAction && (
        <button type="button" className="toast__action" onClick={() => { onAction(); onClose(); }}>
          {actionLabel}
        </button>
      )}
      <button type="button" className="toast__close" onClick={onClose} aria-label="Закрыть">
        ×
      </button>
    </div>
  );
};

export default Toast;

import React, { useEffect } from 'react';
import './Toast.scss';

const Toast = ({ id, message, type = 'info', onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`toast toast--${type}`} role="alert">
      <span className="toast__message">{message}</span>
      <button type="button" className="toast__close" onClick={onClose} aria-label="Закрыть">
        ×
      </button>
    </div>
  );
};

export default Toast;

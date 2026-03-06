import { useEffect } from 'react';

/**
 * Хук для модалок: Escape для закрытия, блокировка скролла body.
 * @param {boolean} isOpen — модалка открыта
 * @param {function} onClose — колбэк закрытия
 */
export function useModalEffect(isOpen, onClose) {
  useEffect(() => {
    if (!isOpen || !onClose) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);
}

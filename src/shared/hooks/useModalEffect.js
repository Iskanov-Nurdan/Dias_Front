import { useEffect, useRef } from 'react';

/**
 * Хук для модалок: Escape для закрытия, блокировка скролла body.
 * onClose держим в ref — иначе при каждом ререндере родителя (поиск, табы) эффект
 * перезапускался бы и дергал overflow/listeners (ощущается как лаг).
 * @param {boolean} isOpen — модалка открыта
 * @param {function} onClose — колбэк закрытия
 */
export function useModalEffect(isOpen, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current?.();
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);
}

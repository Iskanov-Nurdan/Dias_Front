import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Хук для модалок: Escape для закрытия, блокировка скролла body,
 * возврат фокуса на триггер после закрытия, и (если передан containerRef)
 * зацикливание Tab внутри модалки.
 * onClose держим в ref — иначе при каждом ререндере родителя (поиск, табы) эффект
 * перезапускался бы и дергал overflow/listeners (ощущается как лаг).
 * @param {boolean} isOpen — модалка открыта
 * @param {function} onClose — колбэк закрытия
 * @param {{current: HTMLElement}} [containerRef] — корневой DOM-узел модалки для focus trap
 */
export function useModalEffect(isOpen, onClose, containerRef) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const triggerEl = document.activeElement;

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !containerRef?.current) return;

      const focusable = Array.from(containerRef.current.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeydown);

    if (containerRef?.current) {
      const firstFocusable = containerRef.current.querySelector(FOCUSABLE_SELECTOR);
      firstFocusable?.focus();
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeydown);
      if (triggerEl instanceof HTMLElement && document.contains(triggerEl)) {
        triggerEl.focus();
      }
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
}

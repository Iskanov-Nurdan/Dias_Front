import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft } from 'lucide-react';
import { useModalEffect } from '../hooks/useModalEffect';
import './FormModal.scss';

let uid = 0;

/**
 * Общий каркас модалки формы (создание/редактирование сущности): на
 * десктопе — по центру, на мобиле — bottom sheet (size="sheet", короткие
 * формы вроде «Название + одно поле») или fullscreen (size="fullscreen",
 * формы с 5+ полями — вместо крестика кнопка «Назад», sticky-кнопка
 * сохранения снизу). children — весь <form> целиком (тело + кнопки),
 * см. shared/ui/FormModal.scss за классами __form/__body/__actions.
 */
const FormModal = ({
  icon: Icon, eyebrow, title, onClose, error, children, size = 'sheet', className = '', headerExtra,
}) => {
  const panelRef = useRef(null);
  const titleId = useRef(`form-modal-title-${++uid}`).current;

  useModalEffect(true, onClose, panelRef);

  const content = (
    <div
      className={`form-modal__backdrop form-modal__backdrop--${size}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div ref={panelRef} className={`form-modal form-modal--${size} ${className}`.trim()} onClick={(e) => e.stopPropagation()}>
        <div className="form-modal__header">
          {size === 'fullscreen' && (
            // Скрыта на десктопе CSS-ом (там модалка не fullscreen, а
            // обычная центрированная карточка — там нужен крестик, не «назад»).
            <button type="button" className="form-modal__back" onClick={onClose} aria-label="Назад">
              <ChevronLeft size={20} />
            </button>
          )}
          {Icon && <span className="form-modal__header-icon"><Icon size={18} /></span>}
          <div className="form-modal__header-text">
            {eyebrow && <p className="form-modal__eyebrow">{eyebrow}</p>}
            <h2 id={titleId} className="form-modal__title">{title}</h2>
          </div>
          {headerExtra && <div className="form-modal__header-extra">{headerExtra}</div>}
          <button type="button" className="form-modal__close" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        {error && <p className="form-modal__error" role="alert">{error}</p>}

        {children}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default FormModal;

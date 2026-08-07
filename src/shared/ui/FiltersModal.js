import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalEffect } from '../hooks/useModalEffect';
import './FiltersModal.scss';

/**
 * Модалка с фильтрами. На десктопе — по центру; на мобиле — bottom sheet.
 * @param {boolean} open
 * @param {function} onClose
 * @param {string} title
 * @param {React.ReactNode} children — тело (скролл)
 * @param {React.ReactNode} [footer] — нижняя панель (Сброс / Применить), липкая на мобиле
 */
const FiltersModal = ({ open, onClose, title = 'Фильтры', children, footer }) => {
  const panelRef = useRef(null);
  useModalEffect(open, onClose, panelRef);

  if (!open) return null;
  const content = (
    <div className="filters-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="filters-modal-title">
      <div ref={panelRef} className="filters-modal" onClick={(e) => e.stopPropagation()}>
        <div className="filters-modal__header">
          <h2 id="filters-modal-title" className="filters-modal__title">{title}</h2>
          <button type="button" className="filters-modal__close" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        <div className="filters-modal__body">
          {children}
        </div>
        {footer != null && footer !== false && (
          <div className="filters-modal__footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default FiltersModal;

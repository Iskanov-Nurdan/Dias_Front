import React from 'react';
import { createPortal } from 'react-dom';
import { useModalEffect } from '../../hooks';
import './FiltersModal.scss';

const FiltersModal = ({ open, onClose, onReset, children, title = 'Фильтры' }) => {
  useModalEffect(open, onClose);

  if (!open) return null;

  return createPortal(
    <div className="filters-modal-overlay" onClick={onClose}>
      <div className="filters-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="filters-modal__head">
          <h3 className="filters-modal__title">{title}</h3>
          <button type="button" className="filters-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="filters-modal__body">{children}</div>
        <div className="filters-modal__foot">
          {onReset && (
            <button type="button" className="btn btn--secondary btn--sm" onClick={onReset}>
              Сбросить
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Применить
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FiltersModal;

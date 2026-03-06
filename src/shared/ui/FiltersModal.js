import React from 'react';
import { createPortal } from 'react-dom';
import { useModalEffect } from '../hooks/useModalEffect';
import './FiltersModal.scss';

/**
 * Модалка с фильтрами. Центрированная, поверх всего контента.
 * @param {boolean} open
 * @param {function} onClose
 * @param {string} title
 * @param {React.ReactNode} children
 */
const FiltersModal = ({ open, onClose, title = 'Фильтры', children }) => {
  useModalEffect(open, onClose);

  if (!open) return null;
  const content = (
    <div className="filters-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="filters-modal-title">
      <div className="filters-modal" onClick={(e) => e.stopPropagation()}>
        <div className="filters-modal__header">
          <h2 id="filters-modal-title" className="filters-modal__title">{title}</h2>
          <button type="button" className="filters-modal__close" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        <div className="filters-modal__body">
          {children}
        </div>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default FiltersModal;

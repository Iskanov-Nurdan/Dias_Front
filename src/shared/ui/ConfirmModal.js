import React from 'react';
import { createPortal } from 'react-dom';
import { useModalEffect } from '../hooks/useModalEffect';
import './ConfirmModal.scss';

const ConfirmModal = ({ title, message, confirmText = 'Да', cancelText = 'Отмена', onConfirm, onCancel, danger }) => {
  useModalEffect(true, onCancel);

  const handleConfirm = () => {
    onConfirm?.();
    onCancel?.();
  };

  const content = (
    <div className="confirm-modal__backdrop" onClick={onCancel} role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3 id="confirm-modal-title" className="confirm-modal__title">{title}</h3>
        {message && <p className="confirm-modal__message">{message}</p>}
        <div className="confirm-modal__actions">
          <button type="button" className="confirm-modal__btn confirm-modal__btn--cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`confirm-modal__btn confirm-modal__btn--confirm ${danger ? 'confirm-modal__btn--danger' : ''}`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default ConfirmModal;

import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { useModalEffect } from '../hooks/useModalEffect';
import FeedbackVisual from './FeedbackVisual';
import './ConfirmModal.scss';

const ConfirmModal = ({ title, message, confirmText = 'Да', cancelText = 'Отмена', onConfirm, onCancel, danger }) => {
  const panelRef = useRef(null);
  useModalEffect(true, onCancel, panelRef);

  const handleConfirm = () => {
    onConfirm?.();
    onCancel?.();
  };

  const content = (
    <div className="confirm-modal__backdrop" onClick={onCancel} role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div className="confirm-modal" ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal__icon">
          <FeedbackVisual variant={danger ? 'error' : 'confirm'} />
        </div>
        <h3 id="confirm-modal-title" className="confirm-modal__title">{title}</h3>
        {message && <p className="confirm-modal__message">{message}</p>}
        <div className="confirm-modal__actions">
          <button type="button" className="ui-modal-btn" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`ui-modal-btn ${danger ? 'ui-modal-btn--danger' : 'ui-modal-btn--primary'}`}
            onClick={handleConfirm}
          >
            {!danger && <Check size={15} />} {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default ConfirmModal;

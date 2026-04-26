import { createPortal } from 'react-dom';
import './ConfirmModal.scss';

const ConfirmModal = ({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  error,
  confirmBusy = false,
}) => {
  if (!open) return null;

  return createPortal(
    <div className="confirm-modal-overlay" onClick={confirmBusy ? undefined : onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-modal__title">{title}</h3>
        <p className="confirm-modal__message">{message}</p>
        {error ? <p className="confirm-modal__error" role="alert">{error}</p> : null}
        <div className="confirm-modal__actions">
          <button type="button" className="confirm-modal__btn confirm-modal__btn--cancel" onClick={onCancel} disabled={confirmBusy}>
            {cancelText}
          </button>
          <button type="button" className="confirm-modal__btn confirm-modal__btn--confirm" onClick={onConfirm} disabled={confirmBusy}>
            {confirmBusy ? 'Подождите…' : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;

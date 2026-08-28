import { createPortal } from 'react-dom';
import { FiTrash2, FiAlertTriangle } from 'react-icons/fi';
import '../../../design-system/split-screen/tokens.css';
import './ConfirmModal.scss';

// Same shared dialog for both destructive actions (delete/deactivate) and
// soft warnings (discard unsaved changes) — the tone is inferred from the
// confirm label already passed by every call site, so no call site needs a
// new prop to get the right icon/button color.
const DESTRUCTIVE_RE = /удал|деактивир/i;

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

  const isDestructive = DESTRUCTIVE_RE.test(String(confirmText || ''));
  const Icon = isDestructive ? FiTrash2 : FiAlertTriangle;

  return createPortal(
    <div className="confirm-modal-overlay" onClick={confirmBusy ? undefined : onCancel}>
      <div
        className={`confirm-modal${isDestructive ? ' confirm-modal--danger' : ' confirm-modal--neutral'}`}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div className="confirm-modal__icon" aria-hidden="true">
          <Icon size={22} strokeWidth={2} />
        </div>
        <h3 className="confirm-modal__title" id="confirm-modal-title">{title}</h3>
        <p className="confirm-modal__message">{message}</p>
        {error ? <p className="confirm-modal__error" role="alert">{error}</p> : null}
        <div className="confirm-modal__actions">
          <button type="button" className="confirm-modal__btn confirm-modal__btn--cancel" onClick={onCancel} disabled={confirmBusy}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`confirm-modal__btn confirm-modal__btn--confirm${isDestructive ? '' : ' confirm-modal__btn--confirm-neutral'}`}
            onClick={onConfirm}
            disabled={confirmBusy}
          >
            {confirmBusy ? 'Подождите…' : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;

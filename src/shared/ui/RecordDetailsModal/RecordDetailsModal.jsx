import React from 'react';
import './RecordDetailsModal.scss';

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.lead]
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} [props.footer]
 * @param {boolean} [props.wide]
 */
export default function RecordDetailsModal({
  open,
  onClose,
  title,
  lead,
  children,
  footer,
  wide = false,
}) {
  if (!open) return null;

  return (
    <div className="modal-overlay record-details-overlay" onClick={onClose} role="presentation">
      <div
        className={`modal record-details-modal${wide ? ' record-details-modal--wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-details-title"
      >
        <div className="modal__head">
          <h3 id="record-details-title">{title}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="record-details-modal__body">
          {lead ? <p className="record-details-modal__lead">{lead}</p> : null}
          {children}
        </div>
        {footer ? <div className="record-details-modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

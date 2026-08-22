import React from 'react';
import { createPortal } from 'react-dom';
import { X, User, AlertTriangle } from 'lucide-react';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { SubmitButton } from '../../../shared/ui';
import { MAX_WARNINGS } from '../lib/clientWarnings';
import './WarnClientModal.scss';

const WarnClientModal = ({ client, currentCount = 0, saving, error, onConfirm, onClose }) => {
  useModalEffect(true, onClose);
  const nextCount = Math.min(MAX_WARNINGS, currentCount + 1);

  const content = (
    <div className="warn-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="warn-modal-title">
      <div className="warn-modal" onClick={(e) => e.stopPropagation()}>
        <div className="warn-modal__header">
          <h2 id="warn-modal-title" className="warn-modal__title">
            <AlertTriangle size={18} /> Поставить предупреждение?
          </h2>
          <button type="button" className="warn-modal__close" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        {client && (
          <div className="warn-modal__client-card">
            <span className="warn-modal__client-avatar"><User size={16} /></span>
            <div className="warn-modal__client-info">
              <span className="warn-modal__client-name">{client.fio}</span>
              {(client.sportName ?? client.sport?.name) && (
                <span className="warn-modal__client-sport">{client.sportName ?? client.sport?.name}</span>
              )}
            </div>
          </div>
        )}

        <div className="warn-modal__body">
          <p className="warn-modal__text">Клиент получит предупреждение за неоплату абонемента.</p>
          <div className="warn-modal__result">
            <AlertTriangle size={15} className="warn-modal__result-icon" />
            <span>Это будет предупреждение <strong>{nextCount} из {MAX_WARNINGS}</strong></span>
          </div>
          {error && <p className="warn-modal__error" role="alert">{error}</p>}
        </div>

        <div className="warn-modal__actions">
          <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>Отмена</button>
          <SubmitButton
            loading={saving}
            loadingLabel="Ставим…"
            className="ui-modal-btn ui-modal-btn--warning"
            onClick={onConfirm}
          >
            <AlertTriangle size={15} /> Поставить
          </SubmitButton>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default WarnClientModal;

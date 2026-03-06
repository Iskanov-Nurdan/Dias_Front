import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ConfirmModal } from '../../../shared/ui';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import './ExtendModal.scss';

const ExtendModal = ({ client, onSave, onClose, error, saving }) => {
  const [months, setMonths] = useState(1);

  useModalEffect(true, onClose);
  const [showConfirm, setShowConfirm] = useState(false);
  const handleSubmit = (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };
  const handleConfirm = () => {
    setShowConfirm(false);
    onSave({ months });
  };
  const content = (
    <div className="extend-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="extend-modal-title">
      <div className="extend-modal" onClick={(e) => e.stopPropagation()}>
        <div className="extend-modal__header">
          <h2 id="extend-modal-title" className="extend-modal__title">Продлить подписку</h2>
          <button type="button" className="extend-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        {client && <p className="extend-modal__client">{client.fio}</p>}
        {error && <p className="extend-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="extend-modal__form">
          <label className="extend-modal__label">Месяцев <input type="number" min={1} value={months} onChange={(e) => setMonths(Number(e.target.value))} className="extend-modal__input" /></label>
          <div className="extend-modal__actions">
            <button type="button" className="extend-modal__btn extend-modal__btn--cancel" onClick={onClose} disabled={saving}>Отмена</button>
            <button type="submit" className="extend-modal__btn extend-modal__btn--submit" disabled={saving}>{saving ? 'Продление…' : 'Продлить'}</button>
          </div>
        </form>
        {showConfirm && (
          <ConfirmModal
            title="Продлить абонемент?"
            message={`Продлить абонемент ${client?.fio || 'клиента'} на ${months} ${months === 1 ? 'месяц' : months < 5 ? 'месяца' : 'месяцев'}?`}
            confirmText="Продлить"
            onConfirm={handleConfirm}
            onCancel={() => setShowConfirm(false)}
          />
        )}
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default ExtendModal;

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { SubmitButton } from '../../../shared/ui';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import './ClientFreezeModal.scss';

const MIN_DAYS = 1;

const ClientFreezeModal = ({
  open,
  mode,
  initialDays,
  initialReason,
  clientFio,
  onSubmit,
  onClose,
  error,
  saving,
  fullscreen = false,
}) => {
  const [days, setDays] = useState(String(initialDays ?? MIN_DAYS));
  const [reason, setReason] = useState(initialReason ?? '');
  const [localError, setLocalError] = useState(null);

  useModalEffect(open, onClose);

  useEffect(() => {
    if (!open) return;
    setDays(String(initialDays ?? MIN_DAYS));
    setReason(initialReason ?? '');
    setLocalError(null);
  }, [open, initialDays, initialReason, mode]);

  if (!open) return null;

  const title = mode === 'edit' ? 'Изменить заморозку' : 'Заморозка абонемента';

  const handleSubmit = (e) => {
    e.preventDefault();
    setLocalError(null);
    const n = Number(String(days).replace(',', '.'));
    if (!Number.isFinite(n) || n < MIN_DAYS) {
      setLocalError(`Укажите количество дней не меньше ${MIN_DAYS}`);
      return;
    }
    const r = String(reason).trim();
    if (!r) {
      setLocalError('Укажите причину заморозки');
      return;
    }
    onSubmit({
      days: Math.floor(n),
      reason: r,
    });
  };

  const displayError = localError || error;

  const content = (
    <div
      className={`client-freeze-modal__backdrop${fullscreen ? ' client-freeze-modal__backdrop--fullscreen' : ''}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-freeze-modal-title"
    >
      <div
        className={`client-freeze-modal${fullscreen ? ' client-freeze-modal--fullscreen' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="client-freeze-modal__header">
          <h2 id="client-freeze-modal-title" className="client-freeze-modal__title">{title}</h2>
          <button type="button" className="client-freeze-modal__close" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        {clientFio ? <p className="client-freeze-modal__client">{clientFio}</p> : null}
        {displayError ? (
          <p className="client-freeze-modal__error" role="alert">
            {displayError}
          </p>
        ) : null}
        <form onSubmit={handleSubmit} className="client-freeze-modal__form" noValidate>
          <div className="client-freeze-modal__form-body">
            <label className="client-freeze-modal__label" htmlFor="client-freeze-days">
              Количество дней заморозки
              <input
                id="client-freeze-days"
                type="number"
                min={MIN_DAYS}
                step={1}
                inputMode="numeric"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="client-freeze-modal__input"
                autoComplete="off"
                disabled={saving}
              />
            </label>
            <label className="client-freeze-modal__label" htmlFor="client-freeze-reason">
              Причина заморозки <span className="client-freeze-modal__req" aria-hidden>*</span>
              <textarea
                id="client-freeze-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="client-freeze-modal__textarea"
                placeholder="Например: травма во время тренировки"
                disabled={saving}
              />
            </label>
          </div>
          <div className="client-freeze-modal__actions">
            <button type="button" className="client-freeze-modal__btn client-freeze-modal__btn--cancel" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <SubmitButton loading={saving} loadingLabel="Сохранение…" className="client-freeze-modal__btn client-freeze-modal__btn--submit">
              Сохранить
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default ClientFreezeModal;

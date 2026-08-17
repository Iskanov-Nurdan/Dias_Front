import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, CalendarDays, User } from 'lucide-react';
import { ConfirmModal, SubmitButton } from '../../../shared/ui';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import './ExtendModal.scss';

const QUICK_MONTHS = [1, 2, 3, 6, 12];

const pluralMonths = (n) => {
  if (n === 1) return '1 месяц';
  if (n >= 2 && n <= 4) return `${n} месяца`;
  return `${n} месяцев`;
};

const addMonths = (dateStr, months) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const ExtendModal = ({ client, onSave, onClose, error, saving, fullscreen = false }) => {
  const [months, setMonths] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);

  useModalEffect(true, onClose);

  const handleMonthInput = (v) => {
    const n = Math.max(1, Number(v) || 1);
    setMonths(n);
  };

  const newEndDate = useMemo(
    () => addMonths(client?.dateStart ?? client?.date_start, months),
    [client, months],
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    onSave({ months });
  };

  const content = (
    <div
      className={`extend-modal__backdrop${fullscreen ? ' extend-modal__backdrop--fullscreen' : ''}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="extend-modal-title"
    >
      <div
        className={`extend-modal${fullscreen ? ' extend-modal--fullscreen' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="extend-modal__header">
          <h2 id="extend-modal-title" className="extend-modal__title">Продлить подписку</h2>
          <button type="button" className="extend-modal__close" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        {/* Инфо о клиенте */}
        {client && (
          <div className="extend-modal__client-card">
            <span className="extend-modal__client-avatar"><User size={16} /></span>
            <div className="extend-modal__client-info">
              <span className="extend-modal__client-name">{client.fio}</span>
              {(client.sportName ?? client.sport?.name) && (
                <span className="extend-modal__client-sport">{client.sportName ?? client.sport?.name}</span>
              )}
            </div>
          </div>
        )}

        {error && <p className="extend-modal__error" role="alert">{error}</p>}

        <form onSubmit={handleSubmit} className="extend-modal__form">
          <div className="extend-modal__form-body">

            {/* Быстрый выбор */}
            <p className="extend-modal__section-label">Период продления</p>
            <div className="extend-modal__quick">
              {QUICK_MONTHS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`extend-modal__chip${months === m ? ' extend-modal__chip--active' : ''}`}
                  onClick={() => setMonths(m)}
                >
                  {m} мес.
                </button>
              ))}
            </div>

            {/* Ручной ввод */}
            <label className="extend-modal__label">
              <span>Или введите количество месяцев</span>
              <input
                type="number"
                min={1}
                value={months}
                onChange={(e) => handleMonthInput(e.target.value)}
                className="extend-modal__input"
              />
            </label>

            {/* Новая дата */}
            <div className="extend-modal__result">
              <CalendarDays size={15} className="extend-modal__result-icon" />
              <span>Новая дата окончания: <strong>{newEndDate}</strong></span>
            </div>

          </div>

          <div className="extend-modal__actions">
            <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <SubmitButton loading={saving} loadingLabel="Продление…" className="ui-modal-btn ui-modal-btn--primary">
              Продлить на {pluralMonths(months)}
            </SubmitButton>
          </div>
        </form>

        {showConfirm && (
          <ConfirmModal
            title="Продлить абонемент?"
            message={`Продлить абонемент ${client?.fio || 'клиента'} на ${pluralMonths(months)}?`}
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

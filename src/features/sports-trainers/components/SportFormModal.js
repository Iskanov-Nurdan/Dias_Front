import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { SubmitButton } from '../../../shared/ui';
import './SportFormModal.scss';

const SportFormModal = ({ sport, onSave, onClose, error, saving }) => {
  const [name, setName] = useState('');

  useModalEffect(true, onClose);

  useEffect(() => {
    if (sport) setName(sport.name || '');
  }, [sport]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name });
  };

  const content = (
    <div className="sport-form-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="sport-form-modal-title">
      <div className="sport-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sport-form-modal__header">
          <h2 id="sport-form-modal-title" className="sport-form-modal__title">{sport?.id ? 'Редактировать вид спорта' : 'Добавить вид спорта'}</h2>
          <button type="button" className="sport-form-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        {error && <p className="sport-form-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="sport-form-modal__form">
          <div className="sport-form-modal__form-body">
          <label className="sport-form-modal__label">
            <span className="sport-form-modal__label-caption">Название <span className="form-label-required" aria-hidden="true">*</span></span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="sport-form-modal__input" />
          </label>
          </div>
          <div className="sport-form-modal__actions">
            <button type="button" className="sport-form-modal__btn sport-form-modal__btn--cancel" onClick={onClose} disabled={saving}>Отмена</button>
            <SubmitButton loading={saving} className="sport-form-modal__btn sport-form-modal__btn--submit">
              Сохранить
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default SportFormModal;

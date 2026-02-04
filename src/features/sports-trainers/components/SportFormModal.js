import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './SportFormModal.scss';

const SportFormModal = ({ sport, onSave, onClose }) => {
  const [name, setName] = useState('');
  useEffect(() => {
    if (sport) setName(sport.name || '');
  }, [sport]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name });
    onClose();
  };

  const content = (
    <div className="sport-form-modal__backdrop" onClick={onClose}>
      <div className="sport-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="sport-form-modal__title">{sport?.id ? 'Редактировать вид спорта' : 'Добавить вид спорта'}</h2>
        <form onSubmit={handleSubmit} className="sport-form-modal__form">
          <label className="sport-form-modal__label">
            <span className="sport-form-modal__label-caption">Название <span className="form-label-required" aria-hidden="true">*</span></span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="sport-form-modal__input" />
          </label>
          <div className="sport-form-modal__actions">
            <button type="button" className="sport-form-modal__btn sport-form-modal__btn--cancel" onClick={onClose}>Отмена</button>
            <button type="submit" className="sport-form-modal__btn sport-form-modal__btn--submit">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default SportFormModal;

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import './ExtendModal.scss';

const ExtendModal = ({ client, onSave, onClose }) => {
  const [months, setMonths] = useState(1);
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ months });
    onClose();
  };
  const content = (
    <div className="extend-modal__backdrop" onClick={onClose}>
      <div className="extend-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="extend-modal__title">Продлить подписку</h2>
        {client && <p className="extend-modal__client">{client.fio}</p>}
        <form onSubmit={handleSubmit} className="extend-modal__form">
          <label className="extend-modal__label">Месяцев <input type="number" min={1} value={months} onChange={(e) => setMonths(Number(e.target.value))} className="extend-modal__input" /></label>
          <div className="extend-modal__actions">
            <button type="button" className="extend-modal__btn extend-modal__btn--cancel" onClick={onClose}>Отмена</button>
            <button type="submit" className="extend-modal__btn extend-modal__btn--submit">Продлить</button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default ExtendModal;

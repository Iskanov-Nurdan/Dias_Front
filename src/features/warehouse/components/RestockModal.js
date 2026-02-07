import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './RestockModal.scss';

const RestockModal = ({ product, onSave, onClose, error, saving }) => {
  const [qty, setQty] = useState('');

  useEffect(() => {
    setQty('');
  }, [product]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const num = Number(qty);
    if (Number.isNaN(num) || num <= 0) return;
    onSave({ qty: num });
  };

  if (!product) return null;

  const content = (
    <div className="warehouse-form-modal__backdrop" onClick={onClose}>
      <div className="warehouse-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="warehouse-form-modal__title">Пополнить: {product.name}</h2>
        {error && <p className="warehouse-form-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="warehouse-form-modal__form">
          <label className="warehouse-form-modal__label">
            Количество
            <input type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} required className="warehouse-form-modal__input" placeholder="0" />
          </label>
          <div className="warehouse-form-modal__actions">
            <button type="button" className="warehouse-form-modal__btn warehouse-form-modal__btn--cancel" onClick={onClose} disabled={saving}>Отмена</button>
            <button type="submit" className="warehouse-form-modal__btn warehouse-form-modal__btn--submit" disabled={saving}>{saving ? 'Пополнение…' : 'Пополнить'}</button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default RestockModal;

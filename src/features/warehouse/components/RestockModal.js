import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ConfirmModal } from '../../../shared/ui';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import './RestockModal.scss';

const RestockModal = ({ product, onSave, onClose, error, saving }) => {
  const [qty, setQty] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  useModalEffect(!!product, onClose);

  useEffect(() => {
    setQty('');
    setShowConfirm(false);
  }, [product]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const num = Number(qty);
    if (Number.isNaN(num) || num <= 0) return;
    setShowConfirm(true);
  };
  const handleConfirm = () => {
    const num = Number(qty);
    setShowConfirm(false);
    onSave({ qty: num });
  };

  if (!product) return null;

  const content = (
    <div className="warehouse-form-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="restock-modal-title">
      <div className="warehouse-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="warehouse-form-modal__header">
          <h2 id="restock-modal-title" className="warehouse-form-modal__title">Пополнить: {product.name}</h2>
          <button type="button" className="warehouse-form-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        {error && <p className="warehouse-form-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="warehouse-form-modal__form restock-modal__form">
          <section className="restock-modal__body">
            <label className="warehouse-form-modal__label">
              <span className="warehouse-form-modal__label-caption">Количество</span>
              <input type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} required className="warehouse-form-modal__input" placeholder="0" />
            </label>
          </section>
          <div className="warehouse-form-modal__actions">
            <button type="button" className="warehouse-form-modal__btn warehouse-form-modal__btn--cancel" onClick={onClose} disabled={saving}>Отмена</button>
            <button type="submit" className="warehouse-form-modal__btn warehouse-form-modal__btn--submit" disabled={saving}>{saving ? 'Пополнение…' : 'Пополнить'}</button>
          </div>
        </form>
        {showConfirm && (
          <ConfirmModal
            title="Пополнить товар?"
            message={`Пополнить «${product.name}» на ${qty} шт.?`}
            confirmText="Пополнить"
            onConfirm={handleConfirm}
            onCancel={() => setShowConfirm(false)}
          />
        )}
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default RestockModal;

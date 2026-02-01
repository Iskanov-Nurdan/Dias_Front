import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './SaleFormModal.scss';

const SaleFormModal = ({ products = [], onSave, onClose }) => {
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [discount, setDiscount] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setDate(today);
  }, []);

  const selectedProduct = products.find((p) => String(p.id) === String(productId));
  useEffect(() => {
    if (selectedProduct && (pricePerUnit === '' || pricePerUnit === '0')) {
      const p = selectedProduct.price ?? selectedProduct.pricePerUnit;
      if (p != null) setPricePerUnit(String(p));
    }
  }, [productId, selectedProduct?.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      productId: productId ? Number(productId) : undefined,
      qty: qty !== '' ? Number(qty) : undefined,
      pricePerUnit: pricePerUnit !== '' ? Number(pricePerUnit) : undefined,
      discount: discount !== '' ? Number(discount) : undefined,
      date: date || undefined,
    };
    onSave(payload);
    onClose();
  };

  const content = (
    <div className="sale-form-modal__backdrop" onClick={onClose}>
      <div className="sale-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="sale-form-modal__title">Новая продажа</h2>
        <form onSubmit={handleSubmit} className="sale-form-modal__form">
          <label className="sale-form-modal__label">
            Товар
            <Select
              value={String(productId)}
              onChange={(v) => setProductId(v)}
              options={[{ value: '', label: '—' }, ...products.map((p) => ({ value: String(p.id), label: p.name || '' }))]}
              placeholder="—"
              className="sale-form-modal__input sale-form-modal__select"
            />
          </label>
          <label className="sale-form-modal__label">
            Количество
            <input type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} required className="sale-form-modal__input" placeholder="1" />
          </label>
          <label className="sale-form-modal__label">
            Цена за ед.
            <input type="number" step="any" min="0" value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)} required className="sale-form-modal__input" placeholder="0" />
          </label>
          <label className="sale-form-modal__label">
            Скидка
            <input type="number" step="any" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} className="sale-form-modal__input" placeholder="0" />
          </label>
          <label className="sale-form-modal__label">
            Дата
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sale-form-modal__input" />
          </label>
          <div className="sale-form-modal__actions">
            <button type="button" className="sale-form-modal__btn sale-form-modal__btn--cancel" onClick={onClose}>Отмена</button>
            <button type="submit" className="sale-form-modal__btn sale-form-modal__btn--submit">Оформить</button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default SaleFormModal;

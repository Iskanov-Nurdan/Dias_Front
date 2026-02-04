import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Select } from '../../../shared/ui';
import './ProductFormModal.scss';

const ProductFormModal = ({ product, categories = [], onSave, onClose }) => {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [minQty, setMinQty] = useState('');
  const [qty, setQty] = useState('');

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setCategoryId(product.categoryId ?? product.category_id ?? product.category?.id ?? '');
      setPrice(product.price != null ? String(product.price) : '');
      setMinQty(product.minQty != null ? String(product.minQty) : product.min_quantity != null ? String(product.min_quantity) : '');
      setQty(product.qty != null ? String(product.qty) : product.quantity != null ? String(product.quantity) : '');
    } else {
      setName('');
      setCategoryId('');
      setPrice('');
      setMinQty('');
      setQty('');
    }
  }, [product]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      categoryId: categoryId || undefined,
      price: price !== '' ? Number(price) : undefined,
      minQty: minQty !== '' ? Number(minQty) : undefined,
      qty: qty !== '' ? Number(qty) : undefined,
    };
    onSave(payload);
    onClose();
  };

  const content = (
    <div className="warehouse-form-modal__backdrop" onClick={onClose}>
      <div className="warehouse-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="warehouse-form-modal__title">{product?.id ? 'Редактировать товар' : 'Добавить товар'}</h2>
        <form onSubmit={handleSubmit} className="warehouse-form-modal__form">
          <label className="warehouse-form-modal__label">
            <span className="warehouse-form-modal__label-caption">Название <span className="form-label-required" aria-hidden="true">*</span></span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="warehouse-form-modal__input" placeholder="Название товара" />
          </label>
          <label className="warehouse-form-modal__label">
            <span className="warehouse-form-modal__label-caption">Категория</span>
            <Select
              value={String(categoryId)}
              onChange={(v) => setCategoryId(v)}
              options={[{ value: '', label: '—' }, ...categories.map((c) => ({ value: String(c.id), label: c.name || '' }))]}
              placeholder="—"
              className="warehouse-form-modal__select"
            />
          </label>
          <label className="warehouse-form-modal__label">
            <span className="warehouse-form-modal__label-caption">Цена</span>
            <input type="number" step="any" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="warehouse-form-modal__input" placeholder="0" />
          </label>
          <label className="warehouse-form-modal__label">
            <span className="warehouse-form-modal__label-caption">Количество</span>
            <input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className="warehouse-form-modal__input" placeholder="0" />
          </label>
          <label className="warehouse-form-modal__label">
            <span className="warehouse-form-modal__label-caption">Мин. остаток</span>
            <input type="number" min="0" value={minQty} onChange={(e) => setMinQty(e.target.value)} className="warehouse-form-modal__input" placeholder="0" />
          </label>
          <div className="warehouse-form-modal__actions">
            <button type="button" className="warehouse-form-modal__btn warehouse-form-modal__btn--cancel" onClick={onClose}>Отмена</button>
            <button type="submit" className="warehouse-form-modal__btn warehouse-form-modal__btn--submit">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default ProductFormModal;

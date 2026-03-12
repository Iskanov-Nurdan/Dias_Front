import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Select } from '../../../shared/ui';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import './ProductFormModal.scss';

const ProductFormModal = ({ product, categories = [], onSave, onClose, error, saving }) => {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [minQty, setMinQty] = useState('');
  const [qty, setQty] = useState('');

  useModalEffect(true, onClose);

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setCategoryId(product.categoryId ?? product.category_id ?? product.category?.id ?? '');
      const pp = product.purchasePrice;
      const sp = product.sellingPrice;
      setPurchasePrice(pp != null ? String(pp) : '');
      setSellingPrice(sp != null ? String(sp) : '');
      setMinQty(product.minQty != null ? String(product.minQty) : product.min_quantity != null ? String(product.min_quantity) : '');
      setQty(product.qty != null ? String(product.qty) : product.quantity != null ? String(product.quantity) : '');
    } else {
      setName('');
      setCategoryId('');
      setPurchasePrice('');
      setSellingPrice('');
      setMinQty('');
      setQty('');
    }
  }, [product]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      categoryId: categoryId || undefined,
      purchasePrice: purchasePrice !== '' ? Number(purchasePrice) : undefined,
      sellingPrice: sellingPrice !== '' ? Number(sellingPrice) : undefined,
      minQty: minQty !== '' ? Number(minQty) : undefined,
      qty: qty !== '' ? Number(qty) : undefined,
    };
    onSave(payload);
  };

  const content = (
    <div className="warehouse-form-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="warehouse-form-modal-title">
      <div className="warehouse-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="warehouse-form-modal__header">
          <h2 id="warehouse-form-modal-title" className="warehouse-form-modal__title">{product?.id ? 'Редактировать товар' : 'Добавить товар'}</h2>
          <button type="button" className="warehouse-form-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        {error && <p className="warehouse-form-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="warehouse-form-modal__form">
          <section className="warehouse-form-modal__section warehouse-form-modal__section--main">
            <h3 className="warehouse-form-modal__section-title">Основное</h3>
            <label className="warehouse-form-modal__label">
              <span className="warehouse-form-modal__label-caption">Название <span className="form-label-required" aria-hidden="true">*</span></span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="warehouse-form-modal__input" placeholder="Название" />
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
          </section>
          <section className="warehouse-form-modal__section warehouse-form-modal__section--prices">
            <h3 className="warehouse-form-modal__section-title">Цены</h3>
            <div className="warehouse-form-modal__grid">
              <label className="warehouse-form-modal__label">
                <span className="warehouse-form-modal__label-caption">Закупка</span>
                <input type="number" step="any" min="0" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="warehouse-form-modal__input" placeholder="0" />
              </label>
              <label className="warehouse-form-modal__label">
                <span className="warehouse-form-modal__label-caption">Продажа</span>
                <input type="number" step="any" min="0" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} className="warehouse-form-modal__input" placeholder="0" />
              </label>
            </div>
          </section>
          <section className="warehouse-form-modal__section warehouse-form-modal__section--stock">
            <h3 className="warehouse-form-modal__section-title">Остатки</h3>
            <div className="warehouse-form-modal__grid">
              <label className="warehouse-form-modal__label">
                <span className="warehouse-form-modal__label-caption">Количество</span>
                <input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className="warehouse-form-modal__input" placeholder="0" />
              </label>
              <label className="warehouse-form-modal__label">
                <span className="warehouse-form-modal__label-caption">Мин. остаток</span>
                <input type="number" min="0" value={minQty} onChange={(e) => setMinQty(e.target.value)} className="warehouse-form-modal__input" placeholder="0" />
              </label>
            </div>
          </section>
          <div className="warehouse-form-modal__actions">
            <button type="button" className="warehouse-form-modal__btn warehouse-form-modal__btn--cancel" onClick={onClose} disabled={saving}>Отмена</button>
            <button type="submit" className="warehouse-form-modal__btn warehouse-form-modal__btn--submit" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default ProductFormModal;

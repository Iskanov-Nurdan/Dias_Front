import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Select, SubmitButton } from '../../../shared/ui';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import './SaleFormModal.scss';

const SaleFormModal = ({ products = [], onSave, onClose, error, saving }) => {
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [discount, setDiscount] = useState('');
  const [date, setDate] = useState('');

  useModalEffect(true, onClose);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setDate(today);
  }, []);

  const selectedProduct = products.find((p) => String(p.id) === String(productId));
  useEffect(() => {
    const p = products.find((pr) => String(pr.id) === String(productId));
    if (p && p.sellingPrice != null) {
      setPricePerUnit(String(p.sellingPrice));
    } else {
      setPricePerUnit('');
    }
  }, [productId, products]);

  const priceBase = Number(pricePerUnit) || 0;
  const discountPct = Number(discount) || 0;
  const priceAfterDiscount = priceBase * (1 - discountPct / 100);
  const qtyNum = Math.max(0, parseInt(qty, 10) || 0);
  const totalSum = priceAfterDiscount * qtyNum;
  const formatSum = (v) => (v != null && !Number.isNaN(v) ? `${Number(v).toLocaleString('ru-RU')} сом` : '—');

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      productId: productId ? Number(productId) : undefined,
      qty: qty !== '' ? Number(qty) : undefined,
      pricePerUnit: pricePerUnit !== '' ? Number(pricePerUnit) : undefined,
      discountPercent: discount !== '' ? Number(discount) : undefined,
      date: date || undefined,
    };
    onSave(payload);
  };

  const content = (
    <div className="sale-form-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="sale-form-modal-title">
      <div className="sale-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sale-form-modal__header">
          <h2 id="sale-form-modal-title" className="sale-form-modal__title">Новая продажа</h2>
          <button type="button" className="sale-form-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        {error && <p className="sale-form-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="sale-form-modal__form">
          <section className="sale-form-modal__section">
            <h3 className="sale-form-modal__section-title">Товар и количество</h3>
            <label className="sale-form-modal__label">
              <span className="sale-form-modal__label-caption">Товар</span>
              <Select
                value={String(productId)}
                onChange={(v) => setProductId(v)}
                options={[{ value: '', label: '—' }, ...products.map((p) => ({ value: String(p.id), label: p.name || '' }))]}
                placeholder="—"
                className="sale-form-modal__select"
              />
            </label>
            <div className="sale-form-modal__row">
              <label className="sale-form-modal__label">
                <span className="sale-form-modal__label-caption">Количество <span className="form-label-required" aria-hidden="true">*</span></span>
                <input type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} required className="sale-form-modal__input" placeholder="1" />
              </label>
              <label className="sale-form-modal__label sale-form-modal__label--price">
                <span className="sale-form-modal__label-caption">Цена за ед. <span className="form-label-required" aria-hidden="true">*</span></span>
                <div className="sale-form-modal__price-wrap">
                  <input type="number" step="any" min="0" value={pricePerUnit} readOnly className="sale-form-modal__input sale-form-modal__input--readonly" placeholder="Выберите товар" tabIndex={-1} aria-readonly="true" />
                  {!selectedProduct && <span className="sale-form-modal__price-hint">Заполнится после выбора товара</span>}
                </div>
              </label>
            </div>
          </section>
          <section className="sale-form-modal__section">
            <h3 className="sale-form-modal__section-title">Скидка и дата</h3>
            <label className="sale-form-modal__label">
              <span className="sale-form-modal__label-caption">Скидка, %</span>
              <input type="number" step="any" min="0" max="100" value={discount} onChange={(e) => setDiscount(e.target.value)} className="sale-form-modal__input" placeholder="0" />
            </label>
            {selectedProduct && priceBase > 0 && (
              <div className="sale-form-modal__calc">
                <div className="sale-form-modal__calc-row">
                  <span>До скидки</span>
                  <span>{formatSum(priceBase)}</span>
                </div>
                {discountPct > 0 && (
                  <div className="sale-form-modal__calc-row sale-form-modal__calc-row--discount">
                    <span>Со скидкой ({discountPct}%)</span>
                    <span>{formatSum(priceAfterDiscount)}</span>
                  </div>
                )}
                {qtyNum > 0 && (
                  <div className="sale-form-modal__calc-row sale-form-modal__calc-row--total">
                    <span>Итого к оплате</span>
                    <strong>{formatSum(totalSum)}</strong>
                  </div>
                )}
              </div>
            )}
            <label className="sale-form-modal__label">
              <span className="sale-form-modal__label-caption">Дата</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sale-form-modal__input" />
            </label>
          </section>
          <div className="sale-form-modal__actions">
            <button type="button" className="sale-form-modal__btn sale-form-modal__btn--cancel" onClick={onClose} disabled={saving}>Отмена</button>
            <SubmitButton loading={saving} loadingLabel="Оформление…" className="sale-form-modal__btn sale-form-modal__btn--submit">
              Оформить
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default SaleFormModal;

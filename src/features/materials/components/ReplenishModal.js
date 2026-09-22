import React, { useState, useEffect, useMemo } from 'react';
import { PackagePlus } from 'lucide-react';
import {
  Select, SubmitButton, MoneyInput, FormModal,
} from '../../../shared/ui';
import { fetchRawMaterials } from '../api';
import './ReplenishModal.scss';

const unitLabel = (unit) => (unit === 'g' ? 'г' : 'кг');

const defaultReceivedAtLocal = () => {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

/**
 * `material` — фиксированное сырьё (открыто из строки таблицы, поле выбора
 * не показываем). Если material не передан — режим выбора из списка
 * (открыто с тулбара «Приход»).
 */
const ReplenishModal = ({ material, onSave, onClose, error, saving }) => {
  const pickMode = !material;
  const [materialId, setMaterialId] = useState(material?.id ? String(material.id) : '');
  const [materialsOptions, setMaterialsOptions] = useState([]);
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [receivedAt, setReceivedAt] = useState(defaultReceivedAtLocal());
  const [supplierName, setSupplierName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState({});
  const markTouched = (field) => setTouched((t) => (t[field] ? t : { ...t, [field]: true }));

  useEffect(() => {
    if (!pickMode) return;
    let cancelled = false;
    fetchRawMaterials({}, null)
      .then((data) => {
        if (cancelled) return;
        const items = data?.items ?? data?.results ?? [];
        setMaterialsOptions(items.map((m) => ({ value: String(m.id), label: `${m.name} (${unitLabel(m.unit)})`, unit: m.unit })));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pickMode]);

  const selectedUnit = pickMode
    ? materialsOptions.find((o) => o.value === materialId)?.unit
    : material?.unit;

  const qtyError = touched.quantity && !(Number(quantity) > 0) ? 'Количество должно быть больше 0' : null;
  const priceError = touched.unitPrice && !(Number(unitPrice) >= 0) ? 'Укажите цену' : null;
  const materialError = touched.material && pickMode && !materialId ? 'Выберите сырьё' : null;

  const total = useMemo(() => {
    const q = Number(quantity);
    const p = Number(unitPrice);
    return Number.isFinite(q) && Number.isFinite(p) ? q * p : null;
  }, [quantity, unitPrice]);

  const handleSubmit = (e) => {
    e.preventDefault();
    markTouched('quantity');
    markTouched('unitPrice');
    markTouched('material');
    const finalMaterialId = pickMode ? materialId : material.id;
    if (!finalMaterialId || !(Number(quantity) > 0) || !(Number(unitPrice) >= 0) || !receivedAt) return;
    onSave({
      material_id: Number(finalMaterialId),
      quantity: Number(quantity),
      unit_price: Number(unitPrice),
      received_at: new Date(receivedAt).toISOString(),
      supplier_name: supplierName.trim() || undefined,
      document_number: documentNumber.trim() || undefined,
      comment: comment.trim() || undefined,
    });
  };

  return (
    <FormModal
      icon={PackagePlus}
      eyebrow="Приход сырья"
      title={pickMode ? 'Новый приход' : material?.name}
      onClose={onClose}
      error={error}
      size="fullscreen"
    >
      <form onSubmit={handleSubmit} className="form-modal__form">
        <div className="form-modal__body">
            {pickMode && (
              <div className="rpm__field">
                <label className="rpm__label">Сырьё <span className="rpm__required">*</span></label>
                <Select
                  value={materialId}
                  onChange={(v) => { setMaterialId(v); markTouched('material'); }}
                  options={materialsOptions}
                  placeholder="Выберите сырьё"
                  className="rpm__select"
                />
                {materialError && <span className="rpm__field-error">{materialError}</span>}
              </div>
            )}

            <div className="rpm__row">
              <div className="rpm__field">
                <label className="rpm__label" htmlFor="rpm-qty">
                  Количество ({unitLabel(selectedUnit)}) <span className="rpm__required">*</span>
                </label>
                <MoneyInput
                  id="rpm-qty"
                  value={quantity}
                  onChange={setQuantity}
                  onBlur={() => markTouched('quantity')}
                  allowDecimals
                  className={`rpm__input${qtyError ? ' rpm__input--invalid' : ''}`}
                  placeholder="0"
                />
                {qtyError && <span className="rpm__field-error">{qtyError}</span>}
              </div>

              <div className="rpm__field">
                <label className="rpm__label" htmlFor="rpm-price">
                  Цена за единицу (сом) <span className="rpm__required">*</span>
                </label>
                <MoneyInput
                  id="rpm-price"
                  value={unitPrice}
                  onChange={setUnitPrice}
                  onBlur={() => markTouched('unitPrice')}
                  allowDecimals
                  className={`rpm__input${priceError ? ' rpm__input--invalid' : ''}`}
                  placeholder="0"
                />
                {priceError && <span className="rpm__field-error">{priceError}</span>}
              </div>
            </div>

            {total != null && (
              <div className="rpm__total">Итого к оплате: <strong>{total.toLocaleString('ru-RU')} сом</strong></div>
            )}

            <div className="rpm__row">
              <div className="rpm__field">
                <label className="rpm__label" htmlFor="rpm-date">
                  Дата прихода <span className="rpm__required">*</span>
                </label>
                <input
                  id="rpm-date"
                  type="datetime-local"
                  value={receivedAt}
                  onChange={(e) => setReceivedAt(e.target.value)}
                  required
                  className="rpm__input"
                />
              </div>

              <div className="rpm__field">
                <label className="rpm__label" htmlFor="rpm-supplier">Поставщик</label>
                <input
                  id="rpm-supplier"
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="rpm__input"
                  placeholder="Например: ООО «Стройпласт»"
                />
              </div>
            </div>

            <div className="rpm__field">
              <label className="rpm__label" htmlFor="rpm-doc">Номер документа</label>
              <input
                id="rpm-doc"
                type="text"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                className="rpm__input"
                placeholder="Например: НАКЛ-1245"
              />
            </div>

            <div className="rpm__field">
              <label className="rpm__label" htmlFor="rpm-comment">Комментарий</label>
              <textarea
                id="rpm-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="rpm__textarea"
                rows={2}
                placeholder="Необязательно"
              />
            </div>
        </div>

        <div className="form-modal__actions">
          <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary">
            Оприходовать
          </SubmitButton>
        </div>
      </form>
    </FormModal>
  );
};

export default ReplenishModal;

import React, { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { SubmitButton, MoneyInput, FormModal } from '../../../shared/ui';
import './MaterialFormModal.scss';

/**
 * Единица измерения не выбирается пользователем — всё сырьё заводится в кг,
 * дробное количество (0.5, 0.05...) уже покрывает граммы, отдельная
 * единица 'g' для нового сырья не заводится (как и было в исходном
 * Dias_Front — там unit тоже всегда хардкодился в 'kg' на создании).
 * У уже существующего сырья с unit='g' это поле просто не трогаем —
 * на PATCH мы его не отправляем вовсе.
 */
const MaterialFormModal = ({ material, onSave, onClose, error, saving }) => {
  const isEdit = !!material?.id;
  const [name, setName] = useState('');
  const [minBalance, setMinBalance] = useState('');
  const [touched, setTouched] = useState({});
  const markTouched = (field) => setTouched((t) => (t[field] ? t : { ...t, [field]: true }));

  const nameError = touched.name && !name.trim() ? 'Укажите название' : null;

  useEffect(() => {
    if (material) {
      setName(material.name || '');
      setMinBalance(material.min_balance != null ? String(material.min_balance) : '');
    }
  }, [material]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) { markTouched('name'); return; }
    const payload = {
      name: name.trim(),
      min_balance: minBalance !== '' ? Number(minBalance) : null,
    };
    if (!isEdit) {
      payload.unit = 'kg';
      payload.is_active = true;
    }
    onSave(payload);
  };

  return (
    <FormModal
      icon={Package}
      eyebrow={isEdit ? 'Редактирование' : 'Новое сырьё'}
      title={isEdit ? material?.name || 'Сырьё' : 'Добавить сырьё'}
      onClose={onClose}
      error={error}
      size="sheet"
    >
      <form onSubmit={handleSubmit} className="form-modal__form">
        <div className="form-modal__body">
          <div className="mfm__field">
            <label className="mfm__label" htmlFor="mfm-name">
              <Package size={14} className="mfm__label-icon" />
              Название <span className="mfm__required">*</span>
            </label>
            <input
              id="mfm-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => markTouched('name')}
              required
              className={`mfm__input${nameError ? ' mfm__input--invalid' : ''}`}
              autoFocus
              placeholder="Например: Полипропилен PP-H"
            />
            {nameError && <span className="mfm__field-error">{nameError}</span>}
          </div>

          <div className="mfm__field">
            <label className="mfm__label" htmlFor="mfm-min-balance">
              Минимальный остаток (кг)
            </label>
            <MoneyInput
              id="mfm-min-balance"
              value={minBalance}
              onChange={setMinBalance}
              allowDecimals
              className="mfm__input"
              placeholder="0"
            />
          </div>
        </div>

        <div className="form-modal__actions">
          <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary">
            {isEdit ? 'Сохранить' : 'Добавить'}
          </SubmitButton>
        </div>
      </form>
    </FormModal>
  );
};

export default MaterialFormModal;

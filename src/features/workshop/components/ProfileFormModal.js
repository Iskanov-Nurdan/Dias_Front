import React, { useState, useEffect, useMemo } from 'react';
import { Grid3x3 } from 'lucide-react';
import {
  Select, SubmitButton, MoneyInput, FormModal,
} from '../../../shared/ui';
import './BlankModal.scss';
import './ProfileFormModal.scss';

const EXTRA_FIELDS = [
  { key: 'extra_rubber', label: 'Резинка, сом/шт' },
  { key: 'extra_label', label: 'Этикетка, сом/шт' },
  { key: 'extra_labor', label: 'Рабочая сила, сом/шт' },
  { key: 'extra_electricity', label: 'Свет, сом/шт' },
  { key: 'extra_repair', label: 'Ремонт, сом/шт' },
];

const formatMoney = (n) => `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} сом`;

const ProfileFormModal = ({ profile, blanks, onSave, onClose, error, saving }) => {
  const isEdit = !!profile?.id;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [blankId, setBlankId] = useState('');
  const [weightKgPerPiece, setWeightKgPerPiece] = useState('');
  const [markupAmount, setMarkupAmount] = useState('');
  const [extras, setExtras] = useState(() => EXTRA_FIELDS.reduce((o, f) => ({ ...o, [f.key]: '' }), {}));
  const [touched, setTouched] = useState({});
  const markTouched = (field) => setTouched((t) => (t[field] ? t : { ...t, [field]: true }));

  const nameError = touched.name && !name.trim() ? 'Укажите название' : null;
  const blankError = touched.blank && !isEdit && !blankId ? 'Выберите заготовку' : null;

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setCode(profile.code || '');
      setBlankId(profile.blank_id ? String(profile.blank_id) : '');
      setWeightKgPerPiece(profile.weight_kg_per_piece != null ? String(profile.weight_kg_per_piece) : '');
      setMarkupAmount(profile.markup_amount != null ? String(profile.markup_amount) : '');
      setExtras(EXTRA_FIELDS.reduce((o, f) => ({ ...o, [f.key]: profile[f.key] != null ? String(profile[f.key]) : '' }), {}));
    }
  }, [profile]);

  const blankOptions = (blanks || []).map((b) => ({ value: String(b.id), label: b.name }));

  // Пересчитываем прямо по вводу — та же формула, что и на бэкенде
  // (apps/recipes/profile_pricing.py): other_expenses_total = сумма extra_*;
  // sale_unit_price = cost_price + other_expenses_total + markup_amount,
  // и только если себестоимость уже посчитана (после первого учёта в ОТК).
  const otherExpensesTotal = useMemo(
    () => EXTRA_FIELDS.reduce((sum, f) => sum + (Number(extras[f.key]) || 0), 0),
    [extras],
  );
  const costPrice = profile?.cost_price != null ? Number(profile.cost_price) : null;
  const saleUnitPrice = costPrice != null ? costPrice + otherExpensesTotal + (Number(markupAmount) || 0) : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    markTouched('name');
    markTouched('blank');
    if (!name.trim() || (!isEdit && !blankId)) return;
    const payload = {
      name: name.trim(),
      weight_kg_per_piece: weightKgPerPiece !== '' ? Number(weightKgPerPiece) : null,
      markup_amount: markupAmount !== '' ? Number(markupAmount) : 0,
      ...Object.fromEntries(EXTRA_FIELDS.map((f) => [f.key, extras[f.key] !== '' ? Number(extras[f.key]) : 0])),
    };
    if (code.trim()) payload.code = code.trim();
    if (blankId) payload.blank_id = Number(blankId);
    onSave(payload);
  };

  return (
    <FormModal
      icon={Grid3x3}
      eyebrow={isEdit ? 'Редактирование' : 'Новый профиль'}
      title={isEdit ? profile?.name || 'Профиль' : 'Добавить профиль'}
      onClose={onClose}
      error={error}
      size="fullscreen"
      className="pfm"
    >
      <form onSubmit={handleSubmit} className="form-modal__form">
        <div className="form-modal__body">
            <div className="pfm__row">
              <div className="wbm__field">
                <label className="wbm__label" htmlFor="pfm-name">
                  Название <span className="wbm__required">*</span>
                </label>
                <input
                  id="pfm-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => markTouched('name')}
                  required
                  className={`wbm__input${nameError ? ' wbm__input--invalid' : ''}`}
                  autoFocus
                />
                {nameError && <span className="wbm__field-error">{nameError}</span>}
              </div>

              <div className="wbm__field">
                <label className="wbm__label" htmlFor="pfm-code">
                  Код <span className="pfm__hint">· авто, если пусто</span>
                </label>
                <input
                  id="pfm-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="wbm__input"
                />
              </div>
            </div>

            <div className="wbm__field">
              <label className="wbm__label">
                Заготовка {!isEdit && <span className="wbm__required">*</span>}
              </label>
              <Select
                value={blankId}
                onChange={(v) => { setBlankId(v); markTouched('blank'); }}
                options={blankOptions}
                placeholder="Выберите заготовку"
              />
              {blankError && <span className="wbm__field-error">{blankError}</span>}
            </div>

            <div className="wbm__field">
              <label className="wbm__label" htmlFor="pfm-weight">Вес одной штуки, кг</label>
              <MoneyInput id="pfm-weight" value={weightKgPerPiece} onChange={setWeightKgPerPiece} allowDecimals className="wbm__input pfm__half" placeholder="0" />
            </div>

            <div className="pfm__section">
              <h3 className="pfm__section-title">Прочие расходы (сом/шт)</h3>
              <div className="pfm__extras">
                {EXTRA_FIELDS.map((f) => (
                  <div className="wbm__field" key={f.key}>
                    <label className="wbm__label" htmlFor={`pfm-${f.key}`}>{f.label}</label>
                    <MoneyInput
                      id={`pfm-${f.key}`}
                      value={extras[f.key]}
                      onChange={(v) => setExtras((prev) => ({ ...prev, [f.key]: v }))}
                      allowDecimals
                      className="wbm__input"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="pfm__section">
              <h3 className="pfm__section-title">Цена</h3>
              <div className="pfm__row">
                <div className="wbm__field">
                  <label className="wbm__label">Себестоимость, сом</label>
                  <div className="pfm__readonly">{costPrice != null ? formatMoney(costPrice) : '—'}</div>
                </div>
                <div className="wbm__field">
                  <label className="wbm__label">Прочие расходы, сом</label>
                  <div className="pfm__readonly">{formatMoney(otherExpensesTotal)}</div>
                </div>
              </div>
              {costPrice == null && (
                <p className="pfm__hint-text">Себестоимость считается системой после первого учёта в ОТК. Изменить вручную нельзя.</p>
              )}
              <div className="pfm__row">
                <div className="wbm__field">
                  <label className="wbm__label" htmlFor="pfm-markup">Наценка, сом</label>
                  <MoneyInput id="pfm-markup" value={markupAmount} onChange={setMarkupAmount} allowDecimals className="wbm__input" placeholder="0" />
                </div>
                <div className="wbm__field">
                  <label className="wbm__label">Итого цена товара, сом</label>
                  <div className={`pfm__readonly${saleUnitPrice == null ? ' pfm__readonly--empty' : ' pfm__readonly--total'}`}>
                    {saleUnitPrice != null ? formatMoney(saleUnitPrice) : '—'}
                  </div>
                </div>
              </div>
              {saleUnitPrice == null ? (
                <p className="pfm__hint-text">Итоговая цена появится после расчёта себестоимости системой.</p>
              ) : (
                <p className="pfm__hint-text">Итого цена = себестоимость + прочие расходы + наценка.</p>
              )}
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

export default ProfileFormModal;

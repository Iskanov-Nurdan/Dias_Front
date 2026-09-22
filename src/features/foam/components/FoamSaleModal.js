import React, { useState, useMemo } from 'react';
import { ShoppingCart, Plus, Trash2 } from 'lucide-react';
import { Select, SubmitButton, MoneyInput, FormModal } from '../../../shared/ui';
import './FoamModals.scss';

const todayISO = () => new Date().toISOString().slice(0, 10);
const money = (n) => `${Number(n || 0).toLocaleString('ru-RU')} сом`;
const OUTPUT_LABEL = { cube: 'Куб', sheet: 'Лист', granule: 'Гранулят' };

let rowSeq = 0;
const emptyLine = () => ({ key: `line-${++rowSeq}`, stockId: '', qty: '', unitPrice: '' });

/**
 * У apps.foam свой клиент — свободный текст, без общего CRM-справочника
 * Клиентов (осознанное упрощение бэкенда, см. отчёт), и цена вводится
 * вручную — нет profile_sale_price-подобного расчёта, как в основной Кассе.
 */
const FoamSaleModal = ({ stock, onSave, onClose, error, saving }) => {
  const [client, setClient] = useState('');
  const [saleDate] = useState(todayISO());
  const [lines, setLines] = useState([emptyLine()]);
  const [paidAmount, setPaidAmount] = useState('');

  const stockOptions = (stock || [])
    .filter((s) => Number(s.qty) > 0)
    .map((s) => ({
      value: String(s.id),
      label: `${OUTPUT_LABEL[s.output_format] || s.output_format}${s.grade_code ? ` ${s.grade_code}` : ''}${s.thickness_cm ? ` ${s.thickness_cm}см` : ''} — доступно ${s.qty}`,
    }));
  const stockById = useMemo(() => Object.fromEntries((stock || []).map((s) => [String(s.id), s])), [stock]);

  const setLine = (key, patch) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (key) => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

  const validLines = lines
    .map((l) => {
      const row = stockById[l.stockId];
      const qty = Number(l.qty);
      const unitPrice = Number(l.unitPrice);
      if (!row || !(qty > 0) || !(unitPrice >= 0)) return null;
      const overQty = qty > Number(row.qty);
      return { ...l, row, qty, unitPrice, lineTotal: qty * unitPrice, overQty };
    })
    .filter(Boolean);

  const hasValidLines = validLines.length > 0;
  const hasOverage = validLines.some((l) => l.overQty);
  const total = validLines.reduce((s, l) => s + l.lineTotal, 0);
  const canSubmit = client.trim().length > 0 && hasValidLines && !hasOverage;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSave({
      client: client.trim(),
      saleDate,
      lines: validLines.map((l) => ({ stockId: Number(l.row.id), qty: l.qty, unitPrice: l.unitPrice })),
      paidAmount: paidAmount || undefined,
    });
  };

  return (
    <FormModal icon={ShoppingCart} eyebrow="Пенополистирол — касса" title="Новая продажа" onClose={onClose} error={error} size="fullscreen" className="fm">
      <form onSubmit={handleSubmit} className="form-modal__form">
        <div className="form-modal__body">
          <div className="fm__field">
            <label className="fm__label">Клиент <span className="fm__required">*</span></label>
            <input type="text" value={client} onChange={(e) => setClient(e.target.value)} className="fm__input" autoFocus placeholder="Имя / организация" />
          </div>

          <div className="fm__section">
            <h3 className="fm__section-title">Товары</h3>
            {lines.map((line) => {
              const row = stockById[line.stockId];
              const qty = Number(line.qty);
              const over = row && qty > Number(row.qty);
              return (
                <div key={line.key} className="fm__line">
                  <Select
                    value={line.stockId}
                    onChange={(v) => setLine(line.key, { stockId: v })}
                    options={stockOptions}
                    placeholder="Товар со склада ГП"
                    className="fm__line-batch"
                  />
                  <MoneyInput value={line.qty} onChange={(v) => setLine(line.key, { qty: v })} placeholder="Кол-во" className={`fm__line-qty${over ? ' fm__input--invalid' : ''}`} />
                  <MoneyInput value={line.unitPrice} onChange={(v) => setLine(line.key, { unitPrice: v })} placeholder="Цена" className="fm__line-price" />
                  <button type="button" className="fm__line-remove" onClick={() => removeLine(line.key)} disabled={lines.length <= 1} aria-label="Удалить строку">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
            <button type="button" className="fm__add-line" onClick={addLine}><Plus size={14} /> Товар</button>
          </div>

          <div className="fm__total-row">
            <span>Итого</span>
            <span className="fm__total-value">{money(total)}</span>
          </div>

          <div className="fm__field">
            <label className="fm__label">Оплачено сейчас</label>
            <MoneyInput value={paidAmount} onChange={setPaidAmount} placeholder={`0 из ${money(total)}`} className="fm__input" />
            <p className="fm__hint">Меньше суммы — остаток уйдёт в долг клиента.</p>
          </div>
        </div>

        <div className="form-modal__actions">
          <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>Отмена</button>
          <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary" disabled={!canSubmit}>Продать</SubmitButton>
        </div>
      </form>
    </FormModal>
  );
};

export default FoamSaleModal;

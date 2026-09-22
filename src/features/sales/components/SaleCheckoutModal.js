import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { Select, SubmitButton, MoneyInput, FormModal } from '../../../shared/ui';
import { fetchSaleSources } from '../api';
import { fetchClientsLite } from '../../clients/api';
import './SaleCheckoutModal.scss';

const PAYMENT_TYPE_OPTIONS = [
  { value: 'full', label: 'Полная оплата' },
  { value: 'partial', label: 'Частичная оплата' },
  { value: 'debt', label: 'В долг' },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Наличные' },
  { value: 'card', label: 'Карта' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);
const money = (n) => `${Number(n || 0).toLocaleString('ru-RU')} сом`;

let rowSeq = 0;
const emptyLine = () => ({ key: `line-${++rowSeq}`, batchId: '', quantity: '' });

/**
 * Чекаут кассы — один синхронный POST /sales/, склад списывается сразу
 * (см. apps/sales sale_warehouse.py apply_warehouse_for_sale в create()).
 * Цена строки — не свободный ввод: берём unit_sale_price из
 * available_warehouse_batches (select-sources), сервер всё равно сверит
 * с допуском 0.01 и отклонит расхождение (UNIT_PRICE_MISMATCH).
 */
const SaleCheckoutModal = ({ onSave, onClose, error, saving }) => {
  const [clients, setClients] = useState([]);
  const [batches, setBatches] = useState([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [clientId, setClientId] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [paymentType, setPaymentType] = useState('full');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [comment, setComment] = useState('');
  const [saleDate] = useState(todayISO());
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchClientsLite('', null),
      fetchSaleSources(null, null),
    ])
      .then(([clientsList, sources]) => {
        setClients(clientsList);
        setBatches(sources?.available_warehouse_batches ?? []);
      })
      .finally(() => setSourcesLoading(false));
  }, []);

  const clientOptions = clients.map((c) => ({ value: String(c.id), label: c.name }));
  const batchOptions = batches
    .filter((b) => Number(b.available_pieces) > 0)
    .map((b) => ({ value: String(b.id), label: b.display || `${b.product_name} — ${b.available_pieces} шт` }));
  const batchById = useMemo(() => Object.fromEntries(batches.map((b) => [String(b.id), b])), [batches]);

  const setLine = (key, patch) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (key) => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

  const validLines = lines
    .map((l) => {
      const batch = batchById[l.batchId];
      const quantity = Number(l.quantity);
      if (!batch || !(quantity > 0)) return null;
      const unitPrice = Number(batch.unit_sale_price ?? batch.sale_unit_price ?? 0);
      const overQty = quantity > Number(batch.available_pieces);
      return { ...l, batch, quantity, unitPrice, lineTotal: quantity * unitPrice, overQty };
    })
    .filter(Boolean);

  const hasValidLines = validLines.length > 0;
  const hasOverage = validLines.some((l) => l.overQty);
  const total = validLines.reduce((sum, l) => sum + l.lineTotal, 0);
  const canSubmit = !!clientId && hasValidLines && !hasOverage;

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    onSave({
      clientId: Number(clientId),
      saleDate,
      lines: validLines.map((l) => ({
        warehouseBatchId: Number(l.batch.id),
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      paymentType,
      paymentMethod: paymentType === 'debt' ? undefined : paymentMethod,
      paidAmount: paymentType === 'full' ? total : paymentType === 'partial' ? paidAmount : undefined,
      comment: comment || undefined,
    });
  };

  return (
    <FormModal icon={ShoppingCart} eyebrow="Касса" title="Новая продажа" onClose={onClose} error={error} size="fullscreen" className="scm">
      <form onSubmit={handleSubmit} className="form-modal__form">
        <div className="form-modal__body">
          <div className="scm__field">
            <label className="scm__label">Клиент <span className="scm__required">*</span></label>
            <Select
              value={clientId}
              onChange={setClientId}
              options={clientOptions}
              placeholder={sourcesLoading ? 'Загрузка…' : 'Выберите клиента'}
              disabled={sourcesLoading}
            />
            {touched && !clientId && <span className="scm__field-error">Обязательно</span>}
          </div>

          <div className="scm__section">
            <h3 className="scm__section-title">Товары</h3>
            {lines.map((line) => {
              const batch = batchById[line.batchId];
              const qty = Number(line.quantity);
              const price = batch ? Number(batch.unit_sale_price ?? batch.sale_unit_price ?? 0) : 0;
              const over = batch && qty > Number(batch.available_pieces);
              return (
                <div key={line.key} className="scm__line">
                  <Select
                    value={line.batchId}
                    onChange={(v) => setLine(line.key, { batchId: v })}
                    options={batchOptions}
                    placeholder={sourcesLoading ? 'Загрузка…' : 'Товар — партия'}
                    disabled={sourcesLoading}
                    className="scm__line-batch"
                  />
                  <MoneyInput
                    value={line.quantity}
                    onChange={(v) => setLine(line.key, { quantity: v })}
                    placeholder="Кол-во"
                    className={`scm__line-qty${over ? ' scm__line-qty--invalid' : ''}`}
                  />
                  <div className="scm__line-meta">
                    <span className="scm__line-price">{batch ? money(price) : '—'}</span>
                    <span className="scm__line-total">{batch && qty > 0 ? money(qty * price) : '—'}</span>
                  </div>
                  <button type="button" className="scm__line-remove" onClick={() => removeLine(line.key)} disabled={lines.length <= 1} aria-label="Удалить строку">
                    <Trash2 size={14} />
                  </button>
                  {over && (
                    <p className="scm__line-error"><TriangleAlert size={12} /> Доступно только {batch.available_pieces} шт</p>
                  )}
                </div>
              );
            })}
            <button type="button" className="scm__add-line" onClick={addLine}>
              <Plus size={14} /> Товар
            </button>
          </div>

          <div className="scm__total-row">
            <span>Итого</span>
            <span className="scm__total-value">{money(total)}</span>
          </div>

          <div className="scm__section">
            <h3 className="scm__section-title">Оплата</h3>
            <div className="scm__row">
              <div className="scm__field">
                <label className="scm__label">Тип оплаты</label>
                <Select value={paymentType} onChange={setPaymentType} options={PAYMENT_TYPE_OPTIONS} />
              </div>
              {paymentType !== 'debt' && (
                <div className="scm__field">
                  <label className="scm__label">Способ</label>
                  <Select value={paymentMethod} onChange={setPaymentMethod} options={PAYMENT_METHOD_OPTIONS} />
                </div>
              )}
            </div>
            {paymentType === 'partial' && (
              <div className="scm__field">
                <label className="scm__label">Сумма оплаты сейчас</label>
                <MoneyInput value={paidAmount} onChange={setPaidAmount} placeholder="0" className="scm__input" />
              </div>
            )}
            {paymentType === 'full' && (
              <p className="scm__hint">Будет списана вся сумма — {money(total)}.</p>
            )}
            {paymentType === 'debt' && (
              <p className="scm__hint">Товар отгружается, оплата не регистрируется — долг клиента вырастет на {money(total)}.</p>
            )}
          </div>

          <div className="scm__field">
            <label className="scm__label">Комментарий</label>
            <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} className="scm__input" placeholder="Необязательно" />
          </div>
        </div>

        <div className="form-modal__actions">
          <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary" disabled={!canSubmit}>
            Продать
          </SubmitButton>
        </div>
      </form>
    </FormModal>
  );
};

export default SaleCheckoutModal;

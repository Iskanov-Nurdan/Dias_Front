import React, { useMemo, useState } from 'react';
import {
  formatNumberForInput,
  parseLocaleNumber,
  pickFirstIsoDate,
  matchesClientDateFilter,
} from '../../../../shared/lib';
import { Badge, ClientDateFilter, EmptyState, useToast } from '../../../../shared/ui';
import {
  FOAM_SALE_PAYMENT_STATUS_LABEL,
  FOAM_SALE_PAYMENT_STATUS_VARIANT,
  foamOutputFormatLabel,
  foamOutputUnitLabel,
  foamFormatParamsLabel,
  foamSaleTypeLabel,
} from '../../../foam/mockData';
import { useFoamStore, createFoamSale } from '../../../foam/store';
import './SalesFoamTab.scss';

const formatDate = (v) => (v ? String(v).slice(0, 10) : '—');
const toMoney = (v) => `${formatNumberForInput(v)} сом`;

const stockRowLabel = (row) => {
  const parts = [foamOutputFormatLabel(row.outputFormat)];
  if (row.gradeCode) parts.push(`плотность ${row.gradeCode}`);
  const params = foamFormatParamsLabel(row);
  if (params) parts.push(params);
  return `${parts.join(', ')} — остаток ${formatNumberForInput(row.qty)} ${foamOutputUnitLabel(row.outputFormat)}`;
};

const newEmptyLine = () => ({ key: '', qty: '', unitPrice: '' });

const CreateFoamSaleModal = ({ stock, onClose, onCreate }) => {
  const [client, setClient] = useState('');
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState([newEmptyLine()]);
  const [payTab, setPayTab] = useState('paid');
  const [paidAmountStr, setPaidAmountStr] = useState('');

  const availableStock = stock.filter((r) => r.qty > 0);

  const lineTotals = useMemo(
    () => lines.map((ln) => (parseLocaleNumber(ln.qty) || 0) * (parseLocaleNumber(ln.unitPrice) || 0)),
    [lines],
  );
  const total = useMemo(() => Math.round(lineTotals.reduce((s, v) => s + v, 0) * 100) / 100, [lineTotals]);

  const paidAmount = payTab === 'paid' ? total : (payTab === 'debt' ? 0 : (parseLocaleNumber(paidAmountStr) || 0));
  const debtAmount = Math.max(0, Math.round((total - paidAmount) * 100) / 100);

  const updateLine = (idx, patch) => {
    setLines((prev) => prev.map((ln, i) => (i === idx ? { ...ln, ...patch } : ln)));
  };
  const addLine = () => setLines((prev) => [...prev, newEmptyLine()]);
  const removeLine = (idx) => setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const hasValidLines = lines.some((ln) => {
    const row = stock.find((r) => r.key === ln.key);
    const qty = parseLocaleNumber(ln.qty);
    const price = parseLocaleNumber(ln.unitPrice);
    return row && qty > 0 && qty <= row.qty && Number.isFinite(price) && price >= 0;
  });

  const canSubmit = client.trim() && hasValidLines && total > 0
    && (payTab !== 'partial' || (paidAmount > 0 && paidAmount < total));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onCreate({
      client: client.trim(),
      saleDate,
      lines: lines
        .filter((ln) => ln.key && parseLocaleNumber(ln.qty) > 0)
        .map((ln) => ({ key: ln.key, qty: parseLocaleNumber(ln.qty), unitPrice: parseLocaleNumber(ln.unitPrice) || 0 })),
      paidAmount,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal modal--wide" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Создать продажу</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit}>
          <label>Клиент</label>
          <input value={client} onChange={(ev) => setClient(ev.target.value)} placeholder="Название клиента" autoComplete="off" required />
          <label>Дата продажи</label>
          <input type="date" value={saleDate} onChange={(ev) => setSaleDate(ev.target.value)} required />

          <label>Позиции</label>
          <div className="sales-foam-tab__lines">
            {lines.map((ln, idx) => {
              const row = stock.find((r) => r.key === ln.key);
              const qtyNum = parseLocaleNumber(ln.qty);
              const overStock = row && qtyNum > row.qty;
              return (
                <div key={idx} className="sales-foam-tab__line">
                  <select value={ln.key} onChange={(ev) => updateLine(idx, { key: ev.target.value })}>
                    <option value="">Выберите товар</option>
                    {availableStock.map((r) => (
                      <option key={r.key} value={r.key}>{stockRowLabel(r)}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Кол-во"
                    value={ln.qty}
                    onChange={(ev) => updateLine(idx, { qty: ev.target.value })}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Цена за ед., сом"
                    value={ln.unitPrice}
                    onChange={(ev) => updateLine(idx, { unitPrice: ev.target.value })}
                  />
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => removeLine(idx)} disabled={lines.length <= 1}>
                    ×
                  </button>
                  {overStock && <p className="modal__error sales-foam-tab__line-error">На складе только {formatNumberForInput(row.qty)}</p>}
                </div>
              );
            })}
          </div>
          <button type="button" className="btn btn--secondary btn--sm sales-foam-tab__add-line" onClick={addLine}>
            + Добавить позицию
          </button>

          <div className="sales-foam-tab__total-box">
            <span>Итого</span>
            <strong>{toMoney(total)}</strong>
          </div>

          <label>Оплата</label>
          <div className="sales-foam-tab__pay-tabs">
            <button type="button" className={`btn btn--sm ${payTab === 'paid' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setPayTab('paid')}>Оплачено полностью</button>
            <button type="button" className={`btn btn--sm ${payTab === 'partial' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setPayTab('partial')}>Частично</button>
            <button type="button" className={`btn btn--sm ${payTab === 'debt' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setPayTab('debt')}>В долг</button>
          </div>
          {payTab === 'partial' && (
            <>
              <label>Оплачено сейчас, сом</label>
              <input type="number" min="0" step="0.01" value={paidAmountStr} onChange={(ev) => setPaidAmountStr(ev.target.value)} />
            </>
          )}
          <p className="sales-foam-tab__debt-hint">
            Оплачено: {toMoney(paidAmount)} · Долг: {toMoney(debtAmount)}
          </p>

          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={!canSubmit}>Создать продажу</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SaleDetailsModal = ({ sale, onClose }) => (
  <div className="modal-overlay" role="presentation" onClick={onClose}>
    <div className="modal" onClick={(ev) => ev.stopPropagation()}>
      <div className="modal__head">
        <h3>Продажа: {sale.client}</h3>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
      </div>
      <div className="modal__body">
        <div className="sales-foam-tab__detail-lines">
          {sale.lines.map((ln, idx) => (
            <div key={idx} className="sales-foam-tab__detail-line">
              <span>
                {foamOutputFormatLabel(ln.outputFormat)}
                {ln.gradeCode ? `, плотность ${ln.gradeCode}` : ''}
                {ln.thicknessCm ? `, ${ln.thicknessCm} см` : ''}
              </span>
              <span>{formatNumberForInput(ln.qty)} {foamOutputUnitLabel(ln.outputFormat)} × {toMoney(ln.unitPrice)}</span>
            </div>
          ))}
        </div>
        <p className="sales-foam-tab__debt-hint">
          Итого: {toMoney(sale.totalAmount)} · Оплачено: {toMoney(sale.paidAmount)} · Долг: {toMoney(sale.debtAmount)}
        </p>
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  </div>
);

const SalesFoamTab = () => {
  const toast = useToast();
  const { gpStock, sales } = useFoamStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsSale, setDetailsSale] = useState(null);
  const [dateFilterIso, setDateFilterIso] = useState('');

  const visibleSales = useMemo(() => {
    if (!dateFilterIso) return sales;
    return sales.filter((s) => matchesClientDateFilter(dateFilterIso, pickFirstIsoDate(s, ['date'])));
  }, [sales, dateFilterIso]);

  const handleCreate = (payload) => {
    createFoamSale(payload);
    toast.success(`Продажа создана: ${payload.client}`);
  };

  return (
    <div className="sales-foam-tab">
      <div className="ds-toolbar commercial-toolbar">
        <div className="ds-toolbar__start commercial-toolbar__filters">
          <ClientDateFilter value={dateFilterIso} onChange={setDateFilterIso} id="sales-foam-date-filter" />
        </div>
        <div className="ds-toolbar__end">
          <button type="button" className="btn btn--primary" onClick={() => setCreateOpen(true)}>
            Создать продажу
          </button>
        </div>
      </div>

      {visibleSales.length === 0 ? (
        <EmptyState title="Нет продаж" description="Нажмите «Создать продажу», чтобы оформить отгрузку клиенту." />
      ) : (
        <div className="commercial-table-wrap">
          <table className="data-table data-table--sales data-table--row-actions">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Дата</th>
                <th>Тип продажи</th>
                <th className="data-table__cell--num">Сумма</th>
                <th className="data-table__cell--num">Оплачено</th>
                <th className="data-table__cell--num">Долг</th>
                <th>Статус оплаты</th>
                <th>Детали</th>
              </tr>
            </thead>
            <tbody>
              {visibleSales.map((s) => (
                <tr key={s.id}>
                  <td>{s.client}</td>
                  <td>{formatDate(s.date)}</td>
                  <td>{foamSaleTypeLabel(s)}</td>
                  <td className="data-table__cell--num">{toMoney(s.totalAmount)}</td>
                  <td className="data-table__cell--num">{toMoney(s.paidAmount)}</td>
                  <td className="data-table__cell--num">{toMoney(s.debtAmount)}</td>
                  <td><Badge variant={FOAM_SALE_PAYMENT_STATUS_VARIANT[s.paymentStatus]}>{FOAM_SALE_PAYMENT_STATUS_LABEL[s.paymentStatus]}</Badge></td>
                  <td>
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => setDetailsSale(s)}>
                      Открыть
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <CreateFoamSaleModal stock={gpStock} onClose={() => setCreateOpen(false)} onCreate={handleCreate} />
      )}

      {detailsSale && (
        <SaleDetailsModal sale={detailsSale} onClose={() => setDetailsSale(null)} />
      )}
    </div>
  );
};

export default SalesFoamTab;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiPlus, FiCheck, FiX } from 'react-icons/fi';
import {
  formatNumberForInput,
  parseLocaleNumber,
  pickFirstIsoDate,
  matchesClientDateFilter,
  getApiErrorMessage,
} from '../../../../shared/lib';
import { Badge, ClientDateFilter, EmptyState, Loading, useToast, SearchInput } from '../../../../shared/ui';
import { useOperationalRefetch, WS_FOAM_SALES } from '../../../../shared/realtime';
import {
  FOAM_SALE_PAYMENT_STATUS_LABEL,
  FOAM_SALE_PAYMENT_STATUS_VARIANT,
  foamOutputFormatLabel,
  foamOutputUnitLabel,
  foamFormatParamsLabel,
} from '../../../foam/mockData';
import { getFoamGpStock, getFoamSales, createFoamSale } from '../../../foam/api/foamApi';
import './SalesFoamTab.scss';

const formatDate = (v) => (v ? String(v).slice(0, 10) : '—');
const toMoney = (v) => `${formatNumberForInput(v)} сом`;

const toCalcRow = (row) => ({
  outputFormat: row.output_format,
  gradeCode: row.grade_code,
  thicknessCm: row.thickness_cm,
  qty: Number(row.qty),
});

/** Короткая подпись типа продажи по составу строк (форматы через запятую). */
const foamSaleTypeLabel = (sale) => {
  const formats = [...new Set((sale?.lines || []).map((ln) => foamOutputFormatLabel(ln.output_format)))];
  return formats.length ? formats.join(', ') : '—';
};

const stockRowLabel = (row) => {
  const parts = [foamOutputFormatLabel(row.output_format)];
  if (row.grade_code) parts.push(`плотность ${row.grade_code}`);
  const params = foamFormatParamsLabel(toCalcRow(row));
  if (params) parts.push(params);
  return `${parts.join(', ')} — остаток ${formatNumberForInput(row.qty)} ${foamOutputUnitLabel(row.output_format)}`;
};

const newEmptyLine = () => ({ stockId: '', qty: '', unitPrice: '' });

const CreateFoamSaleModal = ({ stock, onClose, onCreate, saving }) => {
  const [client, setClient] = useState('');
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState([newEmptyLine()]);
  const [payTab, setPayTab] = useState('paid');
  const [paidAmountStr, setPaidAmountStr] = useState('');
  const [error, setError] = useState('');

  const availableStock = stock.filter((r) => Number(r.qty) > 0);

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
    const row = stock.find((r) => String(r.id) === String(ln.stockId));
    const qty = parseLocaleNumber(ln.qty);
    const price = parseLocaleNumber(ln.unitPrice);
    return row && qty > 0 && qty <= Number(row.qty) && Number.isFinite(price) && price >= 0;
  });

  const canSubmit = client.trim() && hasValidLines && total > 0
    && (payTab !== 'partial' || (paidAmount > 0 && paidAmount < total));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    try {
      await onCreate({
        client: client.trim(),
        sale_date: saleDate,
        lines: lines
          .filter((ln) => ln.stockId && parseLocaleNumber(ln.qty) > 0)
          .map((ln) => ({
            stock_id: Number(ln.stockId),
            qty: String(parseLocaleNumber(ln.qty)),
            unit_price: String(parseLocaleNumber(ln.unitPrice) || 0),
          })),
        paid_amount: String(paidAmount),
      });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
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
              const row = stock.find((r) => String(r.id) === String(ln.stockId));
              const qtyNum = parseLocaleNumber(ln.qty);
              const overStock = row && qtyNum > Number(row.qty);
              return (
                <div key={idx} className="sales-foam-tab__line">
                  <select value={ln.stockId} onChange={(ev) => updateLine(idx, { stockId: ev.target.value })}>
                    <option value="">Выберите товар</option>
                    {availableStock.map((r) => (
                      <option key={r.id} value={r.id}>{stockRowLabel(r)}</option>
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
          {error && <p className="modal__error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>
              <FiX aria-hidden size={16} strokeWidth={2} />
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving || !canSubmit}>
              <FiCheck aria-hidden size={16} strokeWidth={2} />
              {saving ? 'Сохранение…' : 'Создать продажу'}
            </button>
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
                {foamOutputFormatLabel(ln.output_format)}
                {ln.grade_code ? `, плотность ${ln.grade_code}` : ''}
                {ln.thickness_cm ? `, ${ln.thickness_cm} см` : ''}
              </span>
              <span>{formatNumberForInput(ln.qty)} {foamOutputUnitLabel(ln.output_format)} × {toMoney(ln.unit_price)}</span>
            </div>
          ))}
        </div>
        <p className="sales-foam-tab__debt-hint">
          Итого: {toMoney(sale.total_amount)} · Оплачено: {toMoney(sale.paid_amount)} · Долг: {toMoney(sale.debt_amount)}
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
  const [gpStock, setGpStock] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailsSale, setDetailsSale] = useState(null);
  const [dateFilterIso, setDateFilterIso] = useState('');
  const [salesSearch, setSalesSearch] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [stockRes, salesRes] = await Promise.all([
        getFoamGpStock(),
        getFoamSales({ page_size: 500 }),
      ]);
      setGpStock(stockRes.data?.items || []);
      setSales(salesRes.data?.items || []);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useOperationalRefetch(WS_FOAM_SALES, fetchAll, true);

  const visibleSales = useMemo(() => {
    let list = sales;
    if (dateFilterIso) {
      list = list.filter((s) => matchesClientDateFilter(dateFilterIso, pickFirstIsoDate(s, ['date'])));
    }
    const q = salesSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => String(s.client || '').toLowerCase().includes(q));
    }
    return list;
  }, [sales, dateFilterIso, salesSearch]);

  const handleCreate = async (payload) => {
    setSaving(true);
    try {
      await createFoamSale(payload);
      await fetchAll();
      toast.success(`Продажа создана: ${payload.client}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="sales-foam-tab">
      <div className="ds-toolbar commercial-toolbar">
        <div className="ds-toolbar__start commercial-toolbar__filters">
          <SearchInput
            value={salesSearch}
            onChange={(e) => setSalesSearch(e.target.value)}
            placeholder="Поиск по клиенту"
          />
          <ClientDateFilter value={dateFilterIso} onChange={setDateFilterIso} id="sales-foam-date-filter" />
        </div>
        <div className="ds-toolbar__end">
          <button type="button" className="btn btn--primary" onClick={() => setCreateOpen(true)}>
            <FiPlus aria-hidden size={16} strokeWidth={2} />
            Продажа
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
                  <td className="data-table__cell--num">{toMoney(s.total_amount)}</td>
                  <td className="data-table__cell--num">{toMoney(s.paid_amount)}</td>
                  <td className="data-table__cell--num">{toMoney(s.debt_amount)}</td>
                  <td><Badge variant={FOAM_SALE_PAYMENT_STATUS_VARIANT[s.payment_status]}>{FOAM_SALE_PAYMENT_STATUS_LABEL[s.payment_status]}</Badge></td>
                  <td>
                    <button type="button" className="action-row__btn" onClick={() => setDetailsSale(s)}>
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
        <CreateFoamSaleModal stock={gpStock} onClose={() => setCreateOpen(false)} onCreate={handleCreate} saving={saving} />
      )}

      {detailsSale && (
        <SaleDetailsModal sale={detailsSale} onClose={() => setDetailsSale(null)} />
      )}
    </div>
  );
};

export default SalesFoamTab;

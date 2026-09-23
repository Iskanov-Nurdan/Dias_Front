import React, { useEffect, useMemo, useState } from 'react';
import { Undo2, Search, TriangleAlert } from 'lucide-react';
import { FormModal, SubmitButton } from '../../../shared/ui';
import { useToast } from '../../../app/providers/ToastProvider';
import { getApiErrorMessage } from '../../../shared/lib/apiError';
import { fetchReturnableSales, fetchReturnableLines, createReturn } from '../api';
import './ReturnModal.scss';

const money = (n) => `${Number(n || 0).toLocaleString('ru-RU')} сом`;
const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Возврат — двухшаговая модалка: найти продажу → выбрать строки/количество
 * и провести. На бэке это POST /returns/ (draft) + POST /returns/{id}/complete/
 * одним действием (createReturn в api.js) — деньги возвращаются
 * автоматически (см. _create_auto_refund_payment): если по продаже ещё есть
 * долг, возврат сперва гасит его, наличными возвращается только остаток
 * сверху. Отдельного выбора «на карту» бэк сегодня не даёт — только cash.
 */
const ReturnModal = ({ onClose, onDone }) => {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [sales, setSales] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [returnLines, setReturnLines] = useState([]);
  const [qtyByLine, setQtyByLine] = useState({});
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setSearching(true);
    const t = setTimeout(() => {
      fetchReturnableSales(query, null)
        .then(setSales)
        .catch((err) => toast.error(getApiErrorMessage(err)))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const pickSale = (sale) => {
    setSelectedSale(sale);
    setQtyByLine({});
    fetchReturnableLines(sale.id, null).then(setReturnLines).catch((err) => toast.error(getApiErrorMessage(err)));
  };

  const setQty = (lineId, value) => setQtyByLine((prev) => ({ ...prev, [lineId]: value }));

  const selectedLines = useMemo(
    () => returnLines
      .map((l) => ({ ...l, qty: Number(qtyByLine[l.id] || 0) }))
      .filter((l) => l.qty > 0),
    [returnLines, qtyByLine],
  );

  const overQty = selectedLines.some((l) => l.qty > Number(l.returnable_quantity));
  const total = selectedLines.reduce((sum, l) => sum + l.qty * Number(l.unit_price || 0), 0);
  const canSubmit = !!selectedSale && selectedLines.length > 0 && !overQty;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSaving(true);
    try {
      await createReturn({
        saleId: selectedSale.id,
        date: todayISO(),
        reason,
        lines: selectedLines.map((l) => ({ saleLineId: l.id, quantity: l.qty, returnTarget: 'warehouse', conditionType: 'good' })),
      }, null);
      toast.success('Возврат оформлен');
      onDone?.();
      onClose();
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal icon={Undo2} eyebrow="Касса" title="Возврат" onClose={onClose} error={error} size="fullscreen" className="ret">
      <div className="form-modal__form">
        <div className="form-modal__body ret__body">
          {!selectedSale ? (
            <>
              <div className="ret__search">
                <Search size={15} />
                <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Номер продажи, клиент, дата…" autoFocus />
              </div>
              <div className="ret__sales-list">
                {searching && <p className="ret__hint">Поиск…</p>}
                {!searching && sales.length === 0 && <p className="ret__hint">Ничего не найдено</p>}
                {sales.map((s) => (
                  <button type="button" key={s.id} className="ret__sale-item" onClick={() => pickSale(s)}>
                    <span className="ret__sale-item-main">№{s.sale_number} · {s.client_name || 'без клиента'}</span>
                    <span className="ret__sale-item-meta">{s.date} · {money(s.total_amount)}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button type="button" className="ret__back" onClick={() => setSelectedSale(null)}>← Другая продажа</button>
              <p className="ret__sale-title">Продажа №{selectedSale.sale_number} · {selectedSale.client_name || 'без клиента'}</p>

              <div className="ret__lines">
                {returnLines.length === 0 && <p className="ret__hint">Нет строк, доступных к возврату</p>}
                {returnLines.map((l) => (
                  <div key={l.id} className="ret__line">
                    <div className="ret__line-info">
                      <span>{l.product_name}</span>
                      <span className="ret__line-sub">продано {l.sold_quantity} · доступно к возврату {l.returnable_quantity}</span>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={qtyByLine[l.id] || ''}
                      onChange={(e) => setQty(l.id, e.target.value.replace(/[^\d.]/g, ''))}
                      placeholder="0"
                      className={Number(qtyByLine[l.id]) > Number(l.returnable_quantity) ? 'ret__line-qty--invalid' : ''}
                    />
                  </div>
                ))}
              </div>

              {overQty && (
                <p className="ret__warn"><TriangleAlert size={13} /> Количество превышает доступное к возврату</p>
              )}

              <div className="ret__field">
                <label>Причина возврата</label>
                <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Необязательно" />
              </div>

              {selectedLines.length > 0 && (
                <p className="ret__total">Сумма возврата: <strong>{money(total)}</strong></p>
              )}
            </>
          )}
        </div>

        <div className="form-modal__actions">
          <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>Отмена</button>
          {selectedSale && (
            <SubmitButton loading={saving} disabled={!canSubmit} className="ui-modal-btn ui-modal-btn--primary" onClick={handleSubmit}>
              Провести возврат
            </SubmitButton>
          )}
        </div>
      </div>
    </FormModal>
  );
};

export default ReturnModal;

import React, { useEffect, useMemo, useState } from 'react';
import {
  useServerQuery,
  parseLocaleNumber,
  formatQuantityDisplay,
  getApiErrorMessage,
} from '../../../../shared/lib';
import {
  EmptyState,
  ErrorState,
  Loading,
  Pagination,
  SearchableSelect,
  IntegerInput,
  Badge,
  useToast,
} from '../../../../shared/ui';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { createSale, getSale, getSaleSelectSources, getSaleWaybillUrl, previewSale } from '../../api/salesApi';
import { getClients } from '../../../clients/api/clientsApi';
import './SalesPage.scss';
import './WaybillPreviewModal.scss';
import { WAYBILL_DEFAULT_UNIT, WAYBILL_SUPPLIER } from '../../config/waybillConfig';

const paymentStatusLabel = (v) => {
  const k = String(v || '').toLowerCase();
  if (k === 'paid') return 'Оплачено';
  if (k === 'partially_paid') return 'Частично оплачено';
  if (k === 'unpaid') return 'Долг';
  return v || '—';
};

const paymentStatusVariant = (v) => {
  const k = String(v || '').toLowerCase();
  if (k === 'paid') return 'success';
  if (k === 'partially_paid') return 'warning';
  if (k === 'unpaid') return 'danger';
  return 'default';
};

const formatDate = (v) => (v ? String(v).slice(0, 10) : '—');
const toMoney = (v) => (v != null && v !== '' ? `${formatQuantityDisplay(v)} сом` : '—');
const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const clientLabel = (c) => {
  if (!c) return '—';
  const name = (typeof c.display === 'string' && c.display.trim())
    || (typeof c.label === 'string' && c.label.trim())
    || (typeof c.name === 'string' && c.name.trim())
    || (typeof c.title === 'string' && c.title.trim());
  return name || '—';
};

const orderLabel = (o) => {
  if (!o) return '—';
  const profile = typeof o.profile_name === 'string' ? o.profile_name.trim() : '';
  const qty = o.quantity != null ? `${formatQuantityDisplay(o.quantity)} шт` : '';
  const len = o.length != null && o.length !== '' ? `${formatQuantityDisplay(o.length)} м` : '';
  const status = typeof o.status_label === 'string' ? o.status_label.trim() : '';
  const manual = [profile, qty && len ? `${qty} × ${len}` : (qty || len), status].filter(Boolean).join(' — ');
  if (manual) return manual;
  const raw = (typeof o.display === 'string' && o.display.trim())
    || (typeof o.order_display === 'string' && o.order_display.trim());
  if (raw) {
    const parts = raw.split('—').map((x) => x.trim()).filter(Boolean);
    if (parts.length > 1) return parts.slice(1).join(' — ');
    return raw;
  }
  return '—';
};
const isClosedOrder = (o) => {
  const raw = String(o?.request_status || o?.status || o?.status_label || '').toLowerCase();
  return raw.includes('closed')
    || raw.includes('completed')
    || raw.includes('done')
    || raw.includes('rejected')
    || raw.includes('declined')
    || raw.includes('cancelled')
    || raw.includes('canceled')
    || raw.includes('закрыт')
    || raw.includes('заверш')
    || raw.includes('отказ');
};

const batchLabel = (b) => {
  if (!b) return '—';
  const t = (typeof b.display === 'string' && b.display.trim())
    || (typeof b.warehouse_batch_display === 'string' && b.warehouse_batch_display.trim());
  return t || '—';
};
const isGoodBatchForSale = (b) => {
  const quality = String(b?.quality || '').toLowerCase();
  if (quality === 'defect' || quality === 'bad') return false;
  const status = String(b?.status || '').toLowerCase();
  if (status && status !== 'available') return false;
  if (status === 'shipped' || status === 'sold' || status === 'closed') return false;
  return true;
};

const qtyUnitLabel = (unitType) => (unitType === 'packages' ? 'уп.' : 'шт.');
const paymentTypeLabel = (v) => {
  const k = String(v || '').toLowerCase();
  if (k === 'full') return 'Полная';
  if (k === 'partial') return 'Частичная';
  if (k === 'debt') return 'В долг';
  return v || '—';
};
const paymentMethodLabel = (v) => {
  const k = String(v || '').toLowerCase();
  if (k === 'cash') return 'Наличные';
  if (k === 'card') return 'Карта';
  if (k === 'transfer') return 'Перевод';
  return v || '—';
};
const inferPaymentType = (sale) => {
  const t = String(sale?.payment_type || '').trim();
  if (t) return t;
  const total = toNumber(sale?.total_amount);
  const paid = toNumber(sale?.paid_amount);
  const debt = toNumber(sale?.debt_amount);
  if (total > 0 && debt === 0) return 'full';
  if (total > 0 && paid === 0) return 'debt';
  if (paid > 0 && debt > 0) return 'partial';
  return '';
};
const toWaybillDate = (v) => {
  const s = String(v || '');
  if (s.length >= 10) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
  return '—';
};

const SalesPage = () => {
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, payment_filter: '' });
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [saleDetailsId, setSaleDetailsId] = useState(null);

  const apiQuery = useMemo(() => {
    const q = { page: queryState.page, page_size: queryState.page_size };
    if (queryState.payment_filter === 'paid') q.payment_status = 'paid';
    if (queryState.payment_filter === 'debt') q.payment_status = 'unpaid';
    return q;
  }, [queryState]);

  const { items, meta, loading, error, refetch } = useServerQuery('sales/', apiQuery, { enabled: true });
  useOperationalRefetch(['sale', 'payment', 'return', 'order'], refetch, true);

  return (
    <div className="page page--sales commercial-page">
      <div className="ds-toolbar commercial-toolbar">
        <div className="ds-toolbar__start commercial-toolbar__filters">
          <SearchableSelect
            value={queryState.payment_filter}
            onChange={(v) => setQueryState((p) => ({ ...p, payment_filter: v, page: 1 }))}
            placeholder="Фильтр оплаты"
            options={[
              { value: '', label: 'Все' },
              { value: 'paid', label: 'Оплачено' },
              { value: 'debt', label: 'Долг' },
            ]}
          />
        </div>
        <div className="ds-toolbar__end">
          <button type="button" className="btn btn--primary" onClick={() => setSaleModalOpen(true)}>
            Создать продажу
          </button>
        </div>
      </div>

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет продаж" />}

      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <div className="commercial-table-wrap">
          <table className="data-table data-table--sales data-table--row-actions">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Дата</th>
                <th className="data-table__cell--num">Сумма</th>
                <th className="data-table__cell--num">Оплачено</th>
                <th className="data-table__cell--num">Долг</th>
                <th>Статус оплаты</th>
                <th>Детали</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const clientText = s.client_name || clientLabel(s.client) || s.display;
                return (
                  <tr key={s.id}>
                    <td>{clientText || '—'}</td>
                    <td>{formatDate(s.date || s.created_at)}</td>
                    <td className="data-table__cell--num">{toMoney(s.total_amount ?? s.revenue)}</td>
                    <td className="data-table__cell--num">{toMoney(s.paid_amount)}</td>
                    <td className="data-table__cell--num">{toMoney(s.debt_amount)}</td>
                    <td><Badge variant={paymentStatusVariant(s.payment_status)}>{paymentStatusLabel(s.payment_status_label || s.payment_status)}</Badge></td>
                    <td>
                      <button type="button" className="btn btn--secondary btn--sm" onClick={() => setSaleDetailsId(s.id)}>
                        Открыть
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (!error || error.status === 404) && (
        <Pagination meta={meta} onPageChange={(nextPage) => setQueryState((p) => ({ ...p, page: nextPage }))} />
      )}

      {saleModalOpen && (
        <CreateSaleModal
          onClose={() => setSaleModalOpen(false)}
          onSaved={() => {
            setSaleModalOpen(false);
            refetch();
          }}
        />
      )}

      {saleDetailsId != null && (
        <SaleDetailsModal
          saleId={saleDetailsId}
          onClose={() => setSaleDetailsId(null)}
        />
      )}
    </div>
  );
};

const CreateSaleModal = ({ onClose, onSaved }) => {
  const toast = useToast();
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingSelect, setLoadingSelect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [batches, setBatches] = useState([]);
  const [client, setClient] = useState('');
  const [order, setOrder] = useState('');
  const [unitType, setUnitType] = useState('pieces');
  const [paymentType, setPaymentType] = useState('full');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [saleLines, setSaleLines] = useState([{ warehouse_batch: '', quantity: '', unit_price: '' }]);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getClients({ page: 1, page_size: 500 });
        if (!alive) return;
        const data = res.data || {};
        setClients(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (alive) setClients([]);
      } finally {
        if (alive) setLoadingClients(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoadingSelect(true);
    const params = {};
    if (client) params.client = client;
    if (order) params.order = order;
    if (unitType) params.unit_type = unitType;
    getSaleSelectSources(params)
      .then((res) => {
        if (!alive) return;
        const data = res.data || {};
        const ord = data.available_orders ?? data.orders;
        const bat = data.available_warehouse_batches ?? data.warehouse_batches;
        setOrders(Array.isArray(ord) ? ord : []);
        setBatches(Array.isArray(bat) ? bat : []);
      })
      .catch(() => {
        if (!alive) return;
        setOrders([]);
        setBatches([]);
      })
      .finally(() => {
        if (alive) setLoadingSelect(false);
      });
    return () => { alive = false; };
  }, [client, order, unitType]);

  useEffect(() => {
    if (paymentType === 'debt') setPaidAmount('0');
    if (paymentType === 'full') setPaidAmount('');
  }, [paymentType]);

  useEffect(() => {
    const buildPayloadForPreview = () => {
      if (!client) return null;
      if (!saleLines.length) return null;
      const cleanLines = [];
      for (let i = 0; i < saleLines.length; i += 1) {
        const ln = saleLines[i];
        const wb = ln.warehouse_batch ? Number(ln.warehouse_batch) : null;
        const qty = parseLocaleNumber(ln.quantity);
        const price = parseLocaleNumber(ln.unit_price);
        if (!wb || !(qty > 0) || !Number.isFinite(price)) return null;
        cleanLines.push({
          warehouse_batch: wb,
          quantity: String(qty),
          unit_price: String(price),
        });
      }
      const payload = {
        client: Number(client),
        unit_type: unitType,
        sale_lines: cleanLines,
        payment_type: paymentType,
        payment_method: paymentMethod,
      };
      if (order) payload.order = Number(order);
      if (paymentType === 'partial') {
        const p = parseLocaleNumber(paidAmount);
        if (!(p > 0)) return null;
        payload.paid_amount = String(p);
      }
      if (paymentType === 'debt') payload.paid_amount = '0';
      return payload;
    };

    const payload = buildPayloadForPreview();
    if (!payload) {
      setPreview(null);
      setPreviewError('');
      return undefined;
    }

    let alive = true;
    setPreviewLoading(true);
    const t = setTimeout(() => {
      previewSale(payload)
        .then((res) => {
          if (!alive) return;
          setPreview(res.data || null);
          setPreviewError('');
        })
        .catch((err) => {
          if (!alive) return;
          setPreview(null);
          setPreviewError(getApiErrorMessage(err, 'Не удалось рассчитать предпросмотр продажи'));
        })
        .finally(() => {
          if (alive) setPreviewLoading(false);
        });
    }, 300);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [client, order, unitType, saleLines, paymentType, paymentMethod, paidAmount]);

  const filteredOrders = useMemo(() => {
    if (!client) return [];
    return orders.filter((o) => {
      if (isClosedOrder(o)) return false;
      const oid = o?.client_id ?? o?.client?.id ?? o?.client;
      if (oid == null || oid === '') return true;
      return String(oid) === String(client);
    });
  }, [orders, client]);
  const orderOptions = useMemo(
    () => [{ value: '', label: 'Не выбрана' }, ...filteredOrders.map((o) => ({ value: String(o.id), label: orderLabel(o) }))],
    [filteredOrders],
  );
  const clientOptions = useMemo(
    () => [{ value: '', label: 'Выберите клиента' }, ...clients.map((c) => ({ value: String(c.id), label: clientLabel(c) }))],
    [clients],
  );
  const filteredBatches = useMemo(() => {
    const source = batches.filter(isGoodBatchForSale);
    if (unitType === 'packages') {
      return source
        .filter((b) => toNumber(b.available_packages) > 0)
        .sort((a, b) => toNumber(b.available_packages) - toNumber(a.available_packages));
    }
    return source
      .filter((b) => toNumber(b.available_pieces) > 0 || toNumber(b.available_packages) > 0)
      .sort((a, b) => {
        const ap = toNumber(a.available_pieces) + toNumber(a.available_packages);
        const bp = toNumber(b.available_pieces) + toNumber(b.available_packages);
        return bp - ap;
      });
  }, [batches, unitType]);
  useEffect(() => {
    const allowedBatchIds = new Set(filteredBatches.map((b) => String(b.id)));
    setSaleLines((prev) => prev.map((line) => {
      if (!line.warehouse_batch) return line;
      return allowedBatchIds.has(String(line.warehouse_batch))
        ? line
        : { ...line, warehouse_batch: '' };
    }));
  }, [filteredBatches]);
  const batchOptions = useMemo(
    () => [{ value: '', label: 'Выберите партию' }, ...filteredBatches.map((b) => ({ value: String(b.id), label: batchLabel(b) }))],
    [filteredBatches],
  );

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!client) {
      setFormError('Выберите клиента.');
      return;
    }
    if (!saleLines.length) {
      setFormError('Добавьте хотя бы одну строку.');
      return;
    }

    const cleanLines = [];
    for (let i = 0; i < saleLines.length; i += 1) {
      const ln = saleLines[i];
      const wb = ln.warehouse_batch ? Number(ln.warehouse_batch) : null;
      const qty = parseLocaleNumber(ln.quantity);
      const price = parseLocaleNumber(ln.unit_price);
      if (!wb || !(qty > 0) || !Number.isFinite(price)) {
        setFormError(`Проверьте строку ${i + 1}.`);
        return;
      }
      cleanLines.push({
        warehouse_batch: wb,
        quantity: String(qty),
        unit_price: String(price),
      });
    }

    const payload = {
      client: Number(client),
      unit_type: unitType,
      sale_lines: cleanLines,
      payment_type: paymentType,
      payment_method: paymentMethod,
      paid_amount: paymentType === 'debt' ? '0' : String(paidAmount || ''),
    };
    if (order) payload.order = Number(order);
    if (paymentType === 'full') {
      if (preview?.total_amount != null && preview.total_amount !== '') {
        payload.paid_amount = String(preview.total_amount);
      } else {
        delete payload.paid_amount;
      }
    }
    if (paymentType === 'partial' && !(parseLocaleNumber(paidAmount) > 0)) {
      setFormError('Укажите сумму оплаты для частичной оплаты.');
      return;
    }

    setSaving(true);
    try {
      await createSale(payload);
      toast.show('Продажа создана');
      onSaved();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Ошибка создания продажи'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sales-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Новая продажа</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть" disabled={saving}>×</button>
        </div>
        <form className="sales-modal__form" onSubmit={submit}>
          <div className="sales-modal__scroll">
            {(loadingClients || loadingSelect) && <Loading />}
            <section className="sales-modal__section">
              <label className="sales-modal__label">Клиент *</label>
              <SearchableSelect
                value={client}
                onChange={(v) => {
                  setClient(v != null ? String(v) : '');
                  setOrder('');
                }}
                options={clientOptions}
                placeholder="Выберите клиента"
              />
              <label className="sales-modal__label">Заявка</label>
              <SearchableSelect
                value={order}
                onChange={(v) => setOrder(v != null ? String(v) : '')}
                options={orderOptions}
                disabled={!client}
                placeholder={client ? 'Выберите заявку' : 'Сначала выберите клиента'}
              />
            </section>
            <section className="sales-modal__section">
              <h4 className="sales-modal__section-title">Товары</h4>
              <label className="sales-modal__label">Тип продажи</label>
              <SearchableSelect
                value={unitType}
                onChange={(v) => setUnitType(v != null ? String(v) : 'pieces')}
                options={[
                  { value: 'pieces', label: 'Штуки' },
                  { value: 'packages', label: 'Упаковки' },
                ]}
              />
              {saleLines.map((line, idx) => (
                <div key={idx} className="sales-modal__line-card card">
                  <label className="sales-modal__label">Партия склада</label>
                  <SearchableSelect
                    value={line.warehouse_batch}
                    onChange={(v) => setSaleLines((prev) => prev.map((x, i) => (i === idx ? { ...x, warehouse_batch: v != null ? String(v) : '' } : x)))}
                    options={batchOptions}
                  />
                  <label className="sales-modal__label">Количество</label>
                  <IntegerInput
                    min={1}
                    value={line.quantity}
                    onChange={(v) => setSaleLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: v } : x)))}
                  />
                  <p className="sales-modal__hint-line">Количество в {qtyUnitLabel(unitType)}</p>
                  <label className="sales-modal__label">Цена за единицу</label>
                  <input
                    inputMode="decimal"
                    value={line.unit_price}
                    onChange={(e) => setSaleLines((prev) => prev.map((x, i) => (i === idx ? { ...x, unit_price: e.target.value } : x)))}
                  />
                </div>
              ))}
              <button
                type="button"
                className="btn btn--secondary sales-modal__add-line"
                onClick={() => setSaleLines((prev) => [...prev, { warehouse_batch: '', quantity: '', unit_price: '' }])}
                disabled={saving}
              >
                Добавить строку
              </button>
            </section>
            <section className="sales-modal__section">
              <h4 className="sales-modal__section-title">Оплата</h4>
              <label className="sales-modal__label">Тип оплаты</label>
              <SearchableSelect
                value={paymentType}
                onChange={(v) => setPaymentType(v != null ? String(v) : 'full')}
                options={[
                  { value: 'full', label: 'Полная' },
                  { value: 'partial', label: 'Частичная' },
                  { value: 'debt', label: 'В долг' },
                ]}
              />
              <label className="sales-modal__label">Способ оплаты</label>
              <SearchableSelect
                value={paymentMethod}
                onChange={(v) => setPaymentMethod(v != null ? String(v) : 'cash')}
                options={[
                  { value: 'cash', label: 'Наличные' },
                  { value: 'card', label: 'Карта' },
                  { value: 'transfer', label: 'Перевод' },
                ]}
              />
              <label className="sales-modal__label">Сумма оплаты</label>
              <input
                inputMode="decimal"
                value={paymentType === 'debt' ? '0' : paidAmount}
                disabled={paymentType === 'full' || paymentType === 'debt'}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder={paymentType === 'full' ? 'Автоматически из общей суммы' : ''}
              />
              {previewLoading && <p className="sales-modal__hint-line">Расчет...</p>}
              {!previewLoading && preview && (
                <p className="sales-modal__hint-line">
                  Итого: {toMoney(preview.total_amount)} | Оплачено: {toMoney(preview.paid_amount)} | Долг: {toMoney(preview.debt_amount)}
                </p>
              )}
              {!previewLoading && previewError && <p className="sales-modal__hint-line">{previewError}</p>}
            </section>
            {formError && <p className="modal__error">{formError}</p>}
          </div>
          <div className="modal__actions sales-modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Сохранение…' : 'Создать продажу'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SaleDetailsModal = ({ saleId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sale, setSale] = useState(null);
  const [waybillOpen, setWaybillOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    getSale(saleId)
      .then((res) => {
        if (!alive) return;
        setSale(res.data || null);
      })
      .catch((err) => {
        if (!alive) return;
        setError(getApiErrorMessage(err, 'Не удалось загрузить детали продажи'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [saleId]);

  const lines = Array.isArray(sale?.sale_lines) ? sale.sale_lines : [];
  const clientName = sale?.client_name || clientLabel(sale?.client);
  const orderText = sale?.order_display
    || (typeof sale?.order === 'object' ? orderLabel(sale.order) : '')
    || '—';
  const paymentStatusText = sale?.payment_status_label || paymentStatusLabel(sale?.payment_status);
  const paymentTypeText = sale?.payment_type_label || paymentTypeLabel(inferPaymentType(sale));
  const paymentMethodText = sale?.payment_method_label
    || paymentMethodLabel(sale?.payment_method || sale?.last_payment_method || sale?.method);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide sales-detail-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Детали продажи</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="sales-detail-modal__body">
          {loading && <Loading />}
          {!loading && error && <p className="modal__error">{error}</p>}
          {!loading && !error && sale && (
            <>
              <section className="sales-detail__block">
                <h4 className="sales-detail__block-title">Основа</h4>
                <dl className="sales-detail__dl">
                  <div className="sales-detail__dl-row"><dt>Клиент</dt><dd>{clientName || '—'}</dd></div>
                  <div className="sales-detail__dl-row"><dt>Дата</dt><dd>{formatDate(sale.date || sale.created_at)}</dd></div>
                  <div className="sales-detail__dl-row"><dt>Заявка</dt><dd>{orderText}</dd></div>
                  <div className="sales-detail__dl-row"><dt>Тип продажи</dt><dd>{sale.unit_type === 'packages' ? 'Упаковки' : 'Штуки'}</dd></div>
                </dl>
              </section>
              <section className="sales-detail__block">
                <h4 className="sales-detail__block-title">Оплата</h4>
                <dl className="sales-detail__dl">
                  <div className="sales-detail__dl-row"><dt>Тип оплаты</dt><dd>{paymentTypeText}</dd></div>
                  <div className="sales-detail__dl-row"><dt>Способ оплаты</dt><dd>{paymentMethodText}</dd></div>
                  <div className="sales-detail__dl-row"><dt>Статус</dt><dd>{paymentStatusText}</dd></div>
                  <div className="sales-detail__dl-row"><dt>Сумма</dt><dd>{toMoney(sale.total_amount)}</dd></div>
                  <div className="sales-detail__dl-row"><dt>Оплачено</dt><dd>{toMoney(sale.paid_amount)}</dd></div>
                  <div className="sales-detail__dl-row"><dt>Долг</dt><dd>{toMoney(sale.debt_amount)}</dd></div>
                </dl>
              </section>
              <section className="sales-detail__block">
                <h4 className="sales-detail__block-title">Строки продажи</h4>
                {lines.length === 0 ? <p className="sales-detail__muted">Нет строк.</p> : (
                  <div className="commercial-table-wrap">
                    <table className="data-table data-table--order-detail-lines">
                      <thead>
                        <tr>
                          <th>Партия</th>
                          <th className="data-table__cell--num">Количество</th>
                          <th className="data-table__cell--num">Цена</th>
                          <th className="data-table__cell--num">Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((ln, i) => {
                          const lineQty = ln.quantity ?? ln.qty ?? ln.pieces_quantity ?? ln.packages_quantity;
                          const linePrice = ln.unit_price ?? ln.price;
                          const lineTotal = ln.total_amount ?? ln.line_total;
                          const lineBatchLabel = ln.warehouse_batch_display
                            || ln.display
                            || ln.batch_display
                            || ln.product_name
                            || ln.profile_name
                            || (ln.length_per_piece != null && ln.length_per_piece !== '' && ln.profile_name
                              ? `${ln.profile_name} — ${formatQuantityDisplay(ln.length_per_piece)} м`
                              : '')
                            || batchLabel(ln.warehouse_batch);
                          return (
                            <tr key={ln.id != null ? `ln-${ln.id}` : `ln-${i}`}>
                              <td>{lineBatchLabel || '—'}</td>
                              <td className="data-table__cell--num">{lineQty != null ? formatQuantityDisplay(lineQty) : '—'}</td>
                              <td className="data-table__cell--num">{toMoney(linePrice)}</td>
                              <td className="data-table__cell--num">{toMoney(lineTotal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={() => setWaybillOpen(true)}>Накладная</button>
          <button type="button" className="btn btn--secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
      {waybillOpen && sale && (
        <WaybillPreviewModal sale={sale} onClose={() => setWaybillOpen(false)} />
      )}
    </div>
  );
};

const WaybillPreviewModal = ({ sale, onClose }) => {
  const lines = Array.isArray(sale?.sale_lines) ? sale.sale_lines : [];
  const buyer = sale?.client_name || clientLabel(sale?.client) || '—';
  const total = lines.reduce((acc, ln) => acc + toNumber(ln.total_amount ?? ln.line_total), 0);
  const waybillBaseUrl = getSaleWaybillUrl(sale.id);
  const downloadWaybill = async (format) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${waybillBaseUrl}?format=${format}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error('Не удалось скачать накладную');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nakladnaya-${sale.id}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // eslint-disable-next-line no-alert
      alert('Ошибка скачивания накладной');
    }
  };

  return (
    <div className="modal-overlay waybill-preview-modal" onClick={onClose}>
      <div className="modal modal--wide waybill-preview-modal__dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head waybill-preview-modal__head">
          <h3>Накладная</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="waybill-preview-modal__body">
          <div className="waybill-print-sheet">
            <section className="waybill-copy">
              <h4 className="waybill-copy__title">Расходная накладная № {sale.id || '—'} от ________ г.</h4>
              <div className="waybill-copy__meta">
                <p><strong>Поставщик:</strong> _______________________, тел: _______________________</p>
                <p><strong>Покупатель:</strong> {buyer}</p>
              </div>
              <table className="waybill-copy__table">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Наименование товара</th>
                    <th>Единица измерение</th>
                    <th>Цена</th>
                    <th>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((ln, idx) => {
                    const title = ln.warehouse_batch_display || ln.display || ln.batch_display || ln.product_name || ln.profile_name || '—';
                    const qty = ln.quantity ?? ln.qty ?? ln.pieces_quantity ?? ln.packages_quantity;
                    const unitPrice = ln.unit_price ?? ln.price;
                    const lineSum = ln.total_amount ?? ln.line_total;
                    return (
                      <tr key={ln.id != null ? `wb-line-${ln.id}` : `wb-line-row-${idx}`}>
                        <td>{idx + 1}</td>
                        <td>{title}</td>
                        <td>{qty != null ? `${formatQuantityDisplay(qty)} ${WAYBILL_DEFAULT_UNIT}` : `— ${WAYBILL_DEFAULT_UNIT}`}</td>
                        <td>{unitPrice != null ? formatQuantityDisplay(unitPrice) : '—'}</td>
                        <td>{lineSum != null ? formatQuantityDisplay(lineSum) : '—'}</td>
                      </tr>
                    );
                  })}
                  <tr className="waybill-copy__total-row">
                    <td colSpan={4}>Итого:</td>
                    <td>{formatQuantityDisplay(total)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="waybill-copy__signatures">
                <div className="waybill-copy__sign-item">
                  <span>Отпустил</span>
                  <span className="waybill-copy__sign-line" />
                </div>
                <div className="waybill-copy__sign-item">
                  <span>Получил</span>
                  <span className="waybill-copy__sign-line" />
                </div>
                <div className="waybill-copy__sign-item">
                  <span>Место печати</span>
                  <span className="waybill-copy__sign-line" />
                </div>
              </div>
            </section>
          </div>
        </div>
        <div className="modal__actions waybill-preview-modal__actions">
          <button type="button" className="btn btn--secondary" onClick={() => downloadWaybill('xlsx')}>Excel</button>
          <button type="button" className="btn btn--secondary" onClick={() => downloadWaybill('pdf')}>PDF</button>
          <button type="button" className="btn btn--primary" onClick={() => window.print()}>Печать</button>
        </div>
      </div>
    </div>
  );
};

export default SalesPage;

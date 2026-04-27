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
import { createSale, getSale, getSaleSelectSources, previewSale } from '../../api/salesApi';
import { getClients } from '../../../clients/api/clientsApi';
import './SalesPage.scss';

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

const batchLabel = (b) => {
  if (!b) return '—';
  const t = (typeof b.display === 'string' && b.display.trim())
    || (typeof b.warehouse_batch_display === 'string' && b.warehouse_batch_display.trim());
  return t || '—';
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
      <div className="ds-toolbar ds-toolbar--stack-mobile commercial-toolbar">
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
    if (unitType === 'packages') {
      return batches.filter((b) => toNumber(b.available_packages) > 0);
    }
    return batches.filter((b) => toNumber(b.available_pieces) > 0 || toNumber(b.available_packages) > 0);
  }, [batches, unitType]);
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
              {paymentType === 'debt' && <p className="sales-modal__hint-line">При типе "В долг" оплачено всегда 0, вся сумма уходит в долг.</p>}
              {paymentType === 'full' && <p className="sales-modal__hint-line">При типе "Полная" оплачено равно общей сумме продажи.</p>}
              {previewLoading && <p className="sales-modal__hint-line">Расчет...</p>}
              {!previewLoading && preview && (
                <p className="sales-modal__hint-line">
                  Итого: {toMoney(preview.total_amount)} | Оплачено: {toMoney(preview.paid_amount)} | Долг: {toMoney(preview.debt_amount)}
                </p>
              )}
              {!previewLoading && previewError && <p className="sales-modal__hint-line">{previewError}</p>}
              <p className="sales-modal__hint-line">Сумма и долг рассчитываются на backend.</p>
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
          <button type="button" className="btn btn--secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
};

export default SalesPage;

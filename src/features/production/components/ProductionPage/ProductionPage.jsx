import React, { useState, useEffect } from 'react';
import { EmptyState, FilterBar, Loading, ErrorState, ConfirmModal, useToast } from '../../../../shared/ui';
import { useServerQuery } from '../../../../shared/lib';
import { getProductionBatches, getProductionOrders, releaseOrder } from '../../api/productionApi';
import { apiClient } from '../../../../shared/api';
import './ProductionPage.scss';

const errorToMessage = (err) => {
  const data = err?.response?.data;
  if (!data || typeof data !== 'object') return err?.message || 'Ошибка';
  const code = data.code ? `[${data.code}] ` : '';
  const base = data.error || data.message || 'Ошибка';
  const details = data.details && typeof data.details === 'object'
    ? Object.entries(data.details).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ')
    : '';
  const missing = Array.isArray(data.missing) && data.missing.length
    ? data.missing.map((m) => {
      if (typeof m === 'object') {
        const name = m.component || m.raw_material || m.element || m.name || 'компонент';
        const req = m.required ?? m.need ?? '?';
        const avail = m.available ?? m.balance ?? 0;
        const unit = m.unit || '';
        return `${name}: нужно ${req} ${unit}, доступно ${avail} ${unit}`.trim();
      }
      return String(m);
    }).join('; ')
    : '';
  return [code + base, details, missing].filter(Boolean).join('. ');
};

const updateQuery = (setter) => (patch) => {
  setter((prev) => ({
    ...prev,
    ...patch,
    page: patch.page !== undefined ? patch.page : 1,
  }));
};

const Pagination = ({ meta, onChange }) => {
  const page = Number(meta?.page || 1);
  const totalPages = Number(meta?.total_pages || 1);
  if (totalPages <= 1) return null;
  return (
    <div className="production-pagination">
      <button type="button" className="btn btn--secondary btn--sm" onClick={() => onChange({ page: page - 1 })} disabled={page <= 1}>
        Назад
      </button>
      <span>Страница {page} из {totalPages}</span>
      <button type="button" className="btn btn--secondary btn--sm" onClick={() => onChange({ page: page + 1 })} disabled={page >= totalPages}>
        Вперёд
      </button>
    </div>
  );
};

const ProductionPage = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('orders');
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [releaseConfirm, setReleaseConfirm] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [ordersQuery, setOrdersQuery] = useState({
    page: 1,
    page_size: 20,
    search: '',
    ordering: '',
    status: '',
  });
  const [batchesQuery, setBatchesQuery] = useState({
    page: 1,
    page_size: 20,
    search: '',
    ordering: '',
    otk_status: '',
  });

  const onOrdersQueryChange = updateQuery(setOrdersQuery);
  const onBatchesQueryChange = updateQuery(setBatchesQuery);

  const {
    items: orders,
    meta: ordersMeta,
    loading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useServerQuery(null, ordersQuery, {
    fetcher: (queryState, signal) => getProductionOrders({ query: queryState, signal }),
  });

  const {
    items: batches,
    meta: batchesMeta,
    loading: batchesLoading,
    error: batchesError,
    refetch: refetchBatches,
  } = useServerQuery(null, batchesQuery, {
    fetcher: (queryState, signal) => getProductionBatches({ query: queryState, signal }),
  });

  const [allOrders, setAllOrders] = useState([]);

  useEffect(() => {
    apiClient.get('orders/', { params: { status: 'created', page_size: 100 } })
      .then((res) => setAllOrders(res.data?.items || []))
      .catch(() => setAllOrders([]));
  }, [releaseModalOpen]);

  const productName = (o) => o.product_name || o.product?.name || o.product || o.recipe?.name || o.recipe_name || '—';
  const lineName = (o) => o.line?.name || o.line_name || o.line || '—';
  const statusLabel = (s) => {
    const v = String(s || '').toLowerCase();
    if (v === 'created' || v === 'создан') return 'СОЗДАН';
    if (v === 'in_progress' || v === 'в работе') return 'В РАБОТЕ';
    if (v === 'done' || v === 'выполнен') return 'ВЫПОЛНЕН';
    return s || '—';
  };
  const otkStatusLabel = (s) => {
    const v = String(s || '').toLowerCase();
    if (v === 'pending' || v === 'ожидает') return 'ОЖИДАЕТ';
    if (v === 'accepted' || v === 'принято') return 'ПРИНЯТО';
    if (v === 'rejected' || v === 'брак') return 'БРАК';
    return s || '—';
  };
  const formatDate = (d) => (d ? (typeof d === 'string' ? d.slice(0, 10) : d) : '—');

  const refetch = () => {
    refetchOrders();
    refetchBatches();
  };

  return (
    <div className="page page--production">
      <div className="production-banner">
        При выпуске происходит списание со складов. После выпуска подтвердите — партия передаётся в ОТК.
      </div>

      <div className="production-tabs-bar">
        <button
          type="button"
          className={`production-tabs-bar__tab ${activeTab === 'orders' ? 'production-tabs-bar__tab--active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          Заказы
        </button>
        <button
          type="button"
          className={`production-tabs-bar__tab ${activeTab === 'batches' ? 'production-tabs-bar__tab--active' : ''}`}
          onClick={() => setActiveTab('batches')}
        >
          Партии
        </button>
      </div>

      {activeTab === 'orders' && (
        <div className="production-card">
          <div className="production-card__head">
            <FilterBar
              filters={[
                { key: 'search', type: 'search', placeholder: 'Поиск' },
                { key: 'status', type: 'select', placeholder: 'Статус', options: [
                  { value: 'created', label: 'Создан' },
                  { value: 'in_progress', label: 'В работе' },
                  { value: 'done', label: 'Выполнен' },
                ] },
                { key: 'ordering', type: 'ordering', placeholder: 'Сортировка', options: [
                  { value: 'date', label: 'Дата (возр.)' },
                  { value: '-date', label: 'Дата (убыв.)' },
                  { value: 'product', label: 'Продукт (А-Я)' },
                  { value: '-product', label: 'Продукт (Я-А)' },
                ] },
              ]}
              queryState={ordersQuery}
              onChange={onOrdersQueryChange}
            />
            <button type="button" className="btn btn--primary" onClick={() => setReleaseModalOpen(true)}>
              Выпустить
            </button>
          </div>
          {ordersLoading && <Loading />}
          {ordersError && <ErrorState error={ordersError} onRetry={refetchOrders} />}
          {!ordersLoading && !ordersError && (
            orders.length === 0 ? (
              <EmptyState title="Нет заказов для выпуска" />
            ) : (
              <div className="production-table production-table--orders">
                <div className="production-table__header">
                  <span className="production-table__th">ПРОДУКТ</span>
                  <span className="production-table__th">ЛИНИЯ</span>
                  <span className="production-table__th">КОЛ-ВО</span>
                  <span className="production-table__th">СТАТУС</span>
                </div>
                {orders.map((o) => (
                  <div key={o.id} className="production-table__row">
                    <span>{productName(o)}</span>
                    <span>{lineName(o)}</span>
                    <span>{o.quantity ?? o.released ?? o.produced ?? '—'}</span>
                    <span>{statusLabel(o.status)}</span>
                  </div>
                ))}
              </div>
            )
          )}
          {!ordersLoading && !ordersError && <Pagination meta={ordersMeta} onChange={onOrdersQueryChange} />}
        </div>
      )}

      {activeTab === 'batches' && (
        <div className="production-card">
          <div className="production-card__head">
            <FilterBar
              filters={[
                { key: 'search', type: 'search', placeholder: 'Поиск' },
                { key: 'otk_status', type: 'select', placeholder: 'Статус ОТК', options: [
                  { value: 'pending', label: 'Ожидает' },
                  { value: 'accepted', label: 'Принято' },
                  { value: 'rejected', label: 'Брак' },
                ] },
                { key: 'ordering', type: 'ordering', placeholder: 'Сортировка', options: [
                  { value: 'date', label: 'Дата (возр.)' },
                  { value: '-date', label: 'Дата (убыв.)' },
                ] },
              ]}
              queryState={batchesQuery}
              onChange={onBatchesQueryChange}
            />
          </div>
          {batchesLoading && <Loading />}
          {batchesError && <ErrorState error={batchesError} onRetry={refetchBatches} />}
          {!batchesLoading && !batchesError && (
            batches.length === 0 ? (
              <EmptyState title="Нет партий" />
            ) : (
              <div className="production-table production-table--batches">
                <div className="production-table__header">
                  <span className="production-table__th">СТАТУС ОТК</span>
                  <span className="production-table__th">ПРОДУКТ</span>
                  <span className="production-table__th">ВЫПУЩЕНО</span>
                  <span className="production-table__th">ОПЕРАТОР</span>
                  <span className="production-table__th">ДАТА</span>
                </div>
                {batches.map((b) => (
                  <div key={b.id} className="production-table__row">
                    <span>{otkStatusLabel(b.otk_status || b.status)}</span>
                    <span>{b.product_name || b.product?.name || b.product || '—'}</span>
                    <span>{b.quantity ?? b.released ?? '—'}</span>
                    <span>{b.operator_name || b.operator?.name || b.operator || b.assigned_to || '—'}</span>
                    <span>{formatDate(b.date || b.created_at)}</span>
                  </div>
                ))}
              </div>
            )
          )}
          {!batchesLoading && !batchesError && <Pagination meta={batchesMeta} onChange={onBatchesQueryChange} />}
        </div>
      )}

      {releaseModalOpen && (
        <ReleaseModal
          orders={allOrders}
          onSubmit={(data) => { setReleaseConfirm(data); setReleaseModalOpen(false); }}
          onClose={() => { setReleaseModalOpen(false); setReleaseConfirm(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      <ConfirmModal
        open={!!releaseConfirm}
        title="Выпустить партию?"
        message={releaseConfirm ? `Выпустить ${releaseConfirm.quantity} шт? Сырьё будет списано.` : ''}
        confirmText="Выпустить"
        onConfirm={async () => {
          if (!releaseConfirm) return;
          setSubmitError('');
          try {
            await releaseOrder(releaseConfirm.orderId, { quantity: releaseConfirm.quantity });
            setReleaseModalOpen(false);
            setReleaseConfirm(null);
            refetch();
            toast.show('Успешно выпущено');
          } catch (err) {
            setSubmitError(errorToMessage(err));
          }
        }}
        onCancel={() => setReleaseConfirm(null)}
      />
    </div>
  );
};

const ReleaseModal = ({ orders, onSubmit, onClose, error }) => {
  const [orderId, setOrderId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [writeOffRows, setWriteOffRows] = useState([]);

  const selectedOrder = orderId ? orders.find((o) => String(o.id) === String(orderId)) : null;

  useEffect(() => {
    if (!selectedOrder) {
      setWriteOffRows([]);
      return;
    }
    const comp = selectedOrder.components || selectedOrder.recipe?.components || [];
    setWriteOffRows(Array.isArray(comp) ? comp.map((c) => ({
      component: c.material_name || c.element_name || c.name || '—',
      required: c.quantity ?? '—',
      where: '—',
      batch: '—',
      balance: '—',
      status: '—',
    })) : []);
  }, [selectedOrder]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!orderId || !quantity) return;
    onSubmit({ orderId: Number(orderId), quantity: Number(quantity) });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Выпустить</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label>Заказ</label>
          <select value={orderId} onChange={(e) => setOrderId(e.target.value)} required>
            <option value="">— Выберите —</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.product_name || o.product?.name || o.product || o.recipe_name || o.recipe?.name || `Заказ #${o.id}`}
              </option>
            ))}
          </select>
          <div className="production-modal-banner">
            Доступны только подтверждённые заказы для линий с открытыми сменами.
          </div>
          <label>Кол-во, шт</label>
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          <label>Списание</label>
          <div className="production-modal-banner production-modal-banner--small">
            Списание происходит автоматически.
          </div>
          {writeOffRows.length > 0 ? (
            <div className="production-writeoff-table">
              <div className="production-writeoff-table__header">
                <span>КОМПОНЕНТ</span>
                <span>ТРЕБУЕТСЯ</span>
                <span>КУДА</span>
                <span>ПАРТИЯ</span>
                <span>ОСТАТОК</span>
                <span>СТАТУС</span>
              </div>
              {writeOffRows.map((row, i) => (
                <div key={`${row.component ?? ''}-${row.batch ?? ''}-${i}`} className="production-writeoff-table__row">
                  <span>{row.component}</span>
                  <span>{row.required}</span>
                  <span>{row.where}</span>
                  <span>{row.batch}</span>
                  <span>{row.balance}</span>
                  <span>{row.status}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="production-modal-warning">
            Проверьте остатки.
          </div>
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="submit" className="btn btn--primary">Выпустить</button>
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductionPage;

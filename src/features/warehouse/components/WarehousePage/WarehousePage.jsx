import React, { useEffect, useMemo, useState } from 'react';
import { useDiscardOnClose, useDirtyFromBaseline } from '../../../../shared/hooks';
import {
  useServerQuery,
  formatNumberForInput,
  parseLocaleNumber,
  resolveInventoryForm,
  inventoryFormLabel,
  inventoryFormBadgeModifier,
  warehouseStockStatusRu,
  readWarehouseQuality,
  readWarehouseDefectReason,
  warehouseQualityShortLabel,
} from '../../../../shared/lib';
import { buildWarehouseBatchCardRows } from '../warehouseBatchCard';
import { EmptyState, ErrorState, Loading, useToast, DecimalInput, ConfirmModal, ActionMenu, Pagination, Badge } from '../../../../shared/ui';
import Select from '../../../../shared/ui/Select/Select';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import PackFromOtkModal from '../PackFromOtkModal';
import './WarehousePage.scss';

const statusLabel = (status) => warehouseStockStatusRu(status);
const batchTime = (b) => {
  const t = b?.updated_at || b?.created_at || b?.date;
  const ts = Date.parse(String(t || ''));
  return Number.isFinite(ts) ? ts : 0;
};
const statusRank = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'available') return 0;
  if (s === 'reserved') return 1;
  if (s === 'in_use' || s === 'processing') return 2;
  if (s === 'shipped' || s === 'sold' || s === 'closed') return 4;
  return 3;
};

const readDisplayProduct = (b) => {
  if (!b || typeof b !== 'object') return '—';
  const own = typeof b.product === 'string' ? b.product.trim() : '';
  if (own) return own;
  const profileLabel = b.linked_entities?.profile?.label;
  if (typeof profileLabel === 'string' && profileLabel.trim()) return profileLabel.trim();
  return '—';
};

const readDisplayBatch = (b) => {
  if (!b || typeof b !== 'object') return '—';
  const sourceLabel = b.linked_entities?.source_batch?.label;
  if (typeof sourceLabel === 'string' && sourceLabel.trim()) return sourceLabel.trim();
  return '—';
};

const formatWarehouseQty = (value, unit = 'шт') => (
  value != null && value !== '' ? `${formatNumberForInput(value)} ${unit}` : '—'
);

const WarehouseBatchDetailModal = ({ batch, stockTab, onClose }) => {
  const [fullBatch, setFullBatch] = useState(batch || null);
  const [resolvedLineName, setResolvedLineName] = useState('');
  useEffect(() => {
    let alive = true;
    setResolvedLineName('');
    if (!batch?.id) {
      setFullBatch(batch || null);
      return () => { alive = false; };
    }
    apiClient.get(`warehouse/batches/${batch.id}/`)
      .then((res) => {
        if (!alive) return;
        const detail = res.data || {};
        setFullBatch({ ...(batch || {}), ...detail });
      })
      .catch(() => {
        if (!alive) return;
        setFullBatch(batch || null);
      });
    return () => { alive = false; };
  }, [batch]);
  useEffect(() => {
    let alive = true;
    if (!batch?.id) return () => { alive = false; };
    if (fullBatch?.line_name) return () => { alive = false; };
    apiClient.get(`warehouse/batches/${batch.id}/trace/`)
      .then((res) => {
        if (!alive) return;
        const lineId = res.data?.production_batch?.line_id;
        if (!lineId) return;
        return apiClient.get(`lines/${lineId}/`)
          .then((lineRes) => {
            if (!alive) return;
            const name = (lineRes.data?.name || '').toString().trim();
            if (name) setResolvedLineName(name);
          })
          .catch(() => {
            if (!alive) return;
            setResolvedLineName('Линия');
          });
      })
      .catch(() => {
        if (!alive) return;
        setResolvedLineName('');
      });
    return () => { alive = false; };
  }, [batch, fullBatch?.line_name]);
  if (!fullBatch) return null;
  const rowsRaw = buildWarehouseBatchCardRows({
    ...fullBatch,
    line_name: fullBatch.line_name || resolvedLineName,
  });
  const rows = stockTab === 'reworked'
    ? [
      { label: 'Продукт', value: readDisplayProduct(fullBatch) },
      { label: 'Физический остаток', value: formatWarehouseQty(fullBatch.quantity, 'кг') },
      { label: 'Свободно', value: formatWarehouseQty(fullBatch.available_quantity, 'кг') },
      { label: 'Статус на складе', value: statusLabel(fullBatch.status) },
      { label: 'Дата выпуска', value: fullBatch.date ? String(fullBatch.date).slice(0, 10) : '—' },
    ]
    : rowsRaw;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide warehouse-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Партия</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="warehouse-detail-modal__grid">
          {rows.map(({ label, value }, i) => (
            <React.Fragment key={`${label}-${i}`}>
              <div className="warehouse-detail-modal__label">{label}</div>
              <div className="warehouse-detail-modal__value">{value}</div>
            </React.Fragment>
          ))}
        </div>
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
};

const WarehousePage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({
    page: 1,
    page_size: 20,
    status: '',
    search: '',
    inventory_form: '',
  });
  const [stockTab, setStockTab] = useState('good'); // good | defect | reworked
  const [reserveTarget, setReserveTarget] = useState(null);
  const [detailBatch, setDetailBatch] = useState(null);
  const [packOpen, setPackOpen] = useState(false);
  const [packError, setPackError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const listQuery = useMemo(() => {
    const q = { ...queryState };
    if (stockTab === 'reworked') {
      q.stock_bucket = 'reworked';
      delete q.inventory_form;
      delete q.status;
    }
    return q;
  }, [queryState, stockTab]);

  const { items, meta, raw, loading, error, refetch } = useServerQuery('warehouse/batches/', listQuery, { enabled: true });

  useOperationalRefetch(['warehouse_batch', 'production_batch', 'batch'], refetch, true);

  const filteredRows = useMemo(() => {
    const list = items || [];
    if (stockTab === 'reworked') return list;
    return list.filter((b) => {
      const qKey = readWarehouseQuality(b);
      return stockTab === 'defect' ? qKey === 'defect' : qKey !== 'defect';
    });
  }, [items, stockTab]);
  const sortedRows = useMemo(
    () => [...filteredRows].sort((a, b) => {
      const ra = statusRank(a.status);
      const rb = statusRank(b.status);
      if (ra !== rb) return ra - rb;
      const aAvail = Number(a.available_quantity ?? 0);
      const bAvail = Number(b.available_quantity ?? 0);
      const az = Number.isFinite(aAvail) ? aAvail : 0;
      const bz = Number.isFinite(bAvail) ? bAvail : 0;
      if (az !== bz) return bz - az;
      return batchTime(b) - batchTime(a);
    }),
    [filteredRows],
  );

  const listMeta = useMemo(() => {
    if (meta) return meta;
    const ps = Number(queryState.page_size) || 20;
    if (raw && typeof raw.count === 'number' && ps > 0) {
      return { page: queryState.page, pages: Math.max(1, Math.ceil(raw.count / ps)), total: raw.count };
    }
    return null;
  }, [meta, raw, queryState.page, queryState.page_size]);

  const handleReserve = async (batchId, quantity) => {
    setSubmitError('');
    try {
      await apiClient.post('warehouse/batches/reserve/', {
        batch_id: Number(batchId),
        quantity: Number(quantity),
      });
      setReserveTarget(null);
      refetch();
      toast.show('Успешно зарезервировано');
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.error || data?.message || 'Ошибка';
      setSubmitError(msg);
    }
  };

  return (
    <div className="page page--warehouse commercial-page">
      <div className="warehouse-tabs" role="tablist" aria-label="Тип партий">
        <button
          type="button"
          className={`warehouse-tabs__btn${stockTab === 'good' ? ' is-active' : ''}`}
          onClick={() => setStockTab('good')}
        >
          Годные
        </button>
        <button
          type="button"
          className={`warehouse-tabs__btn${stockTab === 'defect' ? ' is-active' : ''}`}
          onClick={() => setStockTab('defect')}
        >
          Брак
        </button>
        <button
          type="button"
          className={`warehouse-tabs__btn${stockTab === 'reworked' ? ' is-active' : ''}`}
          onClick={() => setStockTab('reworked')}
        >
          Переделанные
        </button>
      </div>
      <div className="page--warehouse__toolbar ds-toolbar ds-toolbar--page-head commercial-toolbar">
        <div className="ds-toolbar__start page--warehouse__filters">
          <input
            type="text"
            className="ds-toolbar__search page--warehouse__search ds-toolbar__search--full"
            placeholder="Поиск"
            value={queryState.search}
            onChange={(e) => setQueryState((p) => ({ ...p, search: e.target.value, page: 1 }))}
          />
          <div className="page--warehouse__filters-inline">
            {stockTab !== 'reworked' ? (
              <>
                <Select
                  className="page--warehouse__select"
                  value={queryState.status}
                  placeholder="Статус"
                  options={[
                    { value: '', label: 'Все статусы' },
                    { value: 'available', label: 'Доступно' },
                    { value: 'reserved', label: 'Резерв' },
                    { value: 'shipped', label: 'Продано' },
                  ]}
                  onChange={(val) => setQueryState((p) => ({ ...p, status: val, page: 1 }))}
                />
                <Select
                  className="page--warehouse__select"
                  value={queryState.inventory_form}
                  placeholder="Форма"
                  options={[
                    { value: '', label: 'Все формы' },
                    { value: 'unpacked', label: 'Не упаковано' },
                    { value: 'packed', label: 'Упаковано' },
                    { value: 'open_package', label: 'Открытая упаковка' },
                  ]}
                  onChange={(val) => setQueryState((p) => ({ ...p, inventory_form: val, page: 1 }))}
                />
              </>
            ) : null}
          </div>
        </div>
        {stockTab !== 'reworked' ? (
        <div className="ds-toolbar__end page--warehouse__toolbar-primary ds-hide-mobile">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => { setPackError(''); setPackOpen(true); }}
          >
            Упаковать
          </button>
        </div>
        ) : null}
      </div>

      {stockTab !== 'reworked' ? (
      <div className="ds-sticky-mobile-actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => { setPackError(''); setPackOpen(true); }}
        >
          Упаковать
        </button>
      </div>
      ) : null}

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && sortedRows.length === 0 && (
        <EmptyState title={stockTab === 'reworked' ? 'Нет партий на складе переделанных' : 'Нет партий'} />
      )}
      {!loading && (!error || error.status === 404) && sortedRows.length > 0 && (
        <div className="commercial-table-wrap">
          <table className="data-table data-table--fixed data-table--warehouse data-table--row-actions data-table--clickable">
          <thead>
            <tr>
              <th>Продукт</th>
              <th>Статус</th>
              {stockTab !== 'reworked' ? <th>Качество</th> : null}
              <th className="data-table__cell--num">Физический остаток</th>
              {stockTab !== 'reworked' ? <th className="data-table__cell--num">Зарезервировано</th> : null}
              <th className="data-table__cell--num">Свободно</th>
              {stockTab !== 'reworked' ? <th>Партия</th> : null}
              {stockTab !== 'reworked' ? <th aria-hidden /> : null}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((b) => {
              const qtyRaw = b.quantity;
              const reservedRaw = b.reserved_quantity;
              const availableRaw = b.available_quantity;
              const qty = Number.isFinite(Number(availableRaw)) ? Number(availableRaw) : 0;
              const productLabel = readDisplayProduct(b);
              const inv = resolveInventoryForm(b);
              const invMod = inventoryFormBadgeModifier(inv);
              const qKey = readWarehouseQuality(b);
              const isReworked = stockTab === 'reworked';
              const unit = isReworked ? 'кг' : '';
              const canReserve =
                !isReworked
                &&
                String(b.status || '').toLowerCase() === 'available'
                && qKey !== 'defect';
              const defectReason = readWarehouseDefectReason(b);
              const isDefect = qKey === 'defect';
              return (
                <tr
                  key={b.id}
                  tabIndex={0}
                  role="button"
                  className={isDefect ? 'data-table__row--warehouse-defect' : undefined}
                  onClick={() => setDetailBatch(b)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetailBatch(b);
                    }
                  }}
                >
                  <td className="data-table__cell--lead">
                    <span className="warehouse-table__product-name">{productLabel}</span>
                    {defectReason ? (
                      <span className="warehouse-table__defect-hint" title={defectReason}>
                        {defectReason.length > 48 ? `${defectReason.slice(0, 48)}…` : defectReason}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <div className="warehouse-table__status-stack">
                      <Badge variant={String(b.status || '').toLowerCase() === 'shipped' ? 'success' : String(b.status || '').toLowerCase() === 'reserved' ? 'warning' : 'default'}>
                        {statusLabel(b.status)}
                      </Badge>
                      {!isReworked ? <span className={`warehouse-inv-badge warehouse-inv-badge--${invMod} warehouse-inv-badge--inline`}>
                        {inventoryFormLabel(inv)}
                      </span> : null}
                    </div>
                  </td>
                  {stockTab !== 'reworked' ? <td>
                    <span
                      className={`warehouse-quality-badge warehouse-quality-badge--${qKey}`}
                      title={defectReason || undefined}
                    >
                      {warehouseQualityShortLabel(qKey)}
                    </span>
                  </td> : null}
                  <td className="data-table__cell--num">{qtyRaw != null && qtyRaw !== '' ? `${formatNumberForInput(qtyRaw)}${unit ? ` ${unit}` : ''}` : '—'}</td>
                  {stockTab !== 'reworked' ? <td className="data-table__cell--num">{reservedRaw != null && reservedRaw !== '' ? formatNumberForInput(reservedRaw) : '—'}</td> : null}
                  <td className="data-table__cell--num">{availableRaw != null && availableRaw !== '' ? `${formatNumberForInput(availableRaw)}${unit ? ` ${unit}` : ''}` : '—'}</td>
                  {stockTab !== 'reworked' ? <td className="warehouse-table__batch data-table__cell--muted data-table__cell--num">{readDisplayBatch(b)}</td> : null}
                  {stockTab !== 'reworked' ? <td>
                    {canReserve ? (
                      <ActionMenu
                        ariaLabel="Действия"
                        items={[
                          {
                            label: 'Резерв',
                            onClick: () => setReserveTarget({
                              id: b.id,
                              quantity: qty,
                              product: productLabel,
                              qualityKey: qKey,
                              defectReason,
                            }),
                          },
                        ]}
                      />
                    ) : (
                      <span className="data-table__cell--muted">—</span>
                    )}
                  </td> : null}
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      )}
      {!loading && (!error || error.status === 404) && (
        <Pagination meta={listMeta} onPageChange={(nextPage) => setQueryState((p) => ({ ...p, page: nextPage }))} />
      )}

      {reserveTarget && (
        <ReserveModal
          batch={reserveTarget}
          onClose={() => { setReserveTarget(null); setSubmitError(''); }}
          onSubmit={handleReserve}
          error={submitError}
        />
      )}

      {detailBatch && (
        <WarehouseBatchDetailModal
          batch={detailBatch}
          stockTab={stockTab}
          onClose={() => setDetailBatch(null)}
        />
      )}

      <PackFromOtkModal
        open={packOpen}
        onClose={() => { setPackOpen(false); setPackError(''); }}
        onSuccess={() => {
          refetch();
          toast.show('Упаковка выполнена');
        }}
        error={packError}
        setExternalError={setPackError}
      />
    </div>
  );
};

const ReserveModal = ({ batch, onClose, onSubmit, error }) => {
  const [quantity, setQuantity] = useState(
    batch?.quantity != null && batch?.quantity !== ''
      ? formatNumberForInput(batch.quantity)
      : '1',
  );
  const isDirty = useDirtyFromBaseline(String(batch?.id ?? ''), false, {
    quantity: String(quantity ?? '').trim(),
  });
  const {
    requestClose,
    discardConfirmOpen,
    confirmDiscardAndClose,
    cancelDiscard,
  } = useDiscardOnClose(onClose, isDirty);

  return (
    <div className="modal-overlay" onClick={requestClose}>
      <ConfirmModal
        open={discardConfirmOpen}
        title="Закрыть без сохранения?"
        message="Введённые данные не будут сохранены."
        confirmText="Закрыть"
        onConfirm={confirmDiscardAndClose}
        onCancel={cancelDiscard}
      />
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Резерв</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(
              batch.id,
              parseLocaleNumber(quantity),
            );
          }}
        >
          <div className="modal__field">
            <label>Продукт</label>
            <input value={batch.product} readOnly />
          </div>
          {batch.qualityKey === 'defect' && (
            <p className="warehouse-reserve__quality-note">
              <span className="warehouse-quality-badge warehouse-quality-badge--defect">Брак</span>
              {batch.defectReason ? (
                <span className="warehouse-reserve__defect-reason">{batch.defectReason}</span>
              ) : null}
            </p>
          )}
          <div className="modal__field">
            <label>Количество *</label>
            <DecimalInput min={1} value={quantity} onChange={setQuantity} required />
          </div>
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={requestClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Зарезервировать</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WarehousePage;

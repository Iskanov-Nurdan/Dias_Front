import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
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
import {
  subscribeBlankRuns,
  getBlankRunsSnapshot,
  loadBlankProductionRuns,
  acceptGpWarehouseRunWithPieces,
  isBlankRunOtkRecorded,
  resolveRecipeKgForRun,
  resolveUsedKgForRun,
  getGpAcceptBounds,
} from '../../../chemistry/lib/localBlankStore';
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

const gpFmtIso = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  if (s.length >= 19) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 19)}`;
  return s.slice(0, 10);
};

const cellNum = (v, suffix = '') => {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${formatNumberForInput(n)}${suffix}`;
};

const WarehouseGpAcceptModal = ({ run, onClose }) => {
  const toast = useToast();
  const bounds = useMemo(() => getGpAcceptBounds(run), [run]);
  const [piecesDraft, setPiecesDraft] = useState('');

  useEffect(() => {
    if (!run) return;
    const b = getGpAcceptBounds(run);
    if (b.ok) setPiecesDraft(String(b.maxPieces));
    else setPiecesDraft('');
  }, [run?.id, run?.goodKg, run?.goodPieces, run?.weightKgPerPiece]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!run?.id) return;
    if (!bounds.ok) {
      toast.show('Нет данных для приёмки: вес штуки и годный объём по строке');
      return;
    }
    const trimmed = String(piecesDraft ?? '').trim();
    if (trimmed === '') {
      toast.show('Укажите количество принятых штук');
      return;
    }
    const n = Math.floor(Number(trimmed));
    if (!Number.isFinite(n) || n < 0 || n > bounds.maxPieces) {
      toast.show(`От 0 до ${bounds.maxPieces} шт (по расчёту ОТК)`);
      return;
    }
    if (acceptGpWarehouseRunWithPieces(run.id, n)) {
      toast.show(
        n < bounds.maxPieces
          ? 'Принято. Остаток учтён в «Остатках» на производстве'
          : 'Принято на склад ГП',
      );
      onClose();
    } else toast.show('Не удалось сохранить приёмку');
  };

  if (!run) return null;

  const parsed =
    String(piecesDraft ?? '').trim() === '' ? NaN : Math.floor(Number(piecesDraft));
  const previewAcceptedKg =
    bounds.ok && Number.isFinite(parsed) && parsed >= 0 ? parsed * bounds.weightKgPerPiece : null;
  const previewRemainder =
    bounds.ok && previewAcceptedKg != null ? Math.max(0, bounds.goodKg - previewAcceptedKg) : null;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal modal--wide warehouse-gp-accept-modal"
        onClick={(ev) => ev.stopPropagation()}
        role="dialog"
        aria-labelledby="warehouse-gp-accept-title"
      >
        <div className="modal__head">
          <h3 id="warehouse-gp-accept-title">Приёмка: {run.productName || 'Товар'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form className="modal__body chemistry-element-form" onSubmit={handleSubmit}>
          {!bounds.ok ? (
            <p className="modal__error">
              Не задан вес одной штуки или годный объём. Проверьте товар и запись ОТК.
            </p>
          ) : (
            <>
              <p className="warehouse-gp-accept-modal__lede">
                После ОТК по расчёту: до <strong>{bounds.maxPieces} шт</strong> (
                {formatNumberForInput(bounds.goodKg)} кг годного при{' '}
                {formatNumberForInput(bounds.weightKgPerPiece)} кг/шт). Укажите, сколько штук реально
                принимаете на склад — разница останется как остаток в машине и появится во вкладке
                «Остатки».
              </p>
              <label htmlFor="gp-accept-pieces">Принято фактически, шт</label>
              <input
                id="gp-accept-pieces"
                inputMode="numeric"
                className="warehouse-gp-accept-modal__pieces-input"
                value={piecesDraft}
                onChange={(ev) => setPiecesDraft(ev.target.value.replace(/[^\d]/g, ''))}
                placeholder="0"
                autoComplete="off"
              />
              <div className="warehouse-gp-accept-modal__preview">
                <div>
                  <span className="warehouse-gp-accept-modal__preview-label">На склад ГП, кг</span>
                  <span className="warehouse-gp-accept-modal__preview-value">
                    {previewAcceptedKg != null ? `${formatNumberForInput(previewAcceptedKg)} кг` : '—'}
                  </span>
                </div>
                <div>
                  <span className="warehouse-gp-accept-modal__preview-label">Остаток в машине, кг</span>
                  <span className="warehouse-gp-accept-modal__preview-value">
                    {previewRemainder != null ? `${formatNumberForInput(previewRemainder)} кг` : '—'}
                  </span>
                </div>
              </div>
            </>
          )}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={!bounds.ok}>
              Сохранить приёмку
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const WarehouseGpAcceptPanel = () => {
  const [acceptRun, setAcceptRun] = useState(null);
  const v = useSyncExternalStore(subscribeBlankRuns, getBlankRunsSnapshot, getBlankRunsSnapshot);
  const { pending, accepted } = useMemo(() => {
    void v;
    const runs = loadBlankProductionRuns();
    const pend = runs.filter((r) => isBlankRunOtkRecorded(r) && !r.gpAcceptedAt);
    const acc = runs
      .filter((r) => r.gpAcceptedAt)
      .sort((a, b) => String(b.gpAcceptedAt).localeCompare(String(a.gpAcceptedAt)))
      .slice(0, 40);
    return { pending: pend, accepted: acc };
  }, [v]);

  const cellUsedKgDisplay = (r) => {
    const u = resolveUsedKgForRun(r);
    return u > 0 ? `${formatNumberForInput(u)} кг` : '—';
  };

  const rowCellsPending = (r) => (
    <>
      <td className="warehouse-gp__product">{r.productName || '—'}</td>
      <td className="data-table__cell--muted">{r.blankName || '—'}</td>
      <td className="data-table__cell--muted">{gpFmtIso(r.createdAt)}</td>
      <td className="data-table__cell--num">{cellNum(resolveRecipeKgForRun(r), ' кг')}</td>
      <td className="data-table__cell--num">{cellUsedKgDisplay(r)}</td>
      <td className="data-table__cell--num">{cellNum(r.defectKg, ' кг')}</td>
      <td className="data-table__cell--num">{cellNum(r.goodKg, ' кг')}</td>
      <td className="data-table__cell--num">
        {r.goodPieces != null && Number.isFinite(Number(r.goodPieces))
          ? formatNumberForInput(Number(r.goodPieces))
          : '—'}
      </td>
      <td className="data-table__cell--num">{cellNum(r.weightKgPerPiece, ' кг')}</td>
      <td>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setAcceptRun(r)}>
          Принять
        </button>
      </td>
    </>
  );

  const acceptedPiecesLabel = (r) => {
    if (r.gpAcceptedPieces != null && Number.isFinite(Number(r.gpAcceptedPieces))) {
      return formatNumberForInput(Number(r.gpAcceptedPieces));
    }
    if (r.goodPieces != null && Number.isFinite(Number(r.goodPieces))) {
      return formatNumberForInput(Math.floor(Number(r.goodPieces)));
    }
    return '—';
  };

  const rowCellsAccepted = (r) => (
    <>
      <td className="warehouse-gp__product">{r.productName || '—'}</td>
      <td className="data-table__cell--muted">{r.blankName || '—'}</td>
      <td className="data-table__cell--muted">{gpFmtIso(r.createdAt)}</td>
      <td className="data-table__cell--num">{cellNum(resolveRecipeKgForRun(r), ' кг')}</td>
      <td className="data-table__cell--num">{cellUsedKgDisplay(r)}</td>
      <td className="data-table__cell--num">{cellNum(r.defectKg, ' кг')}</td>
      <td className="data-table__cell--num">{cellNum(r.goodKg, ' кг')}</td>
      <td className="data-table__cell--num">
        {r.goodPieces != null && Number.isFinite(Number(r.goodPieces))
          ? formatNumberForInput(Number(r.goodPieces))
          : '—'}
      </td>
      <td className="data-table__cell--num">{cellNum(r.weightKgPerPiece, ' кг')}</td>
      <td className="data-table__cell--num">{acceptedPiecesLabel(r)}</td>
      <td className="data-table__cell--num">{cellNum(r.gpAcceptedKg, ' кг')}</td>
      <td className="data-table__cell--num">{cellNum(r.gpMachineRemainderKg, ' кг')}</td>
      <td className="data-table__cell--muted">{gpFmtIso(r.gpAcceptedAt)}</td>
    </>
  );

  return (
    <div className="warehouse-gp">
      <section className="warehouse-gp__block">
        <h2 className="warehouse-gp__title">К приёмке (после ОТК)</h2>
        <p className="warehouse-gp__hint">
          Здесь виден расчёт годных килограммов и штук. Нажмите «Принять», чтобы зафиксировать поступление
          на склад ГП (локально).
        </p>
        {pending.length === 0 ? (
          <EmptyState title="Нет строк на приёмку" />
        ) : (
          <div className="commercial-table-wrap warehouse-gp__table-wrap">
            <table className="data-table data-table--warehouse-gp">
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Заготовка</th>
                  <th>Дата выпуска</th>
                  <th className="data-table__cell--num">Заготовка, кг</th>
                  <th className="data-table__cell--num">В производстве, кг</th>
                  <th className="data-table__cell--num">Брак, кг</th>
                  <th className="data-table__cell--num">Годного, кг</th>
                  <th className="data-table__cell--num">Шт</th>
                  <th className="data-table__cell--num">кг/шт</th>
                  <th aria-hidden />
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id}>{rowCellsPending(r)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="warehouse-gp__block warehouse-gp__block--second">
        <h2 className="warehouse-gp__title">Принято</h2>
        {accepted.length === 0 ? (
          <EmptyState title="Пока ничего не принято" />
        ) : (
          <div className="commercial-table-wrap warehouse-gp__table-wrap">
            <table className="data-table data-table--warehouse-gp">
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Заготовка</th>
                  <th>Дата выпуска</th>
                  <th className="data-table__cell--num">Заготовка, кг</th>
                  <th className="data-table__cell--num">В производстве, кг</th>
                  <th className="data-table__cell--num">Брак, кг</th>
                  <th className="data-table__cell--num">Годного, кг</th>
                  <th className="data-table__cell--num">Шт (расч.)</th>
                  <th className="data-table__cell--num">кг/шт</th>
                  <th className="data-table__cell--num">Принято, шт</th>
                  <th className="data-table__cell--num">На склад, кг</th>
                  <th className="data-table__cell--num">Остаток машины, кг</th>
                  <th>Принято</th>
                </tr>
              </thead>
              <tbody>
                {accepted.map((r) => (
                  <tr key={r.id}>{rowCellsAccepted(r)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {acceptRun ? <WarehouseGpAcceptModal run={acceptRun} onClose={() => setAcceptRun(null)} /> : null}
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
  const [stockTab, setStockTab] = useState('good'); // good | defect | reworked | gp
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

  const { items, meta, raw, loading, error, refetch } = useServerQuery('warehouse/batches/', listQuery, {
    enabled: stockTab !== 'gp',
  });

  useOperationalRefetch(['warehouse_batch', 'production_batch', 'batch'], refetch, stockTab !== 'gp');

  const filteredRows = useMemo(() => {
    if (stockTab === 'gp') return [];
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
        <button
          type="button"
          className={`warehouse-tabs__btn${stockTab === 'gp' ? ' is-active' : ''}`}
          onClick={() => setStockTab('gp')}
        >
          Склад ГП
        </button>
      </div>
      {stockTab === 'gp' ? (
        <WarehouseGpAcceptPanel />
      ) : (
        <>
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
        </>
      )}

      {reserveTarget && (
        <ReserveModal
          batch={reserveTarget}
          onClose={() => { setReserveTarget(null); setSubmitError(''); }}
          onSubmit={handleReserve}
          error={submitError}
        />
      )}

      {detailBatch && stockTab !== 'gp' && (
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

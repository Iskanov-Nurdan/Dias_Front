import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDiscardOnClose, useDirtyFromBaseline } from '../../../../shared/hooks';
import {
  useServerQuery,
  formatNumberForInput,
  formatQuantityDisplay,
  parseLocaleNumber,
  resolveInventoryForm,
  inventoryFormLabel,
  getApiErrorMessage,
  getWarehouseQuantityPresentation,
  formatPacksByPiecesPhrase,
  readCatalogProductIdFromWarehouseBatch,
  sameWarehouseProductKey,
  readWarehouseQuality,
  readWarehouseDefectReason,
} from '../../../../shared/lib';
import {
  ConfirmModal,
  Collapse,
  EmptyState,
  ErrorState,
  Loading,
  ActionMenu,
  useToast,
  DecimalInput,
  IntegerInput,
  Select,
} from '../../../../shared/ui';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { downloadSaleWaybill } from '../../api/salesApi';
import './SalesPage.scss';

/** Поля упаковки с записи склада ГП (имена с бэка могут отличаться). */
function getPackagingMeta(batch) {
  if (!batch) {
    return { unitMeters: NaN, piecesPerPackage: NaN, packageTotalMeters: NaN };
  }
  const unitMeters = parseLocaleNumber(
    batch.length_per_piece
    ?? batch.unit_meters
    ?? batch.unit_length_m
    ?? batch.piece_length_m
    ?? batch.piece_meters,
  );
  const piecesPerPackage = parseLocaleNumber(
    batch.pieces_per_package ?? batch.pieces_in_package ?? batch.pieces_per_pack,
  );
  const packageTotalMeters = parseLocaleNumber(
    batch.package_total_meters ?? batch.package_meters ?? batch.pack_total_meters,
  );
  return { unitMeters, piecesPerPackage, packageTotalMeters };
}

function computePiecesForApi({ saleUnit, qtyInput, meta, overridePiecesPerPackage }) {
  const q = parseLocaleNumber(qtyInput);
  if (!(q > 0)) return { pieces: NaN, error: 'Укажите количество больше 0' };

  const pp =
    Number.isFinite(overridePiecesPerPackage) && overridePiecesPerPackage > 0
      ? overridePiecesPerPackage
      : meta.piecesPerPackage;

  if (saleUnit === 'piece') {
    return { pieces: Math.floor(q), error: null };
  }
  if (saleUnit === 'package') {
    if (!(Number.isFinite(pp) && pp > 0)) {
      return {
        pieces: NaN,
        error: 'Укажите штук в упаковке (из партии или вручную).',
      };
    }
    return { pieces: Math.floor(q * pp), error: null };
  }
  return { pieces: Math.floor(q), error: null };
}

const unitLabel = (u) => {
  if (u === 'package') return 'упак.';
  if (u === 'meter') return 'м'; // старые записи в таблице
  return 'шт';
};

function batchProductTitle(batch) {
  if (!batch) return '';
  const s = (v) => (v != null && String(v).trim() ? String(v).trim() : '');
  return (
    s(batch.profile_name)
    || s(batch.product_name)
    || s(batch.product?.name)
    || (typeof batch.product === 'string' ? s(batch.product) : '')
    || ''
  );
}

function formatBatchSelectOptionLabel(p) {
  const q = readWarehouseQuality(p);
  const base = batchProductTitle(p) || p.batch || p.lot || 'Партия';
  const pres = getWarehouseQuantityPresentation(p);
  const detail = [pres.primary, pres.secondary].filter(Boolean).join(' · ');
  const prefix = q === 'defect' ? 'Брак · ' : '';
  return `${prefix}${base}${detail ? ` — ${detail}` : ''}`;
}

/** Качество в продаже: только `quality` на записи продажи или на вложенной `warehouse_batch`. */
const saleWarehouseQualityKey = (s) => {
  if (!s || typeof s !== 'object') return 'good';
  if (s.warehouse_batch && typeof s.warehouse_batch === 'object') {
    return readWarehouseQuality(s.warehouse_batch);
  }
  return readWarehouseQuality(s);
};

const saleStorageFormLabel = (s) => {
  const pseudo = {
    inventory_form: s.inventory_form ?? s.stock_form,
    packaging_state: s.packaging_state,
    packaging_status: s.packaging_status,
  };
  return inventoryFormLabel(resolveInventoryForm(pseudo));
};

function saleRowRevenueText(s) {
  if (s.revenue != null && s.revenue !== '') return `${formatQuantityDisplay(s.revenue)} сом`;
  if (s.price != null && s.price !== '') return `${formatQuantityDisplay(s.price)} сом`;
  if (s.total != null && s.total !== '') return `${formatQuantityDisplay(s.total)} сом`;
  return '—';
}

function saleRowCostText(s) {
  if (s.cost_total != null && s.cost_total !== '') return `${formatQuantityDisplay(s.cost_total)} сом`;
  if (s.cost != null && s.cost !== '') return `${formatQuantityDisplay(s.cost)} сом`;
  return '—';
}

function saleRowProfitText(s) {
  if (s.profit != null && s.profit !== '') return `${formatQuantityDisplay(s.profit)} сом`;
  return '—';
}

function saleQtySummaryLine(s) {
  if (!s) return '—';
  if (
    s.quantity_unit === 'package' &&
    s.quantity_input != null &&
    String(s.quantity_input).trim() !== ''
  ) {
    return `${formatQuantityDisplay(s.quantity_input)} ${unitLabel(s.quantity_unit)} · ${formatQuantityDisplay(s.quantity)} шт · ${saleStorageFormLabel(s)}`;
  }
  return `${formatQuantityDisplay(s.quantity)} ${s.quantity_unit ? unitLabel(s.quantity_unit) : 'шт'} · ${saleStorageFormLabel(s)}`;
}

/** Поля для локального HTML накладной (совпадают с модалкой «Накладная»). */
function buildWaybillDraftSnapshot(sale) {
  if (!sale?.id) return { id: sale?.id };
  const dateStr =
    (sale.sale_date || sale.date || sale.created_at || '').toString().slice(0, 10) || '—';
  const clientStr = sale.client_name || sale.client?.name || sale.client || '—';
  const productTitle = batchProductTitle(sale) || '—';
  const batchNo =
    sale.warehouse_batch_id != null || sale.batch_id != null
      ? `№${sale.warehouse_batch_id ?? sale.batch_id ?? sale.warehouse_batch?.id}`
      : null;
  const defect = saleWarehouseQualityKey(sale) === 'defect';
  const batchParts = [productTitle];
  if (batchNo) batchParts.push(batchNo);
  if (defect) batchParts.push('Брак');
  return {
    id: sale.id,
    date_display: dateStr,
    client_display: clientStr,
    batch_display: batchParts.join(' '),
    quantity_display: saleQtySummaryLine(sale),
    revenue_display: saleRowRevenueText(sale),
    cost_display: saleRowCostText(sale),
    profit_display: saleRowProfitText(sale),
    comment: sale.comment,
  };
}

const SaleWaybillModal = ({ sale, onClose, onDownloadPdf, downloading }) => {
  if (!sale?.id) return null;
  const dateStr = (sale.sale_date || sale.date || sale.created_at || '').toString().slice(0, 10) || '—';
  const clientStr = sale.client_name || sale.client?.name || sale.client || '—';
  const productTitle = batchProductTitle(sale) || '—';
  const batchNo =
    sale.warehouse_batch_id != null || sale.batch_id != null
      ? `№${sale.warehouse_batch_id ?? sale.batch_id ?? sale.warehouse_batch?.id}`
      : null;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal sales-modal sales-modal--waybill" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Накладная</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="modal__body sales-waybill__body">
          <p className="sales-waybill__intro">Продажа №{sale.id}</p>
          <dl className="sales-waybill__dl">
            <div className="sales-waybill__row">
              <dt>Дата</dt>
              <dd>{dateStr}</dd>
            </div>
            <div className="sales-waybill__row">
              <dt>Клиент</dt>
              <dd>{clientStr}</dd>
            </div>
            <div className="sales-waybill__row">
              <dt>Партия</dt>
              <dd>
                {productTitle}
                {batchNo ? <span className="sales-waybill__batch-no"> {batchNo}</span> : null}
                {saleWarehouseQualityKey(sale) === 'defect' ? (
                  <span className="warehouse-quality-badge warehouse-quality-badge--defect sales-waybill__defect-badge">
                    Брак
                  </span>
                ) : null}
              </dd>
            </div>
            <div className="sales-waybill__row">
              <dt>Количество</dt>
              <dd>{saleQtySummaryLine(sale)}</dd>
            </div>
            <div className="sales-waybill__row">
              <dt>Выручка</dt>
              <dd>{saleRowRevenueText(sale)}</dd>
            </div>
            <div className="sales-waybill__row">
              <dt>Себестоимость</dt>
              <dd>{saleRowCostText(sale)}</dd>
            </div>
            <div className="sales-waybill__row">
              <dt>Прибыль</dt>
              <dd>{saleRowProfitText(sale)}</dd>
            </div>
            {sale.comment ? (
              <div className="sales-waybill__row">
                <dt>Комментарий</dt>
                <dd>{sale.comment}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div className="modal__actions sales-waybill__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Закрыть
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={downloading}
            onClick={() => onDownloadPdf(sale)}
          >
            {downloading ? 'Формирование…' : 'Скачать PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SalesPage = () => {
  const toast = useToast();
  const [queryState] = useState({ page: 1, page_size: 20 });
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);

  const [modalSale, setModalSale] = useState(null);
  const [waybillSale, setWaybillSale] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [waybillLoadingId, setWaybillLoadingId] = useState(null);

  const { items, loading, error, refetch } = useServerQuery('sales/', queryState, { enabled: true });

  const loadClientsAndProducts = useCallback(() => {
    apiClient
      .get('clients/', { params: { page_size: 500 } })
      .then((res) => {
        const raw = res.data?.items || [];
        setClients(raw.filter((c) => c.is_active !== false && c.active !== false));
      })
      .catch(() => setClients([]));
    apiClient
      .get('warehouse/batches/', { params: { page_size: 500, status: 'available' } })
      .then((res) => setProducts(res.data?.items || []))
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    loadClientsAndProducts();
  }, [loadClientsAndProducts]);

  const reloadSalesOperational = useCallback(() => {
    refetch();
    loadClientsAndProducts();
  }, [refetch, loadClientsAndProducts]);

  useOperationalRefetch(['sale', 'warehouse_batch'], reloadSalesOperational, true);

  const handleSubmit = async (payload) => {
    setSubmitError('');
    try {
      if (modalSale?.id) {
        await apiClient.patch(`sales/${modalSale.id}/`, payload);
        refetch();
        toast.show('Сохранено');
        setSubmitError('');
        return { id: modalSale.id };
      }
      const res = await apiClient.post('sales/', payload);
      refetch();
      toast.show('Создано');
      setSubmitError('');
      return { id: res.data?.id };
    } catch (err) {
      const data = err.response?.data;
      let msg = getApiErrorMessage(err, 'Ошибка');
      if (data?.details && typeof data.details === 'object' && typeof msg === 'string') {
        const details = Object.entries(data.details)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join('; ');
        if (details) msg = [msg, details].filter(Boolean).join('. ');
      }
      setSubmitError(msg);
      return null;
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitError('');
    try {
      await apiClient.delete(`sales/${deleteTarget.id}/`);
      setDeleteTarget(null);
      refetch();
      toast.show('Удалено');
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Ошибка удаления'));
    }
  };

  const onDownloadWaybill = useCallback(
    async (saleRow) => {
      if (!saleRow?.id) return;
      setWaybillLoadingId(saleRow.id);
      try {
        const { source } = await downloadSaleWaybill(saleRow.id, buildWaybillDraftSnapshot(saleRow));
        toast.show(source === 'server' ? 'Накладная скачана' : 'Скачан черновик накладной');
      } catch (e) {
        toast.show(e?.userMessage || e?.message || 'Не удалось скачать накладную', 'error');
      } finally {
        setWaybillLoadingId(null);
      }
    },
    [toast],
  );

  return (
    <div className="page page--sales">
      <div className="ds-toolbar ds-toolbar--page-head ds-toolbar--stack-mobile">
        <div className="ds-toolbar__end" style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            className="btn btn--primary ds-hide-mobile"
            onClick={() => {
              setWaybillSale(null);
              setModalSale({});
            }}
          >
            Создать
          </button>
        </div>
      </div>

      <div className="ds-sticky-mobile-actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            setWaybillSale(null);
            setModalSale({});
          }}
        >
          Создать
        </button>
      </div>

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет продаж" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <table className="data-table data-table--fixed data-table--sales data-table--row-actions data-table--clickable">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Клиент</th>
              <th>Партия</th>
              <th>Количество</th>
              <th>Выручка</th>
              <th>Себестоимость</th>
              <th>Прибыль</th>
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr
                key={s.id}
                tabIndex={0}
                role="button"
                aria-label={`Накладная, продажа №${s.id}`}
                onClick={() => setWaybillSale(s)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setWaybillSale(s);
                  }
                }}
              >
                <td className="data-table__cell--muted sales-table__date-cell">
                  {(s.sale_date || s.date || s.created_at || '').toString().slice(0, 10) || '—'}
                </td>
                <td className="data-table__cell--lead">{s.client_name || s.client?.name || s.client || '—'}</td>
                <td className="data-table__cell--lead">
                  <div className="sales-table__product-cell">
                    <span className="sales-table__product-title">
                      {batchProductTitle(s) || '—'}
                    </span>
                    {saleWarehouseQualityKey(s) === 'defect' ? (
                      <span className="warehouse-quality-badge warehouse-quality-badge--defect sales-table__quality-badge">
                        Брак
                      </span>
                    ) : null}
                    {s.warehouse_batch_id != null || s.batch_id != null ? (
                      <span className="sales-table__batch-hint">
                        №{s.warehouse_batch_id ?? s.batch_id ?? s.warehouse_batch?.id}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="sales-table__qty-cell">
                  <span className="sales-table__qty-line">
                    {s.quantity_unit === 'package' &&
                    s.quantity_input != null &&
                    String(s.quantity_input).trim() !== '' ? (
                      <>
                        {formatQuantityDisplay(s.quantity_input)} {unitLabel(s.quantity_unit)}
                        <span className="sales-table__qty-sub">
                          {formatQuantityDisplay(s.quantity)} шт · {saleStorageFormLabel(s)}
                        </span>
                      </>
                    ) : (
                      <>
                        {formatQuantityDisplay(s.quantity)} {s.quantity_unit ? unitLabel(s.quantity_unit) : 'шт'}
                        <span className="sales-table__qty-sub">{saleStorageFormLabel(s)}</span>
                      </>
                    )}
                  </span>
                </td>
                <td className="sales-table__price data-table__cell--num">
                  {s.revenue != null && s.revenue !== ''
                    ? `${formatQuantityDisplay(s.revenue)} сом`
                    : s.price != null && s.price !== ''
                      ? `${formatQuantityDisplay(s.price)} сом`
                      : s.total != null && s.total !== ''
                        ? `${formatQuantityDisplay(s.total)} сом`
                        : '—'}
                </td>
                <td className="data-table__cell--num data-table__cell--muted">
                  {s.cost_total != null && s.cost_total !== ''
                    ? `${formatQuantityDisplay(s.cost_total)} сом`
                    : s.cost != null && s.cost !== ''
                      ? `${formatQuantityDisplay(s.cost)} сом`
                      : '—'}
                </td>
                <td className="data-table__cell--num">
                  {s.profit != null && s.profit !== ''
                    ? `${formatQuantityDisplay(s.profit)} сом`
                    : '—'}
                </td>
                <td>
                  <ActionMenu
                    ariaLabel="Действия"
                    items={[
                      {
                        label: 'Редактировать',
                        onClick: () => {
                          setWaybillSale(null);
                          setModalSale(s);
                        },
                      },
                      {
                        label: 'Накладная',
                        onClick: () => setWaybillSale(s),
                      },
                      {
                        label: 'Удалить',
                        danger: true,
                        onClick: () =>
                          setDeleteTarget({ id: s.id, name: s.product_name || s.product || 'Продажа' }),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {submitError && !modalSale && !deleteTarget && (
        <p className="modal__error sales-page__error">{submitError}</p>
      )}

      {waybillSale && (
        <SaleWaybillModal
          sale={waybillSale}
          onClose={() => setWaybillSale(null)}
          onDownloadPdf={onDownloadWaybill}
          downloading={waybillLoadingId === waybillSale.id}
        />
      )}

      {modalSale !== null && (
        <SaleModal
          sale={modalSale?.id ? modalSale : null}
          clients={clients}
          products={products}
          onSubmit={handleSubmit}
          onClose={() => {
            setModalSale(null);
            setSubmitError('');
          }}
          error={submitError}
          onDownloadWaybill={onDownloadWaybill}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить продажу?"
        message={deleteTarget ? `Удалить "${deleteTarget.name}"?` : ''}
        confirmText="Удалить"
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setSubmitError(''); }}
        error={deleteTarget ? submitError : undefined}
      />
    </div>
  );
};

const SaleModal = ({ sale, clients, products, onSubmit, onClose, error, onDownloadWaybill }) => {
  const [phase, setPhase] = useState('form');
  const [savedId, setSavedId] = useState(null);
  const [client, setClient] = useState('');
  const [product, setProduct] = useState('');
  const [saleUnit, setSaleUnit] = useState('piece');
  const [qtyInput, setQtyInput] = useState('');
  const [price, setPrice] = useState('');
  const [comment, setComment] = useState('');
  const [overridePiecesPerPackage, setOverridePiecesPerPackage] = useState('');
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [waybillBusy, setWaybillBusy] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const [saleDate, setSaleDate] = useState('');

  useEffect(() => {
    setSyncing(true);
    setPhase('form');
    setSavedId(null);
    if (sale?.id) {
      setClient(sale.client_id ?? sale.client?.id ?? sale.client ?? '');
      const wb =
        sale.warehouse_batch_id ??
        sale.warehouse_batch?.id ??
        sale.batch_id ??
        sale.stock_batch_id;
      if (wb != null && String(wb).trim() !== '') {
        setProduct(String(wb));
      } else {
        setProduct('');
      }
      const qu = sale.quantity_unit;
      setSaleUnit(qu === 'meter' ? 'piece' : qu === 'package' || qu === 'piece' ? qu : 'piece');
      setQtyInput(
        sale.quantity_input != null && sale.quantity_input !== ''
          ? formatNumberForInput(sale.quantity_input)
          : sale.quantity != null
            ? formatNumberForInput(sale.quantity)
            : '',
      );
      setPrice(
        sale.price != null && sale.price !== '' ? formatNumberForInput(sale.price) : '',
      );
      setComment(sale.comment ?? '');
      const sd = sale.sale_date || sale.date || sale.created_at;
      setSaleDate(
        sd && String(sd).length >= 10 ? String(sd).slice(0, 10) : '',
      );
      setOverridePiecesPerPackage(
        sale.override_pieces_per_package != null && sale.override_pieces_per_package !== ''
          ? formatNumberForInput(sale.override_pieces_per_package)
          : '',
      );
    } else {
      setClient('');
      setProduct('');
      setSaleUnit('piece');
      setQtyInput('');
      setPrice('');
      setComment('');
      setOverridePiecesPerPackage('');
      setSaleDate(new Date().toISOString().slice(0, 10));
    }
    setSyncing(false);
  }, [sale]);

  const saleWarehouseBatchId = useMemo(
    () =>
      sale?.warehouse_batch_id ??
      sale?.warehouse_batch?.id ??
      sale?.batch_id ??
      sale?.stock_batch_id,
    [sale?.warehouse_batch_id, sale?.warehouse_batch?.id, sale?.batch_id, sale?.stock_batch_id],
  );
  const saleProductRef = useMemo(
    () => sale?.product_id ?? sale?.product?.id ?? sale?.product,
    [sale?.product_id, sale?.product],
  );
  /** Пока в ответе продажи нет warehouse_batch_id — подобрать строку склада по product_id. */
  useEffect(() => {
    if (!sale?.id || !products.length) return;
    if (saleWarehouseBatchId != null && String(saleWarehouseBatchId).trim() !== '') return;
    if (saleProductRef == null || saleProductRef === '') return;
    const match = products.find((b) => sameWarehouseProductKey(saleProductRef, b));
    if (match) setProduct(String(match.id));
  }, [sale?.id, saleProductRef, saleWarehouseBatchId, products]);

  const saleFormSnapshot = useMemo(
    () => ({
      client: client === '' || client == null ? '' : String(client),
      product: product === '' || product == null ? '' : String(product),
      saleUnit,
      qtyInput: String(qtyInput ?? '').trim(),
      price: String(price ?? '').trim(),
      comment: String(comment ?? '').trim(),
      overridePiecesPerPackage: String(overridePiecesPerPackage ?? '').trim(),
      saleDate: String(saleDate ?? '').trim(),
    }),
    [client, product, saleUnit, qtyInput, price, comment, overridePiecesPerPackage, saleDate],
  );

  const isDirtyForm = useDirtyFromBaseline(sale?.id ?? 'new', syncing, saleFormSnapshot);
  const needConfirmClose = useCallback(
    () => phase === 'form' && isDirtyForm(),
    [phase, isDirtyForm],
  );
  const {
    requestClose,
    discardConfirmOpen,
    confirmDiscardAndClose,
    cancelDiscard,
  } = useDiscardOnClose(onClose, needConfirmClose);

  const selectedBatch = useMemo(
    () => products.find((p) => String(p.id) === String(product)),
    [products, product],
  );
  const meta = useMemo(() => getPackagingMeta(selectedBatch), [selectedBatch]);
  const invForm = useMemo(
    () => (selectedBatch ? resolveInventoryForm(selectedBatch) : 'unpacked'),
    [selectedBatch],
  );
  const selectedBatchPackagingMeta = useMemo(
    () => getPackagingMeta(selectedBatch),
    [selectedBatch],
  );

  const batchQualityKey = useMemo(
    () => (selectedBatch ? readWarehouseQuality(selectedBatch) : 'good'),
    [selectedBatch],
  );
  const batchDefectReason = useMemo(
    () => (selectedBatch ? readWarehouseDefectReason(selectedBatch) : ''),
    [selectedBatch],
  );

  useEffect(() => {
    if (!selectedBatch || sale?.id) return;
    if (invForm === 'packed') {
      setSaleUnit((u) => (u === 'piece' ? 'package' : u));
    } else {
      setSaleUnit((u) => (u === 'package' ? 'piece' : u));
    }
  }, [selectedBatch, invForm, sale?.id]);

  /** Новая продажа: при смене партии подставить кратность упаковки только для «Упаковано». */
  useEffect(() => {
    if (sale?.id || !selectedBatch) return;
    if (resolveInventoryForm(selectedBatch) !== 'packed') {
      setOverridePiecesPerPackage('');
      return;
    }
    if (
      Number.isFinite(selectedBatchPackagingMeta.piecesPerPackage) &&
      selectedBatchPackagingMeta.piecesPerPackage > 0
    ) {
      setOverridePiecesPerPackage(formatNumberForInput(selectedBatchPackagingMeta.piecesPerPackage));
    } else {
      setOverridePiecesPerPackage('');
    }
  }, [sale?.id, selectedBatch, selectedBatchPackagingMeta]);

  /** Редактирование: в записи продажи нет override, в партии есть кратность — подставить в поле. */
  useEffect(() => {
    if (!sale?.id || !selectedBatch) return;
    if (sale.quantity_unit !== 'package') return;
    if (resolveInventoryForm(selectedBatch) !== 'packed') return;
    const hasOverride =
      sale.override_pieces_per_package != null && String(sale.override_pieces_per_package).trim() !== '';
    if (hasOverride) return;
    if (
      Number.isFinite(selectedBatchPackagingMeta.piecesPerPackage) &&
      selectedBatchPackagingMeta.piecesPerPackage > 0
    ) {
      setOverridePiecesPerPackage(formatNumberForInput(selectedBatchPackagingMeta.piecesPerPackage));
    }
  }, [
    sale?.id,
    sale?.quantity_unit,
    sale?.override_pieces_per_package,
    selectedBatch,
    selectedBatchPackagingMeta,
  ]);

  /**
   * Откуда списывать на бэке. Зависит от формы строки склада, не только от единицы продажи:
   * при «Упаковано» и продаже упаковками piece_pick всё равно нужен (целые пломбированные упаковки).
   */
  const piecePickForApi = useMemo(() => {
    if (invForm === 'packed') return 'from_sealed_package';
    if (invForm === 'open_package') return 'from_open_package';
    if (invForm === 'unpacked') return 'loose_remainder';
    return null;
  }, [invForm]);

  const sendPiecePick = useMemo(() => {
    if (!piecePickForApi) return false;
    if (piecePickForApi === 'loose_remainder' && invForm === 'unpacked') return false;
    return true;
  }, [piecePickForApi, invForm]);

  const effPiecesPerPackage = useMemo(() => {
    const o = parseLocaleNumber(overridePiecesPerPackage);
    if (Number.isFinite(o) && o > 0) return o;
    return meta.piecesPerPackage;
  }, [overridePiecesPerPackage, meta.piecesPerPackage]);

  const derived = useMemo(
    () =>
      computePiecesForApi({
        saleUnit,
        qtyInput,
        meta,
        overridePiecesPerPackage: parseLocaleNumber(overridePiecesPerPackage),
      }),
    [saleUnit, qtyInput, meta, overridePiecesPerPackage],
  );

  const availPieces = useMemo(() => {
    if (!selectedBatch) return NaN;
    return parseLocaleNumber(selectedBatch.available_quantity ?? selectedBatch.quantity);
  }, [selectedBatch]);

  const maxPacksByStock = useMemo(() => {
    if (saleUnit !== 'package') return null;
    const ipp = effPiecesPerPackage;
    if (!(Number.isFinite(ipp) && ipp > 0) || !Number.isFinite(availPieces) || availPieces < 1) return null;
    return Math.floor(availPieces / ipp);
  }, [saleUnit, effPiecesPerPackage, availPieces]);

  const stockExceeded =
    Number.isFinite(derived.pieces) &&
    derived.pieces > 0 &&
    Number.isFinite(availPieces) &&
    availPieces >= 0 &&
    derived.pieces > availPieces;

  const catalogProductId = useMemo(
    () => readCatalogProductIdFromWarehouseBatch(selectedBatch),
    [selectedBatch],
  );
  const catalogProductMissing =
    Boolean(selectedBatch) && catalogProductId == null;

  const packagingHint = useMemo(() => {
    const parts = [];
    if (Number.isFinite(meta.unitMeters) && meta.unitMeters > 0) {
      parts.push(`длина штуки ≈ ${formatQuantityDisplay(meta.unitMeters)} м`);
    }
    if (Number.isFinite(effPiecesPerPackage) && effPiecesPerPackage > 0) {
      parts.push(`в упаковке ≈ ${formatQuantityDisplay(effPiecesPerPackage)} шт`);
    }
    if (Number.isFinite(meta.packageTotalMeters) && meta.packageTotalMeters > 0) {
      parts.push(`метраж упаковки ≈ ${formatQuantityDisplay(meta.packageTotalMeters)} м`);
    }
    return parts.length ? parts.join(' · ') : null;
  }, [meta.unitMeters, effPiecesPerPackage, meta.packageTotalMeters]);

  const handleWaybill = async () => {
    const id = savedId ?? sale?.id;
    if (!id) return;
    setWaybillBusy(true);
    try {
      if (sale?.id) {
        await onDownloadWaybill(sale);
      } else {
        await onDownloadWaybill({
          id,
          client_name: clients.find((c) => String(c.id) === String(client))?.name,
          product_name:
            selectedBatch?.product_name || selectedBatch?.product?.name || selectedBatch?.product,
          quantity: derived.pieces,
          price,
          comment,
        });
      }
    } finally {
      setWaybillBusy(false);
    }
  };

  if (phase === 'success' && savedId) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal sales-modal sales-modal--success" onClick={(e) => e.stopPropagation()}>
          <div className="modal__head">
            <h3>Готово</h3>
            <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          </div>
          <div className="modal__body sales-modal__success-body">
            <p className="sales-modal__success-text">Продажа записана.</p>
          </div>
          <div className="modal__actions sales-modal__success-actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Закрыть
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={waybillBusy}
              onClick={handleWaybill}
            >
              {waybillBusy ? 'Скачивание…' : 'Накладная'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const priceNum = parseLocaleNumber(price);
  const qtyForTotal = saleUnit === 'package' ? parseLocaleNumber(qtyInput) : derived.pieces;
  const lineTotal =
    Number.isFinite(priceNum) && priceNum >= 0 && Number.isFinite(qtyForTotal) && qtyForTotal > 0
      ? priceNum * qtyForTotal
      : NaN;

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
      <div className="modal sales-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Продажа</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form
          id="sales-modal-form"
          className="sales-modal__form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!product) return;
            const { pieces, error: convErr } = derived;
            if (convErr) {
              return;
            }
            if (!(Number.isFinite(pieces) && pieces > 0)) return;
            if (stockExceeded) return;
            if (catalogProductMissing || catalogProductId == null) return;

            const qIn = parseLocaleNumber(qtyInput);
            const lenM = parseLocaleNumber(
              selectedBatch?.length_per_piece
              ?? selectedBatch?.unit_meters
              ?? selectedBatch?.unit_length_m
              ?? selectedBatch?.piece_length_m
              ?? selectedBatch?.piece_meters,
            );
            const packsInt = saleUnit === 'package' ? Math.floor(Number.isFinite(qIn) ? qIn : 0) : undefined;
            const payload = {
              ...(client ? { client_id: Number(client), client: Number(client) } : {}),
              product: catalogProductId,
              ...(selectedBatch?.id != null && String(selectedBatch.id).trim() !== ''
                ? {
                  warehouse_batch: Number(selectedBatch.id),
                  warehouse_batch_id: Number(selectedBatch.id),
                }
                : {}),
              sale_mode: saleUnit === 'package' ? 'packages' : 'pieces',
              sold_pieces: pieces,
              ...(saleUnit === 'package' && packsInt != null && packsInt >= 0
                ? { sold_packages: packsInt }
                : {}),
              ...(Number.isFinite(lenM) && lenM > 0 ? { length_per_piece: lenM } : {}),
              quantity: pieces,
              quantity_unit: saleUnit,
              quantity_input: Number.isFinite(qIn) ? qIn : pieces,
              stock_form: invForm,
              ...(sendPiecePick ? { piece_pick: piecePickForApi } : {}),
              ...(Number.isFinite(parseLocaleNumber(overridePiecesPerPackage)) &&
              parseLocaleNumber(overridePiecesPerPackage) > 0
                ? { override_pieces_per_package: parseLocaleNumber(overridePiecesPerPackage) }
                : {}),
              ...(price !== '' && Number.isFinite(parseLocaleNumber(price))
                ? { price: parseLocaleNumber(price) }
                : {}),
              ...(comment.trim() ? { comment: comment.trim() } : {}),
              ...(saleDate.trim() ? { sale_date: saleDate.trim(), date: saleDate.trim() } : {}),
            };

            setLocalSubmitting(true);
            try {
              const result = await onSubmit(payload);
              if (result?.id && !sale) {
                setSavedId(result.id);
                setPhase('success');
              } else if (result?.id && sale) {
                onClose();
              }
            } finally {
              setLocalSubmitting(false);
            }
          }}
        >
          <div className="sales-modal__fields">
            <label className="sales-modal__label" htmlFor="sales-modal-date">Дата продажи</label>
            <input
              id="sales-modal-date"
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="sales-modal__date-input"
            />

            <label className="sales-modal__label">Клиент</label>
            <Select
              value={client === '' || client == null ? '' : String(client)}
              onChange={setClient}
              placeholder="Клиент"
              options={[
                { value: '', label: 'Без клиента' },
                ...clients.map((c) => ({
                  value: String(c.id),
                  label: c.name || 'Клиент',
                })),
              ]}
            />

            <label className="sales-modal__label">Партия *</label>
            <Select
              value={product === '' || product == null ? '' : String(product)}
              onChange={setProduct}
              placeholder="Выберите партию"
              options={products.map((p) => ({
                value: String(p.id),
                label: formatBatchSelectOptionLabel(p),
              }))}
            />

            {selectedBatch && (
              <div
                className={`sales-modal__batch-strip sales-modal__batch-strip--${invForm}${
                  batchQualityKey === 'defect' ? ' sales-modal__batch-strip--defect' : ''
                }`}
              >
                <div className="sales-modal__batch-strip__top">
                  <span className="sales-modal__batch-strip__name">
                  {batchProductTitle(selectedBatch) || `Партия ${selectedBatch.id}`}
                </span>
                  {batchQualityKey === 'defect' ? (
                    <span className="warehouse-quality-badge warehouse-quality-badge--defect">Брак</span>
                  ) : (
                    <span className="warehouse-quality-badge warehouse-quality-badge--good">Годный</span>
                  )}
                  <span className="sales-modal__batch-strip__form">{inventoryFormLabel(invForm)}</span>
                </div>
                <div className="sales-modal__batch-strip__avail">
                  Доступно{' '}
                  {Number.isFinite(availPieces) ? `${formatQuantityDisplay(availPieces)} шт` : '—'}
                  {invForm === 'packed' && maxPacksByStock != null && maxPacksByStock >= 1
                    ? ` · до ${formatQuantityDisplay(maxPacksByStock)} упак.`
                    : ''}
                </div>
                {batchQualityKey === 'defect' && batchDefectReason ? (
                  <p className="sales-modal__batch-strip__reason">{batchDefectReason}</p>
                ) : null}
                {packagingHint ? (
                  <p className="sales-modal__batch-strip__hint">{packagingHint}</p>
                ) : null}
              </div>
            )}

            {selectedBatch && (
              <div className="sales-modal__unit-line">
                <span className="sales-modal__unit-line__k">Единица</span>
                <span className="sales-modal__unit-line__v">
                  {invForm === 'packed' ? 'Упаковки' : 'Штуки'}
                </span>
              </div>
            )}

            {selectedBatch && saleUnit === 'piece' && (
              <div className="sales-modal__block">
                <label className="sales-modal__label" htmlFor="sale-modal-qty-piece">Количество *</label>
                <div className="sales-modal__inline-qty">
                  <IntegerInput
                    id="sale-modal-qty-piece"
                    min={0}
                    value={qtyInput}
                    onChange={setQtyInput}
                    required
                    className="input sales-modal__inline-qty-input"
                  />
                  {Number.isFinite(availPieces) && availPieces >= 1 ? (
                    <button
                      type="button"
                      className="sales-modal__max-btn"
                      onClick={() => setQtyInput(String(Math.floor(availPieces)))}
                    >
                      Макс.
                    </button>
                  ) : null}
                </div>
              </div>
            )}

            {selectedBatch && saleUnit === 'package' && (
              <div className="sales-modal__block sales-modal__block--pack">
                <div className="sales-modal__pack-grid">
                  <div>
                    <label className="sales-modal__label" htmlFor="sale-modal-packs">Упаковок *</label>
                    <div className="sales-modal__inline-qty">
                      <IntegerInput
                        id="sale-modal-packs"
                        min={1}
                        value={qtyInput}
                        onChange={setQtyInput}
                        className="input sales-modal__inline-qty-input"
                      />
                      {maxPacksByStock != null && maxPacksByStock >= 1 ? (
                        <button
                          type="button"
                          className="sales-modal__max-btn"
                          onClick={() => setQtyInput(String(maxPacksByStock))}
                        >
                          Макс.
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <label className="sales-modal__label" htmlFor="sale-modal-ipp">Штук в упаковке *</label>
                    <IntegerInput
                      id="sale-modal-ipp"
                      min={1}
                      value={overridePiecesPerPackage}
                      onChange={setOverridePiecesPerPackage}
                      className="input"
                    />
                  </div>
                  <div className="sales-modal__pack-grid__total">
                    <span className="sales-modal__pack-grid__total-k">Итого шт</span>
                    <span className="sales-modal__pack-grid__total-v">
                      {Number.isFinite(derived.pieces) && derived.pieces > 0
                        ? formatQuantityDisplay(derived.pieces)
                        : '—'}
                    </span>
                  </div>
                </div>
                {(() => {
                  const pk = parseLocaleNumber(qtyInput);
                  const ippOk = Number.isFinite(effPiecesPerPackage) && effPiecesPerPackage > 0;
                  if (!(Number.isFinite(pk) && pk >= 1 && ippOk)) return null;
                  const phrase = formatPacksByPiecesPhrase(Math.floor(pk), Math.floor(effPiecesPerPackage));
                  return phrase ? <p className="sales-modal__pack-phrase">{phrase}</p> : null;
                })()}
              </div>
            )}

            {saleUnit === 'piece' &&
              selectedBatch &&
              Number.isFinite(derived.pieces) &&
              derived.pieces >= 0 &&
              !derived.error && (
                <p className="sales-modal__hint-line">
                  Списание: {formatQuantityDisplay(derived.pieces)} шт
                  {Number.isFinite(availPieces) && availPieces >= 0 ? (
                    <> · макс. {formatQuantityDisplay(availPieces)}</>
                  ) : null}
                </p>
              )}
            {derived.error ? <p className="modal__error">{derived.error}</p> : null}
            {stockExceeded ? (
              <p className="modal__error">
                Недостаточно на складе (макс. {formatQuantityDisplay(availPieces)} шт).
              </p>
            ) : null}

            <div className="sales-modal__block">
              <label className="sales-modal__label" htmlFor="sale-modal-price">Цена</label>
              <DecimalInput id="sale-modal-price" min={0} value={price} onChange={setPrice} placeholder="" />
              {Number.isFinite(lineTotal) && lineTotal > 0 ? (
                <p className="sales-modal__hint-line">
                  Сумма: {formatQuantityDisplay(lineTotal)} сом
                </p>
              ) : null}
            </div>

            <Collapse title="Комментарий">
              <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="" />
            </Collapse>

            {catalogProductMissing ? (
              <p className="modal__error" role="alert">
                Для этой партии нет продукта в каталоге — выберите другую.
              </p>
            ) : null}
            {error ? <p className="modal__error">{error}</p> : null}
          </div>
        </form>
        <div className="modal__actions sales-modal__footer">
          <button type="button" className="btn btn--secondary" onClick={requestClose} disabled={localSubmitting}>
            Отмена
          </button>
          <button
            type="submit"
            form="sales-modal-form"
            className="btn btn--primary"
            disabled={
              localSubmitting ||
              !!derived.error ||
              stockExceeded ||
              catalogProductMissing ||
              !(Number.isFinite(derived.pieces) && derived.pieces > 0)
            }
          >
            {localSubmitting ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesPage;

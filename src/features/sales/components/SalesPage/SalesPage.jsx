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

const SalesPage = () => {
  const toast = useToast();
  const [queryState] = useState({ page: 1, page_size: 20 });
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);

  const saleStorageFormLabel = (s) => {
    const pseudo = {
      inventory_form: s.inventory_form ?? s.stock_form,
      packaging_state: s.packaging_state,
      packaging_status: s.packaging_status,
    };
    return inventoryFormLabel(resolveInventoryForm(pseudo));
  };
  const [modalSale, setModalSale] = useState(null);
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
        const { source } = await downloadSaleWaybill(saleRow.id, {
          id: saleRow.id,
          client_name: saleRow.client_name || saleRow.client?.name,
          product_name: saleRow.product_name || saleRow.product?.name,
          quantity: saleRow.quantity,
          price: saleRow.price ?? saleRow.total,
          comment: saleRow.comment,
        });
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
        <div className="ds-toolbar__start">
          <p className="sales-page__lede">
            Продажа списывает только с <strong>склада готовой продукции</strong> (выбор партии со статусом «доступно»). Цепочка: производство (ProductionBatch) → ОТК → склад → продажа.
          </p>
        </div>
        <div className="ds-toolbar__end ds-hide-mobile">
          <button type="button" className="btn btn--primary" onClick={() => setModalSale({})}>
            Создать
          </button>
        </div>
      </div>

      <div className="ds-sticky-mobile-actions">
        <button type="button" className="btn btn--primary" onClick={() => setModalSale({})}>
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
              <th>Профиль / партия</th>
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
                onClick={() => setModalSale(s)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setModalSale(s);
                  }
                }}
              >
                <td className="data-table__cell--muted sales-table__date-cell">
                  {(s.sale_date || s.date || s.created_at || '').toString().slice(0, 10) || '—'}
                </td>
                <td className="data-table__cell--lead">{s.client_name || s.client?.name || s.client || '—'}</td>
                <td className="data-table__cell--lead">
                  {s.profile_name || s.profile?.name || s.product_name || s.product?.name || s.product || '—'}
                  {s.warehouse_batch_id != null || s.batch_id != null ? (
                    <span className="sales-table__batch-hint">
                      №{s.warehouse_batch_id ?? s.batch_id ?? s.warehouse_batch?.id}
                    </span>
                  ) : null}
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
                        label: waybillLoadingId === s.id ? '…' : 'Накладная',
                        disabled: waybillLoadingId === s.id,
                        onClick: () => onDownloadWaybill(s),
                      },
                      {
                        label: 'Удалить',
                        danger: true,
                        onClick: () =>
                          setDeleteTarget({ id: s.id, name: s.product_name || s.product || `#${s.id}` }),
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

  /** Пока в ответе продажи нет warehouse_batch_id — подобрать строку склада по product_id. */
  useEffect(() => {
    if (!sale?.id || !products.length) return;
    const wb =
      sale.warehouse_batch_id ??
      sale.warehouse_batch?.id ??
      sale.batch_id ??
      sale.stock_batch_id;
    if (wb != null && String(wb).trim() !== '') return;
    const pid = sale.product_id ?? sale.product?.id ?? sale.product;
    if (pid == null || pid === '') return;
    const match = products.find((b) => sameWarehouseProductKey(pid, b));
    if (match) setProduct(String(match.id));
  }, [sale?.id, sale?.product_id, sale?.warehouse_batch_id, sale?.batch_id, products]);

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

  useEffect(() => {
    if (!selectedBatch || sale?.id) return;
    if (invForm === 'packed') {
      setSaleUnit((u) => (u === 'piece' ? 'package' : u));
    } else {
      setSaleUnit((u) => (u === 'package' ? 'piece' : u));
    }
  }, [selectedBatch?.id, invForm, selectedBatch, sale?.id]);

  /** Новая продажа: при смене партии подставить кратность упаковки только для «Упаковано». */
  useEffect(() => {
    if (sale?.id || !selectedBatch) return;
    if (resolveInventoryForm(selectedBatch) !== 'packed') {
      setOverridePiecesPerPackage('');
      return;
    }
    const m = getPackagingMeta(selectedBatch);
    if (Number.isFinite(m.piecesPerPackage) && m.piecesPerPackage > 0) {
      setOverridePiecesPerPackage(formatNumberForInput(m.piecesPerPackage));
    } else {
      setOverridePiecesPerPackage('');
    }
  }, [selectedBatch?.id, sale?.id]);

  /** Редактирование: в записи продажи нет override, в партии есть кратность — подставить в поле. */
  useEffect(() => {
    if (!sale?.id || !selectedBatch) return;
    if (sale.quantity_unit !== 'package') return;
    if (resolveInventoryForm(selectedBatch) !== 'packed') return;
    const hasOverride =
      sale.override_pieces_per_package != null && String(sale.override_pieces_per_package).trim() !== '';
    if (hasOverride) return;
    const m = getPackagingMeta(selectedBatch);
    if (Number.isFinite(m.piecesPerPackage) && m.piecesPerPackage > 0) {
      setOverridePiecesPerPackage(formatNumberForInput(m.piecesPerPackage));
    }
  }, [sale?.id, selectedBatch?.id, sale?.quantity_unit, sale?.override_pieces_per_package]);

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
        <div className="modal sales-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal__head">
            <h3>Продажа создана</h3>
            <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          </div>
          <div className="modal__body">
            <p className="sales-modal__success-text">Продажа создана.</p>
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
      <div className="modal modal--wide sales-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{sale ? 'Редактировать' : 'Создать'}</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form
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
          <p className="sales-modal__chain-hint" style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', lineHeight: 1.45 }}>
            Отгрузка только со склада готовой продукции: выберите партию из списка (после производства и ОТК).
          </p>
          <label>Дата продажи</label>
          <input
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            className="sales-modal__date-input"
          />

          <label>Клиент</label>
          <Select
            value={client === '' || client == null ? '' : String(client)}
            onChange={setClient}
            placeholder="Клиент"
            options={[
              { value: '', label: 'Без клиента' },
              ...clients.map((c) => ({
                value: String(c.id),
                label: c.name || `#${c.id}`,
              })),
            ]}
          />

          <label>Партия склада *</label>
          <Select
            value={product === '' || product == null ? '' : String(product)}
            onChange={setProduct}
            placeholder="Партия"
            options={products.map((p) => {
              const name = p.product_name || p.product?.name || p.product || `#${p.id}`;
              const inv = resolveInventoryForm(p);
              const pres = getWarehouseQuantityPresentation(p);
              const suffix = pres.secondary
                ? `${pres.primary} · ${pres.secondary}`
                : inv === 'packed' || inv === 'open_package'
                  ? pres.primary
                  : `${pres.primary} шт`;
              return { value: String(p.id), label: `${name} — ${suffix}` };
            })}
          />

          {selectedBatch && (
            <div className={`sales-modal__stock-banner sales-modal__stock-banner--${invForm}`}>
              <span className="sales-modal__stock-label">Склад:</span>
              <span className="sales-modal__stock-value">{inventoryFormLabel(invForm)}</span>
              {packagingHint && <span className="sales-modal__stock-meta">{packagingHint}</span>}
            </div>
          )}

          <fieldset className="sales-modal__units">
            <legend>Единица *</legend>
            <label className="sales-modal__radio">
              <input
                type="radio"
                name="saleUnit"
                value="package"
                checked={saleUnit === 'package'}
                onChange={() => setSaleUnit('package')}
                disabled={invForm !== 'packed'}
              />
              Упаковки
            </label>
            <label className="sales-modal__radio">
              <input
                type="radio"
                name="saleUnit"
                value="piece"
                checked={saleUnit === 'piece'}
                onChange={() => setSaleUnit('piece')}
                disabled={invForm === 'packed'}
              />
              Штуки
            </label>
          </fieldset>

          {saleUnit === 'piece' ? (
            <>
              <label>Количество, шт *</label>
              <DecimalInput min={0} value={qtyInput} onChange={setQtyInput} required />
            </>
          ) : (
            <div className="sales-modal__pack-composition">
              <div className="sales-modal__pack-head">
                <span className="sales-modal__pack-title">Упаковки *</span>
              </div>
              <div className="sales-modal__pack-equation" aria-label="Расчёт отгрузки упаковками">
                <div className="sales-modal__pack-cell">
                  <label htmlFor="sale-modal-packs">Упаковок</label>
                  <div className="sales-modal__pack-input-row">
                    <DecimalInput
                      id="sale-modal-packs"
                      min={0}
                      value={qtyInput}
                      onChange={setQtyInput}
                    />
                    {maxPacksByStock != null && maxPacksByStock >= 1 && (
                      <button
                        type="button"
                        className="sales-modal__pack-max"
                        onClick={() => setQtyInput(String(maxPacksByStock))}
                      >
                        Макс.
                      </button>
                    )}
                  </div>
                </div>
                <span className="sales-modal__pack-op" aria-hidden>×</span>
                <div className="sales-modal__pack-cell">
                  <label htmlFor="sale-modal-ipp">Штук в каждой</label>
                  <DecimalInput
                    id="sale-modal-ipp"
                    min={1}
                    value={overridePiecesPerPackage}
                    onChange={setOverridePiecesPerPackage}
                  />
                  <span className="sales-modal__pack-cell-note">
                    {Number.isFinite(meta.piecesPerPackage) && meta.piecesPerPackage > 0
                      ? 'По умолчанию из партии.'
                      : 'Укажите штук в упаковке.'}
                  </span>
                </div>
                <span className="sales-modal__pack-op" aria-hidden>=</span>
                <div className="sales-modal__pack-total" role="status">
                  <span className="sales-modal__pack-total-label">Итого, шт</span>
                  <span className="sales-modal__pack-total-value">
                    {Number.isFinite(derived.pieces) && derived.pieces > 0
                      ? formatQuantityDisplay(derived.pieces)
                      : '—'}
                  </span>
                  {Number.isFinite(availPieces) && availPieces >= 0 && (
                    <span className="sales-modal__pack-total-avail">
                      из {formatQuantityDisplay(availPieces)}
                    </span>
                  )}
                </div>
              </div>
              {(() => {
                const pk = parseLocaleNumber(qtyInput);
                const ippOk = Number.isFinite(effPiecesPerPackage) && effPiecesPerPackage > 0;
                if (!(Number.isFinite(pk) && pk >= 1 && ippOk)) return null;
                const phrase = formatPacksByPiecesPhrase(Math.floor(pk), Math.floor(effPiecesPerPackage));
                return phrase ? <p className="sales-modal__pack-readback">{phrase}</p> : null;
              })()}
            </div>
          )}

          {saleUnit === 'piece' &&
            Number.isFinite(derived.pieces) &&
            derived.pieces >= 0 &&
            !derived.error && (
              <p className="sales-modal__computed">
                К списанию: {formatQuantityDisplay(derived.pieces)} шт
                {Number.isFinite(availPieces) && availPieces >= 0 && (
                  <> · на складе {formatQuantityDisplay(availPieces)}</>
                )}
              </p>
            )}
          {derived.error && <p className="modal__error">{derived.error}</p>}
          {stockExceeded && (
            <p className="modal__error">Недостаточно на складе (макс. {formatQuantityDisplay(availPieces)} шт).</p>
          )}

          <label>Цена</label>
          <DecimalInput min={0} value={price} onChange={setPrice} placeholder="0" />

          <Collapse title="Комментарий">
            <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="" />
          </Collapse>

          {catalogProductMissing && (
            <p className="modal__error" role="alert">
              У этой партии нет привязки к продукту в каталоге — выберите другую строку.
            </p>
          )}
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={requestClose} disabled={localSubmitting}>
              Отмена
            </button>
            <button
              type="submit"
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
        </form>
      </div>
    </div>
  );
};

export default SalesPage;

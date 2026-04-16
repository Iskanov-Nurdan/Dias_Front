import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../../shared/api';
import {
  parseLocaleNumber,
  formatQuantityDisplay,
  formatPacksByPiecesPhrase,
  ruPackagingWord,
  readBatchPackagingHeight,
  readBatchPackagingWidth,
  readBatchPackagingAngleDeg,
  batchHasFullPackagingGeometry,
  readWarehouseQuality,
  readWarehouseDefectReason,
  warehouseQualityShortLabel,
} from '../../../shared/lib';
import { useDiscardOnClose, useDirtyFromBaseline } from '../../../shared/hooks';
import { IntegerInput, Select, ConfirmModal } from '../../../shared/ui';
import { packFromOtk } from '../api/warehouseApi';

const errorToMessage = (err) => {
  const data = err?.response?.data;
  if (!data || typeof data !== 'object') return err?.message || 'Ошибка';
  return data.error || data.message || 'Ошибка';
};

const productName = (b) =>
  (b.product_name && String(b.product_name).trim())
  || (typeof b.product?.name === 'string' ? b.product.name : null)
  || (typeof b.product === 'string' ? b.product : null)
  || `Продукт #${b.product_id ?? '?'}`;

const lotLabel = (b) => b.batch ?? b.lot ?? (b.id != null ? `#${b.id}` : '—');

const formatDimsReadonly = (b) => {
  if (!batchHasFullPackagingGeometry(b)) return '—';
  const h = readBatchPackagingHeight(b);
  const w = readBatchPackagingWidth(b);
  const a = readBatchPackagingAngleDeg(b);
  return `${formatQuantityDisplay(h)} × ${formatQuantityDisplay(w)} × ${formatQuantityDisplay(a)}°`;
};

const PackFromOtkModal = ({ open, onClose, onSuccess, error: externalError, setExternalError }) => {
  const [warehouseBatchId, setWarehouseBatchId] = useState('');
  const [itemsPerPackage, setItemsPerPackage] = useState('');
  const [packagesCount, setPackagesCount] = useState('1');
  const [comment, setComment] = useState('');
  const [unpackedBatches, setUnpackedBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  const selectedBatch = useMemo(
    () => unpackedBatches.find((x) => String(x.id) === String(warehouseBatchId)),
    [unpackedBatches, warehouseBatchId],
  );

  const ipp = useMemo(() => {
    const n = parseLocaleNumber(itemsPerPackage);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
  }, [itemsPerPackage]);

  const pk = useMemo(() => {
    const n = parseLocaleNumber(packagesCount);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
  }, [packagesCount]);

  const availableQty = useMemo(() => {
    if (!selectedBatch) return 0;
    const q = parseLocaleNumber(selectedBatch.quantity ?? selectedBatch.available_quantity);
    return Number.isFinite(q) && q > 0 ? q : 0;
  }, [selectedBatch]);

  const requiredQty = ipp != null && pk != null ? ipp * pk : null;

  const maxPackagesByStock = useMemo(() => {
    if (ipp == null || ipp < 1 || !(availableQty > 0)) return null;
    return Math.floor(availableQty / ipp);
  }, [ipp, availableQty]);

  const batchOptions = useMemo(() => {
    const list = [...unpackedBatches].sort((a, b) => {
      const na = productName(a);
      const nb = productName(b);
      const c = na.localeCompare(nb, 'ru');
      if (c !== 0) return c;
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });
    return list.map((b) => {
      const q = parseLocaleNumber(b.quantity ?? b.available_quantity);
      const qtyStr = Number.isFinite(q) ? `${formatQuantityDisplay(q)} шт` : '—';
      const qn = readWarehouseQuality(b);
      const prefix = qn === 'defect' ? 'Брак · ' : '';
      return {
        value: String(b.id),
        label: `${prefix}${productName(b)} · ${lotLabel(b)} · ${qtyStr}`,
      };
    });
  }, [unpackedBatches]);

  useEffect(() => {
    if (!open) return;
    setLocalError('');
    setExternalError?.('');
    setWarehouseBatchId('');
    setItemsPerPackage('');
    setPackagesCount('1');
    setComment('');
    setUnpackedBatches([]);
    setLoadingBatches(true);
    apiClient
      .get('warehouse/batches/', {
        params: {
          page_size: 200,
          status: 'available',
          inventory_form: 'unpacked',
        },
      })
      .then((res) => {
        const items = res.data?.items ?? [];
        setUnpackedBatches(items);
      })
      .catch(() => {
        setUnpackedBatches([]);
      })
      .finally(() => {
        setLoadingBatches(false);
      });
  }, [open, setExternalError]);

  const packSnap = {
    warehouseBatchId: warehouseBatchId === '' || warehouseBatchId == null ? '' : String(warehouseBatchId),
    itemsPerPackage: String(itemsPerPackage ?? '').trim(),
    packagesCount: String(packagesCount ?? '').trim(),
    comment: String(comment ?? '').trim(),
  };
  const isDirty = useDirtyFromBaseline(String(open), open ? loadingBatches : true, packSnap);
  const {
    requestClose,
    discardConfirmOpen,
    confirmDiscardAndClose,
    cancelDiscard,
  } = useDiscardOnClose(onClose, isDirty);

  if (!open) return null;

  const err = externalError || localError;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setExternalError?.('');
    const wid = warehouseBatchId ? Number(warehouseBatchId) : NaN;
    if (!Number.isFinite(wid) || wid <= 0) {
      setLocalError('Выберите партию.');
      return;
    }
    if (ipp == null) {
      setLocalError('«Штук в упаковке» — целое число от 1.');
      return;
    }
    if (pk == null) {
      setLocalError('«Упаковок» — целое число от 1.');
      return;
    }
    const need = ipp * pk;
    if (availableQty < 1) {
      setLocalError('В партии нет доступного количества.');
      return;
    }
    if (need > availableQty) {
      setLocalError(
        `Недостаточно остатка: нужно ${formatQuantityDisplay(need)} шт, доступно ${formatQuantityDisplay(availableQty)} шт.`,
      );
      return;
    }

    setSaving(true);
    try {
      await packFromOtk({
        warehouse_batch_id: wid,
        warehouse_batch: wid,
        pieces_per_package: ipp,
        packages_count: pk,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
      onSuccess?.();
      onClose();
    } catch (ex) {
      const msg = errorToMessage(ex);
      if (setExternalError) setExternalError(msg);
      else setLocalError(msg);
    } finally {
      setSaving(false);
    }
  };

  const foundLine =
    selectedBatch
      ? (availableQty > 0
        ? `Доступно: ${formatQuantityDisplay(availableQty)} шт`
        : 'Нет доступного количества.')
      : 'Выберите партию — покажем остаток.';

  const compositionPhrase =
    ipp != null && pk != null ? formatPacksByPiecesPhrase(pk, ipp) : null;

  const spendLine =
    requiredQty != null ? `К списанию: ${formatQuantityDisplay(requiredQty)} шт` : null;

  const shortage = requiredQty != null && availableQty > 0 && requiredQty > availableQty;

  const defectReason = selectedBatch ? readWarehouseDefectReason(selectedBatch) : '';

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
      <div className="modal pack-from-otk-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head pack-from-otk-modal__head">
          <h3>Упаковать</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        <form className="pack-from-otk-form" onSubmit={handleSubmit}>
          <div className="pack-from-otk-form__grid">
            <div className="pack-from-otk-form__field pack-from-otk-form__field--wide">
              <label>Партия *</label>
              <Select
                value={warehouseBatchId === '' || warehouseBatchId == null ? '' : String(warehouseBatchId)}
                onChange={setWarehouseBatchId}
                disabled={loadingBatches}
                placeholder={loadingBatches ? 'Загрузка…' : 'Выберите партию'}
                options={batchOptions}
              />
            </div>

            {selectedBatch && (
              <div className="pack-from-otk-form__readonly-block pack-from-otk-form__field pack-from-otk-form__field--wide">
                <div className="pack-from-otk-form__readonly-row">
                  <span className="pack-from-otk-form__readonly-k">Качество</span>
                  <span className="pack-from-otk-form__readonly-v">
                    {warehouseQualityShortLabel(readWarehouseQuality(selectedBatch))}
                  </span>
                </div>
                {defectReason ? (
                  <div className="pack-from-otk-form__readonly-row">
                    <span className="pack-from-otk-form__readonly-k">Причина брака</span>
                    <span className="pack-from-otk-form__readonly-v pack-from-otk-form__readonly-v--reason">{defectReason}</span>
                  </div>
                ) : null}
                <div className="pack-from-otk-form__readonly-row">
                  <span className="pack-from-otk-form__readonly-k">Высота × ширина × угол</span>
                  <span className="pack-from-otk-form__readonly-v">{formatDimsReadonly(selectedBatch)}</span>
                </div>
              </div>
            )}

            <div className="pack-from-otk-form__field pack-from-otk-form__field--wide pack-from-otk-form__field--composition">
              <div className="pack-from-otk-form__composition-head">
                <span className="pack-from-otk-form__composition-title">Упаковка *</span>
              </div>
              <div className="pack-from-otk-form__equation" aria-label="Параметры упаковки">
                <div className="pack-from-otk-form__equation-cell">
                  <label htmlFor="pack-from-otk-packages-count">Упаковок</label>
                  <div className="pack-from-otk-form__equation-input-row">
                    <IntegerInput
                      id="pack-from-otk-packages-count"
                      min={1}
                      value={packagesCount}
                      onChange={setPackagesCount}
                      required
                      className="input"
                    />
                    {maxPackagesByStock != null && maxPackagesByStock >= 1 && (
                      <button
                        type="button"
                        className="pack-from-otk-form__max-btn"
                        disabled={loadingBatches}
                        onClick={() => setPackagesCount(String(maxPackagesByStock))}
                      >
                        Макс.
                      </button>
                    )}
                  </div>
                </div>
                <span className="pack-from-otk-form__equation-op" aria-hidden>×</span>
                <div className="pack-from-otk-form__equation-cell">
                  <label htmlFor="pack-from-otk-items-per-pack">Штук в каждой</label>
                  <IntegerInput
                    id="pack-from-otk-items-per-pack"
                    min={1}
                    value={itemsPerPackage}
                    onChange={setItemsPerPackage}
                    required
                    className="input"
                  />
                </div>
                <span className="pack-from-otk-form__equation-op" aria-hidden>=</span>
                <div className="pack-from-otk-form__equation-total" role="status">
                  <span className="pack-from-otk-form__equation-total-label">итого шт</span>
                  <strong className="pack-from-otk-form__equation-total-value">
                    {requiredQty != null ? formatQuantityDisplay(requiredQty) : '—'}
                  </strong>
                </div>
              </div>
              {compositionPhrase && (
                <p className="pack-from-otk-form__composition-readback">{compositionPhrase}</p>
              )}
            </div>

            <div className="pack-from-otk-form__field pack-from-otk-form__field--wide">
              <label>Комментарий</label>
              <textarea
                className="pack-from-otk-form__comment"
                rows={2}
                value={comment}
                onChange={(ev) => setComment(ev.target.value)}
                placeholder="Необязательно"
              />
            </div>

            <div className="pack-from-otk-form__field pack-from-otk-form__field--wide">
              <p className="pack-from-otk-form__found" role="status">{foundLine}</p>
              {spendLine && <p className="pack-from-otk-form__subline">{spendLine}</p>}
              {shortage && (
                <p className="pack-from-otk-form__warn" role="alert">
                  Недостаточно остатка — уменьшите упаковки или штук в упаковке.
                </p>
              )}
              {maxPackagesByStock != null && maxPackagesByStock >= 0 && ipp != null && (
                <p className="pack-from-otk-form__subline">
                  Максимум по остатку:{' '}
                  {formatPacksByPiecesPhrase(maxPackagesByStock, ipp) ??
                    `${maxPackagesByStock} ${ruPackagingWord(maxPackagesByStock)} по ${formatQuantityDisplay(ipp)} шт`}
                </p>
              )}
            </div>
          </div>
          {err && <p className="modal__error">{err}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={requestClose} disabled={saving}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={saving || loadingBatches}>
              {saving ? 'Упаковка…' : 'Упаковать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PackFromOtkModal;

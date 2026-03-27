import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../../shared/api';
import {
  parseLocaleNumber,
  formatQuantityDisplay,
  sumNotPackedQtyMatchingParams,
  toPackagingNumber,
  formatPacksByPiecesPhrase,
  ruPackagingWord,
} from '../../../shared/lib';
import { useDiscardOnClose, useDirtyFromBaseline } from '../../../shared/hooks';
import { DecimalInput, Select, ConfirmModal } from '../../../shared/ui';
import { packFromOtk } from '../api/warehouseApi';

const errorToMessage = (err) => {
  const data = err?.response?.data;
  if (!data || typeof data !== 'object') return err?.message || 'Ошибка';
  return data.error || data.message || 'Ошибка';
};

const PackFromOtkModal = ({ open, onClose, onSuccess, error: externalError, setExternalError }) => {
  const [productId, setProductId] = useState('');
  const [heightM, setHeightM] = useState('');
  const [widthM, setWidthM] = useState('');
  const [angleDeg, setAngleDeg] = useState('');
  const [itemsPerPackage, setItemsPerPackage] = useState('');
  const [packagesCount, setPackagesCount] = useState('1');
  const [unpackedBatches, setUnpackedBatches] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  const hN = useMemo(() => toPackagingNumber(heightM), [heightM]);
  const wN = useMemo(() => toPackagingNumber(widthM), [widthM]);
  const aN = useMemo(() => toPackagingNumber(angleDeg), [angleDeg]);

  const paramsReady = Number.isFinite(hN) && hN > 0 && Number.isFinite(wN) && wN >= 0 && Number.isFinite(aN);

  const availableQty = useMemo(() => {
    if (!productId || !paramsReady) return 0;
    return sumNotPackedQtyMatchingParams(unpackedBatches, {
      productId,
      heightM: hN,
      widthM: wN,
      angleDeg: aN,
    });
  }, [unpackedBatches, productId, paramsReady, hN, wN, aN]);

  const ipp = useMemo(() => {
    const n = parseLocaleNumber(itemsPerPackage);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
  }, [itemsPerPackage]);

  const pk = useMemo(() => {
    const n = parseLocaleNumber(packagesCount);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
  }, [packagesCount]);

  const requiredQty = ipp != null && pk != null ? ipp * pk : null;

  const maxPackagesByStock = useMemo(() => {
    if (ipp == null || ipp < 1 || !(availableQty > 0)) return null;
    return Math.floor(availableQty / ipp);
  }, [ipp, availableQty]);

  useEffect(() => {
    if (!open) return;
    setLocalError('');
    setExternalError?.('');
    setProductId('');
    setHeightM('');
    setWidthM('');
    setAngleDeg('');
    setItemsPerPackage('');
    setPackagesCount('1');
    setUnpackedBatches([]);
    setLoadingProducts(true);
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
        const map = new Map();
        items.forEach((b) => {
          const rawProduct = b.product;
          const primitiveProduct =
            typeof rawProduct === 'string' || typeof rawProduct === 'number' ? rawProduct : null;
          const id = b.product_id ?? b.product?.id ?? primitiveProduct;
          const name =
            (b.product_name && String(b.product_name).trim()) ||
            (typeof b.product?.name === 'string' ? b.product.name : null) ||
            `Продукт #${id ?? '?'}`;
          if (id == null || String(id).trim() === '') return;
          const key = String(id).trim();
          if (!map.has(key)) map.set(key, { id: key, name: String(name) });
        });
        const opts = [...map.values()].sort((x, y) => x.name.localeCompare(y.name, 'ru'));
        setProductOptions(opts);
      })
      .catch(() => {
        setUnpackedBatches([]);
        setProductOptions([]);
      })
      .finally(() => setLoadingProducts(false));
  }, [open, setExternalError]);

  const packSnap = {
    productId: productId === '' || productId == null ? '' : String(productId),
    heightM: String(heightM ?? '').trim(),
    widthM: String(widthM ?? '').trim(),
    angleDeg: String(angleDeg ?? '').trim(),
    itemsPerPackage: String(itemsPerPackage ?? '').trim(),
    packagesCount: String(packagesCount ?? '').trim(),
  };
  const isDirty = useDirtyFromBaseline(String(open), open ? loadingProducts : true, packSnap);
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
    if (!productId) {
      setLocalError('Выберите продукт.');
      return;
    }
    if (!paramsReady) {
      setLocalError('Укажите высоту, ширину и угол (как в строке склада).');
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
      setLocalError('Нет неупакованного остатка с таким продуктом и параметрами.');
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
      const packageTotalM = Math.round(ipp * hN * 1e9) / 1e9;
      await packFromOtk({
        product_id: String(productId).trim(),
        shift_height: hN,
        shift_width: wN,
        width_meters: wN,
        angle_deg: aN,
        pieces_per_package: ipp,
        packages_count: pk,
        unit_meters: hN,
        package_total_meters: packageTotalM,
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
    productId && paramsReady
      ? availableQty > 0
        ? `Доступно неупакованного: ${formatQuantityDisplay(availableQty)} шт`
        : 'Подходящего неупакованного остатка нет (проверьте продукт и размеры).'
      : productId && !paramsReady
        ? 'Введите высоту, ширину и угол — покажем остаток.'
        : 'Выберите продукт и параметры — покажем остаток.';

  const compositionPhrase =
    ipp != null && pk != null ? formatPacksByPiecesPhrase(pk, ipp) : null;

  const spendLine =
    requiredQty != null ? `К списанию: ${formatQuantityDisplay(requiredQty)} шт` : null;

  const shortage = requiredQty != null && availableQty > 0 && requiredQty > availableQty;

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
              <label>Продукт *</label>
              <Select
                value={productId === '' || productId == null ? '' : String(productId)}
                onChange={setProductId}
                disabled={loadingProducts}
                placeholder="Выберите продукт"
                options={productOptions.map((p) => ({ value: String(p.id), label: p.name }))}
              />
            </div>
            <div className="pack-from-otk-form__field">
              <label>Высота, м *</label>
              <DecimalInput min={0} value={heightM} onChange={setHeightM} required />
            </div>
            <div className="pack-from-otk-form__field">
              <label>Ширина, м *</label>
              <DecimalInput min={0} value={widthM} onChange={setWidthM} required />
            </div>
            <div className="pack-from-otk-form__field">
              <label>Угол, ° *</label>
              <DecimalInput value={angleDeg} onChange={setAngleDeg} required />
            </div>
            <div className="pack-from-otk-form__field pack-from-otk-form__field--wide pack-from-otk-form__field--composition">
              <div className="pack-from-otk-form__composition-head">
                <span className="pack-from-otk-form__composition-title">Упаковка *</span>
              </div>
              <div className="pack-from-otk-form__equation" aria-label="Параметры упаковки">
                <div className="pack-from-otk-form__equation-cell">
                  <label htmlFor="pack-from-otk-packages-count">Упаковок</label>
                  <div className="pack-from-otk-form__equation-input-row">
                    <DecimalInput
                      id="pack-from-otk-packages-count"
                      min={1}
                      value={packagesCount}
                      onChange={setPackagesCount}
                      required
                    />
                    {maxPackagesByStock != null && maxPackagesByStock >= 1 && (
                      <button
                        type="button"
                        className="pack-from-otk-form__max-btn"
                        disabled={loadingProducts}
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
                  <DecimalInput
                    id="pack-from-otk-items-per-pack"
                    min={1}
                    value={itemsPerPackage}
                    onChange={setItemsPerPackage}
                    required
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
            <button type="submit" className="btn btn--primary" disabled={saving || loadingProducts}>
              {saving ? 'Упаковка…' : 'Упаковать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PackFromOtkModal;

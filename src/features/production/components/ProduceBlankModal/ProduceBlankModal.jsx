import React, { useMemo, useState, useEffect } from 'react';
import { Select } from '../../../../shared/ui';
import {
  formatNumberForInput,
  useServerQuery,
  getApiErrorMessage,
} from '../../../../shared/lib';
import { DEMO_PRODUCTION_VAT_MAX_KG } from '../../../chemistry/lib/blankRecipeShared';
import {
  postWorkshopBlankProductionRun,
  buildCreateBlankRunPayload,
  mapWorkshopBlankFromApi,
  mapPreparedBlankRowFromApi,
} from '../../../chemistry/api/blankWorkshopApi';
import { getPlasticProfile } from '../../api/productionApi';
import { readPlasticProfileWeightKg } from '../../lib/readPlasticProfilePieceWeight';
import './ProduceBlankModal.scss';

const listQ = { page: 1, page_size: 500, ordering: 'name' };
const prepQ = { page: 1, page_size: 500 };
const ProduceBlankModal = ({ onClose, onSaved }) => {
  const { items: blankItems } = useServerQuery('workshop/blanks/', listQ, { enabled: true });
  const { items: profileItems } = useServerQuery('plastic-profiles/', listQ, {
    enabled: true,
  });
  const { items: preparedItems } = useServerQuery('workshop/prepared-blanks/', prepQ, { enabled: true });

  const blanks = useMemo(
    () => (blankItems || []).map(mapWorkshopBlankFromApi).filter(Boolean),
    [blankItems],
  );
  const preparedByBlankId = useMemo(() => {
    const m = new Map();
    (preparedItems || []).forEach((row) => {
      const mapped = mapPreparedBlankRowFromApi(row);
      if (mapped?.blankId) m.set(mapped.blankId, mapped);
    });
    return m;
  }, [preparedItems]);

  const [blankId, setBlankId] = useState('');
  const [productId, setProductId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /** Вес из GET plastic-profiles/:id/ (в списке поле часто не отдаётся). */
  const [detailWeightKg, setDetailWeightKg] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const blankOptions = useMemo(
    () =>
      (blanks || []).map((b) => ({
        value: String(b.id),
        label: b.name || 'Заготовка',
      })),
    [blanks],
  );

  const productOptions = useMemo(
    () =>
      (profileItems || []).map((p) => ({
        value: String(p.id),
        label: p.name || p.code || `Профиль #${p.id}`,
      })),
    [profileItems],
  );

  const selectedBlank = useMemo(
    () => (blanks || []).find((b) => String(b.id) === String(blankId)),
    [blanks, blankId],
  );

  const selectedProduct = useMemo(
    () => (profileItems || []).find((x) => String(x.id) === String(productId)),
    [profileItems, productId],
  );

  const productWeightResolved = useMemo(() => {
    const fromList = readPlasticProfileWeightKg(selectedProduct);
    if (fromList != null) return fromList;
    if (
      productId &&
      detailWeightKg != null &&
      Number.isFinite(detailWeightKg) &&
      detailWeightKg > 0
    ) {
      return detailWeightKg;
    }
    return null;
  }, [selectedProduct, productId, detailWeightKg]);

  const effectivePieceKg = productWeightResolved;

  const weightDisplaySource = useMemo(() => {
    if (!productId) return null;
    if (readPlasticProfileWeightKg(selectedProduct) != null) return 'list';
    if (detailWeightKg != null) return 'detail';
    return null;
  }, [productId, selectedProduct, detailWeightKg]);
  /** Подгрузка полной карточки товара, если в списке нет веса штуки. */
  useEffect(() => {
    if (!productId) {
      setDetailWeightKg(null);
      setDetailLoading(false);
      return;
    }
    const fromList = readPlasticProfileWeightKg(selectedProduct);
    if (fromList != null) {
      setDetailWeightKg(null);
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailWeightKg(null);
    getPlasticProfile(productId)
      .then((res) => {
        if (cancelled) return;
        const kg = readPlasticProfileWeightKg(res.data);
        setDetailWeightKg(Number.isFinite(kg) && kg > 0 ? kg : null);
      })
      .catch(() => {
        if (!cancelled) setDetailWeightKg(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, selectedProduct]);

  const selectedProductLabel = useMemo(() => {
    const p = selectedProduct;
    return p?.name || p?.code || '';
  }, [selectedProduct]);

  const recipeKg = selectedBlank ? Number(selectedBlank.recipeKgPerBarrel) || 0 : 0;

  const capHint = useMemo(() => {
    if (!selectedBlank || recipeKg <= 0) return null;
    if (recipeKg <= DEMO_PRODUCTION_VAT_MAX_KG) return null;
    return `В партии учитывается не больше ${formatNumberForInput(DEMO_PRODUCTION_VAT_MAX_KG)} кг (ёмкость). По рецепту ${formatNumberForInput(recipeKg)} кг — в машину уходит ${formatNumberForInput(DEMO_PRODUCTION_VAT_MAX_KG)} кг.`;
  }, [selectedBlank, recipeKg]);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!blankId) {
      setError('Выберите заготовку.');
      return;
    }
    if (!productId) {
      setError('Выберите товар.');
      return;
    }
    if (!Number.isFinite(effectivePieceKg) || effectivePieceKg <= 0) {
      setError('Нет веса одной штуки для выбранного товара. Укажите вес в «Заготовка» -> «Профили».');
      return;
    }
    if (recipeKg <= 0) {
      setError('У заготовки нет массы бочки (recipe_kg_per_barrel) — проверьте состав в «Заготовка».');
      return;
    }
    const usedKg = Math.min(recipeKg, DEMO_PRODUCTION_VAT_MAX_KG);
    const prep = preparedByBlankId.get(String(blankId));
    if (prep && prep.totalKg > 1e-6) {
      if (prep.totalKg + 1e-6 < usedKg) {
        setError(
          `В «Заготовка (цех)» сейчас ${formatNumberForInput(prep.totalKg)} кг, для партии нужно ${formatNumberForInput(usedKg)} кг.`,
        );
        return;
      }
    }
    setError('');
    setSubmitting(true);
    try {
      await postWorkshopBlankProductionRun(
        buildCreateBlankRunPayload({
          blankId,
          productId,
          blankTotalKg: recipeKg,
          blankUsedInProductionKg: usedKg,
          vatMaxKgDemo: DEMO_PRODUCTION_VAT_MAX_KG,
          weightKgPerPiece: effectivePieceKg,
        }),
      );
      onSaved?.();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось создать партию'));
    } finally {
      setSubmitting(false);
    }
  };

  const overlayClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={overlayClose}>
      <div
        className="produce-blank-modal__shell"
        onClick={(ev) => ev.stopPropagation()}
        role="presentation"
      >
        <div
          className="modal modal--wide produce-blank-modal"
        >
          <div className="modal__head">
            <h3>Произвести</h3>
            <button
              type="button"
              className="modal__close"
              onClick={overlayClose}
              aria-label="Закрыть"
              disabled={submitting}
            >
              ×
            </button>
          </div>
          <form className="modal__body chemistry-element-form" onSubmit={handleSubmit}>
            <label>Заготовка *</label>
            <Select
              value={blankId === '' ? '' : String(blankId)}
              onChange={(v) => {
                setBlankId(v != null ? String(v) : '');
                setError('');
              }}
              placeholder="Выберите заготовку"
              options={blankOptions}
            />
            {blankOptions.length === 0 ? (
              <p className="produce-blank-modal__warn">
                Нет заготовок — создайте во вкладке «Заготовка».
              </p>
            ) : null}
            {capHint ? <p className="produce-blank-modal__hint-cap">{capHint}</p> : null}

            <label>Товар *</label>
            <Select
              value={productId === '' ? '' : String(productId)}
              onChange={(v) => {
                const nid = v != null ? String(v) : '';
                setError('');
                if (!nid) {
                  setProductId('');
                  return;
                }
                setProductId(nid);
              }}
              placeholder="Выберите товар"
              options={productOptions}
            />
            {productOptions.length === 0 ? (
              <p className="produce-blank-modal__warn">Нет товаров в справочнике. Создайте товар в «Заготовка» -> «Профили».</p>
            ) : null}

            {productWeightResolved != null ? (
              <>
                <label>Вес одной штуки</label>
                <p className="produce-side-panel__weight-hint">
                  <strong>{formatNumberForInput(productWeightResolved)} кг</strong>
                  {weightDisplaySource ? ' — из карточки товара (ОТК и склад ГП).' : ''}
                </p>
              </>
            ) : null}
            {productId && detailLoading ? (
              <p className="produce-blank-modal__product-hint">Загрузка параметров товара…</p>
            ) : null}
            {productId && !detailLoading && productWeightResolved == null ? (
              <p className="produce-blank-modal__warn">
                Для этого товара сервер не отдал вес одной штуки — задайте его в «Профили» (редактирование
                профиля).
              </p>
            ) : null}
            {selectedProductLabel ? (
              <p className="produce-blank-modal__product-hint">Выбрано: {selectedProductLabel}</p>
            ) : null}

            {error ? <p className="modal__error">{error}</p> : null}

            <div className="modal__actions">
              <button type="button" className="btn btn--secondary" onClick={overlayClose} disabled={submitting}>
                Отмена
              </button>
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? '…' : 'Произвести'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProduceBlankModal;

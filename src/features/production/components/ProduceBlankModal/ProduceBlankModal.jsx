import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Select, DecimalInput, useToast } from '../../../../shared/ui';
import {
  formatNumberForInput,
  parseLocaleNumber,
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
import { createPlasticProfile, getPlasticProfile } from '../../api/productionApi';
import { readPlasticProfileWeightKg } from '../../lib/readPlasticProfilePieceWeight';
import './ProduceBlankModal.scss';

const clampGramsInput = (raw) => {
  const d = String(raw ?? '').replace(/\D/g, '').slice(0, 3);
  if (d === '') return '';
  return String(Math.min(999, parseInt(d, 10)));
};

const calcPieceKg = (kgStr, gramsStr) => {
  const kgNum = parseLocaleNumber(kgStr ?? '');
  const g = clampGramsInput(gramsStr);
  const gNum = g === '' ? 0 : parseInt(g, 10);
  const k = Number.isFinite(kgNum) ? kgNum : 0;
  return k + gNum / 1000;
};

const listQ = { page: 1, page_size: 500, ordering: 'name' };
const prepQ = { page: 1, page_size: 500 };

/** Код для POST plastic-profiles/ — короткий (часто лимит поля на бэке). */
const buildAutoPlasticCode = () => {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `GP${t}${r}`.slice(0, 20);
};

const ProduceBlankModal = ({ onClose, onSaved }) => {
  const toast = useToast();
  const { items: blankItems } = useServerQuery('workshop/blanks/', listQ, { enabled: true });
  const { items: profileItems, refetch: refetchProfiles } = useServerQuery('plastic-profiles/', listQ, {
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

  const [sideOpen, setSideOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductKg, setNewProductKg] = useState('');
  const [newProductGrams, setNewProductGrams] = useState('');
  const [sideError, setSideError] = useState('');
  const [sideBusy, setSideBusy] = useState(false);
  const [pieceWeightFromNewProduct, setPieceWeightFromNewProduct] = useState(null);
  /** Вес из GET plastic-profiles/:id/ (в списке поле часто не отдаётся). */
  const [detailWeightKg, setDetailWeightKg] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const resetSideForm = useCallback(() => {
    setNewProductName('');
    setNewProductKg('');
    setNewProductGrams('');
    setSideError('');
  }, []);

  const handleCloseSide = useCallback(() => {
    setSideOpen(false);
    resetSideForm();
  }, [resetSideForm]);

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
    if (
      pieceWeightFromNewProduct &&
      String(pieceWeightFromNewProduct.productId) === String(productId) &&
      Number.isFinite(pieceWeightFromNewProduct.kg) &&
      pieceWeightFromNewProduct.kg > 0
    ) {
      return pieceWeightFromNewProduct.kg;
    }
    return null;
  }, [selectedProduct, productId, pieceWeightFromNewProduct, detailWeightKg]);

  const effectivePieceKg = productWeightResolved;

  const weightDisplaySource = useMemo(() => {
    if (!productId) return null;
    if (readPlasticProfileWeightKg(selectedProduct) != null) return 'list';
    if (detailWeightKg != null) return 'detail';
    if (
      pieceWeightFromNewProduct &&
      String(pieceWeightFromNewProduct.productId) === String(productId)
    ) {
      return 'session';
    }
    return null;
  }, [productId, selectedProduct, detailWeightKg, pieceWeightFromNewProduct]);

  /** Если в списке появился вес — сбрасываем временный вес с «Нового товара». */
  useEffect(() => {
    if (!productId) {
      setPieceWeightFromNewProduct(null);
      return;
    }
    const p = (profileItems || []).find((x) => String(x.id) === String(productId));
    if (readPlasticProfileWeightKg(p) != null) {
      setPieceWeightFromNewProduct(null);
    }
  }, [productId, profileItems]);

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
    if (
      pieceWeightFromNewProduct &&
      String(pieceWeightFromNewProduct.productId) === String(productId)
    ) {
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
  }, [productId, selectedProduct, pieceWeightFromNewProduct]);

  const selectedProductLabel = useMemo(() => {
    const p = selectedProduct;
    return p?.name || p?.code || '';
  }, [selectedProduct]);

  const sidePieceKg = useMemo(() => calcPieceKg(newProductKg, newProductGrams), [newProductKg, newProductGrams]);

  const sideWeightHint =
    sidePieceKg > 0
      ? `Расчётный вес одной штуки: ${formatNumberForInput(sidePieceKg)} кг`
      : 'Укажите килограммы и граммы выше — здесь появится расчётный вес одной штуки.';

  const recipeKg = selectedBlank ? Number(selectedBlank.recipeKgPerBarrel) || 0 : 0;

  const capHint = useMemo(() => {
    if (!selectedBlank || recipeKg <= 0) return null;
    if (recipeKg <= DEMO_PRODUCTION_VAT_MAX_KG) return null;
    return `В партии учитывается не больше ${formatNumberForInput(DEMO_PRODUCTION_VAT_MAX_KG)} кг (ёмкость). По рецепту ${formatNumberForInput(recipeKg)} кг — в машину уходит ${formatNumberForInput(DEMO_PRODUCTION_VAT_MAX_KG)} кг.`;
  }, [selectedBlank, recipeKg]);

  const handleSaveNewProduct = async (e) => {
    e.preventDefault();
    const n = newProductName.trim();
    if (!n) {
      setSideError('Введите имя товара.');
      return;
    }
    if (!Number.isFinite(sidePieceKg) || sidePieceKg <= 0) {
      setSideError('Укажите вес одной штуки (кг и/или граммы).');
      return;
    }
    setSideBusy(true);
    setSideError('');
    const code = buildAutoPlasticCode();
    try {
      const payload = {
        name: n,
        code,
        is_active: true,
        comment: '',
        weight_kg_per_piece: sidePieceKg,
      };
      const res = await createPlasticProfile(payload);
      const id = res.data?.id;
      await refetchProfiles();
      if (id != null) {
        setPieceWeightFromNewProduct({ productId: String(id), kg: sidePieceKg });
        setProductId(String(id));
      }
      toast.show('Товар создан');
      handleCloseSide();
    } catch (err) {
      setSideError(getApiErrorMessage(err, 'Не удалось создать товар'));
    } finally {
      setSideBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!blankId) {
      setError('Выберите заготовку.');
      return;
    }
    if (!productId) {
      setError('Выберите товар или добавьте новый справа.');
      return;
    }
    if (!Number.isFinite(effectivePieceKg) || effectivePieceKg <= 0) {
      setError(
        'Нет веса одной штуки для выбранного товара. Укажите вес в «Профили» или создайте товар справа с весом.',
      );
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
    if (submitting || sideBusy) return;
    handleCloseSide();
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
          className={`modal modal--wide produce-blank-modal ${sideOpen ? 'produce-blank-modal--with-side' : ''}`}
        >
          <div className="modal__head">
            <h3>Произвести</h3>
            <button
              type="button"
              className="modal__close"
              onClick={overlayClose}
              aria-label="Закрыть"
              disabled={submitting || sideBusy}
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
                  setPieceWeightFromNewProduct(null);
                  return;
                }
                setPieceWeightFromNewProduct((cur) =>
                  cur && String(cur.productId) !== nid ? null : cur,
                );
                setProductId(nid);
              }}
              placeholder="Выберите товар"
              options={productOptions}
            />
            <p className="produce-blank-modal__product-hint">
              Нет в списке?{' '}
              <button
                type="button"
                className="produce-blank-modal__link"
                onClick={() => {
                  setSideOpen(true);
                  setSideError('');
                }}
              >
                Добавить товар
              </button>
              {' — форма справа.'}
            </p>
            {productOptions.length === 0 && !sideOpen ? (
              <p className="produce-blank-modal__warn">Нет товаров в справочнике — добавьте через «Добавить товар».</p>
            ) : null}

            {productWeightResolved != null ? (
              <>
                <label>Вес одной штуки</label>
                <p className="produce-side-panel__weight-hint">
                  <strong>{formatNumberForInput(productWeightResolved)} кг</strong>
                  {weightDisplaySource === 'session'
                    ? ' — из данных при создании товара (после сохранения на сервере будет в справочнике).'
                    : ' — из карточки товара (ОТК и склад ГП).'}
                </p>
              </>
            ) : null}
            {productId && detailLoading ? (
              <p className="produce-blank-modal__product-hint">Загрузка параметров товара…</p>
            ) : null}
            {productId && !detailLoading && productWeightResolved == null ? (
              <p className="produce-blank-modal__warn">
                Для этого товара сервер не отдал вес одной штуки — задайте его в «Профили» (редактирование
                профиля) или создайте товар справа с весом.
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

        {sideOpen ? (
          <aside className="produce-side-panel" aria-label="Новый товар">
            <div className="produce-side-panel__head">
              <h4 className="produce-side-panel__title">Новый товар</h4>
              <button
                type="button"
                className="modal__close produce-side-panel__close"
                onClick={handleCloseSide}
                aria-label="Закрыть панель"
                disabled={sideBusy}
              >
                ×
              </button>
            </div>
            <form className="produce-side-panel__form chemistry-element-form" onSubmit={handleSaveNewProduct}>
              <label>Имя *</label>
              <input
                value={newProductName}
                onChange={(ev) => {
                  setNewProductName(ev.target.value);
                  if (sideError) setSideError('');
                }}
                autoComplete="off"
                placeholder="Например, Батон 400 г"
              />
              <div className="produce-side-panel__kg-row">
                <div className="produce-side-panel__field">
                  <label>Кг</label>
                  <DecimalInput
                    min={0}
                    value={newProductKg}
                    onChange={(v) => {
                      setNewProductKg(v);
                      if (sideError) setSideError('');
                    }}
                    placeholder="0"
                  />
                </div>
                <div className="produce-side-panel__field">
                  <label>Граммы</label>
                  <input
                    inputMode="numeric"
                    className="produce-side-panel__grams"
                    value={newProductGrams}
                    onChange={(ev) => {
                      setNewProductGrams(clampGramsInput(ev.target.value));
                      if (sideError) setSideError('');
                    }}
                    placeholder="0–999"
                    title="Граммы, 0–999"
                  />
                </div>
              </div>
              <p className="produce-side-panel__weight-hint">{sideWeightHint}</p>
              {sideError ? <p className="modal__error">{sideError}</p> : null}
              <div className="produce-side-panel__actions">
                <button type="button" className="btn btn--secondary" onClick={handleCloseSide} disabled={sideBusy}>
                  Отмена
                </button>
                <button type="submit" className="btn btn--primary" disabled={sideBusy}>
                  {sideBusy ? '…' : 'Сохранить'}
                </button>
              </div>
            </form>
          </aside>
        ) : null}
      </div>
    </div>
  );
};

export default ProduceBlankModal;

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Select, DecimalInput } from '../../../../shared/ui';
import { formatNumberForInput, parseLocaleNumber } from '../../../../shared/lib';
import {
  sumCompositionKg,
  DEMO_PRODUCTION_VAT_MAX_KG,
} from '../../../chemistry/lib/blankRecipeShared';
import {
  loadBlanks,
  loadProducts,
  appendProduct,
  appendBlankProductionRun,
} from '../../../chemistry/lib/localBlankStore';
import './ProduceBlankModal.scss';

const newRunId = () => `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

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

const ProduceBlankModal = ({ onClose, onSaved }) => {
  const [blanks, setBlanks] = useState(() => loadBlanks());
  const [products, setProducts] = useState(() => loadProducts());
  const [blankId, setBlankId] = useState('');
  const [productId, setProductId] = useState('');
  const [error, setError] = useState('');

  const [sideOpen, setSideOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newKg, setNewKg] = useState('');
  const [newGrams, setNewGrams] = useState('');
  const [sideError, setSideError] = useState('');

  const resetSideForm = useCallback(() => {
    setNewProductName('');
    setNewKg('');
    setNewGrams('');
    setSideError('');
  }, []);

  const handleCloseSide = useCallback(() => {
    setSideOpen(false);
    resetSideForm();
  }, [resetSideForm]);

  useEffect(() => {
    const onBlanks = () => setBlanks(loadBlanks());
    const onProducts = () => setProducts(loadProducts());
    window.addEventListener('dias-blanks-changed', onBlanks);
    window.addEventListener('dias-products-changed', onProducts);
    return () => {
      window.removeEventListener('dias-blanks-changed', onBlanks);
      window.removeEventListener('dias-products-changed', onProducts);
    };
  }, []);

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
      (products || []).map((p) => ({
        value: String(p.id),
        label: p.name || 'Товар',
      })),
    [products],
  );

  const selectedBlank = useMemo(
    () => (blanks || []).find((b) => String(b.id) === String(blankId)),
    [blanks, blankId],
  );

  const selectedProduct = useMemo(
    () => (products || []).find((p) => String(p.id) === String(productId)),
    [products, productId],
  );

  const pieceKgPreview = useMemo(
    () => calcPieceKg(newKg, newGrams),
    [newKg, newGrams],
  );

  const weightHint =
    pieceKgPreview > 0
      ? `Вес одной штуки: ${formatNumberForInput(pieceKgPreview)} кг`
      : 'Укажите килограммы и граммы выше — здесь появится расчётный вес одной штуки.';

  const capHint = useMemo(() => {
    const recipe = sumCompositionKg(selectedBlank?.composition);
    if (recipe == null || !Number.isFinite(Number(recipe))) return null;
    const r = Number(recipe);
    if (r <= DEMO_PRODUCTION_VAT_MAX_KG) return null;
    return `В партии учитывается не больше ${formatNumberForInput(DEMO_PRODUCTION_VAT_MAX_KG)} кг (ёмкость). По рецепту ${formatNumberForInput(r)} кг — в машину уходит ${formatNumberForInput(DEMO_PRODUCTION_VAT_MAX_KG)} кг.`;
  }, [selectedBlank]);

  const handleSaveNewProduct = (e) => {
    e.preventDefault();
    const n = newProductName.trim();
    const pieceKg = calcPieceKg(newKg, newGrams);
    if (!n) {
      setSideError('Введите имя товара.');
      return;
    }
    if (!Number.isFinite(pieceKg) || pieceKg <= 0) {
      setSideError('Укажите вес одной штуки (кг и/или граммы).');
      return;
    }
    setSideError('');
    const id = `pr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    appendProduct({ id, name: n, weightKgPerPiece: pieceKg });
    setProducts(loadProducts());
    setProductId(String(id));
    setSideOpen(false);
    resetSideForm();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!blankId) {
      setError('Выберите заготовку.');
      return;
    }
    if (!productId) {
      setError('Выберите товар или добавьте новый справа.');
      return;
    }
    const blankTotalKg = sumCompositionKg(selectedBlank?.composition);
    if (blankTotalKg == null || !Number.isFinite(Number(blankTotalKg)) || Number(blankTotalKg) <= 0) {
      setError('У выбранной заготовки нет состава или сумма кг = 0.');
      return;
    }
    const r = Number(blankTotalKg);
    const usedKg = Math.min(r, DEMO_PRODUCTION_VAT_MAX_KG);
    setError('');
    appendBlankProductionRun({
      id: newRunId(),
      createdAt: new Date().toISOString(),
      sourceType: 'blank',
      blankId: String(blankId),
      blankName: selectedBlank?.name || '—',
      productId: String(productId),
      productName: selectedProduct?.name || '—',
      blankTotalKg: r,
      blankUsedInProductionKg: usedKg,
      vatMaxKgDemo: DEMO_PRODUCTION_VAT_MAX_KG,
      weightKgPerPiece:
        selectedProduct?.weightKgPerPiece != null && Number.isFinite(Number(selectedProduct.weightKgPerPiece))
          ? Number(selectedProduct.weightKgPerPiece)
          : null,
      defectKg: null,
      goodKg: null,
      goodPieces: null,
    });
    onSaved?.();
    onClose();
  };

  const overlayClose = () => {
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
            <button type="button" className="modal__close" onClick={overlayClose} aria-label="Закрыть">
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
                Нет заготовок. Создайте рецепт в разделе «Заготовка».
              </p>
            ) : null}
            {capHint ? <p className="produce-blank-modal__hint-cap">{capHint}</p> : null}

            <label>Товар *</label>
            <Select
              value={productId === '' ? '' : String(productId)}
              onChange={(v) => setProductId(v != null ? String(v) : '')}
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

            {error ? <p className="modal__error">{error}</p> : null}

            <div className="modal__actions">
              <button type="button" className="btn btn--secondary" onClick={overlayClose}>
                Отмена
              </button>
              <button type="submit" className="btn btn--primary">
                Произвести
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
                    value={newKg}
                    onChange={(v) => {
                      setNewKg(v);
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
                    value={newGrams}
                    onChange={(ev) => {
                      setNewGrams(clampGramsInput(ev.target.value));
                      if (sideError) setSideError('');
                    }}
                    placeholder="0–999"
                    title="Граммы, 0–999"
                  />
                </div>
              </div>
              <p className="produce-side-panel__weight-hint">{weightHint}</p>

              {sideError ? <p className="modal__error">{sideError}</p> : null}

              <div className="produce-side-panel__actions">
                <button type="button" className="btn btn--secondary" onClick={handleCloseSide}>
                  Отмена
                </button>
                <button type="submit" className="btn btn--primary">
                  Сохранить
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

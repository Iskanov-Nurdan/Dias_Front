import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useServerQuery,
  formatQuantityDisplay,
  formatNumberForInput,
  parseLocaleNumber,
  getApiErrorMessage,
} from '../../../../shared/lib';
import { Loading, EmptyState, ErrorState, useToast, DecimalInput, Select, ConfirmModal, ActionMenu } from '../../../../shared/ui';
import {
  getChemistryBalances,
  produceChemistry,
  createChemicalElement,
  updateChemicalElement,
  deleteChemicalElement,
  getChemicalElement,
} from '../../api/chemistryApi';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import './ChemistryPage.scss';

const UNITS = [
  { value: 'kg', label: 'кг' },
  { value: 'g', label: 'г' },
];

const MAIN_TAB = { CATALOG: 'catalog', STOCK: 'stock', BATCHES: 'batches' };

const apiError = (err) => getApiErrorMessage(err, 'Ошибка');

const newLineKey = () => `ln-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const normalizeUnit = (u) => {
  const s = String(u || 'kg').toLowerCase();
  if (s === 'кг') return 'kg';
  if (s === 'г') return 'g';
  return s === 'g' || s === 'kg' ? s : 'kg';
};

const mapDetailToRecipeRows = (detail) => {
  const raw = detail?.recipe_lines;
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ key: newLineKey(), raw_material_id: '', quantity_per_unit: '' }];
  }
  return raw.map((r) => {
    const matId =
      r.raw_material != null && typeof r.raw_material === 'object'
        ? r.raw_material.id
        : (r.raw_material ?? r.material_id ?? '');
    return {
      key: r.id != null ? `ex-${r.id}` : newLineKey(),
      raw_material_id: matId === '' ? '' : String(matId),
      quantity_per_unit:
        r.quantity_per_unit != null && r.quantity_per_unit !== ''
          ? formatNumberForInput(r.quantity_per_unit)
          : '',
    };
  });
};

const buildRecipeLinesPayload = (rows) => {
  const out = [];
  for (const row of rows) {
    const mid = row.raw_material_id === '' || row.raw_material_id == null
      ? NaN
      : Number(row.raw_material_id);
    const q = parseLocaleNumber(row.quantity_per_unit ?? '');
    if (!Number.isFinite(mid) || mid <= 0) continue;
    if (!Number.isFinite(q) || q <= 0) continue;
    out.push({
      raw_material_id: mid,
      quantity_per_unit: q,
    });
  }
  return out;
};

const getComment = (c) => c?.comment ?? c?.note ?? '';

const minBal = (b) => b?.min_balance ?? b?.min_stock;

const balanceQty = (b) => b.balance ?? b.quantity ?? b.quantity_remaining;

const balanceChemId = (b) => b.chemistry_id ?? b.catalog_id ?? b.id;

const balanceName = (b) => b.name ?? b.chemistry_name ?? b.element_name ?? '—';

const isLowStockChem = (b) => {
  const min = minBal(b);
  if (min === null || min === undefined || min === '') return false;
  const minN = Number(min);
  if (Number.isNaN(minN)) return false;
  return Number(balanceQty(b)) <= minN;
};

const getStockLevelKey = (b) => {
  const bal = Number(balanceQty(b));
  if (!Number.isFinite(bal) || bal <= 0) return 'empty';
  if (isLowStockChem(b)) return 'low';
  return 'ok';
};

const STOCK_LEVEL_LABEL = {
  ok: 'норма',
  low: 'мало',
  empty: 'нет в наличии',
};

const formatReleaseCell = (qty, unit) => {
  if (qty == null) return '—';
  const q = formatQuantityDisplay(qty);
  const ul = String(unit || '').trim().toLowerCase();
  if (!ul || ul === 'количество' || ul === 'amount' || ul === 'ед.' || ul === 'ед') return q;
  if (ul === 'штуки' || ul === 'шт') return `${q} шт`;
  return `${q} ${String(unit).trim()}`;
};

const hasProductionHistory = (row) =>
  row?.has_batches === true
  || Number(row?.batches_count) > 0;

const canDeleteChemistry = (row) => row?.deletable === true;

const AddChemistryModal = ({ onClose, onSaved, error: parentError }) => {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kg');
  const [minBalance, setMinBalance] = useState('');
  const [comment, setComment] = useState('');
  const [statusActive, setStatusActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      setLocalError('Укажите название');
      return;
    }
    const minVal = minBalance.trim() === '' ? null : parseLocaleNumber(minBalance);
    if (minVal != null && (!Number.isFinite(minVal) || minVal < 0)) {
      setLocalError('Мин. остаток: неотрицательное число или пусто');
      return;
    }
    setSaving(true);
    setLocalError('');
    try {
      await createChemicalElement({
        name: n,
        unit: unit || 'kg',
        is_active: statusActive,
        recipe_lines: [],
        ...(minVal != null && Number.isFinite(minVal) ? { min_balance: minVal } : { min_balance: null }),
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
      onSaved?.();
    } catch (err) {
      setLocalError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal modal--wide" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Добавить химию</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form className="modal__body chemistry-element-form" onSubmit={handleSubmit}>
          <label>Название *</label>
          <input value={name} onChange={(ev) => setName(ev.target.value)} required autoComplete="off" />
          <label>Единица *</label>
          <Select value={unit} onChange={setUnit} options={UNITS} />
          <label>Минимальный остаток</label>
          <DecimalInput min={0} value={minBalance} onChange={setMinBalance} placeholder="Порог «мало»" />
          <label>Комментарий</label>
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Опционально" />
          <label>Статус *</label>
          <Select
            value={statusActive ? 'active' : 'inactive'}
            onChange={(v) => setStatusActive(v === 'active')}
            options={[
              { value: 'active', label: 'активен' },
              { value: 'inactive', label: 'неактивен' },
            ]}
          />
          {(localError || parentError) && <p className="modal__error">{localError || parentError}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditChemistryModal = ({
  initial,
  unitLocked,
  onClose,
  onSaved,
  error: parentError,
}) => {
  const [name, setName] = useState(initial?.name || '');
  const [unit, setUnit] = useState(() => normalizeUnit(initial?.unit));
  const [minBalance, setMinBalance] = useState(
    initial?.min_balance != null && initial?.min_balance !== ''
      ? formatNumberForInput(initial.min_balance)
      : '',
  );
  const [comment, setComment] = useState(getComment(initial));
  const [statusActive, setStatusActive] = useState(initial?.is_active !== false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setName(initial?.name || '');
    setUnit(normalizeUnit(initial?.unit));
    setMinBalance(
      initial?.min_balance != null && initial?.min_balance !== ''
        ? formatNumberForInput(initial.min_balance)
        : '',
    );
    setComment(getComment(initial));
    setStatusActive(initial?.is_active !== false);
  }, [initial]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || !initial?.id) return;
    const minVal = minBalance.trim() === '' ? null : parseLocaleNumber(minBalance);
    if (minVal != null && (!Number.isFinite(minVal) || minVal < 0)) {
      setLocalError('Мин. остаток: неотрицательное число или пусто');
      return;
    }
    setSaving(true);
    setLocalError('');
    try {
      const payload = {
        name: n,
        is_active: statusActive,
        ...(minVal != null && Number.isFinite(minVal) ? { min_balance: minVal } : { min_balance: null }),
        ...(comment.trim() ? { comment: comment.trim() } : { comment: '' }),
      };
      if (!unitLocked) payload.unit = unit || 'kg';
      await updateChemicalElement(initial.id, payload);
      onSaved?.();
    } catch (err) {
      setLocalError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal modal--wide" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Редактировать</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form className="modal__body chemistry-element-form" onSubmit={handleSubmit}>
          <label>Название *</label>
          <input value={name} onChange={(ev) => setName(ev.target.value)} required />
          <label>Единица *</label>
          <Select value={unit} onChange={setUnit} options={UNITS} disabled={unitLocked} />
          <label>Минимальный остаток</label>
          <DecimalInput min={0} value={minBalance} onChange={setMinBalance} />
          <label>Комментарий</label>
          <input value={comment} onChange={(e) => setComment(e.target.value)} />
          <label>Статус *</label>
          <Select
            value={statusActive ? 'active' : 'inactive'}
            onChange={(v) => setStatusActive(v === 'active')}
            options={[
              { value: 'active', label: 'активен' },
              { value: 'inactive', label: 'неактивен' },
            ]}
          />
          {(localError || parentError) && <p className="modal__error">{localError || parentError}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CompositionModal = ({
  chemistryId,
  chemistryName,
  detail,
  detailLoading,
  rawMaterials,
  onClose,
  onSaved,
  error: parentError,
}) => {
  const [recipeRows, setRecipeRows] = useState(() => [
    { key: newLineKey(), raw_material_id: '', quantity_per_unit: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!detail) return;
    setRecipeRows(mapDetailToRecipeRows(detail));
  }, [detail]);

  const materialOptions = useMemo(
    () =>
      (rawMaterials || []).map((m) => ({
        value: String(m.id),
        label: m.name || `#${m.id}`,
      })),
    [rawMaterials],
  );

  const addRow = () => {
    setRecipeRows((prev) => [...prev, { key: newLineKey(), raw_material_id: '', quantity_per_unit: '' }]);
  };

  const removeRow = (key) => {
    setRecipeRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  };

  const setRow = (key, field, value) => {
    setRecipeRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const recipe_lines = buildRecipeLinesPayload(recipeRows);
    if (recipe_lines.length === 0) {
      setLocalError('Добавьте хотя бы одно сырьё и расход (кг сырья на 1 кг химии).');
      return;
    }
    const mids = recipe_lines.map((r) => r.raw_material_id);
    if (new Set(mids).size !== mids.length) {
      setLocalError('Одно сырьё указано дважды — оставьте одну строку.');
      return;
    }
    setSaving(true);
    setLocalError('');
    try {
      await updateChemicalElement(chemistryId, { recipe_lines });
      onSaved?.();
    } catch (err) {
      setLocalError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal modal--wide" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Состав химии: {chemistryName || '—'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form className="modal__body chemistry-element-form" onSubmit={handleSubmit}>
          {detailLoading ? (
            <Loading />
          ) : (
            <>
              <div className="chemistry-recipe-grid chemistry-recipe-grid--head">
                <span>Сырьё *</span>
                <span>Кг сырья на 1 кг химии *</span>
                <span />
              </div>
              {recipeRows.map((row) => (
                <div key={row.key} className="chemistry-recipe-grid chemistry-recipe-grid--row">
                  <Select
                    value={row.raw_material_id === '' ? '' : String(row.raw_material_id)}
                    onChange={(v) => setRow(row.key, 'raw_material_id', v)}
                    placeholder="Выберите сырьё"
                    options={materialOptions}
                  />
                  <DecimalInput
                    min={0}
                    value={row.quantity_per_unit}
                    onChange={(v) => setRow(row.key, 'quantity_per_unit', v)}
                    placeholder="0"
                  />
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => removeRow(row.key)}
                    disabled={recipeRows.length <= 1}
                    aria-label="Удалить строку"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn--secondary btn--sm chemistry-element-form__add-line" onClick={addRow}>
                + Строка
              </button>
            </>
          )}
          {(localError || parentError) && <p className="modal__error">{localError || parentError}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={saving || detailLoading}>
              {saving ? 'Сохранение…' : 'Сохранить состав'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ProduceChemistryModal = ({ initialChemistryId, onClose, onSuccess }) => {
  const [catalog, setCatalog] = useState([]);
  const [chemistryId, setChemistryId] = useState(
    initialChemistryId != null ? String(initialChemistryId) : '',
  );
  const [qty, setQty] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    apiClient.get('chemistry/elements/', { params: { page_size: 500 } })
      .then((r) => setCatalog(r.data?.items || []))
      .catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    if (initialChemistryId != null) setChemistryId(String(initialChemistryId));
  }, [initialChemistryId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const q = parseLocaleNumber(qty);
    const id = chemistryId ? Number(chemistryId) : NaN;
    if (!Number.isFinite(id) || id <= 0 || !(q > 0)) return;
    setSaving(true);
    setErr('');
    try {
      await produceChemistry({
        chemistry_id: id,
        quantity: q,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
      onSuccess?.();
      onClose();
    } catch (ex) {
      setErr(apiError(ex));
    } finally {
      setSaving(false);
    }
  };

  const activeOptions = useMemo(
    () =>
      catalog
        .filter((c) => c.is_active !== false)
        .map((c) => ({
          value: String(c.id),
          label: c.name || `#${c.id}`,
        })),
    [catalog],
  );

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal modal--wide" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Выпуск</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit}>
          <label>Химия *</label>
          <Select
            value={chemistryId === '' ? '' : String(chemistryId)}
            onChange={setChemistryId}
            placeholder="Выберите позицию"
            options={activeOptions}
          />
          <label>Количество (в единицах карточки: кг / г) *</label>
          <DecimalInput min={0} value={qty} onChange={setQty} required placeholder="Сколько выпустить" />
          <label>Комментарий</label>
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Опционально" />
          {err && <p className="modal__error">{err}</p>}
          <div className="modal__actions">
            <button type="submit" className="btn btn--primary" disabled={saving || !chemistryId}>
              {saving ? 'Выполняется…' : 'Выпустить'}
            </button>
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ChemistryPage = () => {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const mainTab = tabParam === MAIN_TAB.STOCK || tabParam === MAIN_TAB.BATCHES ? tabParam : MAIN_TAB.CATALOG;

  const setMainTab = useCallback(
    (next) => {
      if (next === MAIN_TAB.CATALOG) setSearchParams({}, { replace: true });
      else setSearchParams({ tab: next }, { replace: true });
    },
    [setSearchParams],
  );

  const query = useMemo(() => ({ page: 1, page_size: 500, ordering: 'name' }), []);
  const { items, loading, error, refetch } = useServerQuery('chemistry/elements/', query, { enabled: true });

  const [rawMaterials, setRawMaterials] = useState([]);
  const [balances, setBalances] = useState([]);
  const [balLoading, setBalLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [compositionTarget, setCompositionTarget] = useState(null);
  const [produceOpen, setProduceOpen] = useState(false);
  const [producePrefillId, setProducePrefillId] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const batchQuery = useMemo(() => ({ page: 1, page_size: 500, ordering: '-created_at' }), []);
  const {
    items: batchItems,
    loading: batchesLoading,
    error: batchesError,
    refetch: refetchBatches,
  } = useServerQuery('chemistry/batches/', batchQuery, { enabled: mainTab === MAIN_TAB.BATCHES });

  useEffect(() => {
    apiClient.get('raw-materials/', { params: { page_size: 500 } })
      .then((r) => setRawMaterials(r.data?.items || []))
      .catch(() => setRawMaterials([]));
  }, []);

  const loadBalances = useCallback(() => {
    setBalLoading(true);
    getChemistryBalances()
      .then((r) => {
        const raw = r.data?.items ?? r.data;
        setBalances(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setBalances([]))
      .finally(() => setBalLoading(false));
  }, []);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  const refetchAll = useCallback(() => {
    refetch();
    loadBalances();
    refetchBatches();
  }, [refetch, loadBalances, refetchBatches]);

  useOperationalRefetch(
    ['chemistry', 'chemistry_element', 'chemistry_balance', 'chemistry_batch', 'material_balance'],
    refetchAll,
    true,
  );

  const balanceByChemId = useMemo(() => {
    const m = new Map();
    balances.forEach((b) => {
      const id = balanceChemId(b);
      if (id != null) m.set(Number(id), b);
    });
    return m;
  }, [balances]);

  const catalogRows = useMemo(() => {
    const list = items || [];
    return list.map((el) => {
      const b = balanceByChemId.get(Number(el.id));
      const q = b != null ? balanceQty(b) : (el.balance ?? 0);
      const min = b != null ? minBal(b) : el.min_balance;
      return {
        ...el,
        _balance: q,
        _min: min,
      };
    });
  }, [items, balanceByChemId]);

  useEffect(() => {
    if (!compositionTarget?.id) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    getChemicalElement(compositionTarget.id)
      .then((res) => {
        if (!cancelled) setDetail(res.data);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [compositionTarget?.id]);

  const handleDeactivate = async () => {
    if (!deactivateTarget?.id) return;
    setSubmitError('');
    try {
      await updateChemicalElement(deactivateTarget.id, { is_active: false });
      setDeactivateTarget(null);
      refetchAll();
      toast.show('Деактивировано');
    } catch (err) {
      setSubmitError(apiError(err));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    try {
      await deleteChemicalElement(deleteTarget.id);
      setDeleteTarget(null);
      refetchAll();
      toast.show('Удалено');
    } catch (err) {
      setDeleteError(apiError(err));
    }
  };

  const openProduce = (id) => {
    setProducePrefillId(id != null ? id : null);
    setProduceOpen(true);
  };

  return (
    <div className="page page--chemistry">
      <div className="chemistry-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === MAIN_TAB.CATALOG}
          className={`chemistry-tabs__tab${mainTab === MAIN_TAB.CATALOG ? ' chemistry-tabs__tab--active' : ''}`}
          onClick={() => setMainTab(MAIN_TAB.CATALOG)}
        >
          Справочник
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === MAIN_TAB.STOCK}
          className={`chemistry-tabs__tab${mainTab === MAIN_TAB.STOCK ? ' chemistry-tabs__tab--active' : ''}`}
          onClick={() => setMainTab(MAIN_TAB.STOCK)}
        >
          Остатки
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === MAIN_TAB.BATCHES}
          className={`chemistry-tabs__tab${mainTab === MAIN_TAB.BATCHES ? ' chemistry-tabs__tab--active' : ''}`}
          onClick={() => setMainTab(MAIN_TAB.BATCHES)}
        >
          Партии
        </button>
      </div>

      {mainTab === MAIN_TAB.CATALOG && (
        <div className="chemistry-card">
          <div className="chemistry-card__head ds-toolbar ds-toolbar--in-card">
            <div className="ds-toolbar__end chemistry-card__toolbar-actions">
              <button type="button" className="btn btn--primary" onClick={() => { setSubmitError(''); setAddOpen(true); }}>
                Добавить химию
              </button>
            </div>
          </div>

          {loading && <Loading />}
          {error && <ErrorState error={error} onRetry={refetch} />}
          {!loading && !error && catalogRows.length === 0 ? (
            <EmptyState title="Нет позиций" />
          ) : !loading && !error ? (
            <div className="chemistry-table-wrap">
              <div className="chemistry-table chemistry-table--catalog-full">
                <div className="chemistry-table__header">
                  <span className="chemistry-table__th">Название</span>
                  <span className="chemistry-table__th chemistry-table__th--num">Остаток</span>
                  <span className="chemistry-table__th chemistry-table__th--num">Минимальный остаток</span>
                  <span className="chemistry-table__th">Статус</span>
                  <span className="chemistry-table__th chemistry-table__th--actions">Действия</span>
                </div>
                {catalogRows.map((row) => {
                  const u = row.unit || 'kg';
                  const active = row.is_active !== false;
                  return (
                    <div key={row.id} className="chemistry-table__row">
                      <span className="chemistry-table__name chemistry-table__cell-clip">{row.name || '—'}</span>
                      <span className="chemistry-table__cell-num">
                        {formatQuantityDisplay(row._balance)} {u}
                      </span>
                      <span className="chemistry-table__cell-num">
                        {row._min != null && row._min !== '' ? formatQuantityDisplay(row._min) : '—'}
                      </span>
                      <span>{active ? 'активен' : 'неактивен'}</span>
                      <div className="chemistry-table__actions chemistry-table__actions--wrap">
                        <button type="button" className="btn btn--primary btn--sm" onClick={() => openProduce(row.id)}>
                          Выпуск
                        </button>
                        <ActionMenu
                          items={[
                            { label: 'Редактировать', onClick: () => { setSubmitError(''); setEditTarget(row); } },
                            { label: 'Состав', onClick: () => { setSubmitError(''); setCompositionTarget(row); } },
                            ...(active
                              ? [{ label: 'Деактивировать', onClick: () => setDeactivateTarget(row) }]
                              : []),
                            ...(canDeleteChemistry(row)
                              ? [{ label: 'Удалить', danger: true, onClick: () => setDeleteTarget({ id: row.id, name: row.name }) }]
                              : []),
                          ]}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {mainTab === MAIN_TAB.STOCK && (
        <div className="chemistry-card chemistry-card--stock">
          {balLoading && <Loading />}
          {!balLoading && balances.length === 0 ? (
            <EmptyState title="Нет остатков" />
          ) : !balLoading ? (
            <div className="chemistry-table-wrap">
              <div className="chemistry-table chemistry-table--stock-full">
                <div className="chemistry-table__header">
                  <span className="chemistry-table__th">Химия</span>
                  <span className="chemistry-table__th chemistry-table__th--num">Общий остаток</span>
                  <span className="chemistry-table__th">Единица</span>
                  <span className="chemistry-table__th">Статус</span>
                </div>
                {balances.map((b, idx) => {
                  const sk = getStockLevelKey(b);
                  return (
                    <div
                      key={balanceChemId(b) != null ? String(balanceChemId(b)) : `b-${idx}`}
                      className={`chemistry-table__row ${sk === 'low' || sk === 'empty' ? 'chemistry-table__row--warn' : ''}`}
                    >
                      <span className="chemistry-table__name chemistry-table__cell-clip">{balanceName(b)}</span>
                      <span className="chemistry-table__cell-num">{formatQuantityDisplay(balanceQty(b))}</span>
                      <span>{b.unit || 'kg'}</span>
                      <span className={`chemistry-stock-status chemistry-stock-status--${sk}`}>{STOCK_LEVEL_LABEL[sk]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {mainTab === MAIN_TAB.BATCHES && (
        <div className="chemistry-card chemistry-card--stock">
          {batchesLoading && <Loading />}
          {batchesError && <ErrorState error={batchesError} onRetry={refetchBatches} />}
          {!batchesLoading && !batchesError && (!batchItems || batchItems.length === 0) ? (
            <EmptyState title="Нет партий" />
          ) : !batchesLoading && !batchesError ? (
            <div className="chemistry-table-wrap">
              <div className="chemistry-table chemistry-table--batches-full">
                <div className="chemistry-table__header">
                  <span className="chemistry-table__th">Дата</span>
                  <span className="chemistry-table__th">Химия</span>
                  <span className="chemistry-table__th chemistry-table__th--num">Произведено</span>
                  <span className="chemistry-table__th chemistry-table__th--num">Осталось</span>
                  <span className="chemistry-table__th chemistry-table__th--num">Себестоимость за кг</span>
                  <span className="chemistry-table__th chemistry-table__th--num">Общая себестоимость</span>
                  <span className="chemistry-table__th">Комментарий</span>
                </div>
                {batchItems.map((row, i) => {
                  const cn =
                    row.chemistry?.name
                    ?? row.chemistry_name
                    ?? row.name
                    ?? (row.chemistry_id != null ? `#${row.chemistry_id}` : '—');
                  const dt = row.created_at || row.produced_at || '—';
                  const ds = typeof dt === 'string' ? dt.slice(0, 16).replace('T', ' ') : dt;
                  const cpu = row.cost_per_unit ?? row.unit_cost;
                  const ctot = row.cost_total ?? row.total_cost;
                  return (
                    <div key={row.id ?? i} className="chemistry-table__row">
                      <span className="chemistry-table__cell-clip">{ds}</span>
                      <span className="chemistry-table__name chemistry-table__cell-clip">{cn}</span>
                      <span className="chemistry-table__cell-num">{formatReleaseCell(row.quantity_produced, row.unit)}</span>
                      <span className="chemistry-table__cell-num">{formatQuantityDisplay(row.quantity_remaining)}</span>
                      <span className="chemistry-table__cell-num">
                        {cpu != null && cpu !== '' ? `${formatQuantityDisplay(cpu)} сом` : '—'}
                      </span>
                      <span className="chemistry-table__cell-num">
                        {ctot != null && ctot !== '' ? `${formatQuantityDisplay(ctot)} сом` : '—'}
                      </span>
                      <span className="chemistry-table__cell-clip">{row.comment ?? '—'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {addOpen && (
        <AddChemistryModal
          error={submitError}
          onClose={() => { setAddOpen(false); setSubmitError(''); }}
          onSaved={() => {
            setAddOpen(false);
            setSubmitError('');
            refetchAll();
            toast.show('Химия создана');
          }}
        />
      )}

      {editTarget && (
        <EditChemistryModal
          initial={editTarget}
          unitLocked={hasProductionHistory(editTarget)}
          error={submitError}
          onClose={() => { setEditTarget(null); setSubmitError(''); }}
          onSaved={() => {
            setEditTarget(null);
            setSubmitError('');
            refetchAll();
            toast.show('Сохранено');
          }}
        />
      )}

      {compositionTarget && (
        <CompositionModal
          chemistryId={compositionTarget.id}
          chemistryName={compositionTarget.name}
          detail={detail}
          detailLoading={detailLoading}
          rawMaterials={rawMaterials}
          error={submitError}
          onClose={() => { setCompositionTarget(null); setSubmitError(''); setDetail(null); }}
          onSaved={() => {
            setCompositionTarget(null);
            setSubmitError('');
            setDetail(null);
            refetchAll();
            toast.show('Состав сохранён');
          }}
        />
      )}

      {produceOpen && (
        <ProduceChemistryModal
          initialChemistryId={producePrefillId}
          onClose={() => { setProduceOpen(false); setProducePrefillId(null); }}
          onSuccess={() => {
            refetchAll();
            toast.show('Выпуск полуфабриката учтён');
          }}
        />
      )}

      <ConfirmModal
        open={!!deactivateTarget}
        title="Деактивировать?"
        message={deactivateTarget ? `«${deactivateTarget.name || ''}» — снять с выпуска?` : ''}
        confirmText="Деактивировать"
        onConfirm={handleDeactivate}
        onCancel={() => { setDeactivateTarget(null); setSubmitError(''); }}
        error={submitError}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить?"
        message={deleteTarget ? `Удалить «${deleteTarget.name || ''}»? Только если нет партий и нет ссылок из рецептов.` : ''}
        confirmText="Удалить"
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        error={deleteError}
      />
    </div>
  );
};

export default ChemistryPage;

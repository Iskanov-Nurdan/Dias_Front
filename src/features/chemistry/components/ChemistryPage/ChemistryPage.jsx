import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  useServerQuery,
  formatNumberForInput,
  formatQuantityDisplay,
  parseLocaleNumber,
  getApiErrorMessage,
  recipeNormativeOutputQuantity,
  recipeNormativeOutputUnitLabel,
  normativeOtkQuantityFromRun,
} from '../../../../shared/lib';
import { useDiscardOnClose } from '../../../../shared/hooks';
import { Loading, EmptyState, ErrorState, useToast, DecimalInput, Select, ConfirmModal } from '../../../../shared/ui';
import {
  createRecipeRun,
  getRecipeRun,
  appendRecipeRunBatchesBulk,
  removeRecipeRunBatchAtIndex,
} from '../../api/chemistryApi';
import { fetchLinesWithShiftSnapshot } from '../../../lines/api/linesApi';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { recipeRunListStatusRu } from '../../../../shared/lib/erpLabels';
import { apiClient } from '../../../../shared/api';
import { fetchBatchesByIds } from '../../../otk/api';
import './ChemistryPage.scss';

const formatDate = (d) => (d ? (typeof d === 'string' ? d.slice(0, 10) : d) : '—');

/** Колонка «Выпуск»: без дубля «количество» под заголовком. */
const formatReleaseCell = (qty, unit) => {
  if (qty == null) return '—';
  const q = formatQuantityDisplay(qty);
  const ul = String(unit || '').trim().toLowerCase();
  if (!ul || ul === 'количество' || ul === 'amount' || ul === 'ед.' || ul === 'ед') return q;
  if (ul === 'штуки' || ul === 'шт') return `${q} шт`;
  return `${q} ${String(unit).trim()}`;
};

/** Смена открыта и не на паузе — такие линии показываем в «Новый замес». */
const isLineEligibleForRecipeRun = (ln) => {
  if (!ln || typeof ln !== 'object') return false;
  const open = ln.shift_is_open === true || ln.isOpen === true;
  if (!open) return false;
  if (ln.shift_is_paused === true || ln.isPaused === true) return false;
  const snap = ln.shift_snapshot || ln.shiftSnapshot;
  if (snap && (snap.is_paused === true || snap.paused === true)) return false;
  return true;
};

/** Связанная партия ОТК ещё в ожидании — можно PATCH замеса. */
const isRecipeRunOtkPending = (run) => {
  const pb = run?.production_batch;
  if (pb == null || pb === false) return true;
  if (typeof pb !== 'object') return true;
  const st = String(pb.otk_status ?? '').toLowerCase();
  return !st || st === 'pending' || st === 'awaiting' || st === 'waiting';
};

/** Подпись рецепта для запуска: вложенный объект, снимки на запуске, плоские поля API. */
const getRecipeRunRecipeLabel = (run) => {
  const recipe = run?.recipe || {};
  const v =
    recipe.recipe ||
    recipe.recipe_name ||
    recipe.product ||
    recipe.name ||
    run?.recipe_name_snapshot ||
    run?.recipe_name;
  return v != null && String(v).trim() !== '' ? String(v) : '—';
};

/** Подпись линии: вложенный объект, снимки, плоские поля API. */
const getRecipeRunLineLabel = (run) => {
  const line = run?.line || {};
  const v = line.name || run?.line_name_snapshot || run?.line_name;
  return v != null && String(v).trim() !== '' ? String(v) : '—';
};

const mapRecipeRunListItem = (r) => {
  const pb = r?.production_batch ?? r?.production_batch_id;
  const productionBatchId = r?.production_batch_id ?? (typeof pb === 'object' && pb != null ? pb.id : pb);
  const releaseQty = normativeOtkQuantityFromRun(r);
  const releaseUnit = recipeNormativeOutputUnitLabel(r.recipe || {});
  return {
    id: r.id,
    recipeName: getRecipeRunRecipeLabel(r),
    lineName: getRecipeRunLineLabel(r),
    batchesCount: r.batches_count ?? (Array.isArray(r.batches) ? r.batches.length : 0),
    createdAt: r.created_at,
    summary: r.summary || '',
    releaseQty,
    releaseUnit,
    productionBatchId: productionBatchId != null && productionBatchId !== '' ? productionBatchId : null,
    statusRu: recipeRunListStatusRu(r),
  };
};

/** Имя позиции состава: вложенные поля API или справочники (как на странице рецептов). */
const resolveComponentName = (c, rawMaterials, chemistryElements) => {
  const embedded =
    c.name ||
    c.material_name ||
    c.material_name_snapshot ||
    c.element_name ||
    c.element_name_snapshot ||
    c.chemistry_name ||
    c.chemistry_name_snapshot ||
    c.raw_material_name ||
    c.component_name ||
    c.display_name;
  if (embedded) return embedded;
  const matId = c.material_id ?? c.raw_material_id;
  if (matId != null && matId !== '') {
    const m = rawMaterials.find((i) => String(i.id) === String(matId));
    return m?.name || '—';
  }
  const eId = c.chemistry_id ?? c.element_id;
  if (eId != null && eId !== '') {
    const e = chemistryElements.find((i) => String(i.id) === String(eId));
    return e?.name || '—';
  }
  return '—';
};

const formatRecipeCompositionHint = (components, rawMaterials, chemistryElements) => {
  if (!Array.isArray(components) || !components.length) return '';
  return components
    .map((c) => {
      const n = resolveComponentName(c, rawMaterials, chemistryElements);
      const q = c.quantity != null ? c.quantity : '';
      const u = c.unit || '';
      return q !== '' ? `${n}: ${q} ${u}`.trim() : n;
    })
    .join('; ');
};

const apiError = (err) => {
  const data = err?.response?.data;
  if (!data || typeof data !== 'object') return err?.message || 'Ошибка';
  if (data.code === 'INSUFFICIENT_STOCK') {
    const base =
      typeof data.error === 'string'
        ? data.error
        : getApiErrorMessage(err, 'Недостаточно остатков сырья.');
    const missing = data.missing;
    if (Array.isArray(missing) && missing.length) {
      const rows = missing.map((m) =>
        typeof m === 'object'
          ? `${m.component || m.raw_material || m.name || '—'}: требуется ${m.required ?? '?'} ${m.unit || ''}, доступно ${m.available ?? 0}`
          : String(m)
      );
      return `${base} ${rows.join('; ')}`;
    }
    return base;
  }
  return getApiErrorMessage(err, 'Ошибка');
};

/** Строки рецепта → единый шаблон для ввода «сколько ушло в партию» (сырьё / химия). */
const normalizeRecipeLines = (recipeData, rawMaterials = [], chemistryElements = []) => {
  const comp = recipeData?.components || recipeData?.composition || [];
  if (!Array.isArray(comp)) return [];
  return comp
    .map((c, idx) => {
      const mat = c.material_id ?? c.raw_material_id;
      const chem = c.chemistry_id ?? c.element_id;
      const type = c.type === 'chemistry' || (chem != null && mat == null) ? 'chemistry' : 'raw';
      const id = type === 'raw' ? mat : chem;
      return {
        key: `r${idx}-${type}-${id ?? 'u'}`,
        type,
        material_id: type === 'raw' && id != null ? Number(id) : undefined,
        chemistry_id: type === 'chemistry' && id != null ? Number(id) : undefined,
        name: resolveComponentName(c, rawMaterials, chemistryElements),
        unit: c.unit || 'кг',
        recipeQty:
          c.quantity != null && c.quantity !== '' ? parseLocaleNumber(c.quantity) : null,
      };
    })
    .filter((row) => row.material_id != null || row.chemistry_id != null);
};

const emptyQtyState = (lines) => {
  const o = {};
  lines.forEach((l) => { o[l.key] = ''; });
  return o;
};

const fillQtyByRecipeFraction = (lines, fraction) => {
  const o = emptyQtyState(lines);
  lines.forEach((ln) => {
    if (ln.recipeQty != null && Number.isFinite(ln.recipeQty)) {
      const v = Math.round(ln.recipeQty * fraction * 10000) / 10000;
      o[ln.key] = v > 0 ? formatNumberForInput(v) : '';
    }
  });
  return o;
};

const buildComponentsPayload = (lines, qtyByKey) => {
  const out = [];
  lines.forEach((ln) => {
    const q = parseLocaleNumber(qtyByKey[ln.key] ?? '');
    if (!Number.isFinite(q) || q <= 0) return;
    const o = {
      quantity: q,
      unit: ln.unit || 'кг',
      material_name: ln.name,
    };
    if (ln.type === 'raw') o.material_id = ln.material_id;
    else o.chemistry_id = ln.chemistry_id;
    out.push(o);
  });
  return out;
};

const lineMatchKey = (ln) => {
  if (ln.material_id != null) return `m:${ln.material_id}`;
  if (ln.chemistry_id != null) return `c:${ln.chemistry_id}`;
  return ln.key;
};

const componentMatchKey = (c) => {
  const mid = c.material_id ?? c.raw_material_id;
  if (mid != null && mid !== '') return `m:${mid}`;
  const cid = c.chemistry_id ?? c.element_id;
  if (cid != null && cid !== '') return `c:${cid}`;
  return null;
};

const sumUsedForLine = (batches, ln) => {
  const k = lineMatchKey(ln);
  let s = 0;
  (batches || []).forEach((b) => {
    (b.components || []).forEach((c) => {
      if (componentMatchKey(c) === k) {
        const q = parseLocaleNumber(c.quantity);
        if (!Number.isNaN(q)) s += q;
      }
    });
  });
  return Math.round(s * 1e9) / 1e9;
};

/** Бэк задаёт `name` через _display_label_for_batch_component (в т.ч. fallback «удалено…»). */
const batchComponentLabel = (c) =>
  c.name ||
  c.material_name ||
  c.material_name_snapshot ||
  c.element_name ||
  c.element_name_snapshot ||
  c.chemistry_name ||
  c.chemistry_name_snapshot ||
  c.raw_material_name ||
  c.component_name ||
  c.display_name
  || (c.material_id != null || c.raw_material_id != null
    ? `Сырьё #${c.material_id ?? c.raw_material_id}`
    : null)
  || (c.chemistry_id != null || c.element_id != null
    ? `Химия #${c.chemistry_id ?? c.element_id}`
    : null)
  || '—';

/**
 * Подпись строки сохранённой партии: сначала данные из API (снимки и display-* с бэка),
 * иначе подстановка из загруженного рецепта. Раньше порядок был наоборот — при удалённом
 * сырье строки рецепта давали «—» и перекрывали пустые, но корректные по количеству, снимки.
 */
const batchComponentDisplayName = (c, recipeLines) => {
  const fromApi = batchComponentLabel(c);
  if (fromApi !== '—') return fromApi;
  if (Array.isArray(recipeLines) && recipeLines.length) {
    const k = componentMatchKey(c);
    if (k) {
      const ln = recipeLines.find((l) => lineMatchKey(l) === k);
      if (ln?.name && ln.name !== '—') return ln.name;
    }
  }
  return '—';
};

/** Подсказка: нужно ли делить на несколько ёмкостей (по объёму). */
const splitHintFromVolumes = (plannedVol, containerVol) => {
  const p = parseLocaleNumber(plannedVol);
  const c = parseLocaleNumber(containerVol);
  if (!p || !c || p <= 0 || c <= 0) return null;
  if (p <= c) return { count: 1, text: 'Хватает одной ёмкости.' };
  const n = Math.ceil(p / c);
  return {
    count: n,
    text: `Ориентир: ~${n} партий (⌈${p} / ${c}⌉).`,
  };
};

const BatchCompositionForm = ({
  lines,
  qtyByKey,
  setQtyByKey,
  disabled,
}) => {
  const setKey = (key, v) => setQtyByKey((prev) => ({ ...prev, [key]: v }));

  return (
    <div className="batch-composition-form">
      <div className="batch-composition-form__grid batch-composition-form__grid--head">
        <span>Позиция</span>
        <span>Норма в рецепте</span>
        <span>Расход в эту ёмкость</span>
      </div>
      {lines.map((ln) => (
        <div key={ln.key} className="batch-composition-form__grid batch-composition-form__row">
          <span className="batch-composition-form__name" title={ln.name}>
            {ln.name} <span className="batch-composition-form__unit">({ln.unit})</span>
          </span>
          <span className="batch-composition-form__ref">
            {ln.recipeQty != null && Number.isFinite(ln.recipeQty) ? formatQuantityDisplay(ln.recipeQty) : '—'}
          </span>
          <DecimalInput
            min={0}
            placeholder="0"
            value={qtyByKey[ln.key] ?? ''}
            onChange={(v) => setKey(ln.key, v)}
            disabled={disabled}
            aria-label={`Количество ${ln.name}`}
          />
        </div>
      ))}
      <div className="batch-composition-form__actions">
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          disabled={disabled}
          onClick={() => setQtyByKey(fillQtyByRecipeFraction(lines, 1))}
        >
          Вся норма → эта партия
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          disabled={disabled}
          onClick={() => setQtyByKey(fillQtyByRecipeFraction(lines, 0.5))}
        >
          50% нормы
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          disabled={disabled}
          onClick={() => setQtyByKey(emptyQtyState(lines))}
        >
          Очистить
        </button>
      </div>
    </div>
  );
};

const ChemistryPage = () => {
  const toast = useToast();
  const otkNotifyRef = useRef({ ok: false });
  const [productionSearch, setProductionSearch] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [productionStartOpen, setProductionStartOpen] = useState(false);
  const [productionDetailId, setProductionDetailId] = useState(null);

  const { items: recipeRunItems, loading: runsLoading, error: runsError, refetch: refetchRecipeRuns } = useServerQuery(
    'chemistry/recipe-runs/',
    { page: 1, page_size: 100, ordering: '-created_at' },
    { enabled: true }
  );

  useOperationalRefetch(['recipe_run', 'production_batch'], refetchRecipeRuns, true);

  const productionBatchIdsKey = useMemo(() => {
    const s = new Set();
    for (const r of recipeRunItems || []) {
      const id = r?.production_batch_id;
      if (id != null && id !== '' && Number.isFinite(Number(id))) s.add(Number(id));
    }
    return [...s].sort((a, b) => a - b).join(',');
  }, [recipeRunItems]);

  const [otkBatchById, setOtkBatchById] = useState({});

  useEffect(() => {
    if (!productionBatchIdsKey) {
      setOtkBatchById({});
      return;
    }
    const ids = productionBatchIdsKey.split(',').map(Number);
    let cancelled = false;
    const ac = new AbortController();
    (async () => {
      try {
        const batches = await fetchBatchesByIds(ids, ac.signal);
        if (cancelled) return;
        const next = {};
        batches.forEach((b) => {
          if (b?.id != null) next[String(b.id)] = b;
        });
        setOtkBatchById(next);
      } catch (e) {
        if (e.name === 'AbortError' || e.code === 'ERR_CANCELED') return;
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [productionBatchIdsKey]);

  const recipeRunsResolved = useMemo(
    () =>
      (recipeRunItems || []).map((r) => {
        const bid = r?.production_batch_id;
        if (bid == null || bid === '') return r;
        const enriched = otkBatchById[String(bid)];
        if (!enriched) return r;
        return { ...r, production_batch: enriched };
      }),
    [recipeRunItems, otkBatchById]
  );

  const productionSearchLower = productionSearch.trim().toLowerCase();
  const productionRunsList = recipeRunsResolved.map(mapRecipeRunListItem);
  const productionRunsFiltered = productionSearchLower
    ? productionRunsList.filter((r) => {
        const a = `${r.recipeName || ''} ${r.lineName || ''} ${r.summary || ''} ${r.productionBatchId ?? ''}`.toLowerCase();
        return a.includes(productionSearchLower);
      })
    : productionRunsList;

  return (
    <div className="page page--chemistry">
      <div className="chemistry-card">
        <div className="chemistry-card__head ds-toolbar ds-toolbar--in-card">
          <div className="ds-toolbar__start chemistry-card__toolbar-start">
            <input
              type="text"
              className="chemistry-card__search"
              placeholder="Поиск по замесам…"
              value={productionSearch}
              onChange={(e) => setProductionSearch(e.target.value)}
            />
          </div>
          <div className="ds-toolbar__end">
            <button type="button" className="btn btn--primary" onClick={() => { setSubmitError(''); setProductionStartOpen(true); }}>
              Новый замес
            </button>
          </div>
        </div>

        {runsLoading && <Loading />}
        {runsError && <ErrorState error={runsError} onRetry={refetchRecipeRuns} />}
        {!runsLoading && !runsError && productionRunsFiltered.length === 0 ? (
          <EmptyState title="Нет зафиксированных замесов" />
        ) : !runsLoading && !runsError ? (
          <div className="chemistry-table chemistry-table--productions">
            <div className="chemistry-table__header">
              <span className="chemistry-table__th">Рецептура</span>
              <span className="chemistry-table__th">Линия</span>
              <span className="chemistry-table__th">Ёмкости</span>
              <span className="chemistry-table__th">Выпуск</span>
              <span className="chemistry-table__th chemistry-table__th--narrow">Статус</span>
              <span className="chemistry-table__th chemistry-table__th--narrow"></span>
            </div>
            {productionRunsFiltered.map((run) => (
              <div
                key={run.id}
                className="chemistry-table__row chemistry-table__row--clickable"
                onClick={() => setProductionDetailId(run.id)}
                onKeyDown={(e) => e.key === 'Enter' && setProductionDetailId(run.id)}
                role="button"
                tabIndex={0}
              >
                <span className="chemistry-table__name chemistry-table__cell-clip">{run.recipeName || '—'}</span>
                <span className="chemistry-table__cell-clip">{run.lineName || '—'}</span>
                <span className="chemistry-table__cell-num">{run.batchesCount}</span>
                <span className="chemistry-table__cell-num chemistry-table__release">
                  {formatReleaseCell(run.releaseQty, run.releaseUnit)}
                </span>
                <span className="chemistry-table__status chemistry-table__cell-clip">{run.statusRu}</span>
                <span className="chemistry-table__chevron" aria-hidden>›</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {productionStartOpen && (
        <StartProductionModal
          onClose={() => { setProductionStartOpen(false); setSubmitError(''); }}
          onCreateRun={async (payload) => {
            const res = await createRecipeRun(payload);
            await refetchRecipeRuns();
            const data = res.data;
            const pbId = data?.production_batch_id ?? data?.production_batch?.id;
            otkNotifyRef.current = {
              hasBatch: pbId != null && pbId !== '',
            };
            return data;
          }}
          onFlowComplete={() => {
            setProductionStartOpen(false);
            const { hasBatch } = otkNotifyRef.current;
            toast.show(
              hasBatch
                ? 'Замес сохранён. Партия в очереди ОТК — откройте раздел ОТК.'
                : 'Замес сохранён. Если в ответе API нет production_batch_id — проверьте контракт бэкенда.'
            );
          }}
          error={submitError}
          setError={setSubmitError}
        />
      )}

      {productionDetailId != null && (
        <ProductionBatchesModal
          runId={productionDetailId}
          onClose={() => setProductionDetailId(null)}
          onRunsChanged={() => {
            refetchRecipeRuns();
          }}
        />
      )}

    </div>
  );
};

const StartProductionModal = ({
  onClose,
  onCreateRun,
  onFlowComplete,
  error,
  setError,
}) => {
  const [phase, setPhase] = useState('choose_mode');
  const [splitMode, setSplitMode] = useState(null);
  const [plannedVol, setPlannedVol] = useState('');
  const [containerVol, setContainerVol] = useState('');

  const [recipes, setRecipes] = useState([]);
  const [lines, setLines] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [chemistryElements, setChemistryElements] = useState([]);
  const [recipeId, setRecipeId] = useState('');
  const [lineId, setLineId] = useState('');
  const [recipeHint, setRecipeHint] = useState('');

  const [saving, setSaving] = useState(false);
  /** Режим «несколько ёмкостей»: партии только здесь, на сервер — одним запросом по «Завершить запуск». */
  const [draftBatches, setDraftBatches] = useState([]);
  const [recipeLines, setRecipeLines] = useState([]);
  const [batchQtyByKey, setBatchQtyByKey] = useState({});
  const [loadingRecipeLines, setLoadingRecipeLines] = useState(false);
  const [batchRemoveIndex, setBatchRemoveIndex] = useState(null);
  /** Нормативный выпуск из рецепта — единственное число для ОТК (не из партий). */
  const [normativeReleaseQty, setNormativeReleaseQty] = useState(null);
  const [normativeUnitLabel, setNormativeUnitLabel] = useState('шт');

  useEffect(() => {
    apiClient.get('recipes/', { params: { page_size: 500 } })
      .then((r) => setRecipes(r.data?.items || []))
      .catch(() => setRecipes([]));
    fetchLinesWithShiftSnapshot({ page_size: 200, eligible_for_recipe_run: true })
      .then(setLines)
      .catch(() => setLines([]));
    apiClient.get('raw-materials/', { params: { page_size: 500 } })
      .then((r) => setRawMaterials(r.data?.items || []))
      .catch(() => setRawMaterials([]));
    apiClient.get('chemistry/elements/', { params: { page_size: 500 } })
      .then((r) => setChemistryElements(r.data?.items || []))
      .catch(() => setChemistryElements([]));
  }, []);

  useEffect(() => {
    if (!recipeId) {
      setRecipeHint('');
      return;
    }
    const fromList = recipes.find((x) => String(x.id) === String(recipeId));
    const comp = fromList?.components || fromList?.composition;
    if (Array.isArray(comp) && comp.length) {
      setRecipeHint(formatRecipeCompositionHint(comp, rawMaterials, chemistryElements));
      return;
    }
    let cancelled = false;
    apiClient.get(`recipes/${recipeId}/`)
      .then((res) => {
        if (cancelled) return;
        const c = res.data?.components || res.data?.composition || [];
        if (!Array.isArray(c) || !c.length) {
          setRecipeHint('Состав в карточке рецепта не указан.');
          return;
        }
        setRecipeHint(formatRecipeCompositionHint(c, rawMaterials, chemistryElements));
      })
      .catch(() => {
        if (!cancelled) setRecipeHint('');
      });
    return () => { cancelled = true; };
  }, [recipeId, recipes, rawMaterials, chemistryElements]);

  useEffect(() => {
    if (lineId === '' || lineId == null) return;
    const row = lines.find((ln) => String(ln.id) === String(lineId));
    if (!isLineEligibleForRecipeRun(row)) setLineId('');
  }, [lines, lineId]);

  const recipeLabel = (r) => r.recipe || r.recipe_name || r.name || r.product || `№${r.id}`;
  const volHint = splitHintFromVolumes(plannedVol, containerVol);

  const goRecipeLine = () => {
    setError('');
    setNormativeReleaseQty(null);
    setNormativeUnitLabel('шт');
    setPhase('recipe_line');
  };

  const goFirstBatch = async () => {
    setError('');
    const eligibleLines = lines.filter(isLineEligibleForRecipeRun);
    if (!eligibleLines.some((ln) => String(ln.id) === String(lineId))) {
      setError('Выберите линию с открытой сменой без остановки.');
      return;
    }
    if (!recipeId || !lineId) {
      setError('Выберите рецепт и линию');
      return;
    }
    setLoadingRecipeLines(true);
    try {
      const res = await apiClient.get(`recipes/${recipeId}/`);
      const recipeData = res.data;
      const nNorm = recipeNormativeOutputQuantity(recipeData);
      const uNorm = recipeNormativeOutputUnitLabel(recipeData);
      if (nNorm == null) {
        setError('В рецепте не задан нормативный выпуск («Общий выпуск»). Укажите его в карточке рецепта и повторите.');
        return;
      }
      setNormativeReleaseQty(nNorm);
      setNormativeUnitLabel(uNorm);
      const lines = normalizeRecipeLines(recipeData, rawMaterials, chemistryElements);
      if (lines.length === 0) {
        setError('В рецепте нет позиций состава. Откройте рецепт и добавьте строки сырья, затем повторите.');
        return;
      }
      setRecipeLines(lines);
      setBatchQtyByKey(emptyQtyState(lines));
      setPhase('first_batch');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoadingRecipeLines(false);
    }
  };

  const submitFirstBatch = async (e) => {
    e.preventDefault();
    setError('');
    const components = buildComponentsPayload(recipeLines, batchQtyByKey);
    if (components.length === 0) {
      setError('Укажите расход хотя бы по одной позиции состава для этой партии.');
      return;
    }
    const batch = {
      index: 0,
      label: 'Партия 1',
      components,
    };
    if (splitMode === 'multi') {
      setDraftBatches([batch]);
      setBatchQtyByKey(emptyQtyState(recipeLines));
      setPhase('chain');
      return;
    }
    if (normativeReleaseQty == null) {
      setError('Не определён нормативный выпуск рецепта. Вернитесь назад и выберите рецепт снова.');
      return;
    }
    setSaving(true);
    try {
      await onCreateRun({
        recipe_id: Number(recipeId),
        line_id: Number(lineId),
        batches: [batch],
        quantity: normativeReleaseQty,
      });
      onFlowComplete();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const submitNextBatch = (e) => {
    e.preventDefault();
    setError('');
    const components = buildComponentsPayload(recipeLines, batchQtyByKey);
    if (components.length === 0) {
      setError('Укажите расход хотя бы по одной позиции состава для следующей партии.');
      return;
    }
    const nextN = draftBatches.length + 1;
    const batch = {
      index: nextN - 1,
      label: `Партия ${nextN}`,
      components,
    };
    setDraftBatches((prev) => [...prev, batch]);
    setBatchQtyByKey(emptyQtyState(recipeLines));
  };

  const confirmRemoveDraftBatch = () => {
    const idx = batchRemoveIndex;
    if (idx == null) return;
    setBatchRemoveIndex(null);
    const next = draftBatches.filter((_, i) => i !== idx);
    setDraftBatches(next);
    if (next.length === 0) {
      setPhase('first_batch');
      setBatchQtyByKey(emptyQtyState(recipeLines));
    }
  };

  const finalizeMultiRun = async () => {
    setError('');
    if (draftBatches.length === 0) {
      setError('Добавьте хотя бы одну партию.');
      return;
    }
    if (normativeReleaseQty == null) {
      setError('Не определён нормативный выпуск рецепта.');
      return;
    }
    setSaving(true);
    try {
      const batches = draftBatches.map((b, i) => ({
        ...b,
        index: i,
        label: b.label || `Партия ${i + 1}`,
      }));
      await onCreateRun({
        recipe_id: Number(recipeId),
        line_id: Number(lineId),
        batches,
        quantity: normativeReleaseQty,
      });
      onFlowComplete();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = phase === 'chain' ? 'Партии одного замеса' : 'Новый замес';

  const needConfirmWizardClose = useCallback(() => {
    if (splitMode === 'multi' && draftBatches.length > 0) return true;
    if (phase === 'first_batch' || phase === 'chain') {
      return Object.values(batchQtyByKey).some((v) => {
        const n = parseLocaleNumber(String(v ?? ''));
        return Number.isFinite(n) && n > 0;
      });
    }
    return false;
  }, [splitMode, draftBatches.length, phase, batchQtyByKey]);

  const {
    requestClose: requestWizardClose,
    discardConfirmOpen: wizardDiscardOpen,
    confirmDiscardAndClose: confirmWizardDiscard,
    cancelDiscard: cancelWizardDiscard,
  } = useDiscardOnClose(onClose, needConfirmWizardClose);

  return (
    <div className="modal-overlay" onClick={requestWizardClose}>
      <ConfirmModal
        open={wizardDiscardOpen}
        title="Закрыть без сохранения?"
        message="Черновик партий и введённые количества будут сброшены. На сервер ничего не уйдёт, пока вы не завершите запуск."
        confirmText="Закрыть"
        onConfirm={confirmWizardDiscard}
        onCancel={cancelWizardDiscard}
      />
      <ConfirmModal
        open={batchRemoveIndex != null}
        title="Удалить партию?"
        message={
          draftBatches.length <= 1
            ? 'Партия будет убрана из черновика; можно заново ввести партию 1.'
            : 'Убрать эту партию из черновика?'
        }
        confirmText="Удалить"
        onConfirm={confirmRemoveDraftBatch}
        onCancel={() => setBatchRemoveIndex(null)}
      />
      <div className="modal modal--wide production-wizard" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>{modalTitle}</h3>
          <button type="button" className="modal__close" onClick={requestWizardClose} aria-label="Закрыть">×</button>
        </div>

        {phase === 'choose_mode' && (
          <div className="production-start-form production-wizard__body">
            <div className="production-wizard__mode-grid">
              <button
                type="button"
                className={`production-wizard__mode-card ${splitMode === 'one' ? 'production-wizard__mode-card--active' : ''}`}
                onClick={() => { setSplitMode('one'); setError(''); }}
              >
                <span className="production-wizard__mode-title">Одна ёмкость</span>
                <span className="production-wizard__mode-desc">Один расход по рецепту.</span>
              </button>
              <button
                type="button"
                className={`production-wizard__mode-card ${splitMode === 'multi' ? 'production-wizard__mode-card--active' : ''}`}
                onClick={() => { setSplitMode('multi'); setError(''); }}
              >
                <span className="production-wizard__mode-title">Несколько ёмкостей</span>
                <span className="production-wizard__mode-desc">Несколько партий сырья за запуск.</span>
              </button>
            </div>
            <div className="production-wizard__optional-volumes">
              <p className="production-start-form__muted production-wizard__optional-title">Объём (необязательно)</p>
              <div className="production-wizard__vol-row">
                <label>
                  Весь плановый объём
                  <DecimalInput
                    min={0}
                    placeholder="напр. 500"
                    value={plannedVol}
                    onChange={setPlannedVol}
                  />
                </label>
                <label>
                  Вмещает одна ёмкость
                  <DecimalInput
                    min={0}
                    placeholder="напр. 200"
                    value={containerVol}
                    onChange={setContainerVol}
                  />
                </label>
              </div>
              {volHint && (
                <p className="production-wizard__volume-hint">{volHint.text}</p>
              )}
            </div>
            {error && <p className="modal__error">{error}</p>}
            <div className="modal__actions">
              <button type="button" className="btn btn--secondary" onClick={requestWizardClose}>Отмена</button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!splitMode}
                onClick={goRecipeLine}
              >
                Далее
              </button>
            </div>
          </div>
        )}

        {phase === 'recipe_line' && (
          <form
            className="production-start-form production-wizard__body"
            onSubmit={async (e) => {
              e.preventDefault();
              await goFirstBatch();
            }}
          >
            <label>Рецепт *</label>
            <Select
              value={recipeId === '' || recipeId == null ? '' : String(recipeId)}
              onChange={(v) => setRecipeId(v)}
              placeholder="Выберите рецепт"
              options={recipes.map((r) => ({ value: String(r.id), label: recipeLabel(r) }))}
            />
            {recipeHint && <p className="production-start-form__hint">{recipeHint}</p>}
            {recipeId && (() => {
              const fromList = recipes.find((x) => String(x.id) === String(recipeId));
              const prev = recipeNormativeOutputQuantity(fromList || {});
              const prevU = recipeNormativeOutputUnitLabel(fromList || {});
              if (prev == null) {
                return (
                  <p className="production-start-form__muted">Укажите нормативный выпуск в рецепте.</p>
                );
              }
              return (
                <p className="production-wizard__release-banner">
                  Выпуск: <strong>{formatQuantityDisplay(prev)} {prevU}</strong>
                </p>
              );
            })()}
            <label>Линия *</label>
            {(() => {
              const eligibleLines = lines.filter(isLineEligibleForRecipeRun);
              return (
                <>
                  <Select
                    value={lineId === '' || lineId == null ? '' : String(lineId)}
                    onChange={(v) => setLineId(v)}
                    placeholder={eligibleLines.length ? 'Линия' : 'Нет доступных линий'}
                    options={eligibleLines.map((ln) => {
                      const snap = ln.shift_snapshot || ln.shiftSnapshot;
                      const params = snap
                        ? ` · ${snap.height ?? '—'}×${snap.width ?? '—'} · ${snap.angle_deg != null ? `${snap.angle_deg}°` : '—'}`
                        : '';
                      return {
                        value: String(ln.id),
                        label: `${ln.name}${params}`,
                      };
                    })}
                  />
                  {eligibleLines.length === 0 && (
                    <p className="modal__error">
                      Нет линий с активной сменой: смена должна быть открыта и не остановлена.
                    </p>
                  )}
                </>
              );
            })()}
            {error && <p className="modal__error">{error}</p>}
            <div className="modal__actions">
              <button type="button" className="btn btn--secondary" onClick={() => { setError(''); setPhase('choose_mode'); }} disabled={loadingRecipeLines}>Назад</button>
              <button type="button" className="btn btn--secondary" onClick={requestWizardClose} disabled={loadingRecipeLines}>Отмена</button>
              <button type="submit" className="btn btn--primary" disabled={loadingRecipeLines}>
                {loadingRecipeLines ? 'Загрузка…' : 'Далее'}
              </button>
            </div>
          </form>
        )}

        {phase === 'first_batch' && (
          <form className="production-start-form production-wizard__body" onSubmit={submitFirstBatch}>
            {normativeReleaseQty != null && (
              <p className="production-wizard__release-banner">
                Выпуск: <strong>{formatQuantityDisplay(normativeReleaseQty)} {normativeUnitLabel}</strong>
              </p>
            )}
            {splitMode === 'multi' && (
              <p className="production-wizard__step-label">Партия 1 (ёмкость)</p>
            )}
            <BatchCompositionForm
              lines={recipeLines}
              qtyByKey={batchQtyByKey}
              setQtyByKey={setBatchQtyByKey}
              disabled={saving}
            />
            {error && <p className="modal__error">{error}</p>}
            <div className="modal__actions">
              <button type="button" className="btn btn--secondary" onClick={() => { setError(''); setPhase('recipe_line'); }} disabled={saving}>Назад</button>
              <button type="button" className="btn btn--secondary" onClick={requestWizardClose} disabled={saving}>Отмена</button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Сохранение…' : splitMode === 'one' ? 'Зарегистрировать запуск' : 'Далее'}
              </button>
            </div>
          </form>
        )}

        {phase === 'chain' && (
          <div className="production-start-form production-wizard__body">
            {normativeReleaseQty != null && (
              <p className="production-wizard__release-banner">
                Выпуск: <strong>{formatQuantityDisplay(normativeReleaseQty)} {normativeUnitLabel}</strong>
                {' '}— фиксировано по рецепту; сколько бы ни было партий-ёмкостей, в ОТК уходит это число. Партии — только расход сырья.
              </p>
            )}
            {recipeLines.length > 0 && (
              <div className="production-wizard__reconcile">
                <div className="production-wizard__reconcile-title">Сверка с рецептом</div>
                <div className="batch-composition-form__grid batch-composition-form__grid--head production-wizard__reconcile-grid">
                  <span>Позиция</span>
                  <span>Норма</span>
                  <span>Уже в партиях</span>
                  <span>Δ</span>
                </div>
                {recipeLines.map((ln) => {
                  const used = sumUsedForLine(draftBatches, ln);
                  const rq = ln.recipeQty;
                  const delta = rq != null && Number.isFinite(rq) && Number.isFinite(used)
                    ? Math.round((used - rq) * 1e9) / 1e9
                    : null;
                  let mark = '';
                  if (delta != null) {
                    if (Math.abs(delta) < 1e-8) mark = '✓';
                    else if (delta > 0) mark = 'больше нормы';
                    else mark = 'осталось';
                  }
                  return (
                    <div key={ln.key} className="batch-composition-form__grid production-wizard__reconcile-grid production-wizard__reconcile-row">
                      <span className="batch-composition-form__name">{ln.name} ({ln.unit})</span>
                      <span>{rq != null ? formatQuantityDisplay(rq) : '—'}</span>
                      <span>{formatQuantityDisplay(used)}</span>
                      <span className={delta > 0 ? 'production-wizard__reconcile-warn' : ''}>
                        {delta == null ? '—' : `${delta > 0 ? '+' : ''}${formatQuantityDisplay(delta)}${mark ? ` (${mark})` : ''}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="production-wizard__batch-list">
              {draftBatches.map((b, i) => (
                <div key={`draft-${i}`} className="production-wizard__batch-card">
                  <div className="production-wizard__batch-card-head">
                    <strong>{b.label || `Партия ${Number(b.index ?? i) + 1}`}</strong>
                    <div className="production-wizard__batch-card-actions">
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm production-wizard__batch-remove"
                        disabled={saving}
                        onClick={() => setBatchRemoveIndex(i)}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                  {(b.components || []).length > 0 ? (
                    <div className="batch-composition-form__grid batch-composition-form__grid--head production-wizard__batch-mini">
                      <span>Позиция</span>
                      <span>Кол-во</span>
                    </div>
                  ) : (
                    <p className="production-start-form__muted">Состав недоступен.</p>
                  )}
                  {(b.components || []).map((c, j) => (
                    <div key={c.id ?? j} className="batch-composition-form__grid production-wizard__batch-mini">
                      <span>{batchComponentDisplayName(c, recipeLines)}</span>
                      <span>{formatQuantityDisplay(c.quantity)} {c.unit || ''}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <form onSubmit={submitNextBatch}>
              <p className="production-wizard__step-label">Партия {draftBatches.length + 1} (ёмкость)</p>
              <BatchCompositionForm
                lines={recipeLines}
                qtyByKey={batchQtyByKey}
                setQtyByKey={setBatchQtyByKey}
                disabled={saving}
              />
              {error && <p className="modal__error">{error}</p>}
              <div className="modal__actions production-wizard__chain-actions">
                <button type="submit" className="btn btn--secondary" disabled={saving}>
                  {`Добавить партию ${draftBatches.length + 1}`}
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => { setError(''); finalizeMultiRun(); }}
                  disabled={saving || draftBatches.length === 0}
                >
                  {saving ? 'Сохранение…' : 'Завершить запуск'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

const ProductionBatchesModal = ({ runId, onClose, onRunsChanged }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [run, setRun] = useState(null);
  const [recipeLines, setRecipeLines] = useState([]);
  const [addQtyByKey, setAddQtyByKey] = useState({});
  const [flushSaving, setFlushSaving] = useState(false);
  const [addErr, setAddErr] = useState('');
  /** Новые партии только в памяти до «Записать на сервер». */
  const [queuedBatches, setQueuedBatches] = useState([]);
  const [batchRemoveIndex, setBatchRemoveIndex] = useState(null);
  const [removeSaving, setRemoveSaving] = useState(false);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [chemistryElements, setChemistryElements] = useState([]);

  useEffect(() => {
    apiClient.get('raw-materials/', { params: { page_size: 500 } })
      .then((r) => setRawMaterials(r.data?.items || []))
      .catch(() => setRawMaterials([]));
    apiClient.get('chemistry/elements/', { params: { page_size: 500 } })
      .then((r) => setChemistryElements(r.data?.items || []))
      .catch(() => setChemistryElements([]));
  }, []);

  const loadRun = () => {
    setLoading(true);
    setErr(null);
    getRecipeRun(runId)
      .then((res) => setRun(res.data))
      .catch((e) => setErr(apiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    getRecipeRun(runId)
      .then((res) => {
        if (!cancelled) setRun(res.data);
      })
      .catch((e) => {
        if (!cancelled) setErr(apiError(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [runId]);

  const recipeIdResolved = run?.recipe?.id ?? run?.recipe_id;

  useEffect(() => {
    if (!recipeIdResolved) {
      setRecipeLines([]);
      setAddQtyByKey({});
      return;
    }
    apiClient.get(`recipes/${recipeIdResolved}/`)
      .then((res) => {
        const lines = normalizeRecipeLines(res.data, rawMaterials, chemistryElements);
        setRecipeLines(lines);
        setAddQtyByKey(emptyQtyState(lines));
      })
      .catch(() => {
        setRecipeLines([]);
        setAddQtyByKey({});
      });
  }, [recipeIdResolved, rawMaterials, chemistryElements]);

  const recipeName = getRecipeRunRecipeLabel(run);
  const lineName = getRecipeRunLineLabel(run);
  const batches = Array.isArray(run?.batches) ? run.batches : [];
  const canEditRun = run ? isRecipeRunOtkPending(run) : true;

  const addPendingQtyInForm = useCallback(
    () => Object.values(addQtyByKey).some((v) => {
      const n = parseLocaleNumber(String(v ?? ''));
      return Number.isFinite(n) && n > 0;
    }),
    [addQtyByKey],
  );

  const needConfirmDetailClose = useCallback(
    () => queuedBatches.length > 0 || addPendingQtyInForm(),
    [queuedBatches.length, addPendingQtyInForm],
  );

  const {
    requestClose: requestDetailClose,
    discardConfirmOpen: detailDiscardOpen,
    confirmDiscardAndClose: confirmDetailDiscard,
    cancelDiscard: cancelDetailDiscard,
  } = useDiscardOnClose(onClose, needConfirmDetailClose);

  const handleAddToQueue = (e) => {
    e.preventDefault();
    setAddErr('');
    if (recipeLines.length === 0) {
      setAddErr('Не удалось загрузить состав рецепта.');
      return;
    }
    const components = buildComponentsPayload(recipeLines, addQtyByKey);
    if (components.length === 0) {
      setAddErr('Укажите расход хотя бы по одной позиции состава.');
      return;
    }
    const slot = batches.length + queuedBatches.length + 1;
    setQueuedBatches((q) => [
      ...q,
      {
        label: `Партия ${slot}`,
        components,
      },
    ]);
    setAddQtyByKey(emptyQtyState(recipeLines));
  };

  const removeQueuedAt = (qi) => {
    setQueuedBatches((q) => q.filter((_, i) => i !== qi));
  };

  const flushQueuedToServer = async () => {
    if (queuedBatches.length === 0) return;
    setFlushSaving(true);
    setAddErr('');
    setErr(null);
    try {
      await appendRecipeRunBatchesBulk(runId, queuedBatches);
      setQueuedBatches([]);
      onRunsChanged?.();
      const res = await getRecipeRun(runId);
      setRun(res.data);
    } catch (err) {
      setAddErr(apiError(err));
    } finally {
      setFlushSaving(false);
    }
  };

  const confirmRemoveBatchDetail = async () => {
    if (batchRemoveIndex == null) return;
    const idx = batchRemoveIndex;
    setBatchRemoveIndex(null);
    setRemoveSaving(true);
    setErr(null);
    try {
      const result = await removeRecipeRunBatchAtIndex(runId, idx);
      if (result.deletedRun) {
        onRunsChanged?.();
        toast.show('Замес удалён');
        onClose();
        return;
      }
      onRunsChanged?.();
      const res = await getRecipeRun(runId);
      setRun(res.data);
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setRemoveSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={requestDetailClose}>
      <ConfirmModal
        open={detailDiscardOpen}
        title="Закрыть без сохранения?"
        message="Партии в очереди и введённые количества не будут записаны на сервер."
        confirmText="Закрыть"
        onConfirm={confirmDetailDiscard}
        onCancel={cancelDetailDiscard}
      />
      <ConfirmModal
        open={batchRemoveIndex != null}
        title="Удалить партию?"
        message={
          batches.length <= 1
            ? 'Это единственная партия — запуск будет удалён целиком.'
            : 'Партию нельзя восстановить.'
        }
        confirmText="Удалить"
        onConfirm={confirmRemoveBatchDetail}
        onCancel={() => setBatchRemoveIndex(null)}
      />
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Партии замеса (ёмкости)</h3>
          <button type="button" className="modal__close" onClick={requestDetailClose} aria-label="Закрыть">×</button>
        </div>
        <div className="production-detail">
          {loading && <Loading />}
          {err && <p className="modal__error">{err}</p>}
          {!loading && !err && run && (
            <>
              <div className="production-detail__meta">
                <p><strong>Рецепт:</strong> {recipeName}</p>
                <p><strong>Линия:</strong> {lineName}</p>
                <p><strong>Дата:</strong> {formatDate(run.created_at)}</p>
                {(run.production_batch_id != null || run.production_batch?.id != null) && (
                  <p><strong>ОТК:</strong> #{run.production_batch_id ?? run.production_batch?.id}</p>
                )}
              </div>
              {!canEditRun && (
                <p className="modal__error production-detail__locked">
                  Редактирование партий недоступно: по этому замесу партия ОТК уже не в ожидании проверки.
                </p>
              )}
              {(() => {
                const rq = normativeOtkQuantityFromRun(run);
                if (rq == null) return null;
                return (
                  <p className="production-wizard__release-banner">
                    Выпуск:{' '}
                    <strong>
                      {formatQuantityDisplay(rq)} {recipeNormativeOutputUnitLabel(run.recipe || {})}
                    </strong>
                    {' '}(фиксировано по рецепту; партии-ёмкости ниже только для расхода сырья).
                  </p>
                );
              })()}
              {run.summary && <p className="production-detail__summary">{run.summary}</p>}
              <div className="production-detail__batches-wrap">
                {batches.map((b, i) => (
                  <div key={b.id ?? `${b.index}-${i}`} className="production-detail__batch-block">
                    <div className="production-detail__batch-block-title">
                      <span>{b.label || `Партия ${Number(b.index ?? i) + 1}`}</span>
                      <div className="production-detail__batch-block-actions">
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          disabled={!canEditRun || loading || removeSaving || flushSaving}
                          onClick={() => setBatchRemoveIndex(i)}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                    {(b.components || []).length > 0 ? (
                      <div className="chemistry-table chemistry-table--batches-detail chemistry-table--nested">
                        <div className="chemistry-table__header">
                          <span className="chemistry-table__th">ПОЗИЦИЯ</span>
                          <span className="chemistry-table__th">Расход</span>
                        </div>
                        {(b.components || []).map((c, j) => (
                          <div key={c.id ?? j} className="chemistry-table__row">
                            <span className="chemistry-table__name">{batchComponentDisplayName(c, recipeLines)}</span>
                            <span>{formatQuantityDisplay(c.quantity)} {c.unit || ''}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="production-start-form__muted">Состав недоступен.</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="production-detail__add-batch">
                {canEditRun && queuedBatches.length > 0 && (
                  <div className="production-detail__queue">
                    <p className="production-detail__add-title">Очередь к записи ({queuedBatches.length})</p>
                    <ul className="production-detail__queue-list">
                      {queuedBatches.map((qb, qi) => (
                        <li key={qi} className="production-detail__queue-item">
                          <span>{qb.label}</span>
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            disabled={flushSaving}
                            onClick={() => removeQueuedAt(qi)}
                          >
                            Убрать
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={flushSaving}
                      onClick={flushQueuedToServer}
                    >
                      {flushSaving ? 'Запись…' : `Записать на сервер (${queuedBatches.length})`}
                    </button>
                  </div>
                )}
                {canEditRun && <p className="production-detail__add-title">Новая партия</p>}
                {!canEditRun ? null : recipeLines.length === 0 ? (
                  !recipeIdResolved ? (
                    <p className="production-start-form__muted">
                      Добавить партию нельзя: рецепт в справочнике недоступен (удалён или не привязан).
                      Сохранённые партии выше показываются по данным замеса и снимкам.
                    </p>
                  ) : (
                    <p className="modal__error">Не удалось загрузить состав. Обновите страницу.</p>
                  )
                ) : (
                  <form className="production-detail__add-batch-form" onSubmit={handleAddToQueue}>
                    <BatchCompositionForm
                      lines={recipeLines}
                      qtyByKey={addQtyByKey}
                      setQtyByKey={setAddQtyByKey}
                      disabled={flushSaving || removeSaving}
                    />
                    <div className="production-detail__add-actions">
                      <button type="submit" className="btn btn--secondary" disabled={flushSaving || removeSaving}>
                        {`В очередь (партия ${batches.length + queuedBatches.length + 1})`}
                      </button>
                    </div>
                  </form>
                )}
                {addErr && <p className="modal__error production-detail__add-error">{addErr}</p>}
              </div>
            </>
          )}
        </div>
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={loadRun} disabled={loading}>Обновить</button>
          <button type="button" className="btn btn--primary" onClick={requestDetailClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
};

export default ChemistryPage;

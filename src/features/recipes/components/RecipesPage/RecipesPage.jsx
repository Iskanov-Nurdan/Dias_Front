import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiPlus, FiCheck, FiX } from 'react-icons/fi';
import { useDiscardOnClose, useDirtyFromBaseline } from '../../../../shared/hooks';
import {
  useServerQuery,
  formatQuantityDisplay,
  parseLocaleNumber,
  getApiErrorMessage,
  parseApiListResponse,
} from '../../../../shared/lib';
import { Loading, EmptyState, ErrorState, ConfirmModal, useToast, DecimalInput, Select, SearchInput, ActionMenu, EntityAvatar } from '../../../../shared/ui';
import {
  createRecipe,
  updateRecipe,
  deleteRecipe,
  getRecipe,
  getRecipeAvailability,
} from '../../api/recipesApi';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { buildRecipeAvailabilityRows, formatAvailabilityCell } from '../../lib/recipeAvailabilityRows';
import './RecipesPage.scss';

const TYPE_RAW = 'raw';
const TYPE_CHEMISTRY = 'chemistry';
const TYPE_REWORKED = 'reworked_batch';

const reworkBatchProductLabel = (b) => {
  if (!b || typeof b !== 'object') return '';
  const own = typeof b.product === 'string' ? b.product.trim() : '';
  if (own) return own;
  const profileLabel = b.linked_entities?.profile?.label;
  if (typeof profileLabel === 'string' && profileLabel.trim()) return profileLabel.trim();
  return '';
};

const recipeDisplayName = (r) =>
  r.recipe || r.recipe_name || r.name || r.product || r.product_name || '—';

const profileLabel = (r, profileMap) => {
  if (r.profile?.name) return r.profile.name;
  const pid = r.profile_id ?? r.profile?.id;
  if (pid != null && profileMap?.has(Number(pid))) {
    const p = profileMap.get(Number(pid));
    return p?.name || '—';
  }
  return r.profile_name || r.plastic_profile_name || '—';
};

const componentCount = (r) => {
  const c = r.components ?? r.composition;
  if (Array.isArray(c)) return c.length;
  if (r.components_count != null) return Number(r.components_count);
  return 0;
};

const componentQtyPerMeter = (c) =>
  c.quantity_per_meter ?? c.quantity ?? c.qty_per_meter;

const mapApiComponentType = (c) => {
  const t = String(c.type || '').toLowerCase();
  if (t === 'rework_stock' || t === 'reworked_batch' || t === 'reworked_warehouse' || t === 'rework_warehouse_batch') {
    return TYPE_REWORKED;
  }
  if (t === 'chemistry' || t === 'chem') return TYPE_CHEMISTRY;
  if (t === 'raw_material' || t === 'raw') return TYPE_RAW;
  const hasMat = c.material_id != null || c.raw_material_id != null;
  const hasChem = c.chemistry_id != null || c.element_id != null;
  const hasReworkId = c.rework_warehouse_batch_id != null;
  if (hasReworkId && !hasMat && !hasChem) return TYPE_REWORKED;
  if (hasChem && !hasMat) return TYPE_CHEMISTRY;
  return TYPE_RAW;
};

const resolveComponentName = (c, rawMaterials, chemistryElements, reworkBatches = []) => {
  const name =
    c.material_name
    || c.element_name
    || c.name
    || c.batch_display
    || c.warehouse_batch_display
    || c.rework_batch_display;
  if (name) return name;
  const rwId = c.rework_warehouse_batch_id ?? c.warehouse_batch_id;
  if (mapApiComponentType(c) === TYPE_REWORKED && rwId != null) {
    const b = reworkBatches.find((i) => String(i.id) === String(rwId));
    const lbl = reworkBatchProductLabel(b);
    return lbl || '—';
  }
  const matId = c.material_id ?? c.raw_material_id;
  if (matId != null) {
    const m = rawMaterials.find((i) => String(i.id) === String(matId));
    return m?.name || '—';
  }
  const eId = c.chemistry_id ?? c.element_id;
  if (eId != null) {
    const e = chemistryElements.find((i) => String(i.id) === String(eId));
    return e?.name || '—';
  }
  return '—';
};

const getCompositionRows = (recipe, rawMaterials, chemistryElements, reworkBatches = []) => {
  const comp = recipe.components || recipe.composition || [];
  if (!Array.isArray(comp) || comp.length === 0) return [];
  return comp.map((c, idx) => {
    const name = resolveComponentName(c, rawMaterials, chemistryElements, reworkBatches);
    const qty = componentQtyPerMeter(c);
    const kind = mapApiComponentType(c);
    const typeLabel =
      kind === TYPE_CHEMISTRY ? 'Химия'
        : kind === TYPE_REWORKED ? 'Переделанные'
          : 'Сырьё';
    return {
      key: `${idx}-${c.material_id ?? c.chemistry_id ?? c.rework_warehouse_batch_id ?? c.warehouse_batch_id ?? idx}`,
      typeLabel,
      name,
      quantity: qty,
      hasQty: qty != null && qty !== '',
    };
  });
};

const canDeleteRecipe = (r) => r?.deletable === true;

const RecipesPage = () => {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [lockedProfileForCreate, setLockedProfileForCreate] = useState(null);
  const [query, setQuery] = useState({ page: 1, page_size: 500, search: '' });
  const [plasticProfiles, setPlasticProfiles] = useState([]);
  const [metaModal, setMetaModal] = useState(null);
  const [compositionModal, setCompositionModal] = useState(null);
  const [viewRecipeId, setViewRecipeId] = useState(null);
  const [availabilityRecipeId, setAvailabilityRecipeId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deactivateError, setDeactivateError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const { items: recipes, loading, error, refetch } = useServerQuery(
    'recipes/',
    query,
    { enabled: true },
  );

  useEffect(() => {
    apiClient.get('plastic-profiles/', { params: { page_size: 500 } })
      .then((res) => setPlasticProfiles(parseApiListResponse(res.data)))
      .catch(() => setPlasticProfiles([]));
  }, []);

  const profileMap = useMemo(() => {
    const m = new Map();
    plasticProfiles.forEach((p) => m.set(Number(p.id), p));
    return m;
  }, [plasticProfiles]);

  const refetchRecipes = useCallback(() => {
    refetch();
  }, [refetch]);

  useOperationalRefetch(['recipe', 'recipes'], refetchRecipes, true);

  const filterProfileId = searchParams.get('filter_profile_id');
  const recipeList = useMemo(() => {
    let list = recipes || [];
    if (filterProfileId) {
      const pid = Number(filterProfileId);
      if (Number.isFinite(pid)) {
        list = list.filter((r) => Number(r.profile_id ?? r.profile?.id) === pid);
      }
    }
    return list;
  }, [recipes, filterProfileId]);

  const filterProfileLabel = useMemo(() => {
    if (!filterProfileId) return '';
    const pid = Number(filterProfileId);
    const p = plasticProfiles.find((x) => Number(x.id) === pid);
    if (!p) return 'Профиль';
    return p.name || 'Профиль';
  }, [filterProfileId, plasticProfiles]);

  const clearProfileFilter = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('filter_profile_id');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    const open = searchParams.get('open');
    const pid = searchParams.get('profile_id');
    if (open !== 'recipe' || pid == null || pid === '') return;
    const n = Number(pid);
    if (!Number.isFinite(n) || n <= 0) return;
    setLockedProfileForCreate(n);
    setSubmitError('');
    setMetaModal({});
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('open');
      next.delete('profile_id');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleMetaSubmit = async (data) => {
    setSubmitError('');
    try {
      if (metaModal?.id) {
        await updateRecipe(metaModal.id, data);
      } else {
        await createRecipe(data);
      }
      setMetaModal(null);
      setLockedProfileForCreate(null);
      refetchRecipes();
      toast.success('Сохранено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || err.response?.data?.details || 'Ошибка');
    }
  };

  const handleCompositionSaved = () => {
    setCompositionModal(null);
    refetchRecipes();
    toast.success('Состав сохранён');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    try {
      await deleteRecipe(deleteTarget.id);
      setDeleteTarget(null);
      refetchRecipes();
      toast.success('Удалено');
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Ошибка удаления');
      setDeleteError(msg);
      toast.error(msg);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget?.id) return;
    setDeactivateError('');
    try {
      await updateRecipe(deactivateTarget.id, { is_active: false });
      setDeactivateTarget(null);
      refetchRecipes();
      toast.success('Деактивировано');
    } catch (err) {
      const msg = err.response?.data?.error || getApiErrorMessage(err, 'Ошибка');
      setDeactivateError(msg);
      toast.error(msg);
    }
  };

  const openRecipeView = (e, r) => {
    if (e.target.closest('button') || e.target.closest('.recipes-table__actions') || e.target.closest('.action-menu')) return;
    setViewRecipeId(r.id);
  };

  return (
    <div className="page page--recipes">
      {!loading && plasticProfiles.length === 0 && (
        <div className="recipes-filter-banner" role="alert">
          <Link to="/profiles">Создать профиль</Link>
        </div>
      )}

      {filterProfileId && (
        <div className="recipes-filter-banner" role="status">
          <span>Рецепты профиля: <strong>{filterProfileLabel}</strong></span>
          <button type="button" className="btn btn--secondary btn--sm" onClick={clearProfileFilter}>
            Все рецепты
          </button>
        </div>
      )}

      <div className="recipes-card">
        <div className="recipes-card__head ds-toolbar ds-toolbar--in-card">
          <div className="ds-toolbar__start recipes-card__head-start">
            <SearchInput
              className="recipes-card__search"
              placeholder="Поиск"
              value={query.search || ''}
              onChange={(e) => setQuery((p) => ({ ...p, search: e.target.value, page: 1 }))}
            />
          </div>
          <div className="ds-toolbar__end recipes-card__toolbar-actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!plasticProfiles.length}
              title={!plasticProfiles.length ? 'Сначала создайте профиль в разделе «Профили»' : undefined}
              onClick={() => {
                if (!plasticProfiles.length) return;
                setSubmitError('');
                setLockedProfileForCreate(null);
                setMetaModal({});
              }}
            >
              <FiPlus aria-hidden size={16} strokeWidth={2} />
              Рецепт
            </button>
          </div>
        </div>
        {loading && <Loading />}
        {error && error.status !== 404 && <ErrorState error={error} onRetry={refetchRecipes} />}
        {!loading && (!error || error.status === 404) && (
          recipeList.length === 0 ? (
            <EmptyState title="Нет рецептов" />
          ) : (
            <div className="recipes-table-wrap">
              <div className="recipes-table recipes-table--main">
                <div className="recipes-table__header">
                  <span className="recipes-table__th">Название</span>
                  <span className="recipes-table__th">Профиль</span>
                  <span className="recipes-table__th recipes-table__th--num">Компонентов</span>
                  <span className="recipes-table__th">Статус</span>
                  <span className="recipes-table__th recipes-table__th--actions">Действия</span>
                </div>
                {recipeList.map((r) => {
                  const active = r.is_active !== false;
                  return (
                    <div
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      className="recipes-table__row recipes-table__row--clickable"
                      onClick={(e) => openRecipeView(e, r)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setViewRecipeId(r.id);
                        }
                      }}
                    >
                      <span className="recipes-table__name recipes-table__name--with-avatar">
                        <EntityAvatar name={recipeDisplayName(r)} size={28} />
                        {recipeDisplayName(r)}
                      </span>
                      <span className="recipes-table__profile">{profileLabel(r, profileMap)}</span>
                      <span className="recipes-table__count">{componentCount(r)}</span>
                      <span className="recipes-table__status">{active ? 'активен' : 'неактивен'}</span>
                      <div className="recipes-table__actions" onClick={(e) => e.stopPropagation()}>
                        <ActionMenu
                          items={[
                            { label: 'Редактировать', onClick: () => { setSubmitError(''); setMetaModal(r); } },
                            { label: 'Состав', onClick: () => setCompositionModal({ id: r.id, name: recipeDisplayName(r) }) },
                            { label: 'Проверка остатков', onClick: () => setAvailabilityRecipeId(r.id) },
                            ...(active
                              ? [{ label: 'Деактивировать', onClick: () => { setDeactivateError(''); setDeactivateTarget(r); } }]
                              : []),
                            ...(canDeleteRecipe(r)
                              ? [{
                                label: 'Удалить',
                                danger: true,
                                onClick: () => {
                                  setDeleteError('');
                                  setDeleteTarget({ id: r.id, name: recipeDisplayName(r) });
                                },
                              }]
                              : []),
                          ]}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>

      {metaModal !== null && (
        <RecipeMetaModal
          recipe={metaModal?.id ? metaModal : null}
          lockedProfileId={metaModal?.id ? null : lockedProfileForCreate}
          onFetchRecipe={metaModal?.id ? getRecipe : undefined}
          plasticProfiles={plasticProfiles}
          onSubmit={handleMetaSubmit}
          onClose={() => {
            setMetaModal(null);
            setSubmitError('');
            setLockedProfileForCreate(null);
          }}
          error={submitError}
        />
      )}

      {compositionModal && (
        <RecipeCompositionModal
          recipeId={compositionModal.id}
          recipeName={compositionModal.name}
          onClose={() => setCompositionModal(null)}
          onSaved={handleCompositionSaved}
          error={submitError}
          onError={setSubmitError}
        />
      )}

      {viewRecipeId != null && (
        <RecipeDetailModal
          recipeId={viewRecipeId}
          titleFallback={recipeDisplayName(recipes.find((x) => x.id === viewRecipeId) || {})}
          profileLabelText={profileLabel(recipes.find((x) => x.id === viewRecipeId) || {}, profileMap)}
          onClose={() => setViewRecipeId(null)}
          onEdit={() => {
            const r = recipes.find((x) => x.id === viewRecipeId);
            if (r) { setSubmitError(''); setMetaModal(r); }
          }}
          onComposition={() => {
            const r = recipes.find((x) => x.id === viewRecipeId);
            if (r) setCompositionModal({ id: r.id, name: recipeDisplayName(r) });
          }}
          onAvailability={() => setAvailabilityRecipeId(viewRecipeId)}
        />
      )}

      {availabilityRecipeId != null && (
        <AvailabilityModal
          recipeId={availabilityRecipeId}
          title={recipeDisplayName(recipes.find((x) => x.id === availabilityRecipeId) || {})}
          onClose={() => setAvailabilityRecipeId(null)}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить рецепт?"
        message={deleteTarget ? `Удалить «${deleteTarget.name}»? Только если рецепт нигде не использовался.` : ''}
        confirmText="Удалить"
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        error={deleteError}
      />

      <ConfirmModal
        open={!!deactivateTarget}
        title="Деактивировать?"
        message={deactivateTarget ? `Снять с производства «${recipeDisplayName(deactivateTarget)}»?` : ''}
        confirmText="Деактивировать"
        onConfirm={handleDeactivate}
        onCancel={() => { setDeactivateTarget(null); setDeactivateError(''); }}
        error={deactivateError}
      />
    </div>
  );
};

const RecipeMetaModal = ({
  recipe,
  lockedProfileId,
  onFetchRecipe,
  plasticProfiles,
  onSubmit,
  onClose,
  error,
}) => {
  const isEdit = !!recipe?.id;
  const profileLocked = !isEdit && lockedProfileId != null
    && Number.isFinite(Number(lockedProfileId))
    && Number(lockedProfileId) > 0;

  const lockedProfileObj = useMemo(
    () => plasticProfiles.find((p) => String(p.id) === String(lockedProfileId)),
    [plasticProfiles, lockedProfileId],
  );
  const lockedSummary = lockedProfileObj
    ? (lockedProfileObj.name || 'Профиль')
    : (lockedProfileId != null ? 'Выбранный профиль' : '');

  const [name, setName] = useState('');
  const [profileId, setProfileId] = useState('');
  const [comment, setComment] = useState('');
  const [statusActive, setStatusActive] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = (r) => {
      const recipeName = r?.recipe || r?.recipe_name || r?.name || r?.product || r?.product_name || '';
      setName(recipeName);
      const pid = r?.profile_id ?? r?.profile?.id;
      setProfileId(pid != null && pid !== '' ? String(pid) : '');
      setComment(r?.comment ?? r?.note ?? '');
      setStatusActive(r?.is_active !== false);
    };
    if (recipe?.id && onFetchRecipe) {
      setLoading(true);
      onFetchRecipe(recipe.id)
        .then((res) => init(res.data))
        .catch(() => init(recipe))
        .finally(() => setLoading(false));
    } else if (!recipe?.id) {
      init(null);
      if (profileLocked) {
        setProfileId(String(lockedProfileId));
      }
    } else {
      init(recipe);
    }
  }, [recipe, recipe?.id, onFetchRecipe, lockedProfileId, profileLocked]);

  const hasProfile = profileLocked || (profileId !== '' && profileId != null);
  const canSubmit = name.trim().length > 0 && hasProfile;

  const formSnap = useMemo(() => ({
    name: String(name ?? '').trim(),
    profileId: profileId === '' || profileId == null ? '' : String(profileId),
    comment: String(comment ?? '').trim(),
    statusActive,
  }), [name, profileId, comment, statusActive]);

  const isDirty = useDirtyFromBaseline(
    recipe?.id ?? `new-recipe-${lockedProfileId ?? 'open'}`,
    loading,
    formSnap,
  );
  const {
    requestClose,
    discardConfirmOpen,
    confirmDiscardAndClose,
    cancelDiscard,
  } = useDiscardOnClose(onClose, isDirty);

  const handleSubmit = (e) => {
    e.preventDefault();
    const nm = name.trim();
    const pid = profileId ? Number(profileId) : NaN;
    if (!nm || !Number.isFinite(pid) || pid <= 0) return;
    const body = {
      recipe: nm,
      product: nm,
      profile_id: pid,
      base_unit: 'per_meter',
      is_active: statusActive,
      ...(comment.trim() ? { comment: comment.trim() } : { comment: '' }),
    };
    if (!isEdit) {
      body.components = [];
    }
    onSubmit(body);
  };

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
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{isEdit ? 'Редактировать рецепт' : 'Добавить рецепт'}</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        {loading ? (
          <Loading />
        ) : (
          <form onSubmit={handleSubmit}>
            {!isEdit && (!plasticProfiles || plasticProfiles.length === 0) && (
              <p className="modal__error" role="alert">
                Нет ни одного профиля. Создайте профиль в разделе «Профили», затем вернитесь сюда.
              </p>
            )}
            {profileLocked ? (
              <p className="recipe-modal__locked-profile">
                <strong>Профиль:</strong> {lockedSummary}
              </p>
            ) : (
              <>
                <label>Для какого профиля *</label>
                <Select
                  value={profileId === '' || profileId == null ? '' : String(profileId)}
                  onChange={setProfileId}
                  placeholder="Выберите профиль"
                  aria-label="Для какого профиля"
                  options={plasticProfiles.map((p) => ({
                    value: String(p.id),
                    label: p.name || 'Без названия',
                  }))}
                />
              </>
            )}
            <label>Название рецепта *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, белый профиль 60"
            />
            <label>Комментарий</label>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Опционально"
            />
            <label>Статус *</label>
            <Select
              value={statusActive ? 'active' : 'inactive'}
              onChange={(v) => setStatusActive(v === 'active')}
              options={[
                { value: 'active', label: 'активен' },
                { value: 'inactive', label: 'неактивен' },
              ]}
            />
            {error && <p className="modal__error">{error}</p>}
            <div className="modal__actions">
              <button type="button" className="btn btn--secondary" onClick={requestClose}>
                <FiX aria-hidden size={16} strokeWidth={2} />
                Отмена
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={!canSubmit || (!isEdit && (!plasticProfiles || plasticProfiles.length === 0))}
                title={!canSubmit ? 'Укажите профиль и название' : undefined}
              >
                <FiCheck aria-hidden size={16} strokeWidth={2} />
                {isEdit ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const RecipeCompositionModal = ({ recipeId, recipeName, onClose, onSaved, error, onError }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [chemistryElements, setChemistryElements] = useState([]);
  const [reworkStockBatches, setReworkStockBatches] = useState([]);
  const [components, setComponents] = useState([]);
  const unifiedPickRef = useRef(null);
  const [unifiedPick, setUnifiedPick] = useState('');
  const [quantity, setQuantity] = useState('');
  const [lineError, setLineError] = useState('');

  const reworkBatchOptionLabel = (b) => {
    const prod = reworkBatchProductLabel(b) || 'Без названия';
    const avail = b.available_quantity;
    const availPart = avail != null && avail !== '' ? ` · свободно ${formatQuantityDisplay(avail)}` : '';
    return `Переделанные: ${prod}${availPart}`;
  };

  const unifiedOptions = useMemo(() => {
    const raw = rawMaterials.map((i) => ({
      value: `raw:${i.id}`,
      label: `Сырьё: ${i.name || 'Без названия'}`,
    }));
    const chem = chemistryElements.map((i) => ({
      value: `chem:${i.id}`,
      label: `Химия: ${i.name || 'Без названия'}`,
    }));
    const rw = reworkStockBatches.map((b) => ({
      value: `rework:${b.id}`,
      label: reworkBatchOptionLabel(b),
    }));
    return [...raw, ...chem, ...rw].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  }, [rawMaterials, chemistryElements, reworkStockBatches]);

  const qtyValidForAdd = useMemo(() => {
    const q = parseLocaleNumber(quantity);
    return Number.isFinite(q) && q > 0;
  }, [quantity]);

  useEffect(() => {
    apiClient.get('raw-materials/', { params: { page_size: 500 } })
      .then((res) => setRawMaterials(parseApiListResponse(res.data)))
      .catch(() => setRawMaterials([]));
    apiClient.get('chemistry/elements/', { params: { page_size: 500 } })
      .then((res) => setChemistryElements(parseApiListResponse(res.data)))
      .catch(() => setChemistryElements([]));
    apiClient.get('warehouse/batches/', { params: { stock_bucket: 'reworked', page_size: 500 } })
      .then((res) => setReworkStockBatches(parseApiListResponse(res.data)))
      .catch(() => setReworkStockBatches([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRecipe(recipeId)
      .then((res) => {
        if (cancelled) return;
        const comp = res.data?.components || res.data?.composition || [];
        setComponents(Array.isArray(comp) ? comp.map((c) => {
          const type = mapApiComponentType(c);
          const id = type === TYPE_RAW
            ? (c.material_id ?? c.raw_material_id)
            : type === TYPE_CHEMISTRY
              ? (c.chemistry_id ?? c.element_id)
              : (c.rework_warehouse_batch_id ?? c.warehouse_batch_id);
          const q = parseLocaleNumber(componentQtyPerMeter(c));
          return {
            type,
            id,
            name:
              c.material_name
              || c.element_name
              || c.name
              || c.batch_display
              || c.warehouse_batch_display
              || c.rework_batch_display
              || '—',
            quantity: Number.isFinite(q) ? q : '',
          };
        }) : []);
      })
      .catch(() => {
        if (!cancelled) setComponents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [recipeId]);

  useEffect(() => {
    if (!rawMaterials.length) return;
    setComponents((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((c) => {
        if (c.type !== TYPE_RAW || (c.name && c.name !== '—')) return c;
        const found = rawMaterials.find((i) => String(i.id) === String(c.id));
        return { ...c, name: found?.name || c.name || '—' };
      });
    });
  }, [rawMaterials]);

  useEffect(() => {
    if (!chemistryElements.length) return;
    setComponents((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((c) => {
        if (c.type !== TYPE_CHEMISTRY || (c.name && c.name !== '—')) return c;
        const found = chemistryElements.find((i) => String(i.id) === String(c.id));
        return { ...c, name: found?.name || c.name || '—' };
      });
    });
  }, [chemistryElements]);

  useEffect(() => {
    if (!reworkStockBatches.length) return;
    setComponents((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((c) => {
        if (c.type !== TYPE_REWORKED || (c.name && c.name !== '—')) return c;
        const found = reworkStockBatches.find((i) => String(i.id) === String(c.id));
        const lbl = reworkBatchProductLabel(found);
        return { ...c, name: lbl || c.name || '—' };
      });
    });
  }, [reworkStockBatches]);

  const focusComponentPick = useCallback(() => {
    queueMicrotask(() => {
      const el = unifiedPickRef.current?.querySelector('button');
      el?.focus();
    });
  }, []);

  const addComponent = () => {
    setLineError('');
    const q = parseLocaleNumber(quantity);
    if (!unifiedPick || !String(unifiedPick).includes(':')) {
      setLineError('Выберите компонент из списка.');
      return;
    }
    if (!Number.isFinite(q) || q <= 0) {
      setLineError('Укажите норму на 1 м (кг/м) больше 0.');
      return;
    }
    const [kind, idStr] = String(unifiedPick).split(':');
    const id = Number(idStr);
    if (!Number.isFinite(id)) return;
    const type = kind === 'chem'
      ? TYPE_CHEMISTRY
      : kind === 'rework'
        ? TYPE_REWORKED
        : TYPE_RAW;
    const dup = components.some((c) => c.type === type && Number(c.id) === id);
    if (dup) {
      setLineError('Этот компонент уже в составе.');
      return;
    }
    if (kind === 'raw') {
      const item = rawMaterials.find((i) => String(i.id) === String(id));
      setComponents((prev) => [...prev, {
        type: TYPE_RAW,
        id,
        name: item?.name || '—',
        quantity: q,
      }]);
    } else if (kind === 'chem') {
      const item = chemistryElements.find((i) => String(i.id) === String(id));
      setComponents((prev) => [...prev, {
        type: TYPE_CHEMISTRY,
        id,
        name: item?.name || '—',
        quantity: q,
      }]);
    } else if (kind === 'rework') {
      const item = reworkStockBatches.find((i) => String(i.id) === String(id));
      setComponents((prev) => [...prev, {
        type: TYPE_REWORKED,
        id,
        name: reworkBatchProductLabel(item) || '—',
        quantity: q,
      }]);
    } else {
      setLineError('Выберите компонент из списка.');
      return;
    }
    setQuantity('');
    setUnifiedPick('');
    focusComponentPick();
  };

  const removeComponent = (idx) => {
    setComponents((prev) => prev.filter((_, i) => i !== idx));
  };

  const setRowQty = (idx, val) => {
    setComponents((prev) => prev.map((c, i) => {
      if (i !== idx) return c;
      return { ...c, quantity: val };
    }));
  };

  const handleSave = async () => {
    onError('');
    const lines = components
      .map((c) => ({ ...c, quantityNumber: parseLocaleNumber(c.quantity) }))
      .filter((c) => Number.isFinite(c.quantityNumber) && c.quantityNumber >= 0);
    if (lines.length === 0) {
      onError('Добавьте хотя бы одну строку с нормой на 1 м.');
      return;
    }
    setSaving(true);
    try {
      await updateRecipe(recipeId, {
        base_unit: 'per_meter',
        components: lines.map((c) => {
          if (c.type === TYPE_REWORKED) {
            return {
              type: 'rework_stock',
              rework_warehouse_batch_id: c.id,
              quantity_per_meter: c.quantityNumber,
              unit: 'кг',
            };
          }
          const apiType = c.type === TYPE_CHEMISTRY ? 'chemistry' : 'raw_material';
          const comp = {
            type: apiType,
            quantity_per_meter: c.quantityNumber,
            unit: 'кг',
          };
          if (c.type === TYPE_RAW) comp.material_id = c.id;
          if (c.type === TYPE_CHEMISTRY) comp.chemistry_id = c.id;
          return comp;
        }),
      });
      onSaved();
    } catch (err) {
      onError(err.response?.data?.error || err.response?.data?.details || 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  const formSnap = useMemo(() => ({
    components: components.map((c) => ({ t: c.type, id: c.id, q: c.quantity })),
    unifiedPick: unifiedPick || '',
    quantityDraft: String(quantity ?? '').trim(),
  }), [components, unifiedPick, quantity]);

  const isDirty = useDirtyFromBaseline(`comp-${recipeId}`, loading, formSnap);
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
        message="Изменения состава не будут сохранены."
        confirmText="Закрыть"
        onConfirm={confirmDiscardAndClose}
        onCancel={cancelDiscard}
      />
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Состав рецепта: {recipeName || '—'}</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        {loading ? (
          <Loading />
        ) : (
          <div className="modal__body">
            <label>Компонент (сырьё, химия или переделанные) *</label>
            <div className="recipe-modal__row">
              <div className="recipe-modal__pick-wrap" ref={unifiedPickRef}>
                <Select
                  value={unifiedPick === '' || unifiedPick == null ? '' : String(unifiedPick)}
                  onChange={(v) => {
                    setUnifiedPick(v);
                    setLineError('');
                  }}
                  placeholder="Сырьё / Химия / Переделанные…"
                  aria-label="Компонент рецепта"
                  options={unifiedOptions}
                />
              </div>
              <DecimalInput
                min={0}
                placeholder="кг/м"
                value={quantity}
                onChange={(v) => {
                  setQuantity(v);
                  setLineError('');
                }}
                className="recipe-modal__qty"
              />
              <span className="recipe-modal__unit-display" title="Норма на 1 м">кг/м</span>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={addComponent}
                disabled={!unifiedPick || !qtyValidForAdd}
              >
                Добавить компонент
              </button>
            </div>
            {lineError && <p className="modal__error recipe-modal__line-error">{lineError}</p>}

            {components.length > 0 && (
              <div className="recipe-modal__table">
                <div className="recipe-modal__table-header recipe-modal__table-header--cols">
                  <span>Тип</span>
                  <span>Название</span>
                  <span>кг/м</span>
                  <span aria-hidden />
                </div>
                {components.map((c, i) => (
                  <div key={`${c.type}-${c.id}-${i}`} className="recipe-modal__table-row recipe-modal__table-row--cols">
                    <span>
                      {c.type === TYPE_CHEMISTRY ? 'Химия' : c.type === TYPE_REWORKED ? 'Переделанные' : 'Сырьё'}
                    </span>
                    <span className="recipe-modal__comp-name">{c.name}</span>
                    <DecimalInput
                      min={0}
                      className="recipe-modal__qty-inline"
                      value={c.quantity}
                      onChange={(v) => setRowQty(i, v)}
                    />
                    <button type="button" className="btn btn--sm btn--danger" onClick={() => removeComponent(i)} aria-label="Удалить компонент">×</button>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="modal__error">{error}</p>}
            <div className="modal__actions">
              <button type="button" className="btn btn--secondary" onClick={requestClose}>
                <FiX aria-hidden size={16} strokeWidth={2} />
                Отмена
              </button>
              <button type="button" className="btn btn--primary" onClick={handleSave} disabled={saving}>
                <FiCheck aria-hidden size={16} strokeWidth={2} />
                {saving ? 'Сохранение…' : 'Сохранить состав'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const RecipeDetailModal = ({
  recipeId,
  titleFallback,
  profileLabelText,
  onClose,
  onEdit,
  onComposition,
  onAvailability,
}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [chemistryElements, setChemistryElements] = useState([]);
  const [reworkStockBatches, setReworkStockBatches] = useState([]);

  useEffect(() => {
    apiClient.get('raw-materials/', { params: { page_size: 500 } })
      .then((res) => setRawMaterials(parseApiListResponse(res.data)))
      .catch(() => setRawMaterials([]));
    apiClient.get('chemistry/elements/', { params: { page_size: 500 } })
      .then((res) => setChemistryElements(parseApiListResponse(res.data)))
      .catch(() => setChemistryElements([]));
    apiClient.get('warehouse/batches/', { params: { stock_bucket: 'reworked', page_size: 500 } })
      .then((res) => setReworkStockBatches(parseApiListResponse(res.data)))
      .catch(() => setReworkStockBatches([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setData(null);
    getRecipe(recipeId)
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((e) => {
        if (!cancelled) {
          setErr(
            e.response?.data?.error
            || e.response?.data?.detail
            || e.message
            || 'Не удалось загрузить рецепт',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [recipeId]);

  const title = data ? recipeDisplayName(data) : titleFallback;
  const rows = data ? getCompositionRows(data, rawMaterials, chemistryElements, reworkStockBatches) : [];
  const comment = data?.comment ?? data?.note ?? '';
  const profileDisplay = data?.profile?.name || profileLabelText;

  return (
    <div className="modal-overlay modal-overlay--no-dismiss" role="presentation">
      <div className="modal modal--wide recipe-view-modal">
        <div className="modal__head">
          <h3>{title}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="modal__body recipe-view-modal__body">
          {loading && <Loading />}
          {!loading && err && <p className="modal__error">{err}</p>}
          {!loading && !err && (
            <>
              <section className="recipe-view-modal__section">
                <p className="recipe-view-modal__meta"><strong>Профиль:</strong> {profileDisplay}</p>
                {comment ? <p className="recipe-view-modal__meta"><strong>Комментарий:</strong> {comment}</p> : null}
              </section>
              <section className="recipe-view-modal__section">
                <h4 className="recipe-view-modal__section-title">Компоненты (норма на 1 м)</h4>
                {rows.length === 0 ? (
                  <p className="recipe-view-modal__empty">Не задано — откройте «Состав».</p>
                ) : (
                  <div className="recipe-view-modal__grid">
                    <div className="recipe-view-modal__grid-head">
                      <span>Тип</span>
                      <span>Название</span>
                      <span>кг/м</span>
                    </div>
                    {rows.map((row) => (
                      <div key={row.key} className="recipe-view-modal__grid-row">
                        <span>{row.typeLabel}</span>
                        <span>{row.name}</span>
                        <span className="recipe-view-modal__num">
                          {row.hasQty ? `${formatQuantityDisplay(row.quantity)} кг/м` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <div className="recipe-view-modal__actions">
                <button type="button" className="action-row__btn" onClick={onEdit}>Редактировать</button>
                <button type="button" className="action-row__btn" onClick={onComposition}>Состав</button>
                <button type="button" className="action-row__btn" onClick={onAvailability}>Проверка остатков</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const AvailabilityModal = ({ recipeId, title, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setPayload(null);
    getRecipeAvailability(recipeId)
      .then((res) => {
        if (!cancelled) setPayload(res.data);
      })
      .catch((e) => {
        if (!cancelled) {
          setErr(e.response?.data?.error || e.response?.data?.detail || e.message || 'Ошибка запроса');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [recipeId]);

  const { rows, message, ok } = useMemo(() => buildRecipeAvailabilityRows(payload), [payload]);

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Проверка остатков: {title || '—'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="modal__body">
          {loading && <Loading />}
          {!loading && err && <p className="modal__error">{err}</p>}
          {!loading && !err && (
            <>
              {ok === true && (
                <p className="recipe-availability__banner recipe-availability__banner--ok">По данным сервера материалов достаточно.</p>
              )}
              {ok === false && rows.length === 0 && (
                <p className="recipe-availability__banner recipe-availability__banner--bad">Недостаточно материалов на выпуск.</p>
              )}
              {message && (
                <p className="recipe-availability__note">{message}</p>
              )}
              {rows.length > 0 ? (
                <div className="recipe-availability__table-wrap">
                  <table className="recipe-availability__table">
                    <thead>
                      <tr>
                        <th>Компонент</th>
                        <th>Тип</th>
                        <th className="recipe-availability__num">Норма на 1 м</th>
                        <th className="recipe-availability__num">Остаток</th>
                        <th>Хватает</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.key}>
                          <td>{row.name}</td>
                          <td>{row.type}</td>
                          <td className="recipe-availability__num">
                            {formatAvailabilityCell(row.required)}
                            {row.required != null ? ` ${row.unit}` : ''}
                          </td>
                          <td className="recipe-availability__num">{formatAvailabilityCell(row.available)}</td>
                          <td>
                            {row.enough === true && <span className="recipe-availability__pill recipe-availability__pill--ok">Да</span>}
                            {row.enough === false && <span className="recipe-availability__pill recipe-availability__pill--no">Нет</span>}
                            {row.enough == null && <span className="recipe-availability__muted">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : !message && ok == null ? (
                <p className="recipe-availability__empty">Сервер не вернул список компонентов. Обратитесь к администратору или проверьте ответ API.</p>
              ) : null}
            </>
          )}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Закрыть</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipesPage;

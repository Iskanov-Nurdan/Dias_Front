import React, { useState, useEffect } from 'react';
import { useDiscardOnClose, useDirtyFromBaseline } from '../../../../shared/hooks';
import {
  useServerQuery,
  formatNumberForInput,
  formatQuantityDisplay,
  parseLocaleNumber,
  getApiErrorMessage,
  recipeOutputUnitKindRu,
} from '../../../../shared/lib';
import { Loading, EmptyState, ErrorState, ConfirmModal, useToast, DecimalInput, Select, ActionMenu } from '../../../../shared/ui';
import { createRecipe, updateRecipe, deleteRecipe, getRecipe } from '../../api/recipesApi';
import { apiClient } from '../../../../shared/api';
import './RecipesPage.scss';

const resolveComponentName = (c, rawMaterials, chemistryElements) => {
  const name = c.material_name || c.element_name || c.name;
  if (name) return name;
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

const getCompositionItems = (recipe, rawMaterials, chemistryElements) => {
  const comp = recipe.components || recipe.composition || [];
  if (Array.isArray(comp) && comp.length) {
    return comp.map((c, idx) => {
      const name = resolveComponentName(c, rawMaterials, chemistryElements);
      const qty = c.quantity;
      const u = c.unit || 'кг';
      const hasQty = qty != null && qty !== '';
      return {
        key: `${name}-${idx}-${c.material_id ?? c.chemistry_id ?? ''}`,
        name,
        quantity: qty,
        unit: u,
        hasQty,
        isChemistry: c.type === 'chemistry' || (c.chemistry_id != null && c.material_id == null),
      };
    });
  }
  const text = recipe.composition_text;
  if (text && String(text).trim()) {
    return [{ key: 'plain', name: String(text).trim(), hasQty: false, isPlain: true }];
  }
  return [];
};

const formatRecipeYieldStatic = (r) => {
  const q = r?.output_quantity ?? r?.yield_quantity;
  const k = r?.output_unit_kind ?? r?.output_measure;
  if (q == null || q === '') return '—';
  const lab = recipeOutputUnitKindRu(k) || k || '';
  return lab ? `${formatQuantityDisplay(q)} ${lab}` : String(q);
};

const recipeDisplayName = (r) =>
  r.recipe || r.recipe_name || r.name || r.product || r.product_name || '—';

const RecipesPage = () => {
  const toast = useToast();
  const [query, setQuery] = useState({ page: 1, page_size: 20, search: '' });
  const [modalOpen, setModalOpen] = useState(null);
  const [viewRecipeId, setViewRecipeId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const { items: recipes, loading, error, refetch } = useServerQuery(
    'recipes/',
    query,
    { enabled: true }
  );

  const [rawMaterials, setRawMaterials] = useState([]);
  const [chemistryElements, setChemistryElements] = useState([]);

  useEffect(() => {
    apiClient.get('raw-materials/', { params: { page_size: 500 } })
      .then((res) => setRawMaterials(res.data?.items || []))
      .catch(() => setRawMaterials([]));
  }, []);
  useEffect(() => {
    apiClient.get('chemistry/elements/', { params: { page_size: 500 } })
      .then((res) => setChemistryElements(res.data?.items || []))
      .catch(() => setChemistryElements([]));
  }, []);

  const handleSubmit = async (data) => {
    setSubmitError('');
    try {
      if (modalOpen?.id) {
        await updateRecipe(modalOpen.id, data);
      } else {
        await createRecipe(data);
      }
      setModalOpen(null);
      refetch();
      toast.show('Успешно сохранено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || err.response?.data?.details || 'Ошибка');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitError('');
    setDeleteError('');
    try {
      await deleteRecipe(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteError('');
      refetch();
      toast.show('Успешно удалено');
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Ошибка удаления');
      setDeleteError(msg);
      toast.show(msg, 'error');
    }
  };

  const openRecipeView = (e, r) => {
    if (e.target.closest('button') || e.target.closest('.recipes-table__actions')) return;
    setViewRecipeId(r.id);
  };

  return (
    <div className="page page--recipes">
      <div className="recipes-card">
        <div className="recipes-card__head ds-toolbar ds-toolbar--in-card">
          <div className="ds-toolbar__start recipes-card__head-start">
            <input
              type="text"
              className="recipes-card__search"
              placeholder="Поиск"
              value={query.search || ''}
              onChange={(e) => setQuery((p) => ({ ...p, search: e.target.value, page: 1 }))}
            />
          </div>
          <div className="ds-toolbar__end">
            <button type="button" className="btn btn--primary" onClick={() => setModalOpen({})}>
              Создать
            </button>
          </div>
        </div>
        {loading && <Loading />}
        {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
        {!loading && (!error || error.status === 404) && (
          recipes.length === 0 ? (
            <EmptyState title="Нет данных" />
          ) : (
            <div className="recipes-table-wrap">
            <div className="recipes-table">
              <div className="recipes-table__header">
                <span className="recipes-table__th">Рецептура</span>
                <span className="recipes-table__th">Выпуск</span>
                <span className="recipes-table__th recipes-table__th--actions" aria-hidden />
              </div>
              {recipes.map((r) => (
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
                  <span className="recipes-table__name">{recipeDisplayName(r)}</span>
                  <span className="recipes-table__yield">{formatRecipeYieldStatic(r)}</span>
                  <div className="recipes-table__actions" onClick={(e) => e.stopPropagation()}>
                    <ActionMenu
                      ariaLabel="Действия"
                      items={[
                        { label: 'Изменить', onClick: () => setModalOpen(r) },
                        {
                          label: 'Удалить',
                          danger: true,
                          onClick: () => {
                            setDeleteError('');
                            setDeleteTarget({
                              id: r.id,
                              name: r.name || r.recipe || r.recipe_name || r.product,
                            });
                          },
                        },
                      ]}
                    />
                  </div>
                </div>
              ))}
            </div>
            </div>
          )
        )}
      </div>

      {modalOpen !== null && (
        <RecipeModal
          recipe={modalOpen?.id ? modalOpen : null}
          onFetchRecipe={modalOpen?.id ? getRecipe : undefined}
          onSubmit={handleSubmit}
          onClose={() => { setModalOpen(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      {viewRecipeId != null && (
        <RecipeViewModal
          recipeId={viewRecipeId}
          titleFallback={recipeDisplayName(recipes.find((x) => x.id === viewRecipeId) || {})}
          rawMaterials={rawMaterials}
          chemistryElements={chemistryElements}
          onClose={() => setViewRecipeId(null)}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить?"
        message={deleteTarget ? `Удалить "${deleteTarget.name}"?` : ''}
        confirmText="Удалить"
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        error={deleteError}
      />
    </div>
  );
};

const TYPE_RAW = 'raw';
const TYPE_CHEMISTRY = 'chemistry';

const RecipeViewModal = ({
  recipeId,
  titleFallback,
  rawMaterials,
  chemistryElements,
  onClose,
}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

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
            || 'Не удалось загрузить рецепт'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  const title = data ? recipeDisplayName(data) : titleFallback;
  const items = data ? getCompositionItems(data, rawMaterials, chemistryElements) : [];
  const yieldStr = data ? formatRecipeYieldStatic(data) : '—';

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
                <h4 className="recipe-view-modal__section-title">Нормативный выпуск (на партию нормы)</h4>
                <p className="recipe-view-modal__yield">{yieldStr}</p>
              </section>
              <section className="recipe-view-modal__section">
                <h4 className="recipe-view-modal__section-title">Состав</h4>
                {items.length === 0 ? (
                  <p className="recipe-view-modal__empty">Не указан</p>
                ) : (
                  <ul className="recipe-view-modal__list">
                    {items.map((item) => (
                      <li
                        key={item.key}
                        className={`recipe-view-modal__item${item.isPlain ? ' recipe-view-modal__item--plain' : ''}`}
                      >
                        <span className="recipe-view-modal__item-name">
                          {item.name}
                          {item.isChemistry ? (
                            <span className="recipe-view-modal__legacy"> (хим., архив)</span>
                          ) : null}
                        </span>
                        {!item.isPlain && item.hasQty ? (
                          <span className="recipe-view-modal__item-qty">
                            {formatQuantityDisplay(item.quantity)} {item.unit}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/** Варианты поля «Общий выпуск» (output_unit_kind). */
const OUTPUT_UNIT_OPTIONS = [
  { value: 'naming', label: 'Наименование' },
  { value: 'pieces', label: 'Штуки' },
  { value: 'amount', label: 'Количество' },
];

const RecipeModal = ({ recipe, onFetchRecipe, onSubmit, onClose, error }) => {
  const isEdit = !!recipe?.id;
  const [name, setName] = useState('');
  const [components, setComponents] = useState([]);
  const [outputQuantity, setOutputQuantity] = useState('');
  const [outputUnitKind, setOutputUnitKind] = useState('amount');
  const [loading, setLoading] = useState(false);

  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [rawMaterials, setRawMaterials] = useState([]);

  useEffect(() => {
    apiClient.get('raw-materials/', { params: { page_size: 500 } })
      .then((res) => setRawMaterials(res.data?.items || []))
      .catch(() => setRawMaterials([]));
  }, []);

  const normalizeOutputKind = (k) => {
    if (k === 'naming' || k === 'pieces' || k === 'amount') return k;
    const map = { наименование: 'naming', штуки: 'pieces', штук: 'pieces', количество: 'amount' };
    return map[String(k || '').toLowerCase()] || 'amount';
  };

  useEffect(() => {
    const init = (r) => {
      const recipeName = r?.recipe || r?.recipe_name || r?.name || r?.product || r?.product_name || '';
      setName(recipeName);
      const comp = r?.components || r?.composition || [];
      setComponents(Array.isArray(comp) ? comp.map((c) => {
        const hasMat = c.material_id != null || c.raw_material_id != null;
        const hasChem = c.chemistry_id != null || c.element_id != null;
        const type = c.type === TYPE_CHEMISTRY || (hasChem && !hasMat)
          ? TYPE_CHEMISTRY
          : TYPE_RAW;
        const id = type === TYPE_RAW
          ? (c.material_id ?? c.raw_material_id ?? c.id)
          : (c.chemistry_id ?? c.element_id ?? c.id);
        return {
          type,
          id,
          name: c.material_name || c.element_name || c.name || '—',
          quantity: (() => {
            const q = parseLocaleNumber(c.quantity);
            return Number.isFinite(q) ? q : '';
          })(),
          unit: c.unit || 'кг',
        };
      }) : []);
      const oq = r?.output_quantity ?? r?.yield_quantity;
      setOutputQuantity(oq != null && oq !== '' ? formatNumberForInput(oq) : '');
      setOutputUnitKind(normalizeOutputKind(r?.output_unit_kind ?? r?.output_measure));
    };
    if (recipe?.id && onFetchRecipe) {
      setLoading(true);
      onFetchRecipe(recipe.id)
        .then((res) => init(res.data))
        .catch(() => init(recipe))
        .finally(() => setLoading(false));
    } else if (recipe && !recipe.id) {
      init(null);
    } else {
      init(recipe);
    }
  }, [recipe, recipe?.id, onFetchRecipe]);

  const extractUnit = (obj) => {
    const u = obj?.unit ?? obj?.unit_of_measure;
    if (typeof u === 'string') return u;
    if (u && typeof u === 'object') return u.code ?? u.short ?? u.name ?? 'кг';
    return 'кг';
  };

  useEffect(() => {
    if (!rawMaterials.length) return;
    setComponents((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((c) => {
        if (c.type !== TYPE_RAW || (c.name && c.name !== '—')) return c;
        const found = rawMaterials.find((i) => String(i.id) === String(c.id));
        return { ...c, name: found?.name || c.name || '—', unit: found ? extractUnit(found) : c.unit };
      });
    });
  }, [rawMaterials]);

  const selectedItem = selectedId ? rawMaterials.find((i) => String(i.id) === String(selectedId)) : null;
  const displayUnit = selectedItem ? extractUnit(selectedItem) : 'кг';

  const addComponent = () => {
    const id = selectedId === '' || selectedId == null ? null : (Number(selectedId) || selectedId);
    const q = parseLocaleNumber(quantity);
    if (id == null || id === '' || !Number.isFinite(q) || q <= 0) return;
    const item = rawMaterials.find((i) => String(i.id) === String(selectedId) || i.id === id);
    const itemUnit = item ? extractUnit(item) : 'кг';
    setComponents((prev) => [...prev, {
      type: TYPE_RAW,
      id,
      name: item?.name || '—',
      quantity: q,
      unit: itemUnit,
    }]);
    setQuantity('');
  };

  const removeComponent = (idx) => {
    setComponents((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const nm = name.trim();
    const body = {
      recipe: nm,
      product: nm,
      components: components.map((c) => {
        const comp = { type: c.type, quantity: c.quantity, unit: c.unit || 'кг' };
        if (c.type === TYPE_RAW) comp.material_id = c.id;
        if (c.type === TYPE_CHEMISTRY) comp.chemistry_id = c.id;
        return comp;
      }),
    };
    const oqRaw = String(outputQuantity ?? '').trim();
    const oq = oqRaw === '' ? null : parseLocaleNumber(oqRaw);
    if (oqRaw !== '' && Number.isFinite(oq) && oq >= 0) {
      body.output_quantity = oq;
      body.output_unit_kind = outputUnitKind;
      // Алиасы: часть бэкендов пишет только yield_quantity / output_measure (см. чтение в formatRecipeYieldStatic).
      body.yield_quantity = oq;
      body.output_measure = outputUnitKind;
    }
    onSubmit(body);
  };

  const formSnap = {
    name: String(name ?? '').trim(),
    components: components.map((c) => ({
      t: c.type,
      id: c.id,
      q: c.quantity,
      u: c.unit || 'кг',
    })),
    outputQuantity: String(outputQuantity ?? '').trim(),
    outputUnitKind,
    selectedId: selectedId === '' || selectedId == null ? '' : String(selectedId),
    quantityDraft: String(quantity ?? '').trim(),
  };
  const isDirty = useDirtyFromBaseline(recipe?.id ?? 'new', loading, formSnap);
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
        message="Введённые данные не будут сохранены."
        confirmText="Закрыть"
        onConfirm={confirmDiscardAndClose}
        onCancel={cancelDiscard}
      />
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{isEdit ? 'Редактировать' : 'Создать'}</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        {loading ? (
          <Loading />
        ) : (
        <form onSubmit={handleSubmit}>
          <label>Название *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Например, Пленка 80 мкм"
          />
          <label>Состав</label>
          <div className="recipe-modal__row">
            <Select
              value={selectedId === '' || selectedId == null ? '' : String(selectedId)}
              onChange={setSelectedId}
              placeholder="Сырьё со склада"
              aria-label="Сырьё со склада"
              options={rawMaterials.map((i, idx) => ({
                value: String(i.id),
                label: `${i.name} (${extractUnit(i)})`,
              }))}
            />
            <DecimalInput
              min={0}
              placeholder="Кол-во"
              value={quantity}
              onChange={setQuantity}
              className="recipe-modal__qty"
            />
            <span className="recipe-modal__unit-display" title="Ед. изм. из карточки сырья">
              {displayUnit}
            </span>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={addComponent}
              disabled={!selectedId || !quantity}
            >
              Добавить
            </button>
          </div>
          {components.length > 0 && (
            <div className="recipe-modal__table">
              <div className="recipe-modal__table-header recipe-modal__table-header--simple">
                <span>НАИМЕНОВАНИЕ</span>
                <span>КОЛ-ВО</span>
                <span></span>
              </div>
              {components.map((c, i) => (
                <div key={`${c.type}-${c.id}-${i}`} className="recipe-modal__table-row recipe-modal__table-row--simple">
                  <span>
                    {c.name}
                    {c.type === TYPE_CHEMISTRY && (
                      <span className="recipe-modal__legacy-tag"> (хим., архив)</span>
                    )}
                  </span>
                  <span>{formatQuantityDisplay(c.quantity)} {c.unit}</span>
                  <button type="button" className="btn btn--sm btn--danger" onClick={() => removeComponent(i)}>×</button>
                </div>
              ))}
            </div>
          )}
          <label className="recipe-modal__section-label">Общий выпуск</label>
          <div className="recipe-modal__row recipe-modal__row--output">
            <DecimalInput
              min={0}
              placeholder="Сколько делается"
              value={outputQuantity}
              onChange={setOutputQuantity}
              className="recipe-modal__output-qty"
            />
            <Select
              value={outputUnitKind}
              onChange={setOutputUnitKind}
              aria-label="Тип учёта выпуска"
              options={OUTPUT_UNIT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </div>
          <p className="recipe-modal__hint">
            Общий выпуск — норма изделия для расчётов и сопоставления с фактическим выпуском. Габариты (высота, ширина, угол)
            задаются при открытии смены на линии, не в рецепте.
          </p>
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="submit" className="btn btn--primary">{isEdit ? 'Сохранить' : 'Создать'}</button>
            <button type="button" className="btn btn--secondary" onClick={requestClose}>Отмена</button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

export default RecipesPage;

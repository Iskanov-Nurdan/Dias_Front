import React, { useState, useEffect } from 'react';
import { useServerQuery } from '../../../../shared/lib';
import { Loading, EmptyState, ErrorState, ConfirmModal, useToast } from '../../../../shared/ui';
import { createRecipe, updateRecipe, deleteRecipe, getRecipe } from '../../api/recipesApi';
import { apiClient } from '../../../../shared/api';
import './RecipesPage.scss';

const RecipesPage = () => {
  const toast = useToast();
  const [query, setQuery] = useState({ page: 1, page_size: 20, search: '' });
  const [modalOpen, setModalOpen] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
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

  const resolveComponentName = (c) => {
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
    try {
      await deleteRecipe(deleteTarget.id);
      setDeleteTarget(null);
      refetch();
      toast.show('Успешно удалено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка удаления');
    }
  };

  const renderComposition = (recipe) => {
    const comp = recipe.components || recipe.composition || [];
    if (Array.isArray(comp) && comp.length) {
      return comp.map((c) => {
        const name = resolveComponentName(c);
        const qty = c.quantity != null ? c.quantity : '';
        const u = c.unit || 'кг';
        return qty ? `${name} ${qty} ${u}` : name;
      }).join(', ');
    }
    return recipe.composition_text || '—';
  };

  return (
    <div className="page page--recipes">
      <div className="recipes-banner">
        Используйте только подтверждённые хим. элементы.
      </div>
      <div className="recipes-card">
        <div className="recipes-card__head">
          <h2 className="recipes-card__title">Рецепты</h2>
          <div className="recipes-card__actions">
            <input
              type="text"
              className="recipes-card__search"
              placeholder="Поиск..."
              value={query.search || ''}
              onChange={(e) => setQuery((p) => ({ ...p, search: e.target.value, page: 1 }))}
            />
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
            <div className="recipes-table">
              <div className="recipes-table__header">
                <span className="recipes-table__th">РЕЦЕПТ</span>
                <span className="recipes-table__th">СОСТАВ</span>
                <span className="recipes-table__th recipes-table__th--actions">ДЕЙСТВИЯ</span>
              </div>
              {recipes.map((r) => (
                <div key={r.id} className="recipes-table__row">
                  <span className="recipes-table__name">{r.recipe || r.recipe_name || r.name || r.product || r.product_name || '—'}</span>
                  <span className="recipes-table__composition">{renderComposition(r)}</span>
                  <div className="recipes-table__actions">
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => setModalOpen(r)}>
                      Редактировать
                    </button>
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => setDeleteTarget({ id: r.id, name: r.name || r.recipe || r.recipe_name || r.product })}>
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
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

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить?"
        message={deleteTarget ? `Удалить "${deleteTarget.name}"?` : ''}
        confirmText="Удалить"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

const TYPE_RAW = 'raw';
const TYPE_CHEMISTRY = 'chemistry';

const RecipeModal = ({ recipe, onFetchRecipe, onSubmit, onClose, error }) => {
  const isEdit = !!recipe?.id;
  const [name, setName] = useState('');
  const [product, setProduct] = useState('');
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = (r) => {
      const recipeName = r?.recipe || r?.recipe_name || r?.name || '';
      const productName = r?.product || r?.product_name || recipeName || '';
      setName(recipeName);
      setProduct(productName);
      const comp = r?.components || r?.composition || [];
      setComponents(Array.isArray(comp) ? comp.map((c) => ({
        type: c.type || (c.material_id ? TYPE_RAW : TYPE_CHEMISTRY),
        id: c.material_id || c.chemistry_id || c.element_id || c.id,
        name: c.material_name || c.element_name || c.name || '—',
        quantity: c.quantity ?? '',
        unit: c.unit || 'кг',
      })) : []);
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
  const [compType, setCompType] = useState(TYPE_RAW);
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState('');

  const [rawMaterials, setRawMaterials] = useState([]);
  const [chemistryElements, setChemistryElements] = useState([]);

  useEffect(() => {
    apiClient.get('raw-materials/', { params: { page_size: 500 } })
      .then((res) => setRawMaterials(res.data?.items || []))
      .catch(() => setRawMaterials([]));
  }, []);

  useEffect(() => {
    const loadElements = async () => {
      const toItem = (i) => {
        const u = i.unit ?? i.unit_of_measure;
        const unit = typeof u === 'string' ? u : (u?.code ?? u?.short ?? u?.name ?? 'кг');
        return { id: i.id, name: i.name, unit };
      };
      try {
        const r = await apiClient.get('chemistry/elements/', { params: { page_size: 500 } });
        const elements = (r.data?.items || []).map(toItem);
        setChemistryElements(elements);
      } catch (_) {
        setChemistryElements([]);
      }
    };
    loadElements();
  }, []);

  const extractUnit = (obj) => {
    const u = obj?.unit ?? obj?.unit_of_measure;
    if (typeof u === 'string') return u;
    if (u && typeof u === 'object') return u.code ?? u.short ?? u.name ?? 'кг';
    return 'кг';
  };

  const items = compType === TYPE_RAW ? rawMaterials : chemistryElements;

  useEffect(() => {
    if (!rawMaterials.length && !chemistryElements.length) return;
    setComponents((prev) => {
      if (prev.length === 0) return prev;
      const needsEnrich = prev.some((c) => !c.name || c.name === '—');
      if (!needsEnrich) return prev;
      return prev.map((c) => {
        if (c.name && c.name !== '—') return c;
        const list = c.type === TYPE_RAW ? rawMaterials : chemistryElements;
        const found = list.find((i) => String(i.id) === String(c.id));
        return { ...c, name: found?.name || c.name || '—' };
      });
    });
  }, [rawMaterials, chemistryElements]);

  const selectedItem = selectedId ? items.find((i) => String(i.id) === String(selectedId)) : null;
  const displayUnit = selectedItem ? extractUnit(selectedItem) : 'кг';

  const addComponent = () => {
    const id = selectedId === '' || selectedId == null ? null : (Number(selectedId) || selectedId);
    if (id == null || id === '' || quantity === '' || quantity == null) return;
    const item = items.find((i) => String(i.id) === String(selectedId) || i.id === id);
    const itemUnit = item ? extractUnit(item) : 'кг';
    setComponents((prev) => [...prev, {
      type: compType,
      id,
      name: item?.name || '—',
      quantity: Number(quantity),
      unit: itemUnit,
    }]);
    setQuantity('');
  };

  const removeComponent = (idx) => {
    setComponents((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const body = {
      recipe: name,
      product: product || name,
      components: components.map((c) => {
        const comp = { type: c.type, quantity: c.quantity, unit: c.unit || 'кг' };
        if (c.type === TYPE_RAW) comp.material_id = c.id;
        if (c.type === TYPE_CHEMISTRY) comp.chemistry_id = c.id;
        return comp;
      }),
    };
    onSubmit(body);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{isEdit ? 'Редактировать' : 'Создать'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        {loading ? (
          <Loading />
        ) : (
        <form onSubmit={handleSubmit}>
          <label>Рецепт (название) *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Пленка 80 мкм"
          />
          <label>Продукт (название) *</label>
          <input
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            required
            placeholder="Пленка ПВД 80"
          />
          <label>Состав</label>
          <div className="recipe-modal__row">
            <select value={compType} onChange={(e) => { setCompType(e.target.value); setSelectedId(''); }}>
              <option value={TYPE_RAW}>Сырьё (из Склада сырья)</option>
              <option value={TYPE_CHEMISTRY}>Хим. элемент (из остатков)</option>
            </select>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">— Выберите —</option>
              {items.map((i, idx) => (
                <option key={`opt-${compType}-${idx}`} value={i.id}>{i.name} ({extractUnit(i)})</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="Кол-во"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="recipe-modal__qty"
            />
            <span className="recipe-modal__unit-display" title="ед. изм. берётся из выбранного элемента">
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
              <div className="recipe-modal__table-header">
                <span>ТИП</span>
                <span>НАИМЕНОВАНИЕ</span>
                <span>КОЛ-ВО</span>
                <span></span>
              </div>
              {components.map((c, i) => (
                <div key={c.id ?? c.raw_material_id ?? `comp-${c.name}-${i}`} className="recipe-modal__table-row">
                  <span>{c.type === TYPE_RAW ? 'Сырьё' : 'Хим. элемент'}</span>
                  <span>{c.name}</span>
                  <span>{c.quantity} {c.unit}</span>
                  <button type="button" className="btn btn--sm btn--danger" onClick={() => removeComponent(i)}>×</button>
                </div>
              ))}
            </div>
          )}
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="submit" className="btn btn--primary">{isEdit ? 'Сохранить' : 'Создать'}</button>
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

export default RecipesPage;

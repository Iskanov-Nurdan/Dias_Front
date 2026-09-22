import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package, History, Search, PackagePlus, SlidersHorizontal, Plus,
} from 'lucide-react';
import {
  fetchBalances,
  createRawMaterial,
  updateRawMaterial,
  deleteRawMaterial,
  createIncoming,
  fetchMovements,
} from './api';
import { useToast } from '../../app/providers/ToastProvider';
import { useDebounce } from '../../shared/hooks/useDebounce';
import { useProductLine, PRODUCT_LINE } from '../../shared/hooks/useProductLine';
import { getApiErrorMessage } from '../../shared/lib/apiError';
import {
  Pagination, Select, DateSelect, ProductLineTabs, FiltersModal, Fab, Subtabs,
} from '../../shared/ui';
import { MaterialsCatalogList, MaterialsMovementsList, MaterialFormModal, ReplenishModal } from './components';
import { FoamMaterialsTab } from '../foam/components';
import './MaterialsPage.scss';

const TAB_CATALOG = 'catalog';
const TAB_MOVEMENTS = 'movements';

const TABS = [
  { id: TAB_CATALOG, label: 'Справочник', icon: Package },
  { id: TAB_MOVEMENTS, label: 'История движения', icon: History },
];

const normalize = (s) => (s || '').trim().toLowerCase();

const pad2 = (n) => String(n).padStart(2, '0');
const isoCurrentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};
const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

/**
 * DateSelect отдаёт 'YYYY-MM' (день не выбран — значит весь месяц) или
 * 'YYYY-MM-DD' (конкретный день). Переводим в диапазон occurred_at_after/before,
 * который уже понимает бэкенд.
 */
const dateFilterToRange = (value) => {
  if (!value) return { dateFrom: undefined, dateTo: undefined };
  const parts = value.split('-').map(Number);
  const [year, month, day] = parts;
  if (day) return { dateFrom: value, dateTo: value };
  const last = daysInMonth(year, month);
  return { dateFrom: `${year}-${pad2(month)}-01`, dateTo: `${year}-${pad2(month)}-${pad2(last)}` };
};

const MaterialsPage = () => {
  const toast = useToast();
  const [line, setLine] = useProductLine();
  const [activeTab, setActiveTab] = useState(TAB_CATALOG);

  // ── Справочник (каталог небольшой и растёт медленно — фильтруем на клиенте) ──
  const [balances, setBalances] = useState([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesError, setBalancesError] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput);

  const loadBalances = useCallback(() => {
    setBalancesLoading(true);
    setBalancesError(null);
    fetchBalances(null)
      .then((data) => setBalances(data?.items ?? []))
      .catch((err) => setBalancesError(getApiErrorMessage(err)))
      .finally(() => setBalancesLoading(false));
  }, []);

  useEffect(() => { loadBalances(); }, [loadBalances]);

  const balancesFiltered = useMemo(() => {
    const q = normalize(debouncedSearch);
    if (!q) return balances;
    return balances.filter((b) => normalize(b.name).includes(q));
  }, [balances, debouncedSearch]);

  const lowStockCount = useMemo(
    () => balances.filter((b) => b.min_balance != null && Number(b.balance) <= Number(b.min_balance)).length,
    [balances],
  );

  // ── История движения (журнал растёт без остановки — настоящая серверная пагинация) ──
  const [movementsPage, setMovementsPage] = useState(1);
  const [movements, setMovements] = useState(null);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsError, setMovementsError] = useState(null);
  const [movementsMaterialId, setMovementsMaterialId] = useState('');
  const [movementsDirection, setMovementsDirection] = useState('');
  // По умолчанию — текущие год и месяц, день не выбран (весь месяц).
  const [movementsDate, setMovementsDate] = useState(isoCurrentMonth);

  const loadMovements = useCallback(() => {
    setMovementsLoading(true);
    setMovementsError(null);
    const { dateFrom, dateTo } = dateFilterToRange(movementsDate);
    fetchMovements({
      page: movementsPage,
      pageSize: 20,
      materialId: movementsMaterialId || undefined,
      direction: movementsDirection || undefined,
      dateFrom,
      dateTo,
    })
      .then((data) => setMovements(data))
      .catch((err) => setMovementsError(getApiErrorMessage(err)))
      .finally(() => setMovementsLoading(false));
  }, [movementsPage, movementsMaterialId, movementsDirection, movementsDate]);

  useEffect(() => {
    if (activeTab === TAB_MOVEMENTS) loadMovements();
  }, [activeTab, loadMovements]);

  // Смена фильтра сбрасывает на первую страницу — иначе можно застрять на
  // странице 7 из 2 после того, как фильтр сильно сузил выборку.
  const resetMovementsPageAnd = (setter) => (value) => {
    setMovementsPage(1);
    setter(value);
  };

  const movementsMaterialOptions = useMemo(
    () => [{ value: '', label: 'Всё сырьё' }, ...balances.map((b) => ({ value: String(b.material_id ?? b.id), label: b.name }))],
    [balances],
  );

  // ── Модалки ──
  const [formMaterial, setFormMaterial] = useState(null); // {} для создания, объект — для редактирования
  const [formError, setFormError] = useState(null);
  const [formSaving, setFormSaving] = useState(false);
  const [replenishTarget, setReplenishTarget] = useState(null); // null-закрыто, {} — выбор сырья, объект — фиксировано
  const [replenishOpen, setReplenishOpen] = useState(false);
  const [replenishError, setReplenishError] = useState(null);
  const [replenishSaving, setReplenishSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [movementsFiltersOpen, setMovementsFiltersOpen] = useState(false);
  const movementsFiltersActive = !!movementsMaterialId || !!movementsDirection;

  const handleSaveMaterial = async (payload) => {
    setFormError(null);
    setFormSaving(true);
    try {
      if (formMaterial?.id) {
        await updateRawMaterial(formMaterial.id, payload, null);
        toast.success('Сырьё обновлено');
      } else {
        await createRawMaterial(payload, null);
        toast.success('Сырьё добавлено');
      }
      setFormMaterial(null);
      loadBalances();
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setFormError(msg);
      toast.error(msg);
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    deleteRawMaterial(confirmDelete.material_id ?? confirmDelete.id, null)
      .then(() => {
        setConfirmDelete(null);
        loadBalances();
        toast.success('Сырьё удалено');
      })
      .catch((err) => {
        toast.error(getApiErrorMessage(err));
        setConfirmDelete(null);
      });
  };

  const openReplenish = (material) => {
    setReplenishTarget(material ?? null); // null = выбор сырья из списка
    setReplenishOpen(true);
    setReplenishError(null);
  };

  const handleSaveReplenish = async (body) => {
    setReplenishError(null);
    setReplenishSaving(true);
    try {
      await createIncoming(body, null);
      setReplenishOpen(false);
      setReplenishTarget(null);
      loadBalances();
      toast.success('Приход оформлен');
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setReplenishError(msg);
      toast.error(msg);
    } finally {
      setReplenishSaving(false);
    }
  };

  if (line === PRODUCT_LINE.FOAM) {
    return (
      <div className="materials-page">
        <ProductLineTabs value={line} onChange={setLine} />
        <FoamMaterialsTab />
      </div>
    );
  }

  return (
    <div className="materials-page">
      <ProductLineTabs value={line} onChange={setLine} />
      <Subtabs items={TABS} activeId={activeTab} onChange={setActiveTab} />

      {activeTab === TAB_CATALOG && (
        <>
          <div className="materials-page__toolbar">
            <div className="ui-search materials-page__search">
              <Search size={16} className="ui-search__icon" />
              <input
                type="text"
                placeholder="Поиск по названию"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="ui-search__input"
              />
            </div>
            {lowStockCount > 0 && (
              <span className="materials-page__low-stock-pill">
                <span className="materials-page__low-stock-dot" />
                Ниже минимума: {lowStockCount}
              </span>
            )}
            <div className="materials-page__toolbar-actions">
              <button type="button" className="materials-page__replenish-btn" onClick={() => openReplenish(null)}>
                <PackagePlus size={16} /> Приход
              </button>
              <button type="button" className="materials-page__add" onClick={() => setFormMaterial({})}>
                <Plus size={16} /> Добавить сырьё
              </button>
            </div>
          </div>

          <MaterialsCatalogList
            items={balancesFiltered}
            loading={balancesLoading}
            error={balancesError}
            onRetry={loadBalances}
            onEdit={setFormMaterial}
            onDelete={setConfirmDelete}
            onReplenish={openReplenish}
            confirmDelete={confirmDelete}
            onConfirmDelete={handleDelete}
            onCancelDelete={() => setConfirmDelete(null)}
            emptyStateActionLabel="Добавить сырьё"
            emptyStateOnAction={() => setFormMaterial({})}
          />
        </>
      )}

      {activeTab === TAB_MOVEMENTS && (
        <>
          <div className="materials-page__toolbar materials-page__toolbar--movements">
            <div className="materials-page__movements-filters-desktop">
              <Select
                value={movementsMaterialId}
                onChange={resetMovementsPageAnd(setMovementsMaterialId)}
                options={movementsMaterialOptions}
                placeholder="Всё сырьё"
                className="materials-page__filter-select"
              />
              <Select
                value={movementsDirection}
                onChange={resetMovementsPageAnd(setMovementsDirection)}
                options={[
                  { value: '', label: 'Приход и расход' },
                  { value: 'in', label: 'Только приход' },
                  { value: 'out', label: 'Только расход' },
                ]}
                className="materials-page__filter-select"
              />
              <DateSelect value={movementsDate} onChange={resetMovementsPageAnd(setMovementsDate)} yearsBack={0} />
            </div>
            <button
              type="button"
              className="materials-page__movements-filter-btn"
              onClick={() => setMovementsFiltersOpen(true)}
            >
              <SlidersHorizontal size={16} />
              Фильтры
              {movementsFiltersActive && <span className="materials-page__filter-dot" aria-hidden />}
            </button>
          </div>

          <FiltersModal
            open={movementsFiltersOpen}
            onClose={() => setMovementsFiltersOpen(false)}
            title="Фильтры"
            footer={(
              <>
                <button
                  type="button"
                  className="filters-modal__reset-btn"
                  onClick={() => { setMovementsMaterialId(''); setMovementsDirection(''); setMovementsPage(1); }}
                >
                  Сброс
                </button>
                <button type="button" className="filters-modal__apply-btn" onClick={() => setMovementsFiltersOpen(false)}>
                  Применить
                </button>
              </>
            )}
          >
            <div className="materials-page__filters-modal-content">
              <label className="materials-page__filter-label">
                <span>Сырьё</span>
                <Select
                  value={movementsMaterialId}
                  onChange={resetMovementsPageAnd(setMovementsMaterialId)}
                  options={movementsMaterialOptions}
                  placeholder="Всё сырьё"
                  className="materials-page__filter-select"
                />
              </label>
              <label className="materials-page__filter-label">
                <span>Направление</span>
                <Select
                  value={movementsDirection}
                  onChange={resetMovementsPageAnd(setMovementsDirection)}
                  options={[
                    { value: '', label: 'Приход и расход' },
                    { value: 'in', label: 'Только приход' },
                    { value: 'out', label: 'Только расход' },
                  ]}
                  className="materials-page__filter-select"
                />
              </label>
              <label className="materials-page__filter-label">
                <span>Период</span>
                <DateSelect value={movementsDate} onChange={resetMovementsPageAnd(setMovementsDate)} yearsBack={0} />
              </label>
            </div>
          </FiltersModal>

          <MaterialsMovementsList
            items={movements?.items}
            loading={movementsLoading}
            error={movementsError}
            onRetry={loadMovements}
          />
          <Pagination
            meta={movements?.meta}
            currentPage={movementsPage}
            onPage={setMovementsPage}
            loading={movementsLoading}
            entityLabel="записей"
          />
        </>
      )}

      {formMaterial && (
        <MaterialFormModal
          material={formMaterial}
          onSave={handleSaveMaterial}
          onClose={() => { setFormMaterial(null); setFormError(null); }}
          error={formError}
          saving={formSaving}
        />
      )}

      {replenishOpen && (
        <ReplenishModal
          material={replenishTarget}
          onSave={handleSaveReplenish}
          onClose={() => { setReplenishOpen(false); setReplenishTarget(null); setReplenishError(null); }}
          error={replenishError}
          saving={replenishSaving}
        />
      )}

      {activeTab === TAB_CATALOG && (
        <Fab onClick={() => setFormMaterial({})} label="Добавить сырьё" />
      )}
    </div>
  );
};

export default MaterialsPage;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchCategories,
  fetchProducts,
  fetchRestocks,
  createCategory,
  updateCategory,
  deleteCategory,
  createProduct,
  updateProduct,
  deleteProduct,
  restockProduct,
} from './api';
import { CategoryFormModal, ProductFormModal } from './components';
import RestockModal from './components/RestockModal';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { ErrorState, EmptyState, ConfirmModal, Select, Pagination, FiltersModal, Skeleton, FilterBar } from '../../shared/ui';
import { formatMoney } from '../../shared/constants/common';
import './WarehousePage.scss';

const TAB_PRODUCTS = 'products';
const TAB_CATEGORIES = 'categories';
const TAB_HISTORY = 'history';

const WarehousePage = () => {
  const { isAdmin, showAccessDenied } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(TAB_PRODUCTS);
  const [queryState, setQueryState] = useState({ search: '', categoryId: '', page: 1, perPage: 20 });
  const [categorySearch, setCategorySearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [productsData, setProductsData] = useState(null);
  const [categoriesData, setCategoriesData] = useState([]);
  const [restocksData, setRestocksData] = useState(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [restocksLoading, setRestocksLoading] = useState(false);
  const [productsError, setProductsError] = useState(null);
  const [categoriesError, setCategoriesError] = useState(null);
  const [restocksError, setRestocksError] = useState(null);
  const [formCategory, setFormCategory] = useState(null);
  const [formProduct, setFormProduct] = useState(null);
  const [restockProductItem, setRestockProductItem] = useState(null);
  const [categoryFormError, setCategoryFormError] = useState(null);
  const [categoryFormSaving, setCategoryFormSaving] = useState(false);
  const [productFormError, setProductFormError] = useState(null);
  const [productFormSaving, setProductFormSaving] = useState(false);
  const [restockFormError, setRestockFormError] = useState(null);
  const [restockFormSaving, setRestockFormSaving] = useState(false);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState(null);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState(null);
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const productsControllerRef = useRef(null);
  const categoriesControllerRef = useRef(null);
  const restocksControllerRef = useRef(null);
  const lastProductsRequestId = useRef(0);
  const lastCategoriesRequestId = useRef(0);
  const lastRestocksRequestId = useRef(0);

  const fetchProductsSafe = useCallback(async () => {
    productsControllerRef.current?.abort();
    productsControllerRef.current = new AbortController();
    const rid = ++lastProductsRequestId.current;
    setProductsLoading(true);
    setProductsError(null);
    try {
      const data = await fetchProducts(queryState, productsControllerRef.current.signal);
      if (rid !== lastProductsRequestId.current) return;
      setProductsData(data);
    } catch (err) {
      if (rid !== lastProductsRequestId.current || err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setProductsError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка');
    } finally {
      if (rid === lastProductsRequestId.current) setProductsLoading(false);
    }
  }, [queryState]);

  const fetchCategoriesSafe = useCallback(async () => {
    categoriesControllerRef.current?.abort();
    categoriesControllerRef.current = new AbortController();
    const rid = ++lastCategoriesRequestId.current;
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const data = await fetchCategories({ search: categorySearch || undefined }, categoriesControllerRef.current.signal);
      if (rid !== lastCategoriesRequestId.current) return;
      setCategoriesData(Array.isArray(data) ? data : data?.results ?? data?.items ?? []);
    } catch (err) {
      if (rid !== lastCategoriesRequestId.current || err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setCategoriesError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка');
    } finally {
      if (rid === lastCategoriesRequestId.current) setCategoriesLoading(false);
    }
  }, [categorySearch]);

  const fetchRestocksSafe = useCallback(async () => {
    restocksControllerRef.current?.abort();
    restocksControllerRef.current = new AbortController();
    const rid = ++lastRestocksRequestId.current;
    setRestocksLoading(true);
    setRestocksError(null);
    try {
      const data = await fetchRestocks({ page: 1, perPage: 50, search: historySearch || undefined }, restocksControllerRef.current.signal);
      if (rid !== lastRestocksRequestId.current) return;
      setRestocksData(data);
    } catch (err) {
      if (rid !== lastRestocksRequestId.current || err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setRestocksError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка');
    } finally {
      if (rid === lastRestocksRequestId.current) setRestocksLoading(false);
    }
  }, [historySearch]);

  useEffect(() => {
    if (activeTab === TAB_PRODUCTS) fetchProductsSafe();
    return () => productsControllerRef.current?.abort();
  }, [activeTab, fetchProductsSafe]);

  useEffect(() => {
    if (activeTab === TAB_CATEGORIES) fetchCategoriesSafe();
    return () => categoriesControllerRef.current?.abort();
  }, [activeTab, fetchCategoriesSafe]);

  useEffect(() => {
    fetchCategoriesSafe();
  }, [fetchCategoriesSafe]);

  useEffect(() => {
    if (activeTab === TAB_HISTORY) fetchRestocksSafe();
    return () => restocksControllerRef.current?.abort();
  }, [activeTab, fetchRestocksSafe]);

  const productsItems = productsData?.items ?? productsData?.results ?? [];
  const categoriesList = Array.isArray(categoriesData) ? categoriesData : [];
  const restocksItems = restocksData?.items ?? restocksData?.results ?? [];

  const handleSaveCategory = async (payload) => {
    setCategoryFormError(null);
    setCategoryFormSaving(true);
    try {
      if (formCategory?.id) await updateCategory(formCategory.id, payload, null);
      else await createCategory(payload, null);
      setFormCategory(null);
      fetchCategoriesSafe();
      if (activeTab === TAB_PRODUCTS) fetchProductsSafe();
    } catch (e) {
      const d = e.response?.data;
      setCategoryFormError(d?.error?.message ?? d?.message ?? d?.detail ?? 'Ошибка сохранения');
    } finally {
      setCategoryFormSaving(false);
    }
  };

  const handleSaveProduct = async (payload) => {
    setProductFormError(null);
    setProductFormSaving(true);
    try {
      if (formProduct?.id) await updateProduct(formProduct.id, payload, null);
      else await createProduct(payload, null);
      setFormProduct(null);
      fetchProductsSafe();
    } catch (e) {
      const d = e.response?.data;
      setProductFormError(d?.error?.message ?? d?.message ?? d?.detail ?? 'Ошибка сохранения');
    } finally {
      setProductFormSaving(false);
    }
  };

  const handleRestock = async (payload) => {
    if (!restockProductItem?.id) return;
    setRestockFormError(null);
    setRestockFormSaving(true);
    try {
      await restockProduct(restockProductItem.id, payload, null);
      setRestockProductItem(null);
      fetchProductsSafe();
      fetchRestocksSafe();
    } catch (e) {
      const d = e.response?.data;
      setRestockFormError(d?.error?.message ?? d?.message ?? d?.detail ?? 'Ошибка');
    } finally {
      setRestockFormSaving(false);
    }
  };

  const handleDeleteProduct = () => {
    if (!confirmDeleteProduct?.id) return;
    setProductsError(null);
    deleteProduct(confirmDeleteProduct.id, null)
      .then(() => {
        setConfirmDeleteProduct(null);
        fetchProductsSafe();
        toast.success('Товар удалён');
      })
      .catch((e) => {
        const msg = e?.userMessage ?? (e.response?.data?.error?.message || e.response?.data?.message || e.response?.data?.detail || e.message || 'Ошибка удаления');
        setProductsError(msg);
        setConfirmDeleteProduct(null);
        toast.error(msg);
      });
  };

  const handleDeleteCategory = () => {
    if (!confirmDeleteCategory?.id) return;
    setCategoriesError(null);
    deleteCategory(confirmDeleteCategory.id, null)
      .then(() => {
        setConfirmDeleteCategory(null);
        fetchCategoriesSafe();
        if (activeTab === TAB_PRODUCTS) fetchProductsSafe();
        toast.success('Категория удалена');
      })
      .catch((e) => {
        const msg = e?.userMessage ?? (e.response?.data?.error?.message || e.response?.data?.message || e.response?.data?.detail || e.message || 'Ошибка удаления');
        setCategoriesError(msg);
        setConfirmDeleteCategory(null);
        toast.error(msg);
      });
  };

  return (
    <div className="warehouse-page">
      <h1 className="warehouse-page__title">Склад</h1>
      <div className="warehouse-page__tabs">
        <button type="button" className={`warehouse-page__tab ${activeTab === TAB_PRODUCTS ? 'warehouse-page__tab--active' : ''}`} onClick={() => setActiveTab(TAB_PRODUCTS)}>Товары</button>
        <button type="button" className={`warehouse-page__tab ${activeTab === TAB_CATEGORIES ? 'warehouse-page__tab--active' : ''}`} onClick={() => setActiveTab(TAB_CATEGORIES)}>Категории</button>
        <button type="button" className={`warehouse-page__tab ${activeTab === TAB_HISTORY ? 'warehouse-page__tab--active' : ''}`} onClick={() => setActiveTab(TAB_HISTORY)}>История</button>
      </div>
      {activeTab === TAB_PRODUCTS && (
        <>
          <FilterBar className="warehouse-page__filter-bar">
            <div className="warehouse-page__filters warehouse-page__filters--desktop">
              <input type="text" placeholder="Поиск" value={queryState.search} onChange={(e) => setQueryState((q) => ({ ...q, search: e.target.value, page: 1 }))} className="warehouse-page__search" />
              <Select
                value={queryState.categoryId}
                onChange={(v) => setQueryState((q) => ({ ...q, categoryId: v, page: 1 }))}
                options={[{ value: '', label: 'Все категории' }, ...categoriesList.map((c) => ({ value: String(c.id), label: c.name || '' }))]}
                placeholder="Все категории"
                className="warehouse-page__select-wrap"
              />
              <button type="button" className="warehouse-page__add filter-bar__action" onClick={() => setFormProduct({})}>Добавить товар</button>
            </div>
            <div className="warehouse-page__toolbar-mobile">
              <input type="text" placeholder="Поиск" value={queryState.search} onChange={(e) => setQueryState((q) => ({ ...q, search: e.target.value, page: 1 }))} className="warehouse-page__search warehouse-page__search--mobile" />
              <div className="warehouse-page__toolbar-mobile-actions">
                <button type="button" className="warehouse-page__filters-btn" onClick={() => setFiltersModalOpen(true)}>Фильтры</button>
                <button type="button" className="warehouse-page__add warehouse-page__add--mobile filter-bar__action" onClick={() => setFormProduct({})}>Добавить товар</button>
              </div>
            </div>
          </FilterBar>
          <FiltersModal open={filtersModalOpen} onClose={() => setFiltersModalOpen(false)} title="Фильтры">
            <div className="warehouse-page__filters-modal-content">
              <label className="warehouse-page__filter-label">
                <span>Категория</span>
                <Select
                  value={queryState.categoryId}
                  onChange={(v) => setQueryState((q) => ({ ...q, categoryId: v, page: 1 }))}
                  options={[{ value: '', label: 'Все' }, ...categoriesList.map((c) => ({ value: String(c.id), label: c.name || '' }))]}
                  placeholder="Все"
                  className="warehouse-page__select-wrap"
                />
              </label>
              <button type="button" className="warehouse-page__filter-apply" onClick={() => setFiltersModalOpen(false)}>Применить</button>
            </div>
          </FiltersModal>
          {productsError && <ErrorState message={productsError} onRetry={fetchProductsSafe} />}
          <div className="warehouse-page__table-wrap">
            <table className="warehouse-page__table">
              <thead><tr><th>Название</th><th>Категория</th><th>Кол-во</th><th>Закупка</th><th>Продажа</th><th>Мин. остаток</th><th>Добавлено</th><th>Действия</th></tr></thead>
              <tbody>
                {productsLoading ? (
                  Array.from({ length: 5 }, (_, i) => (
                    <tr key={`sk-${i}`}>
                      {Array.from({ length: 8 }, (_, j) => (
                        <td key={j}><Skeleton variant="text" /></td>
                      ))}
                    </tr>
                  ))
                ) : productsItems.length === 0 ? (
                  <tr><td colSpan={8} className="warehouse-page__empty-cell"><EmptyState message="Нет товаров" /></td></tr>
                ) : productsItems.map((p) => {
                    const qty = Number(p.qty ?? p.quantity ?? 0);
                    const minQtyVal = Number(p.minQty ?? p.min_quantity);
                    const isAtMin = !Number.isNaN(minQtyVal) && qty <= minQtyVal;
                    return (
                    <tr key={p.id} className={`warehouse-page__product-row${isAtMin ? ' warehouse-page__product-row--at-min' : ''}`}>
                      <td data-label="Название">{p.name}</td>
                      <td data-label="Категория">{p.categoryName ?? p.category?.name ?? '—'}</td>
                      <td data-label="Кол-во">{p.qty ?? p.quantity ?? 0}</td>
                      <td data-label="Закупка">{formatMoney(p.purchasePrice)}</td>
                      <td data-label="Продажа">{formatMoney(p.sellingPrice)}</td>
                      <td data-label="Мин. остаток">{p.minQty ?? p.min_quantity ?? '—'}</td>
                      <td data-label="Добавлено">{(p.createdAt ?? p.created_at) ? new Date(p.createdAt ?? p.created_at).toLocaleDateString('ru-RU') : '—'}</td>
                      <td className="warehouse-page__actions" data-label="">
                        <button type="button" className="warehouse-page__action warehouse-page__action--edit" onClick={() => (isAdmin ? setFormProduct(p) : showAccessDenied())} title="Редактировать">Редактировать</button>
                        <button type="button" className="warehouse-page__action warehouse-page__action--restock" onClick={() => setRestockProductItem(p)} title="Пополнить">Пополнить</button>
                        <button type="button" className="warehouse-page__action warehouse-page__action--delete" onClick={() => (isAdmin ? setConfirmDeleteProduct(p) : showAccessDenied())} title="Удалить">Удалить</button>
                      </td>
                    </tr>
                ); })}
              </tbody>
            </table>
          </div>
          <Pagination
            meta={productsData?.meta}
            currentPage={queryState.page}
            onPage={(p) => setQueryState((q) => ({ ...q, page: p }))}
            loading={productsLoading}
            entityLabel="товаров"
          />
        </>
      )}
      {activeTab === TAB_CATEGORIES && (
        <>
          <FilterBar className="warehouse-page__filter-bar">
            <div className="warehouse-page__filters warehouse-page__filters--desktop">
              <input type="text" placeholder="Поиск" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} className="warehouse-page__search" />
              <button type="button" className="warehouse-page__add filter-bar__action" onClick={() => setFormCategory({})}>Добавить категорию</button>
            </div>
            <div className="warehouse-page__toolbar-mobile">
              <input type="text" placeholder="Поиск" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} className="warehouse-page__search warehouse-page__search--mobile" />
              <button type="button" className="warehouse-page__add warehouse-page__add--mobile filter-bar__action" onClick={() => setFormCategory({})}>Добавить категорию</button>
            </div>
          </FilterBar>
          {categoriesError && <ErrorState message={categoriesError} onRetry={fetchCategoriesSafe} />}
          <div className="warehouse-page__table-wrap">
            <table className="warehouse-page__table">
              <thead><tr><th>Название</th><th>Действия</th></tr></thead>
              <tbody>
                {categoriesLoading ? (
                  Array.from({ length: 5 }, (_, i) => (
                    <tr key={`sk-${i}`}>
                      {Array.from({ length: 2 }, (_, j) => (
                        <td key={j}><Skeleton variant="text" /></td>
                      ))}
                    </tr>
                  ))
                ) : categoriesList.length === 0 ? (
                  <tr><td colSpan={2} className="warehouse-page__empty-cell"><EmptyState message="Нет категорий" /></td></tr>
                ) : categoriesList.map((c) => (
                  <tr key={c.id} className="warehouse-page__product-row">
                    <td data-label="Название">{c.name}</td>
                    <td className="warehouse-page__actions" data-label="">
                      <button type="button" className="warehouse-page__action warehouse-page__action--edit" onClick={() => (isAdmin ? setFormCategory(c) : showAccessDenied())} title="Редактировать">Редактировать</button>
                      <button type="button" className="warehouse-page__action warehouse-page__action--delete" onClick={() => (isAdmin ? setConfirmDeleteCategory(c) : showAccessDenied())} title="Удалить">Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {formCategory !== null && (
        <CategoryFormModal
          category={formCategory?.id ? categoriesList.find((c) => c.id === formCategory.id) ?? formCategory : null}
          onSave={handleSaveCategory}
          onClose={() => { setFormCategory(null); setCategoryFormError(null); }}
          error={categoryFormError}
          saving={categoryFormSaving}
        />
      )}
      {formProduct !== null && (
        <ProductFormModal
          product={formProduct?.id ? productsItems.find((p) => p.id === formProduct.id) ?? formProduct : formProduct}
          categories={categoriesList}
          onSave={handleSaveProduct}
          onClose={() => { setFormProduct(null); setProductFormError(null); }}
          error={productFormError}
          saving={productFormSaving}
        />
      )}
      {restockProductItem !== null && (
        <RestockModal
          product={restockProductItem}
          onSave={handleRestock}
          onClose={() => { setRestockProductItem(null); setRestockFormError(null); }}
          error={restockFormError}
          saving={restockFormSaving}
        />
      )}
      {confirmDeleteProduct !== null && (
        <ConfirmModal
          title="Удалить товар?"
          message={`Удалить «${confirmDeleteProduct.name}»?`}
          confirmText="Удалить"
          danger
          onConfirm={handleDeleteProduct}
          onCancel={() => setConfirmDeleteProduct(null)}
        />
      )}
      {confirmDeleteCategory !== null && (
        <ConfirmModal
          title="Удалить категорию?"
          message={`Удалить «${confirmDeleteCategory.name}»?`}
          confirmText="Удалить"
          danger
          onConfirm={handleDeleteCategory}
          onCancel={() => setConfirmDeleteCategory(null)}
        />
      )}
      {activeTab === TAB_HISTORY && (
        <>
          <FilterBar className="warehouse-page__filter-bar">
            <div className="warehouse-page__filters warehouse-page__filters--desktop">
              <input type="text" placeholder="Поиск" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} className="warehouse-page__search" />
            </div>
            <div className="warehouse-page__toolbar-mobile">
              <input type="text" placeholder="Поиск" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} className="warehouse-page__search warehouse-page__search--mobile" />
            </div>
          </FilterBar>
          <h3 className="warehouse-page__section">История пополнений</h3>
          {restocksError && <ErrorState message={restocksError} onRetry={fetchRestocksSafe} />}
          <div className="warehouse-page__table-wrap">
            <table className="warehouse-page__table">
              <thead><tr><th>Товар</th><th>Кол-во</th><th>Дата</th></tr></thead>
              <tbody>
                {restocksLoading ? (
                  Array.from({ length: 5 }, (_, i) => (
                    <tr key={`sk-${i}`}>
                      {Array.from({ length: 3 }, (_, j) => (
                        <td key={j}><Skeleton variant="text" /></td>
                      ))}
                    </tr>
                  ))
                ) : restocksItems.length === 0 ? (
                  <tr><td colSpan={3} className="warehouse-page__empty-cell"><EmptyState message="Нет пополнений" /></td></tr>
                ) : restocksItems.map((r) => (
                  <tr key={r.id} className="warehouse-page__product-row">
                    <td data-label="Товар">{r.productName ?? r.product?.name ?? '—'}</td>
                    <td data-label="Кол-во">{r.qty ?? r.quantity}</td>
                    <td data-label="Дата">{r.date ? new Date(r.date).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default WarehousePage;

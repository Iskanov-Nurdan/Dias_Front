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
import { ErrorState, EmptyState, ConfirmModal, Select } from '../../shared/ui';
import './WarehousePage.scss';

const TAB_PRODUCTS = 'products';
const TAB_CATEGORIES = 'categories';
const TAB_HISTORY = 'history';

const WarehousePage = () => {
  const { isAdmin, showAccessDenied } = useAuth();
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
      })
      .catch((e) => {
        const msg = e.response?.data?.error?.message || e.response?.data?.message || e.response?.data?.detail || e.message || 'Ошибка удаления';
        setProductsError(msg);
        setConfirmDeleteProduct(null);
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
      })
      .catch((e) => {
        const msg = e.response?.data?.error?.message || e.response?.data?.message || e.response?.data?.detail || e.message || 'Ошибка удаления';
        setCategoriesError(msg);
        setConfirmDeleteCategory(null);
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
          <div className="warehouse-page__toolbar">
            <div className="warehouse-page__filters">
              <input type="text" placeholder="Поиск" value={queryState.search} onChange={(e) => setQueryState((q) => ({ ...q, search: e.target.value, page: 1 }))} className="warehouse-page__search" />
              <Select
                value={queryState.categoryId}
                onChange={(v) => setQueryState((q) => ({ ...q, categoryId: v, page: 1 }))}
                options={[{ value: '', label: 'Все категории' }, ...categoriesList.map((c) => ({ value: String(c.id), label: c.name || '' }))]}
                placeholder="Все категории"
                className="warehouse-page__select-wrap"
              />
            </div>
            <button type="button" className="warehouse-page__add" onClick={() => setFormProduct({})}>Добавить товар</button>
          </div>
          {productsError && <ErrorState message={productsError} onRetry={fetchProductsSafe} />}
          <div className="warehouse-page__table-wrap">
            <table className="warehouse-page__table">
              <thead><tr><th>Название</th><th>Категория</th><th>Кол-во</th><th>Закупка</th><th>Продажа</th><th>Мин. остаток</th><th>Добавлено</th><th>Действия</th></tr></thead>
              <tbody>
                {productsLoading ? (
                  <tr><td colSpan={8} className="warehouse-page__loading-cell"><span className="loading-inline"><span className="loading-inline__spinner" aria-hidden />Загрузка…</span></td></tr>
                ) : productsItems.length === 0 ? (
                  <tr><td colSpan={8} className="warehouse-page__empty-cell"><EmptyState message="Нет товаров" /></td></tr>
                ) : productsItems.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.categoryName ?? p.category?.name ?? '—'}</td>
                      <td>{p.qty ?? p.quantity ?? 0}</td>
                      <td>{p.purchasePrice ?? '—'}</td>
                      <td>{p.sellingPrice ?? '—'}</td>
                      <td>{p.minQty ?? p.min_quantity ?? '—'}</td>
                      <td>{(p.createdAt ?? p.created_at) ? new Date(p.createdAt ?? p.created_at).toLocaleDateString('ru-RU') : '—'}</td>
                      <td className="warehouse-page__actions">
                        <button type="button" className="warehouse-page__action warehouse-page__action--edit" onClick={() => (isAdmin ? setFormProduct(p) : showAccessDenied())} title="Редактировать">Редактировать</button>
                        <button type="button" className="warehouse-page__action warehouse-page__action--restock" onClick={() => setRestockProductItem(p)} title="Пополнить">Пополнить</button>
                        <button type="button" className="warehouse-page__action warehouse-page__action--delete" onClick={() => (isAdmin ? setConfirmDeleteProduct(p) : showAccessDenied())} title="Удалить">Удалить</button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {activeTab === TAB_CATEGORIES && (
        <>
          <div className="warehouse-page__toolbar">
            <div className="warehouse-page__filters">
              <input type="text" placeholder="Поиск" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} className="warehouse-page__search" />
            </div>
            <button type="button" className="warehouse-page__add" onClick={() => setFormCategory({})}>Добавить категорию</button>
          </div>
          {categoriesError && <ErrorState message={categoriesError} onRetry={fetchCategoriesSafe} />}
          <div className="warehouse-page__table-wrap">
            <table className="warehouse-page__table">
              <thead><tr><th>Название</th><th>Действия</th></tr></thead>
              <tbody>
                {categoriesLoading ? (
                  <tr><td colSpan={2} className="warehouse-page__loading-cell"><span className="loading-inline"><span className="loading-inline__spinner" aria-hidden />Загрузка…</span></td></tr>
                ) : categoriesList.length === 0 ? (
                  <tr><td colSpan={2} className="warehouse-page__empty-cell"><EmptyState message="Нет категорий" /></td></tr>
                ) : categoriesList.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="warehouse-page__actions">
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
          <div className="warehouse-page__toolbar">
            <div className="warehouse-page__filters">
              <input type="text" placeholder="Поиск" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} className="warehouse-page__search" />
            </div>
          </div>
          <h3 className="warehouse-page__section">История пополнений</h3>
          {restocksError && <ErrorState message={restocksError} onRetry={fetchRestocksSafe} />}
          <div className="warehouse-page__table-wrap">
            <table className="warehouse-page__table">
              <thead><tr><th>Товар</th><th>Кол-во</th><th>Дата</th></tr></thead>
              <tbody>
                {restocksLoading ? (
                  <tr><td colSpan={3} className="warehouse-page__loading-cell"><span className="loading-inline"><span className="loading-inline__spinner" aria-hidden />Загрузка…</span></td></tr>
                ) : restocksItems.length === 0 ? (
                  <tr><td colSpan={3} className="warehouse-page__empty-cell"><EmptyState message="Нет пополнений" /></td></tr>
                ) : restocksItems.map((r) => <tr key={r.id}><td>{r.productName ?? r.product?.name ?? '—'}</td><td>{r.qty ?? r.quantity}</td><td>{r.date ? new Date(r.date).toLocaleDateString() : '—'}</td></tr>)}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default WarehousePage;

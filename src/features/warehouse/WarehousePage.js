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
import { Loading, ErrorState, EmptyState, ConfirmModal, Select } from '../../shared/ui';
import './WarehousePage.scss';

const TAB_PRODUCTS = 'products';
const TAB_CATEGORIES = 'categories';
const TAB_HISTORY = 'history';

const WarehousePage = () => {
  const [activeTab, setActiveTab] = useState(TAB_PRODUCTS);
  const [queryState, setQueryState] = useState({ search: '', categoryId: '', page: 1, perPage: 20 });
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
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState(null);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState(null);
  const controllerRef = useRef(null);
  const lastRequestId = useRef(0);

  const fetchProductsSafe = useCallback(async () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const rid = ++lastRequestId.current;
    setProductsLoading(true);
    setProductsError(null);
    try {
      const data = await fetchProducts(queryState, controllerRef.current.signal);
      if (rid !== lastRequestId.current) return;
      setProductsData(data);
    } catch (err) {
      if (rid !== lastRequestId.current || err.name === 'AbortError') return;
      setProductsError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка');
    } finally {
      if (rid === lastRequestId.current) setProductsLoading(false);
    }
  }, [queryState]);

  const fetchCategoriesSafe = useCallback(async () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const rid = ++lastRequestId.current;
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const data = await fetchCategories(controllerRef.current.signal);
      if (rid !== lastRequestId.current) return;
      setCategoriesData(Array.isArray(data) ? data : data?.results ?? data?.items ?? []);
    } catch (err) {
      if (rid !== lastRequestId.current || err.name === 'AbortError') return;
      setCategoriesError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка');
    } finally {
      if (rid === lastRequestId.current) setCategoriesLoading(false);
    }
  }, []);

  const fetchRestocksSafe = useCallback(async () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const rid = ++lastRequestId.current;
    setRestocksLoading(true);
    setRestocksError(null);
    try {
      const data = await fetchRestocks({ page: 1, perPage: 50 }, controllerRef.current.signal);
      if (rid !== lastRequestId.current) return;
      setRestocksData(data);
    } catch (err) {
      if (rid !== lastRequestId.current || err.name === 'AbortError') return;
      setRestocksError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка');
    } finally {
      if (rid === lastRequestId.current) setRestocksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === TAB_PRODUCTS) fetchProductsSafe();
    return () => controllerRef.current?.abort();
  }, [activeTab, fetchProductsSafe]);

  useEffect(() => {
    if (activeTab === TAB_CATEGORIES) fetchCategoriesSafe();
    return () => controllerRef.current?.abort();
  }, [activeTab, fetchCategoriesSafe]);

  useEffect(() => {
    fetchCategoriesSafe();
  }, [fetchCategoriesSafe]);

  useEffect(() => {
    if (activeTab === TAB_HISTORY) fetchRestocksSafe();
    return () => controllerRef.current?.abort();
  }, [activeTab, fetchRestocksSafe]);

  const productsItems = productsData?.items ?? productsData?.results ?? [];
  const categoriesList = Array.isArray(categoriesData) ? categoriesData : [];
  const restocksItems = restocksData?.items ?? restocksData?.results ?? [];

  const handleSaveCategory = async (payload) => {
    try {
      if (formCategory?.id) await updateCategory(formCategory.id, payload, null);
      else await createCategory(payload, null);
      setFormCategory(null);
      fetchCategoriesSafe();
      if (activeTab === TAB_PRODUCTS) fetchProductsSafe();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveProduct = async (payload) => {
    try {
      if (formProduct?.id) await updateProduct(formProduct.id, payload, null);
      else await createProduct(payload, null);
      setFormProduct(null);
      fetchProductsSafe();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestock = async (payload) => {
    if (!restockProductItem?.id) return;
    try {
      await restockProduct(restockProductItem.id, payload, null);
      setRestockProductItem(null);
      fetchProductsSafe();
      fetchRestocksSafe();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteProduct = () => {
    if (!confirmDeleteProduct?.id) return;
    deleteProduct(confirmDeleteProduct.id, null).then(() => {
      setConfirmDeleteProduct(null);
      fetchProductsSafe();
    }).catch(console.error);
  };

  const handleDeleteCategory = () => {
    if (!confirmDeleteCategory?.id) return;
    deleteCategory(confirmDeleteCategory.id, null).then(() => {
      setConfirmDeleteCategory(null);
      fetchCategoriesSafe();
      if (activeTab === TAB_PRODUCTS) fetchProductsSafe();
    }).catch(console.error);
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
          {productsLoading && <Loading />}
          {productsError && <ErrorState message={productsError} onRetry={fetchProductsSafe} />}
          {!productsLoading && !productsError && productsItems.length === 0 && <EmptyState message="Нет товаров" />}
          {!productsLoading && !productsError && productsItems.length > 0 && (
            <div className="warehouse-page__table-wrap">
              <table className="warehouse-page__table">
                <thead><tr><th>Название</th><th>Категория</th><th>Кол-во</th><th>Цена</th><th>Мин. остаток</th><th>Добавлено</th><th>Действия</th></tr></thead>
                <tbody>
                  {productsItems.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.categoryName ?? p.category?.name ?? '—'}</td>
                      <td>{p.qty ?? p.quantity ?? 0}</td>
                      <td>{p.price ?? '—'}</td>
                      <td>{p.minQty ?? p.min_quantity ?? '—'}</td>
                      <td>{(p.createdAt ?? p.created_at) ? new Date(p.createdAt ?? p.created_at).toLocaleDateString('ru-RU') : '—'}</td>
                      <td className="warehouse-page__actions">
                        <button type="button" className="warehouse-page__action warehouse-page__action--edit" onClick={() => setFormProduct(p)} title="Редактировать">Редактировать</button>
                        <button type="button" className="warehouse-page__action warehouse-page__action--restock" onClick={() => setRestockProductItem(p)} title="Пополнить">Пополнить</button>
                        <button type="button" className="warehouse-page__action warehouse-page__action--delete" onClick={() => setConfirmDeleteProduct(p)} title="Удалить">Удалить</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {activeTab === TAB_CATEGORIES && (
        <>
          <div className="warehouse-page__toolbar">
            <button type="button" className="warehouse-page__add" onClick={() => setFormCategory({})}>Добавить категорию</button>
          </div>
          {categoriesLoading && <Loading />}
          {categoriesError && <ErrorState message={categoriesError} onRetry={fetchCategoriesSafe} />}
          {!categoriesLoading && !categoriesError && categoriesList.length === 0 && <EmptyState message="Нет категорий" />}
          {!categoriesLoading && !categoriesError && categoriesList.length > 0 && (
            <div className="warehouse-page__table-wrap">
              <table className="warehouse-page__table">
                <thead><tr><th>Название</th><th>Действия</th></tr></thead>
                <tbody>{categoriesList.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="warehouse-page__actions">
                      <button type="button" className="warehouse-page__action warehouse-page__action--edit" onClick={() => setFormCategory(c)} title="Редактировать">Редактировать</button>
                      <button type="button" className="warehouse-page__action warehouse-page__action--delete" onClick={() => setConfirmDeleteCategory(c)} title="Удалить">Удалить</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </>
      )}
      {formCategory !== null && (
        <CategoryFormModal
          category={formCategory?.id ? categoriesList.find((c) => c.id === formCategory.id) ?? formCategory : null}
          onSave={handleSaveCategory}
          onClose={() => setFormCategory(null)}
        />
      )}
      {formProduct !== null && (
        <ProductFormModal
          product={formProduct?.id ? productsItems.find((p) => p.id === formProduct.id) ?? formProduct : formProduct}
          categories={categoriesList}
          onSave={handleSaveProduct}
          onClose={() => setFormProduct(null)}
        />
      )}
      {restockProductItem !== null && (
        <RestockModal
          product={restockProductItem}
          onSave={handleRestock}
          onClose={() => setRestockProductItem(null)}
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
          <h3 className="warehouse-page__section">История пополнений</h3>
          {restocksLoading && <Loading />}
          {restocksError && <ErrorState message={restocksError} onRetry={fetchRestocksSafe} />}
          {!restocksLoading && !restocksError && restocksItems.length === 0 && <EmptyState message="Нет пополнений" />}
          {!restocksLoading && !restocksError && restocksItems.length > 0 && (
            <div className="warehouse-page__table-wrap">
              <table className="warehouse-page__table">
                <thead><tr><th>Товар</th><th>Кол-во</th><th>Дата</th></tr></thead>
                <tbody>{restocksItems.map((r) => <tr key={r.id}><td>{r.productName ?? r.product?.name ?? '—'}</td><td>{r.qty ?? r.quantity}</td><td>{r.date ? new Date(r.date).toLocaleDateString() : '—'}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WarehousePage;

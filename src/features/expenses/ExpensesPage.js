import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tag, ChevronRight, ArrowLeft } from 'lucide-react';
import { fetchExpenseCategories, fetchExpenses, saveExpense, createExpenseCategory, updateExpenseCategory, deleteExpenseCategory, createExpense, updateExpense, deleteExpense } from './api';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { ExpenseCategoryFormModal, ExpenseFormModal } from './components';
import { ErrorState, EmptyState, ConfirmModal, Pagination, Badge, SkeletonTable, FilterBar } from '../../shared/ui';
import { formatMoney, SEARCH_DEBOUNCE_MS } from '../../shared/constants/common';
import { useDebounce } from '../../shared/hooks/useDebounce';
import './ExpensesPage.scss';

const ExpensesPage = () => {
  const { isAdmin, showAccessDenied } = useAuth();
  const toast = useToast();
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [categorySearch, setCategorySearch] = useState('');
  const debouncedCategorySearch = useDebounce(categorySearch, SEARCH_DEBOUNCE_MS);
  const [expensesSearch, setExpensesSearch] = useState('');
  const debouncedExpensesSearch = useDebounce(expensesSearch, SEARCH_DEBOUNCE_MS);
  const [queryState, setQueryState] = useState({ page: 1, perPage: 20 });
  const [categoriesData, setCategoriesData] = useState([]);
  const [expensesData, setExpensesData] = useState(null);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState(null);
  const [expensesError, setExpensesError] = useState(null);
  const [formCategory, setFormCategory] = useState(null);
  const [formExpense, setFormExpense] = useState(null);
  const [categoryFormError, setCategoryFormError] = useState(null);
  const [categoryFormSaving, setCategoryFormSaving] = useState(false);
  const [expenseFormError, setExpenseFormError] = useState(null);
  const [expenseFormSaving, setExpenseFormSaving] = useState(false);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState(null);
  const [confirmDeleteExpense, setConfirmDeleteExpense] = useState(null);
  const categoriesControllerRef = useRef(null);
  const expensesControllerRef = useRef(null);
  const lastCategoriesRequestId = useRef(0);
  const lastExpensesRequestId = useRef(0);

  const fetchCategoriesSafe = useCallback(async () => {
    categoriesControllerRef.current?.abort();
    categoriesControllerRef.current = new AbortController();
    const rid = ++lastCategoriesRequestId.current;
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const data = await fetchExpenseCategories({ search: debouncedCategorySearch || undefined }, categoriesControllerRef.current.signal);
      if (rid !== lastCategoriesRequestId.current) return;
      setCategoriesData(Array.isArray(data) ? data : data?.results ?? data?.items ?? []);
    } catch (err) {
      if (rid !== lastCategoriesRequestId.current || err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setCategoriesError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка');
    } finally {
      if (rid === lastCategoriesRequestId.current) setCategoriesLoading(false);
    }
  }, [debouncedCategorySearch]);

  const fetchExpensesSafe = useCallback(async () => {
    const q = { ...queryState, categoryId: selectedCategoryId || undefined, search: debouncedExpensesSearch || undefined };
    expensesControllerRef.current?.abort();
    expensesControllerRef.current = new AbortController();
    const rid = ++lastExpensesRequestId.current;
    setExpensesLoading(true);
    setExpensesError(null);
    try {
      const data = await fetchExpenses(q, expensesControllerRef.current.signal);
      if (rid !== lastExpensesRequestId.current) return;
      setExpensesData(data);
    } catch (err) {
      if (rid !== lastExpensesRequestId.current || err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setExpensesError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка');
    } finally {
      if (rid === lastExpensesRequestId.current) setExpensesLoading(false);
    }
  }, [selectedCategoryId, queryState, debouncedExpensesSearch]);

  useEffect(() => {
    fetchCategoriesSafe();
    return () => categoriesControllerRef.current?.abort();
  }, [fetchCategoriesSafe]);

  useEffect(() => {
    if (selectedCategoryId != null) fetchExpensesSafe();
    return () => expensesControllerRef.current?.abort();
  }, [selectedCategoryId, fetchExpensesSafe]);

  useEffect(() => {
    setQueryState((q) => (q.page === 1 ? q : { ...q, page: 1 }));
  }, [selectedCategoryId, debouncedExpensesSearch]);

  const categoriesList = Array.isArray(categoriesData) ? categoriesData : [];
  const expensesItems = expensesData?.items ?? expensesData?.results ?? expensesData ?? [];

  const handleSaveExpense = (id) => {
    saveExpense(id, null).then(() => fetchExpensesSafe()).catch(console.error);
  };

  const handleSaveCategory = async (payload) => {
    setCategoryFormError(null);
    setCategoryFormSaving(true);
    try {
      if (formCategory?.id) await updateExpenseCategory(formCategory.id, payload, null);
      else await createExpenseCategory(payload, null);
      setFormCategory(null);
      fetchCategoriesSafe();
    } catch (e) {
      const data = e.response?.data;
      setCategoryFormError(data?.error?.message ?? data?.message ?? data?.detail ?? 'Ошибка сохранения');
    } finally {
      setCategoryFormSaving(false);
    }
  };

  const handleSaveExpenseForm = async (payload) => {
    setExpenseFormError(null);
    setExpenseFormSaving(true);
    try {
      if (formExpense?.id) await updateExpense(formExpense.id, payload, null);
      else await createExpense(payload, null);
      setFormExpense(null);
      fetchExpensesSafe();
    } catch (e) {
      const data = e.response?.data;
      setExpenseFormError(data?.error?.message ?? data?.message ?? data?.detail ?? 'Ошибка сохранения');
    } finally {
      setExpenseFormSaving(false);
    }
  };

  const handleDeleteCategory = () => {
    if (!confirmDeleteCategory?.id) return;
    deleteExpenseCategory(confirmDeleteCategory.id, null)
      .then(() => {
        setConfirmDeleteCategory(null);
        fetchCategoriesSafe();
        toast.success('Категория удалена');
      })
      .catch((e) => {
        const msg = e.response?.data?.error?.message ?? e.response?.data?.message ?? e.response?.data?.detail;
        const text = e.response?.status === 409
          ? (msg || 'Категорию нельзя удалить: в ней есть сохранённые расходы')
          : (msg || 'Ошибка удаления категории');
        toast.error(text);
      });
  };

  const handleDeleteExpense = () => {
    if (!confirmDeleteExpense?.id) return;
    deleteExpense(confirmDeleteExpense.id, null)
      .then(() => {
        setConfirmDeleteExpense(null);
        fetchExpensesSafe();
        toast.success('Расход удалён');
      })
      .catch((e) => {
        const msg = e.response?.data?.error?.message ?? e.response?.data?.message ?? e.response?.data?.detail;
        toast.error(msg || 'Ошибка удаления расхода');
      });
  };

  const selectedCategory = selectedCategoryId != null ? categoriesList.find((c) => c.id === selectedCategoryId) : null;

  return (
    <div className="expenses-page">
      
      {selectedCategoryId == null ? (
        <>
          <FilterBar className="expenses-page__filter-bar">
            <input type="text" placeholder="Поиск" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} className="expenses-page__search" />
            <button type="button" className="expenses-page__add filter-bar__action" onClick={() => setFormCategory({})}>Добавить</button>
          </FilterBar>
          {categoriesError && <ErrorState message={categoriesError} onRetry={fetchCategoriesSafe} />}
          <div className="expenses-page__table-wrap">
            <table className="expenses-page__table">
              <thead><tr><th>Название</th><th>Действия</th></tr></thead>
              <tbody>
                {categoriesLoading ? (
                  <tr>
                    <td colSpan={2} className="expenses-page__skeleton-cell">
                      <SkeletonTable rows={6} cols={2} />
                    </td>
                  </tr>
                ) : categoriesList.length === 0 ? (
                  <tr><td colSpan={2} className="expenses-page__empty-cell"><EmptyState compact tableCell message="Нет категорий" /></td></tr>
                ) : (
                  <>
                    {categoriesList.length < 4 && (
                      <tr className="expenses-page__categories-hint-row"><td colSpan={2}>Категории помогают группировать расходы</td></tr>
                    )}
                    {categoriesList.map((c) => (
                  <tr key={c.id} className="expenses-page__category-row">
                    <td data-label="Название">
                      <button
                        type="button"
                        className="expenses-page__category-link"
                        onClick={() => setSelectedCategoryId(c.id)}
                        aria-label={`Открыть расходы по категории ${c.name}`}
                      >
                        <span className="expenses-page__category-icon"><Tag size={15} /></span>
                        <span className="expenses-page__category-name">{c.name}</span>
                        <ChevronRight size={14} className="expenses-page__category-chevron" />
                      </button>
                    </td>
                    <td className="expenses-page__actions" data-label="">
                      <button type="button" className="expenses-page__action expenses-page__action--edit" onClick={() => (isAdmin ? setFormCategory(c) : showAccessDenied())}>Изменить</button>
                      <button type="button" className="expenses-page__action expenses-page__action--delete" onClick={() => (isAdmin ? setConfirmDeleteCategory(c) : showAccessDenied())}>Удалить</button>
                    </td>
                  </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <FilterBar className="expenses-page__filter-bar">
            <button type="button" className="expenses-page__back" onClick={() => setSelectedCategoryId(null)}>
              <ArrowLeft size={14} />
              К категориям
            </button>
            <input type="text" placeholder="Поиск" value={expensesSearch} onChange={(e) => setExpensesSearch(e.target.value)} className="expenses-page__search" />
            <button type="button" className="expenses-page__add filter-bar__action" onClick={() => setFormExpense({ categoryId: selectedCategoryId })}>Добавить расход</button>
          </FilterBar>
          <h3 className="expenses-page__section">{selectedCategory?.name ?? 'Расходы по категории'}</h3>
          {expensesError && <ErrorState message={expensesError} onRetry={fetchExpensesSafe} />}
          <div className="expenses-page__table-wrap">
            <table className="expenses-page__table">
              <thead><tr><th>Название</th><th>Категория</th><th>Сумма</th><th>Дата</th><th>Сохранён</th><th>Действия</th></tr></thead>
              <tbody>
                {expensesLoading ? (
                  <tr>
                    <td colSpan={6} className="expenses-page__skeleton-cell">
                      <SkeletonTable rows={6} cols={6} />
                    </td>
                  </tr>
                ) : expensesItems.length === 0 ? (
                  <tr><td colSpan={6} className="expenses-page__empty-cell"><EmptyState compact tableCell message="Нет расходов" /></td></tr>
                ) : expensesItems.map((e) => (
                    <tr key={e.id}>
                      <td data-label="Название"><span className="expenses-page__cell-value">{e.name ?? '—'}</span></td>
                      <td data-label="Категория"><span className="expenses-page__cell-value">{e.categoryName ?? e.category?.name ?? '—'}</span></td>
                      <td data-label="Сумма"><span className="expenses-page__cell-value">{formatMoney(e.amount)}</span></td>
                      <td data-label="Дата"><span className="expenses-page__cell-value">{e.date ? new Date(e.date).toLocaleDateString() : '—'}</span></td>
                      <td data-label="Статус"><span className="expenses-page__cell-value"><Badge variant={e.saved ? 'success' : 'warning'}>{e.saved ? 'Сохранён' : 'Черновик'}</Badge></span></td>
                      <td className="expenses-page__actions" data-label="">
                        {!e.saved && (
                          <>
                            <button type="button" className="expenses-page__save-btn" onClick={() => handleSaveExpense(e.id)}>Сохранить</button>
                            <button type="button" className="expenses-page__action expenses-page__action--secondary" onClick={() => (isAdmin ? setFormExpense(e) : showAccessDenied())}>Изменить</button>
                            <button type="button" className="expenses-page__action expenses-page__action--delete" onClick={() => (isAdmin ? setConfirmDeleteExpense(e) : showAccessDenied())}>Удалить</button>
                          </>
                        )}
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            meta={expensesData?.meta}
            currentPage={queryState.page}
            onPage={(p) => setQueryState((q) => ({ ...q, page: p }))}
            loading={expensesLoading}
            entityLabel="расходов"
          />
        </>
      )}
      {formCategory !== null && (
        <ExpenseCategoryFormModal
          category={formCategory?.id ? categoriesList.find((c) => c.id === formCategory.id) ?? formCategory : null}
          onSave={handleSaveCategory}
          onClose={() => { setFormCategory(null); setCategoryFormError(null); }}
          error={categoryFormError}
          saving={categoryFormSaving}
        />
      )}
      {formExpense !== null && (
        <ExpenseFormModal
          expense={formExpense?.id ? expensesItems.find((e) => e.id === formExpense.id) ?? formExpense : formExpense}
          categories={categoriesList}
          onSave={handleSaveExpenseForm}
          onClose={() => { setFormExpense(null); setExpenseFormError(null); }}
          error={expenseFormError}
          saving={expenseFormSaving}
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
      {confirmDeleteExpense !== null && (
        <ConfirmModal
          title="Удалить расход?"
          message={`Удалить «${confirmDeleteExpense.name ?? 'расход'}»?`}
          confirmText="Удалить"
          danger
          onConfirm={handleDeleteExpense}
          onCancel={() => setConfirmDeleteExpense(null)}
        />
      )}
    </div>
  );
};

export default ExpensesPage;

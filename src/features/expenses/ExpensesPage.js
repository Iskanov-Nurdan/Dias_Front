import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchExpenseCategories, fetchExpenses, saveExpense, createExpenseCategory, updateExpenseCategory, deleteExpenseCategory, createExpense, updateExpense, deleteExpense } from './api';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { ExpenseCategoryFormModal, ExpenseFormModal } from './components';
import { ErrorState, EmptyState, ConfirmModal, Pagination } from '../../shared/ui';
import { formatMoney } from '../../shared/constants/common';
import './ExpensesPage.scss';

const ExpensesPage = () => {
  const { isAdmin, showAccessDenied } = useAuth();
  const toast = useToast();
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [expensesSearch, setExpensesSearch] = useState('');
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
      const data = await fetchExpenseCategories({ search: categorySearch || undefined }, categoriesControllerRef.current.signal);
      if (rid !== lastCategoriesRequestId.current) return;
      setCategoriesData(Array.isArray(data) ? data : data?.results ?? data?.items ?? []);
    } catch (err) {
      if (rid !== lastCategoriesRequestId.current || err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setCategoriesError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка');
    } finally {
      if (rid === lastCategoriesRequestId.current) setCategoriesLoading(false);
    }
  }, [categorySearch]);

  const fetchExpensesSafe = useCallback(async () => {
    const q = { ...queryState, categoryId: selectedCategoryId || undefined, search: expensesSearch || undefined };
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
  }, [selectedCategoryId, queryState, expensesSearch]);

  useEffect(() => {
    fetchCategoriesSafe();
    return () => categoriesControllerRef.current?.abort();
  }, [fetchCategoriesSafe]);

  useEffect(() => {
    if (selectedCategoryId != null) fetchExpensesSafe();
    return () => expensesControllerRef.current?.abort();
  }, [selectedCategoryId, fetchExpensesSafe]);

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
      <h1 className="expenses-page__title">Расходы</h1>
      {selectedCategoryId == null ? (
        <>
          <div className="expenses-page__toolbar">
            <div className="expenses-page__toolbar-left">
              <input type="text" placeholder="Поиск" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} className="expenses-page__search" />
            </div>
            <button type="button" className="expenses-page__add" onClick={() => setFormCategory({})}>Добавить</button>
          </div>
          {categoriesError && <ErrorState message={categoriesError} onRetry={fetchCategoriesSafe} />}
          <div className="expenses-page__table-wrap">
            <table className="expenses-page__table">
              <thead><tr><th>Название</th><th>Действия</th></tr></thead>
              <tbody>
                {categoriesLoading ? (
                  <tr><td colSpan={2} className="expenses-page__loading-cell"><span className="loading-inline"><span className="loading-inline__spinner" aria-hidden />Загрузка…</span></td></tr>
                ) : categoriesList.length === 0 ? (
                  <tr><td colSpan={2} className="expenses-page__empty-cell"><EmptyState message="Нет категорий" /></td></tr>
                ) : categoriesList.map((c) => (
                  <tr key={c.id} className="expenses-page__category-row" onClick={() => setSelectedCategoryId(c.id)}>
                    <td>{c.name}</td>
                    <td className="expenses-page__actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="expenses-page__action expenses-page__action--edit" onClick={() => (isAdmin ? setFormCategory(c) : showAccessDenied())}>Изменить</button>
                      <button type="button" className="expenses-page__action expenses-page__action--delete" onClick={() => (isAdmin ? setConfirmDeleteCategory(c) : showAccessDenied())}>Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="expenses-page__toolbar">
            <div className="expenses-page__toolbar-left">
              <button type="button" className="expenses-page__back" onClick={() => setSelectedCategoryId(null)}>← К категориям</button>
              <input type="text" placeholder="Поиск" value={expensesSearch} onChange={(e) => setExpensesSearch(e.target.value)} className="expenses-page__search" />
            </div>
            <button type="button" className="expenses-page__add" onClick={() => setFormExpense({ categoryId: selectedCategoryId })}>Добавить расход</button>
          </div>
          <h3 className="expenses-page__section">{selectedCategory?.name ?? 'Расходы по категории'}</h3>
          {expensesError && <ErrorState message={expensesError} onRetry={fetchExpensesSafe} />}
          <div className="expenses-page__table-wrap">
            <table className="expenses-page__table">
              <thead><tr><th>Название</th><th>Категория</th><th>Сумма</th><th>Дата</th><th>Сохранён</th><th>Действия</th></tr></thead>
              <tbody>
                {expensesLoading ? (
                  <tr><td colSpan={6} className="expenses-page__loading-cell"><span className="loading-inline"><span className="loading-inline__spinner" aria-hidden />Загрузка…</span></td></tr>
                ) : expensesItems.length === 0 ? (
                  <tr><td colSpan={6} className="expenses-page__empty-cell"><EmptyState message="Нет расходов" /></td></tr>
                ) : expensesItems.map((e) => (
                    <tr key={e.id}>
                      <td>{e.name ?? '—'}</td>
                      <td>{e.categoryName ?? e.category?.name ?? '—'}</td>
                      <td>{formatMoney(e.amount)}</td>
                      <td>{e.date ? new Date(e.date).toLocaleDateString() : '—'}</td>
                      <td>{e.saved ? 'Да' : 'Нет'}</td>
                      <td className="expenses-page__actions">
                        {!e.saved && <button type="button" className="expenses-page__save-btn" onClick={() => handleSaveExpense(e.id)}>Сохранить</button>}
                        {!e.saved && (
                          <>
                            <button type="button" className="expenses-page__action expenses-page__action--edit" onClick={() => (isAdmin ? setFormExpense(e) : showAccessDenied())}>Изменить</button>
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

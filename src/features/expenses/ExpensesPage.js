import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchExpenseCategories, fetchExpenses, saveExpense, createExpenseCategory, updateExpenseCategory, deleteExpenseCategory, createExpense, updateExpense, deleteExpense } from './api';
import { ExpenseCategoryFormModal, ExpenseFormModal } from './components';
import { Loading, ErrorState, EmptyState, ConfirmModal } from '../../shared/ui';
import './ExpensesPage.scss';

const TAB_CATEGORIES = 'categories';
const TAB_EXPENSES = 'expenses';

const ExpensesPage = () => {
  const [activeTab, setActiveTab] = useState(TAB_EXPENSES);
  const [queryState] = useState({ page: 1, perPage: 20 });
  const [categoriesData, setCategoriesData] = useState([]);
  const [expensesData, setExpensesData] = useState(null);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState(null);
  const [expensesError, setExpensesError] = useState(null);
  const [formCategory, setFormCategory] = useState(null);
  const [formExpense, setFormExpense] = useState(null);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState(null);
  const [confirmDeleteExpense, setConfirmDeleteExpense] = useState(null);
  const controllerRef = useRef(null);
  const lastRequestId = useRef(0);

  const fetchCategoriesSafe = useCallback(async () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const rid = ++lastRequestId.current;
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const data = await fetchExpenseCategories(controllerRef.current.signal);
      if (rid !== lastRequestId.current) return;
      setCategoriesData(Array.isArray(data) ? data : data?.results ?? data?.items ?? []);
    } catch (err) {
      if (rid !== lastRequestId.current || err.name === 'AbortError') return;
      setCategoriesError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка');
    } finally {
      if (rid === lastRequestId.current) setCategoriesLoading(false);
    }
  }, []);

  const fetchExpensesSafe = useCallback(async () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const rid = ++lastRequestId.current;
    setExpensesLoading(true);
    setExpensesError(null);
    try {
      const data = await fetchExpenses(queryState, controllerRef.current.signal);
      if (rid !== lastRequestId.current) return;
      setExpensesData(data);
    } catch (err) {
      if (rid !== lastRequestId.current || err.name === 'AbortError') return;
      setExpensesError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка');
    } finally {
      if (rid === lastRequestId.current) setExpensesLoading(false);
    }
  }, [queryState]);

  useEffect(() => {
    if (activeTab === TAB_CATEGORIES) fetchCategoriesSafe();
    return () => controllerRef.current?.abort();
  }, [activeTab, fetchCategoriesSafe]);

  useEffect(() => {
    fetchCategoriesSafe();
  }, [fetchCategoriesSafe]);

  useEffect(() => {
    if (activeTab === TAB_EXPENSES) fetchExpensesSafe();
    return () => controllerRef.current?.abort();
  }, [activeTab, fetchExpensesSafe]);

  const categoriesList = Array.isArray(categoriesData) ? categoriesData : [];
  const expensesItems = expensesData?.items ?? expensesData?.results ?? expensesData ?? [];

  const handleSaveExpense = (id) => {
    saveExpense(id, null).then(() => fetchExpensesSafe()).catch(console.error);
  };

  const handleSaveCategory = async (payload) => {
    try {
      if (formCategory?.id) await updateExpenseCategory(formCategory.id, payload, null);
      else await createExpenseCategory(payload, null);
      setFormCategory(null);
      fetchCategoriesSafe();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveExpenseForm = async (payload) => {
    try {
      if (formExpense?.id) await updateExpense(formExpense.id, payload, null);
      else await createExpense(payload, null);
      setFormExpense(null);
      fetchExpensesSafe();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCategory = () => {
    if (!confirmDeleteCategory?.id) return;
    deleteExpenseCategory(confirmDeleteCategory.id, null).then(() => {
      setConfirmDeleteCategory(null);
      fetchCategoriesSafe();
    }).catch(console.error);
  };

  const handleDeleteExpense = () => {
    if (!confirmDeleteExpense?.id) return;
    deleteExpense(confirmDeleteExpense.id, null).then(() => {
      setConfirmDeleteExpense(null);
      fetchExpensesSafe();
    }).catch(console.error);
  };

  return (
    <div className="expenses-page">
      <h1 className="expenses-page__title">Расходы</h1>
      <div className="expenses-page__tabs">
        <button type="button" className={`expenses-page__tab ${activeTab === TAB_CATEGORIES ? 'expenses-page__tab--active' : ''}`} onClick={() => setActiveTab(TAB_CATEGORIES)}>Категории расходов</button>
        <button type="button" className={`expenses-page__tab ${activeTab === TAB_EXPENSES ? 'expenses-page__tab--active' : ''}`} onClick={() => setActiveTab(TAB_EXPENSES)}>Расходы</button>
      </div>
      {activeTab === TAB_CATEGORIES && (
        <>
          <div className="expenses-page__toolbar">
            <button type="button" className="expenses-page__add" onClick={() => setFormCategory({})}>Добавить</button>
          </div>
          {categoriesLoading && <Loading />}
          {categoriesError && <ErrorState message={categoriesError} onRetry={fetchCategoriesSafe} />}
          {!categoriesLoading && !categoriesError && categoriesList.length === 0 && <EmptyState message="Нет категорий" />}
          {!categoriesLoading && !categoriesError && categoriesList.length > 0 && (
            <div className="expenses-page__table-wrap">
              <table className="expenses-page__table">
                <thead><tr><th>Название</th><th>Действия</th></tr></thead>
                <tbody>{categoriesList.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="expenses-page__actions">
                      <button type="button" className="expenses-page__action expenses-page__action--edit" onClick={() => setFormCategory(c)}>Изменить</button>
                      <button type="button" className="expenses-page__action expenses-page__action--delete" onClick={() => setConfirmDeleteCategory(c)}>Удалить</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </>
      )}
      {activeTab === TAB_EXPENSES && (
        <>
          <div className="expenses-page__toolbar">
            <button type="button" className="expenses-page__add" onClick={() => setFormExpense({})}>Добавить расход</button>
          </div>
          {expensesLoading && <Loading />}
          {expensesError && <ErrorState message={expensesError} onRetry={fetchExpensesSafe} />}
          {!expensesLoading && !expensesError && expensesItems.length === 0 && <EmptyState message="Нет расходов" />}
          {!expensesLoading && !expensesError && expensesItems.length > 0 && (
            <div className="expenses-page__table-wrap">
              <table className="expenses-page__table">
                <thead><tr><th>Название</th><th>Категория</th><th>Сумма</th><th>Дата</th><th>Сохранён</th><th>Действия</th></tr></thead>
                <tbody>
                  {expensesItems.map((e) => (
                    <tr key={e.id}>
                      <td>{e.name ?? '—'}</td>
                      <td>{e.categoryName ?? e.category?.name ?? '—'}</td>
                      <td>{e.amount ?? '—'}</td>
                      <td>{e.date ? new Date(e.date).toLocaleDateString() : '—'}</td>
                      <td>{e.saved ? 'Да' : 'Нет'}</td>
                      <td className="expenses-page__actions">
                        {!e.saved && <button type="button" className="expenses-page__save-btn" onClick={() => handleSaveExpense(e.id)}>Сохранить</button>}
                        <button type="button" className="expenses-page__action expenses-page__action--edit" onClick={() => setFormExpense(e)}>Изменить</button>
                        <button type="button" className="expenses-page__action expenses-page__action--delete" onClick={() => setConfirmDeleteExpense(e)}>Удалить</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {formCategory !== null && (
        <ExpenseCategoryFormModal
          category={formCategory?.id ? categoriesList.find((c) => c.id === formCategory.id) ?? formCategory : null}
          onSave={handleSaveCategory}
          onClose={() => setFormCategory(null)}
        />
      )}
      {formExpense !== null && (
        <ExpenseFormModal
          expense={formExpense?.id ? expensesItems.find((e) => e.id === formExpense.id) ?? formExpense : formExpense}
          categories={categoriesList}
          onSave={handleSaveExpenseForm}
          onClose={() => setFormExpense(null)}
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

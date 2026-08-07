import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchSalesSummary, fetchSales, createSale, cancelSale } from './api';
import { fetchProducts } from '../warehouse/api';
import SaleFormModal from './components/SaleFormModal';
import { useToast } from '../../app/providers/ToastProvider';
import { ErrorState, EmptyState, Pagination, Badge, SkeletonTable, FilterBar, ConfirmModal, Spinner } from '../../shared/ui';
import { formatMoney } from '../../shared/constants/common';
import { getApiErrorMessage, isCanceledError } from '../../shared/lib/apiError';
import './SalesPage.scss';

const SalesPage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ dateFrom: '', dateTo: '', page: 1, perPage: 20 });
  const [summary, setSummary] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [salesLoading, setSalesLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [salesError, setSalesError] = useState(null);
  const [formSaleOpen, setFormSaleOpen] = useState(false);
  const [saleFormError, setSaleFormError] = useState(null);
  const [saleFormSaving, setSaleFormSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [confirmCancelSale, setConfirmCancelSale] = useState(null);
  const [products, setProducts] = useState([]);
  const summaryControllerRef = useRef(null);
  const salesControllerRef = useRef(null);
  const lastSummaryRequestId = useRef(0);
  const lastSalesRequestId = useRef(0);

  const fetchSummarySafe = useCallback(async () => {
    summaryControllerRef.current?.abort();
    summaryControllerRef.current = new AbortController();
    const rid = ++lastSummaryRequestId.current;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await fetchSalesSummary(queryState, summaryControllerRef.current.signal);
      if (rid !== lastSummaryRequestId.current) return;
      setSummary(data);
    } catch (err) {
      if (rid !== lastSummaryRequestId.current) return;
      if (isCanceledError(err)) return;
      setSummaryError(getApiErrorMessage(err));
    } finally {
      if (rid === lastSummaryRequestId.current) setSummaryLoading(false);
    }
  }, [queryState.dateFrom, queryState.dateTo]);

  const fetchSalesSafe = useCallback(async () => {
    salesControllerRef.current?.abort();
    salesControllerRef.current = new AbortController();
    const rid = ++lastSalesRequestId.current;
    setSalesLoading(true);
    setSalesError(null);
    try {
      const data = await fetchSales(queryState, salesControllerRef.current.signal);
      if (rid !== lastSalesRequestId.current) return;
      setSalesData(data);
    } catch (err) {
      if (rid !== lastSalesRequestId.current) return;
      if (isCanceledError(err)) return;
      setSalesError(getApiErrorMessage(err));
    } finally {
      if (rid === lastSalesRequestId.current) setSalesLoading(false);
    }
  }, [queryState]);

  useEffect(() => {
    fetchSummarySafe();
    return () => summaryControllerRef.current?.abort();
  }, [fetchSummarySafe]);

  useEffect(() => {
    fetchSalesSafe();
    return () => salesControllerRef.current?.abort();
  }, [fetchSalesSafe]);

  useEffect(() => {
    fetchProducts({ page: 1, perPage: 500 }, null)
      .then((d) => setProducts(d?.items ?? d?.results ?? []))
      .catch((e) => {
        setProducts([]);
        toast.error(e?.userMessage ?? e?.response?.data?.message ?? 'Ошибка загрузки товаров');
      });
  }, []);

  const handleSaveSale = async (payload) => {
    setSaleFormError(null);
    setSaleFormSaving(true);
    try {
      await createSale(payload, null);
      setFormSaleOpen(false);
      fetchSummarySafe();
      fetchSalesSafe();
    } catch (e) {
      setSaleFormError(getApiErrorMessage(e));
    } finally {
      setSaleFormSaving(false);
    }
  };

  const handleCancelSale = async (sale) => {
    if (sale?.status === 'cancelled') return;
    setConfirmCancelSale(null);
    setCancellingId(sale?.id);
    try {
      await cancelSale(sale.id, null);
      fetchSummarySafe();
      fetchSalesSafe();
      toast.success('Продажа отменена');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setCancellingId(null);
    }
  };

  const salesItems = salesData?.items ?? salesData?.results ?? (Array.isArray(salesData) ? salesData : []);
  const summaryData = summary?.data ?? summary;

  return (
    <div className="sales-page">
      
      <FilterBar className="sales-page__filter-bar">
        <div className="sales-page__date-range">
          <label className="sales-page__date-label">
            <span className="sales-page__date-label-text">от</span>
            <input type="date" value={queryState.dateFrom} onChange={(e) => setQueryState((q) => ({ ...q, dateFrom: e.target.value, page: 1 }))} className="sales-page__input" />
          </label>
          <label className="sales-page__date-label">
            <span className="sales-page__date-label-text">до</span>
            <input type="date" value={queryState.dateTo} onChange={(e) => setQueryState((q) => ({ ...q, dateTo: e.target.value, page: 1 }))} className="sales-page__input" />
          </label>
        </div>
        <button type="button" className="sales-page__add filter-bar__action" onClick={() => setFormSaleOpen(true)}>Новая продажа</button>
      </FilterBar>
      {summaryError && <ErrorState message={summaryError} onRetry={fetchSummarySafe} />}
      <div className="sales-page__stats-row">
        <div className="sales-page__summary">
        {summaryLoading ? (
          <Spinner />
        ) : summaryData ? (
        <>
          <div className="sales-page__card"><span className="sales-page__card-label">Всего продаж</span><span className="sales-page__card-value">{summaryData.count ?? 0}</span></div>
          <div className="sales-page__card"><span className="sales-page__card-label">Выручка</span><span className="sales-page__card-value">{summaryData.revenue ?? 0}</span></div>
        </>
        ) : null}
        </div>
      </div>
      {salesError && <ErrorState message={salesError} onRetry={fetchSalesSafe} />}
      <div className="sales-page__table-wrap">
        <table className="sales-page__table">
          <thead><tr><th>Товар</th><th>Кол-во</th><th>Сумма</th><th>Скидка</th><th>Дата</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {salesLoading ? (
              <tr>
                <td colSpan={7} className="sales-page__skeleton-cell">
                  <SkeletonTable rows={6} cols={7} />
                </td>
              </tr>
            ) : salesItems.length === 0 ? (
              <tr><td colSpan={7} className="sales-page__empty-cell"><EmptyState compact tableCell message="Нет продаж" /></td></tr>
            ) : salesItems.map((s) => {
                const isCancelled = s.status === 'cancelled';
                return (
                <tr key={s.id} className={isCancelled ? 'sales-page__row--cancelled' : ''}>
                  <td data-label="Товар"><span className="sales-page__cell-value">{s.productName ?? s.product?.name ?? '—'}</span></td>
                  <td data-label="Кол-во"><span className="sales-page__cell-value">{s.qty ?? s.quantity ?? 0}</span></td>
                  <td data-label="Сумма"><span className="sales-page__cell-value">{formatMoney(s.total)}</span></td>
                  <td data-label="Скидка"><span className="sales-page__cell-value">{s.discountPercent != null ? `${s.discountPercent}%` : (s.discount != null ? `${s.discount}%` : '—')}</span></td>
                  <td data-label="Дата"><span className="sales-page__cell-value">{s.date ? new Date(s.date).toLocaleDateString() : '—'}</span></td>
                  <td data-label="Статус"><span className="sales-page__cell-value"><Badge variant={isCancelled ? 'danger' : 'success'}>{isCancelled ? 'Отменена' : 'Активна'}</Badge></span></td>
                  <td className="sales-page__actions-cell" data-label="">
                    {!isCancelled && (
                      <button
                        type="button"
                        className="sales-page__cancel-btn"
                        onClick={() => setConfirmCancelSale(s)}
                        disabled={cancellingId === s.id}
                      >
                        {cancellingId === s.id ? '…' : 'Отменить'}
                      </button>
                    )}
                  </td>
                </tr>
            );})}
          </tbody>
        </table>
      </div>
      <Pagination
        meta={salesData?.meta}
        currentPage={queryState.page}
        onPage={(p) => setQueryState((q) => ({ ...q, page: p }))}
        loading={salesLoading}
        entityLabel="продаж"
      />
      {confirmCancelSale && (
        <ConfirmModal
          title="Отменить продажу?"
          message={`Отменить продажу: ${confirmCancelSale.productName ?? confirmCancelSale.product?.name ?? '—'}, ${formatMoney(confirmCancelSale.total)}?`}
          confirmText="Отменить"
          onConfirm={() => handleCancelSale(confirmCancelSale)}
          onCancel={() => setConfirmCancelSale(null)}
          danger
        />
      )}
      {formSaleOpen && (
        <SaleFormModal
          products={products}
          onSave={handleSaveSale}
          onClose={() => { setFormSaleOpen(false); setSaleFormError(null); }}
          error={saleFormError}
          saving={saleFormSaving}
        />
      )}
    </div>
  );
};

export default SalesPage;

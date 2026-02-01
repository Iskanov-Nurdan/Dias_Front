import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchSalesSummary, fetchSales, createSale } from './api';
import { fetchProducts } from '../warehouse/api';
import SaleFormModal from './components/SaleFormModal';
import { Loading, ErrorState, EmptyState } from '../../shared/ui';
import './SalesPage.scss';

const SalesPage = () => {
  const [queryState, setQueryState] = useState({ dateFrom: '', dateTo: '', page: 1, perPage: 20 });
  const [summary, setSummary] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [salesLoading, setSalesLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [salesError, setSalesError] = useState(null);
  const [formSaleOpen, setFormSaleOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const controllerRef = useRef(null);
  const lastRequestId = useRef(0);

  const fetchSummarySafe = useCallback(async () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const rid = ++lastRequestId.current;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await fetchSalesSummary(queryState, controllerRef.current.signal);
      if (rid !== lastRequestId.current) return;
      setSummary(data);
    } catch (err) {
      if (rid !== lastRequestId.current || err.name === 'AbortError') return;
      const { getApiErrorMessage } = await import('../../shared/lib/apiError');
      setSummaryError(getApiErrorMessage(err));
    } finally {
      if (rid === lastRequestId.current) setSummaryLoading(false);
    }
  }, [queryState.dateFrom, queryState.dateTo]);

  const fetchSalesSafe = useCallback(async () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const rid = ++lastRequestId.current;
    setSalesLoading(true);
    setSalesError(null);
    try {
      const data = await fetchSales(queryState, controllerRef.current.signal);
      if (rid !== lastRequestId.current) return;
      setSalesData(data);
    } catch (err) {
      if (rid !== lastRequestId.current || err.name === 'AbortError') return;
      const { getApiErrorMessage } = await import('../../shared/lib/apiError');
      setSalesError(getApiErrorMessage(err));
    } finally {
      if (rid === lastRequestId.current) setSalesLoading(false);
    }
  }, [queryState]);

  useEffect(() => {
    fetchSummarySafe();
    return () => controllerRef.current?.abort();
  }, [fetchSummarySafe]);

  useEffect(() => {
    fetchSalesSafe();
    return () => controllerRef.current?.abort();
  }, [fetchSalesSafe]);

  useEffect(() => {
    fetchProducts({ page: 1, perPage: 500 }, null).then((d) => setProducts(d?.items ?? d?.results ?? [])).catch(() => setProducts([]));
  }, []);

  const handleSaveSale = async (payload) => {
    try {
      await createSale(payload, null);
      setFormSaleOpen(false);
      fetchSummarySafe();
      fetchSalesSafe();
    } catch (e) {
      console.error(e);
    }
  };

  const salesItems = salesData?.items ?? salesData?.results ?? (Array.isArray(salesData) ? salesData : []);
  const summaryData = summary?.data ?? summary;

  return (
    <div className="sales-page">
      <h1 className="sales-page__title">Продажи</h1>
      <div className="sales-page__toolbar-top">
        <div className="sales-page__filters">
          <input type="date" placeholder="Дата с" value={queryState.dateFrom} onChange={(e) => setQueryState((q) => ({ ...q, dateFrom: e.target.value }))} className="sales-page__input" />
          <input type="date" placeholder="Дата по" value={queryState.dateTo} onChange={(e) => setQueryState((q) => ({ ...q, dateTo: e.target.value }))} className="sales-page__input" />
        </div>
        <button type="button" className="sales-page__add" onClick={() => setFormSaleOpen(true)}>Новая продажа</button>
      </div>
      {summaryLoading && <Loading />}
      {summaryError && <ErrorState message={summaryError} onRetry={fetchSummarySafe} />}
      {!summaryLoading && !summaryError && summaryData && (
        <div className="sales-page__summary">
          <div className="sales-page__card"><span className="sales-page__card-label">Всего продаж</span><span className="sales-page__card-value">{summaryData.count ?? 0}</span></div>
          <div className="sales-page__card"><span className="sales-page__card-label">Выручка</span><span className="sales-page__card-value">{summaryData.revenue ?? 0}</span></div>
          <div className="sales-page__card"><span className="sales-page__card-label">Средний чек</span><span className="sales-page__card-value">{summaryData.avgCheck ?? '—'}</span></div>
        </div>
      )}
      <h3 className="sales-page__section">Список продаж</h3>
      {salesLoading && <Loading />}
      {salesError && <ErrorState message={salesError} onRetry={fetchSalesSafe} />}
      {!salesLoading && !salesError && salesItems.length === 0 && <EmptyState message="Нет продаж" />}
      {!salesLoading && !salesError && salesItems.length > 0 && (
        <div className="sales-page__table-wrap">
          <table className="sales-page__table">
            <thead><tr><th>Товар</th><th>Кол-во</th><th>Сумма</th><th>Дата</th><th>Сотрудник</th></tr></thead>
            <tbody>
              {salesItems.map((s) => (
                <tr key={s.id}>
                  <td>{s.productName ?? s.product?.name ?? '—'}</td>
                  <td>{s.qty ?? s.quantity ?? 0}</td>
                  <td>{s.total ?? '—'}</td>
                  <td>{s.date ? new Date(s.date).toLocaleDateString() : '—'}</td>
                  <td>{s.employeeName ?? s.employee?.fio ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {formSaleOpen && (
        <SaleFormModal
          products={products}
          onSave={handleSaveSale}
          onClose={() => setFormSaleOpen(false)}
        />
      )}
    </div>
  );
};

export default SalesPage;

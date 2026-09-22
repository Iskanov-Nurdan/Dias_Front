import React, { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { fetchSales, createSale } from './api';
import { useToast } from '../../app/providers/ToastProvider';
import { useProductLine, PRODUCT_LINE } from '../../shared/hooks/useProductLine';
import { getApiErrorMessage } from '../../shared/lib/apiError';
import { Pagination, ProductLineTabs, Fab } from '../../shared/ui';
import { SalesList, SaleCheckoutModal, SaleDetailModal } from './components';
import { FoamSalesTab } from '../foam/components';
import './SalesPage.scss';

const SalesPage = () => {
  const toast = useToast();
  const [line, setLine] = useProductLine();
  const [queryState, setQueryState] = useState({ page: 1, perPage: 20 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detailsSaleId, setDetailsSaleId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchSales(queryState, null)
      .then(setData)
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [queryState]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (payload) => {
    setFormError(null);
    setSaving(true);
    try {
      await createSale(payload, null);
      setCheckoutOpen(false);
      load();
      toast.success('Продажа оформлена');
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (line === PRODUCT_LINE.FOAM) {
    return (
      <div className="sales-page">
        <ProductLineTabs value={line} onChange={setLine} />
        <FoamSalesTab />
      </div>
    );
  }

  return (
    <div className="sales-page">
      <ProductLineTabs
        value={line}
        onChange={setLine}
        action={(
          <button type="button" className="sales-page__add" onClick={() => setCheckoutOpen(true)}>
            <Plus size={16} /> Продать
          </button>
        )}
      />

      <SalesList
        items={data?.items}
        loading={loading}
        error={error}
        onRetry={load}
        onDetails={(s) => setDetailsSaleId(s.id)}
        emptyMessage="Продаж пока нет"
      />
      <Pagination
        meta={data?.meta}
        currentPage={queryState.page}
        onPage={(p) => setQueryState((q) => ({ ...q, page: p }))}
        loading={loading}
        entityLabel="продаж"
      />

      {checkoutOpen && (
        <SaleCheckoutModal
          onSave={handleSave}
          onClose={() => { setCheckoutOpen(false); setFormError(null); }}
          error={formError}
          saving={saving}
        />
      )}

      {detailsSaleId && (
        <SaleDetailModal saleId={detailsSaleId} onClose={() => setDetailsSaleId(null)} />
      )}

      <Fab onClick={() => setCheckoutOpen(true)} label="Продать" />
    </div>
  );
};

export default SalesPage;

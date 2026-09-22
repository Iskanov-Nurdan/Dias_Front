import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Receipt } from 'lucide-react';
import { fetchFoamSales, createFoamSale, fetchFoamGpStock } from '../api';
import { useToast } from '../../../app/providers/ToastProvider';
import { getApiErrorMessage } from '../../../shared/lib/apiError';
import { ErrorState, EmptyState, SkeletonTable, Pagination, Fab } from '../../../shared/ui';
import FoamSaleModal from './FoamSaleModal';
import './FoamSalesTab.scss';

const MOBILE_MQ = '(max-width: 768px)';

const dateFmt = (d) => (d ? new Date(d).toLocaleDateString('ru-RU') : '—');
const money = (n) => `${Number(n || 0).toLocaleString('ru-RU')} сом`;
const PAYMENT_LABEL = { paid: 'Оплачено', partial: 'Частично', debt: 'В долг' };

const FoamSalesTab = () => {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stock, setStock] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchFoamSales({ page, pageSize: 20 }, null)
      .then(setData)
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const openModal = () => {
    fetchFoamGpStock(null).then(setStock).catch(() => setStock([]));
    setModalOpen(true);
  };

  const handleSave = async (payload) => {
    setFormError(null);
    setSaving(true);
    try {
      await createFoamSale(payload, null);
      setModalOpen(false);
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

  const renderMobileCards = () => (
    <div className="foam-sales__cards">
      {data.items.map((s, idx) => (
        <article key={s.id} className="foam-sales__card" style={{ '--row-i': idx }}>
          <span className="foam-sales__avatar"><Receipt size={14} /></span>
          <div className="foam-sales__card-info">
            <div className="foam-sales__card-name">{s.client}</div>
            <div className="foam-sales__card-sub">{dateFmt(s.date)} · Оплачено {money(s.paid_amount)}</div>
          </div>
          <div className="foam-sales__card-meta">
            <span className="foam-sales__amount">{money(s.total_amount)}</span>
            <span className={`foam-sales__status foam-sales__status--${s.payment_status}`}>
              {PAYMENT_LABEL[s.payment_status] || s.payment_status}
            </span>
          </div>
        </article>
      ))}
    </div>
  );

  return (
    <div className="foam-sales">
      <div className="foam-sales__toolbar">
        <button type="button" className="foam-sales__add foam-sales__add--desktop-only" onClick={openModal}>
          <Plus size={16} /> Продать
        </button>
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : (
        <div className={isMobile ? '' : 'ui-list__table-wrap'}>
          {loading ? (
            <SkeletonTable rows={6} cols={5} />
          ) : !(data?.items?.length) ? (
            <EmptyState message="Продаж пока нет" actionLabel="Продать" onAction={openModal} />
          ) : isMobile ? (
            renderMobileCards()
          ) : (
            <table className="ui-list__table foam-sales__table">
              <thead><tr><th>Клиент</th><th>Дата</th><th>Сумма</th><th>Оплачено</th><th>Статус</th></tr></thead>
              <tbody>
                {data.items.map((s, idx) => (
                  <tr key={s.id} style={{ '--row-i': idx }}>
                    <td>{s.client}</td>
                    <td>{dateFmt(s.date)}</td>
                    <td className="foam-sales__amount">{money(s.total_amount)}</td>
                    <td>{money(s.paid_amount)}</td>
                    <td>
                      <span className={`foam-sales__status foam-sales__status--${s.payment_status}`}>
                        {PAYMENT_LABEL[s.payment_status] || s.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <Pagination meta={data?.meta} currentPage={page} onPage={setPage} loading={loading} entityLabel="продаж" />

      {modalOpen && (
        <FoamSaleModal
          stock={stock}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setFormError(null); }}
          error={formError}
          saving={saving}
        />
      )}

      <Fab onClick={openModal} label="Продать" />
    </div>
  );
};

export default FoamSalesTab;

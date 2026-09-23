import React, { useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { Spinner, ErrorState, FormModal } from '../../../shared/ui';
import { fetchSale } from '../api';
import { getApiErrorMessage } from '../../../shared/lib/apiError';
import { getSaleStatusBadge, getPaymentStatusLabel } from '../saleStatus';
import './SaleDetailModal.scss';

const money = (n) => `${Number(n || 0).toLocaleString('ru-RU')} сом`;
const dateFmt = (d) => (d ? new Date(d).toLocaleDateString('ru-RU') : '—');

const SaleDetailModal = ({ saleId, onClose }) => {
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchSale(saleId, controller.signal)
      .then(setSale)
      .catch((err) => { if (err.name !== 'CanceledError') setError(getApiErrorMessage(err)); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [saleId]);

  const lines = Array.isArray(sale?.sale_lines) ? sale.sale_lines : [];

  return (
    <FormModal icon={Receipt} eyebrow="Продажа" title={sale?.sale_number || `#${saleId}`} onClose={onClose} size="fullscreen" className="sdm">
      <div className="form-modal__form">
        <div className="form-modal__body">
          {loading && <div className="sdm__loading"><Spinner /></div>}
          {error && <ErrorState message={error} />}

          {!loading && !error && sale && (
            <div className="sdm__body">
              <div className="sdm__summary">
                <div className="sdm__summary-item">
                  <span className="sdm__summary-label">Клиент</span>
                  <span className="sdm__summary-value">{sale.client_name || '—'}</span>
                </div>
                <div className="sdm__summary-item">
                  <span className="sdm__summary-label">Дата</span>
                  <span className="sdm__summary-value">{dateFmt(sale.date)}</span>
                </div>
                <div className="sdm__summary-item">
                  <span className="sdm__summary-label">Статус</span>
                  <span className="sdm__summary-value">{getSaleStatusBadge(sale, { withPayment: false }).label}</span>
                </div>
                <div className="sdm__summary-item">
                  <span className="sdm__summary-label">Оплата</span>
                  <span className="sdm__summary-value">{getPaymentStatusLabel(sale.payment_status)}</span>
                </div>
              </div>

              <div className="sdm__section">
                <h3 className="sdm__section-title">Товары</h3>
                <ul className="sdm__list">
                  {lines.map((l) => (
                    <li key={l.id} className="sdm__list-row">
                      <span className="sdm__list-product">{l.product}</span>
                      <span className="sdm__list-muted">{l.quantity} шт × {money(l.unit_price)}</span>
                      <span className="sdm__list-total">{money(l.line_total)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="sdm__total-row">
                <span>Итого</span>
                <span className="sdm__total-value">{money(sale.total_amount ?? sale.revenue)}</span>
              </div>
              {Number(sale.debt_amount) > 0 && (
                <div className="sdm__total-row sdm__total-row--debt">
                  <span>Долг</span>
                  <span className="sdm__total-value">{money(sale.debt_amount)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="form-modal__actions">
          <button type="button" className="ui-modal-btn ui-modal-btn--primary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </FormModal>
  );
};

export default SaleDetailModal;

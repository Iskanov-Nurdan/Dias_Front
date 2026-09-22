import React, { useEffect, useState } from 'react';
import { UsersRound, Wallet, Receipt, ClipboardList, Undo2 } from 'lucide-react';
import { Spinner, ErrorState, FormModal } from '../../../shared/ui';
import { fetchClientProfile } from '../api';
import { getApiErrorMessage } from '../../../shared/lib/apiError';
import './ClientProfileModal.scss';

const money = (n) => `${Number(n || 0).toLocaleString('ru-RU')} сом`;
const dateFmt = (d) => (d ? new Date(d).toLocaleDateString('ru-RU') : '—');

/**
 * Карточка клиента для кассы — одним запросом GET /clients/{id}/profile/
 * (apps/sales views.py ClientViewSet.profile, hand-собранный dict, не
 * ClientSerializer): sales[].total_amount (не revenue!), top-level total_debt,
 * returns[].display/return_reason. orders[] — форма не полностью
 * задокументирована на бэкенде, читаем защитно.
 */
const ClientProfileModal = ({ client, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchClientProfile(client.id, controller.signal)
      .then(setData)
      .catch((err) => { if (err.name !== 'CanceledError') setError(getApiErrorMessage(err)); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [client.id]);

  const sales = Array.isArray(data?.sales) ? data.sales : [];
  const orders = Array.isArray(data?.orders) ? data.orders : [];
  const returns = Array.isArray(data?.returns) ? data.returns : [];
  const totalDebt = data?.total_debt ?? data?.summary?.total_debt ?? 0;

  return (
    <FormModal icon={UsersRound} eyebrow="Карточка клиента" title={client.name} onClose={onClose} size="fullscreen" className="cpm">
      <div className="form-modal__form">
        <div className="form-modal__body">
          {loading && <div className="cpm__loading"><Spinner /></div>}
          {error && <ErrorState message={error} />}

          {!loading && !error && (
            <div className="cpm__body">
              <div className="cpm__summary">
                <div className="cpm__summary-item">
                  <span className="cpm__summary-label"><Wallet size={13} /> Долг</span>
                  <span className={`cpm__summary-value${totalDebt > 0 ? ' cpm__summary-value--debt' : ''}`}>{money(totalDebt)}</span>
                </div>
                <div className="cpm__summary-item">
                  <span className="cpm__summary-label">Лимит</span>
                  <span className="cpm__summary-value">
                    {client.credit_limit != null ? money(client.credit_limit) : 'Без лимита'}
                  </span>
                </div>
                <div className="cpm__summary-item">
                  <span className="cpm__summary-label">Телефон</span>
                  <span className="cpm__summary-value">{client.phone || '—'}</span>
                </div>
              </div>

              <div className="cpm__section">
                <h3 className="cpm__section-title"><Receipt size={14} /> Продажи ({sales.length})</h3>
                {sales.length === 0 ? <p className="cpm__empty">Нет продаж</p> : (
                  <ul className="cpm__list">
                    {sales.slice(0, 10).map((s) => (
                      <li key={s.id} className="cpm__list-row">
                        <span>{s.sale_number || `#${s.id}`}</span>
                        <span className="cpm__list-muted">{dateFmt(s.date)}</span>
                        <span>{money(s.total_amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {orders.length > 0 && (
                <div className="cpm__section">
                  <h3 className="cpm__section-title"><ClipboardList size={14} /> Заявки ({orders.length})</h3>
                  <ul className="cpm__list">
                    {orders.slice(0, 10).map((o) => (
                      <li key={o.id} className="cpm__list-row">
                        <span>{o.display || o.order_number || `#${o.id}`}</span>
                        <span className="cpm__list-muted">{dateFmt(o.date)}</span>
                        <span>{o.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {returns.length > 0 && (
                <div className="cpm__section">
                  <h3 className="cpm__section-title"><Undo2 size={14} /> Возвраты ({returns.length})</h3>
                  <ul className="cpm__list">
                    {returns.slice(0, 10).map((r) => (
                      <li key={r.id} className="cpm__list-row">
                        <span>{r.display || `#${r.id}`}</span>
                        <span className="cpm__list-muted">{dateFmt(r.date)}</span>
                        <span>{r.status}</span>
                      </li>
                    ))}
                  </ul>
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

export default ClientProfileModal;

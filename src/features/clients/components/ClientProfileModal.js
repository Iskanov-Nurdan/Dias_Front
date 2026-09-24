import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  UsersRound, Wallet, Receipt, ClipboardList, Undo2, Banknote, CreditCard, ShieldAlert, ShieldCheck, History, Phone, Package,
} from 'lucide-react';
import { Spinner, ErrorState, FormModal } from '../../../shared/ui';
import { useAuth } from '../../../app/providers/AuthProvider';
import { fetchClientProfile, fetchClientPayments } from '../api';
import { getApiErrorMessage } from '../../../shared/lib/apiError';
import { creditInfo } from '../creditLimit';
import DebtRepayModal from './DebtRepayModal';
import './ClientProfileModal.scss';

const money = (n) => `${Number(n || 0).toLocaleString('ru-RU')} сом`;
const dateFmt = (d) => (d ? new Date(d).toLocaleDateString('ru-RU') : '—');
const METHOD_LABEL = { cash: 'Наличные', card: 'Карта', transfer: 'Перевод', other: 'Другое' };
const TYPE_LABEL = {
  payment: 'Оплата', prepayment: 'Предоплата', surcharge: 'Доплата', refund: 'Возврат денег',
};

/**
 * Карточка клиента для кассы — одним запросом GET /clients/{id}/profile/
 * (apps/sales views.py ClientViewSet.profile, hand-собранный dict, не
 * ClientSerializer): sales[].total_amount (не revenue!), top-level total_debt,
 * debts[] — покупки с остатком долга (с items[] — за какие товары долг),
 * returns[].display/return_reason. orders[] — форма не полностью
 * задокументирована на бэкенде, читаем защитно.
 *
 * Лимит = лимит ДОЛГА (client.credit_limit приходит из списка клиентов,
 * в profile его нет). Погашение — POST /payments/ (нужен access-key
 * 'payments' или админ), история платежей — GET /payments/?client_id=.
 */
const ClientProfileModal = ({ client, onClose, onChanged }) => {
  const { hasAccess, isAdmin } = useAuth();
  const canPay = isAdmin || hasAccess('payments');
  const [data, setData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [repay, setRepay] = useState(null); // { target|null }

  const load = useCallback((signal) => {
    const tasks = [fetchClientProfile(client.id, signal)];
    if (canPay) tasks.push(fetchClientPayments(client.id, signal).catch(() => []));
    return Promise.all(tasks).then(([profile, pays]) => {
      setData(profile);
      setPayments(pays || []);
    });
  }, [client.id, canPay]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    load(controller.signal)
      .catch((err) => { if (err.name !== 'CanceledError') setError(getApiErrorMessage(err)); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [load]);

  const sales = useMemo(() => (Array.isArray(data?.sales) ? data.sales : []), [data]);
  const orders = Array.isArray(data?.orders) ? data.orders : [];
  const returns = Array.isArray(data?.returns) ? data.returns : [];
  const debts = Array.isArray(data?.debts) ? data.debts : [];
  const totalDebt = Number(data?.total_debt ?? data?.summary?.total_debt ?? 0);
  const credit = creditInfo(client, totalDebt);

  const itemsBySale = useMemo(
    () => Object.fromEntries(sales.map((s) => [s.id, s])),
    [sales],
  );
  const numberBySale = useMemo(
    () => Object.fromEntries(sales.map((s) => [s.id, s.sale_number || `#${s.id}`])),
    [sales],
  );
  const activePayments = payments.filter((p) => p.status !== 'canceled');

  const afterRepay = () => {
    load(null).catch(() => {});
    onChanged?.();
  };

  return (
    <FormModal icon={UsersRound} eyebrow="Карточка клиента" title={client.name} onClose={onClose} size="fullscreen" className="cpm">
      <div className="form-modal__form">
        <div className="form-modal__body">
          {loading && <div className="cpm__loading"><Spinner /></div>}
          {error && <ErrorState message={error} />}

          {!loading && !error && (
            <div className="cpm__body">
              <div className={`cpm__hero cpm__hero--${credit.hasLimit ? credit.level : (totalDebt > 0 ? 'warn' : 'ok')}`}>
                <div className="cpm__hero-main">
                  <div className="cpm__hero-col">
                    <span className="cpm__hero-label"><Wallet size={13} /> Текущий долг</span>
                    <strong className="cpm__hero-value">{money(totalDebt)}</strong>
                    <span className="cpm__hero-status">{totalDebt > 0 ? 'Есть неоплаченные покупки' : 'Долгов нет'}</span>
                  </div>
                  <div className="cpm__hero-col cpm__hero-col--right">
                    <span className="cpm__hero-label">{credit.hasLimit ? (credit.over ? 'Превышение' : 'Можно ещё') : 'Лимит долга'}</span>
                    <strong className="cpm__hero-value cpm__hero-value--sm">
                      {credit.hasLimit ? money(credit.over ? credit.debt - credit.limit : credit.available) : 'Без лимита'}
                    </strong>
                    {credit.hasLimit && <span className="cpm__hero-status">из {money(credit.limit)}</span>}
                  </div>
                </div>
                {credit.hasLimit && (
                  <div className="cpm__meter-track"><span style={{ width: `${credit.usedPct}%` }} /></div>
                )}
                <div className="cpm__chips">
                  {credit.hasLimit && (
                    <span className="cpm__chip">
                      {credit.over ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
                      {credit.mode === 'hard' ? 'Блокировка при превышении' : 'Предупреждение при превышении'}
                    </span>
                  )}
                  <span className="cpm__chip"><Phone size={12} /> {client.phone || 'Телефон не указан'}</span>
                </div>
              </div>

              {debts.length > 0 && (
                <div className="cpm__section">
                  <div className="cpm__section-head">
                    <h3 className="cpm__section-title"><span className="cpm__section-ico cpm__section-ico--danger"><Wallet size={14} /></span> Долги по покупкам <em>{debts.length}</em></h3>
                    {canPay && (
                      <button type="button" className="cpm__pay-all" onClick={() => setRepay({ target: null })}>
                        Погасить весь долг
                      </button>
                    )}
                  </div>
                  <ul className="cpm__debts">
                    {debts.map((d, idx) => {
                      const items = itemsBySale[d.sale_id]?.items || [];
                      const paidPct = Number(d.total_amount) > 0 ? Math.min(100, Math.round((Number(d.paid_amount) / Number(d.total_amount)) * 100)) : 0;
                      return (
                        <li key={d.sale_id} className="cpm__debt" style={{ '--row-i': idx }}>
                          <div className="cpm__debt-head">
                            <span className="cpm__debt-num">{d.sale_number}</span>
                            <span className="cpm__chip cpm__chip--sm">{dateFmt(d.date)}</span>
                            <strong className="cpm__debt-sum">{money(d.debt_amount)}</strong>
                          </div>
                          {items.length > 0 && (
                            <ul className="cpm__debt-items">
                              {items.map((it, i) => (
                                <li key={`${d.sale_id}-${i}`}>
                                  <span className="cpm__debt-item-name"><Package size={12} /> {(it.product || '').trim() || 'Товар'}</span>
                                  <span className="cpm__list-muted">{it.quantity} шт × {money(it.unit_price)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="cpm__debt-paid">
                            <span className="cpm__debt-paid-bar"><i style={{ width: `${paidPct}%` }} /></span>
                            <span className="cpm__list-muted">оплачено {money(d.paid_amount)} из {money(d.total_amount)}</span>
                          </div>
                          {canPay && (
                            <button type="button" className="cpm__pay" onClick={() => setRepay({ target: d })}>
                              <Banknote size={14} /> Оплатить
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {canPay && activePayments.length > 0 && (
                <div className="cpm__section">
                  <h3 className="cpm__section-title"><span className="cpm__section-ico"><History size={14} /></span> История платежей <em>{activePayments.length}</em></h3>
                  <ul className="cpm__list">
                    {activePayments.slice(0, 15).map((p, idx) => (
                      <li key={p.id} className="cpm__list-row" style={{ '--row-i': idx }}>
                        <span className="cpm__row-ico">{p.payment_method === 'card' ? <CreditCard size={14} /> : <Banknote size={14} />}</span>
                        <span className="cpm__row-main">
                          <span>{TYPE_LABEL[p.payment_type] || p.payment_type}{p.linked_sale && <em className="cpm__row-ref">{numberBySale[p.linked_sale] || `#${p.linked_sale}`}</em>}</span>
                          <span className="cpm__list-muted">{dateFmt(p.date)} · {METHOD_LABEL[p.payment_method] || p.payment_method}</span>
                        </span>
                        <span className={p.payment_type === 'refund' ? 'cpm__neg' : 'cpm__pos'}>
                          {p.payment_type === 'refund' ? '−' : '+'}{money(p.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="cpm__section">
                <h3 className="cpm__section-title"><span className="cpm__section-ico"><Receipt size={14} /></span> Продажи <em>{sales.length}</em></h3>
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
                  <h3 className="cpm__section-title"><span className="cpm__section-ico"><ClipboardList size={14} /></span> Заявки <em>{orders.length}</em></h3>
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
                  <h3 className="cpm__section-title"><span className="cpm__section-ico"><Undo2 size={14} /></span> Возвраты <em>{returns.length}</em></h3>
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

      {repay && (
        <DebtRepayModal
          client={client}
          debts={debts}
          target={repay.target}
          onClose={() => setRepay(null)}
          onDone={afterRepay}
        />
      )}
    </FormModal>
  );
};

export default ClientProfileModal;

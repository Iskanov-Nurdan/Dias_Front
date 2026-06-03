import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { useServerQuery, getApiErrorMessage, parseLocaleNumber, formatQuantityDisplay } from '../../../../shared/lib';
import {
  EmptyState,
  ErrorState,
  Loading,
  Pagination,
  useToast,
  Badge,
  SearchableSelect,
  RecordDetailsModal,
  DetailFields,
} from '../../../../shared/ui';
import { createClient, updateClient, getClientProfile } from '../../api/clientsApi';
import { ClientFormModal } from '../ClientFormModal';
import { createPayment, getPaymentSelectSources } from '../../api/paymentsApi';
import { useOperationalRefetch, WS_CASH } from '../../../../shared/realtime';
import './ClientsPage.scss';

const textOrDash = (v) => (v == null || v === '' ? '—' : String(v));

const asLower = (v) => String(v || '').trim().toLowerCase();

const getClientErrorText = (err, fallback) => {
  if (err?.response?.status === 404) return 'Клиент не найден.';
  return getApiErrorMessage(err, fallback);
};

const clientIsActive = (c) => {
  if (c == null) return true;
  const st = asLower(c.status);
  if (st === 'inactive') return false;
  if (st === 'active') return true;
  if (c.is_active === false) return false;
  return true;
};

const getPhoneExtra = (c) => c?.phone_extra ?? c?.phone_alt ?? '';

const clientTypeValue = (c) => {
  const raw = asLower(c?.client_type || c?.type || c?.entity_type || c?.kind);
  if (['company', 'legal', 'organization', 'business'].includes(raw)) return 'company';
  return 'individual';
};

const clientTypeLabel = (c) => (clientTypeValue(c) === 'company' ? 'Компания' : 'Физ лицо');

const companyAccountField = (c) => (
  c?.settlement_account
  ?? c?.bank_account
  ?? c?.account_number
  ?? c?.checking_account
  ?? ''
);

const innField = (c) => c?.inn ?? c?.tax_id ?? '';
const addressField = (c) => c?.address ?? c?.legal_address ?? '';
const formatDate = (v) => (v ? String(v).slice(0, 10) : '—');

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const firstText = (...parts) => {
  for (let i = 0; i < parts.length; i += 1) {
    const v = parts[i];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

const saleProductsText = (s) => {
  const direct = firstText(s?.products_summary, s?.product_summary, s?.items_summary);
  if (direct) return direct;
  const lines = Array.isArray(s?.sale_lines) ? s.sale_lines : Array.isArray(s?.lines) ? s.lines : [];
  return lines
    .map((ln) => firstText(ln?.product_name, ln?.product, ln?.profile_name, ln?.warehouse_batch_display))
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');
};

/** Человекочитаемое имя продажи (не ORD-… из заявки). */
const saleListLabel = (s) => {
  if (!s) return '—';
  const prod = saleProductsText(s);
  if (prod) return prod;
  const date = firstText(s.date, s.created_at).slice(0, 10);
  const total = s.total_amount ?? s.total ?? s.amount ?? s.revenue;
  const totalPart = total != null && total !== '' ? `${formatQuantityDisplay(total)} сом` : '';
  const saleNo = firstText(s.sale_number, s.number);
  const parts = [];
  if (saleNo && !/^ORD-/i.test(saleNo)) parts.push(`№${saleNo}`);
  if (date) parts.push(date);
  if (totalPart) parts.push(totalPart);
  if (parts.length) return `Продажа ${parts.join(' · ')}`;
  const fallback = firstText(s.sale_display, s.title, s.name);
  if (fallback && !/^ORD-/i.test(fallback)) return fallback;
  if (s.id != null) return `Продажа #${s.id}`;
  return 'Продажа';
};

const saleSearchText = (s) => [
  saleListLabel(s),
  s?.label,
  s?.display,
  s?.sale_display,
  s?.sale_number,
  s?.order_display,
  s?.id,
  s?.date,
  s?.created_at,
  saleProductsText(s),
  s?.debt_amount,
  s?.total_amount,
].filter((v) => v != null && String(v).trim() !== '').join(' ');

const debtSaleOptionLabel = (d) => {
  const title = saleListLabel(d);
  const debt = toNum(d.debt_amount);
  if (!(debt > 0)) return title;
  return `${title} — долг ${formatQuantityDisplay(debt)} сом`;
};

const ProfileSaleLabel = ({ item }) => {
  const title = saleListLabel(item);
  const debt = toNum(item?.debt_amount);
  const debtMeta = debt > 0 ? `долг ${formatQuantityDisplay(debt)} сом` : null;
  if (!debtMeta) {
    return <span className="clients-profile__sale-label clients-profile__sale-label--plain">{title}</span>;
  }
  return (
    <div className="clients-profile__sale-label">
      <span className="clients-profile__sale-label-id">{title}</span>
      <span className="clients-profile__sale-label-meta">{debtMeta}</span>
    </div>
  );
};
const toMoney = (v) => (v != null && v !== '' ? `${formatQuantityDisplay(v)} сом` : '—');
const textDisplay = (v) => (v == null || String(v).trim() === '' ? '—' : String(v).trim());

const ClientsPage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, search: '' });
  const [activityFilter, setActivityFilter] = useState('all');
  const [modalClient, setModalClient] = useState(null);
  const [viewClient, setViewClient] = useState(null);
  const [profileClientId, setProfileClientId] = useState(null);
  const [submitError, setSubmitError] = useState('');

  const queryForApi = useMemo(() => {
    const base = { ...queryState };
    if (activityFilter === 'active') base.is_active = true;
    else if (activityFilter === 'inactive') base.is_active = false;
    return base;
  }, [queryState, activityFilter]);

  const { items, meta, raw, loading, error, refetch } = useServerQuery('clients/', queryForApi, { enabled: true });
  useOperationalRefetch(WS_CASH, refetch, true);

  const listMeta = useMemo(() => {
    if (meta) return meta;
    const ps = Number(queryState.page_size) || 20;
    if (raw && typeof raw.count === 'number' && ps > 0) {
      return { page: queryState.page, pages: Math.max(1, Math.ceil(raw.count / ps)), total: raw.count };
    }
    return null;
  }, [meta, raw, queryState.page, queryState.page_size]);

  const handleSubmit = async (payload) => {
    setSubmitError('');
    try {
      if (modalClient?.id) {
        await updateClient(modalClient.id, payload);
      } else {
        await createClient(payload);
      }
      setModalClient(null);
      refetch();
      toast.success('Сохранено');
    } catch (err) {
      setSubmitError(getClientErrorText(err, 'Ошибка сохранения клиента'));
    }
  };

  const handleDeactivate = async (client) => {
    try {
      await updateClient(client.id, { status: 'inactive' });
      refetch();
      toast.success('Клиент деактивирован');
    } catch (err) {
      try {
        await updateClient(client.id, { is_active: false });
        refetch();
        toast.success('Клиент деактивирован');
      } catch (e2) {
        toast.error(getClientErrorText(e2, 'Не удалось деактивировать'));
      }
    }
  };

  const activitySelectOptions = useMemo(
    () => [
      { value: 'all', label: 'Все' },
      { value: 'active', label: 'Активные' },
      { value: 'inactive', label: 'Неактивные' },
    ],
    [],
  );

  return (
    <div className="page page--clients commercial-page">
      <div className="ds-toolbar ds-toolbar--stack-mobile commercial-toolbar">
        <div className="ds-toolbar__start clients-toolbar__start">
          <input
            type="text"
            className="ds-toolbar__search ds-toolbar__search--full"
            placeholder="Поиск по имени или телефону"
            value={queryState.search}
            onChange={(e) => setQueryState((p) => ({ ...p, search: e.target.value, page: 1 }))}
          />
          <div className="clients-toolbar__filter">
            <SearchableSelect
              value={activityFilter}
              onChange={(v) => {
                setActivityFilter(v);
                setQueryState((p) => ({ ...p, page: 1 }));
              }}
              options={activitySelectOptions}
              placeholder="Статус"
              className="clients-toolbar__activity-select"
            />
          </div>
        </div>
        <div className="ds-toolbar__end">
          <button type="button" className="btn btn--primary" onClick={() => setModalClient({ _new: true })}>
            Создать клиента
          </button>
        </div>
      </div>

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет клиентов" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <div className="commercial-table-wrap">
          <table className="data-table data-table--row-actions data-table--clients data-table--clients-min">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Телефон</th>
                <th>Статус</th>
                <th className="data-table__cell--actions"> </th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="data-table__cell--lead">{textOrDash(c.name || c.title)}</td>
                  <td className="data-table__cell--muted">{textOrDash(c.phone || c.phone_number)}</td>
                  <td>
                    {clientIsActive(c) ? (
                      <Badge variant="success">Активен</Badge>
                    ) : (
                      <Badge variant="default">Неактивен</Badge>
                    )}
                  </td>
                  <td className="data-table__cell--actions clients-table__actions">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setViewClient(c)}
                    >
                      Подробнее
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && (!error || error.status === 404) && (
        <Pagination meta={listMeta} onPageChange={(nextPage) => setQueryState((p) => ({ ...p, page: nextPage }))} />
      )}

      {viewClient ? (
        <RecordDetailsModal
          open
          onClose={() => setViewClient(null)}
          title={textOrDash(viewClient.name || viewClient.title)}
          footer={(
            <>
              <button type="button" className="btn btn--secondary" onClick={() => setViewClient(null)}>
                Закрыть
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setProfileClientId(viewClient.id);
                  setViewClient(null);
                }}
              >
                Карточка
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setModalClient(viewClient);
                  setViewClient(null);
                }}
              >
                Изменить
              </button>
              {clientIsActive(viewClient) ? (
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => {
                    handleDeactivate(viewClient);
                    setViewClient(null);
                  }}
                >
                  Деактивировать
                </button>
              ) : null}
            </>
          )}
        >
          <DetailFields
            rows={[
              { label: 'Тип', value: clientTypeLabel(viewClient) },
              { label: 'Телефон', value: textOrDash(viewClient.phone || viewClient.phone_number) },
              {
                label: 'Доп. телефон',
                value: textOrDash(getPhoneExtra(viewClient)),
              },
              { label: 'Статус', value: clientIsActive(viewClient) ? 'Активен' : 'Неактивен' },
              { label: 'Адрес', value: textOrDash(addressField(viewClient)), full: true },
              { label: 'ИНН', value: textOrDash(innField(viewClient)) },
              {
                label: 'Расчётный счёт',
                value: textOrDash(companyAccountField(viewClient)),
              },
            ]}
          />
        </RecordDetailsModal>
      ) : null}

      {modalClient != null && (
        <ClientFormModal
          client={modalClient?._new ? null : modalClient}
          onClose={() => {
            setModalClient(null);
            setSubmitError('');
          }}
          onSubmit={handleSubmit}
          error={submitError}
        />
      )}

      {profileClientId != null && (
        <ClientProfileModal
          clientId={profileClientId}
          onClose={() => setProfileClientId(null)}
          onPaymentSaved={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
};

const ClientProfileModal = ({ clientId, onClose, onPaymentSaved }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentComment, setPaymentComment] = useState('');
  const [selectedDebtSale, setSelectedDebtSale] = useState('');
  const [paymentSales, setPaymentSales] = useState([]);
  const [payModalOpen, setPayModalOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getClientProfile(clientId);
      setProfile(res.data || null);
    } catch (err) {
      setProfile(null);
      setError(getApiErrorMessage(err, 'Не удалось загрузить карточку клиента'));
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    let alive = true;
    getPaymentSelectSources({ client_id: clientId })
      .then((res) => {
        if (!alive) return;
        const sales = Array.isArray(res.data?.sales) ? res.data.sales : [];
        setPaymentSales(sales);
      })
      .catch(() => {
        if (alive) setPaymentSales([]);
      });
    return () => { alive = false; };
  }, [clientId]);

  const client = profile?.client || {};
  const summary = profile?.summary && typeof profile.summary === 'object' ? profile.summary : {};
  const purchases = Array.isArray(profile?.purchases) ? profile.purchases : [];
  const orders = Array.isArray(profile?.orders) ? profile.orders : [];
  const debts = Array.isArray(profile?.debts) ? profile.debts : [];
  const fallbackDebtRows = paymentSales.filter((s) => toNum(s.debt_amount) > 0);
  const debtRowsRaw = debts.length > 0 ? debts : fallbackDebtRows;
  const debtRows = useMemo(() => {
    const salesById = new Map(paymentSales.map((s) => [String(s.id), s]));
    return debtRowsRaw.map((d) => {
      const extra = salesById.get(String(d.id));
      if (!extra) return d;
      return {
        ...extra,
        ...d,
        debt_amount: d.debt_amount ?? extra.debt_amount,
        sale_lines: d.sale_lines ?? extra.sale_lines ?? extra.lines,
      };
    });
  }, [debtRowsRaw, paymentSales]);
  const summaryDebt = summary.total_debt ?? profile?.total_debt;
  const derivedDebt = debtRows.reduce((acc, d) => acc + toNum(d.debt_amount), 0);
  const totalDebt = toNum(summaryDebt) > 0 ? summaryDebt : (derivedDebt > 0 ? String(derivedDebt) : summaryDebt);
  const summarySales = summary.total_sales_amount;
  const summaryPaid = summary.total_paid_amount;
  const derivedSalesFromPurchases = purchases.reduce((acc, x) => acc + toNum(x.total_amount ?? x.revenue), 0);
  const derivedSalesFromDebts = debtRows.reduce((acc, d) => acc + toNum(d.total_amount ?? d.amount), 0);
  const totalSalesAmount = toNum(summarySales) > 0
    ? summarySales
    : String(derivedSalesFromPurchases > 0 ? derivedSalesFromPurchases : derivedSalesFromDebts);
  const derivedPaid = Math.max(toNum(totalSalesAmount) - toNum(totalDebt), 0);
  const totalPaidAmount = toNum(summaryPaid) > 0 ? summaryPaid : (derivedPaid > 0 ? String(derivedPaid) : summaryPaid);

  const debtSaleOptions = useMemo(
    () => [
      { value: '', label: 'Не выбрана' },
      ...debtRows.map((d) => ({
        value: String(d.id),
        label: debtSaleOptionLabel(d),
        searchText: saleSearchText(d),
      })),
    ],
    [debtRows],
  );
  const paymentMethodOptions = useMemo(
    () => [
      { value: 'cash', label: 'Наличные' },
      { value: 'card', label: 'Карта' },
      { value: 'transfer', label: 'Перевод' },
    ],
    [],
  );

  const submitDebtPayment = async (e) => {
    e.preventDefault();
    setPaymentError('');
    const amt = parseLocaleNumber(paymentAmount);
    if (!(amt > 0)) {
      setPaymentError('Укажите сумму больше нуля.');
      return;
    }
    if (!selectedDebtSale) {
      setPaymentError('Выберите продажу из списка долгов.');
      return;
    }
    setSavingPayment(true);
    try {
      const payload = {
        date: new Date().toISOString().slice(0, 10),
        client: Number(clientId),
        payment_type: 'payment',
        payment_method: paymentMethod,
        amount: String(amt),
        linked_sale: Number(selectedDebtSale),
      };
      const c = paymentComment.trim();
      if (c) payload.comment = c;
      await createPayment(payload);
      setPaymentAmount('');
      setPaymentComment('');
      setSelectedDebtSale('');
      setPayModalOpen(false);
      toast.success('Оплата долга сохранена');
      await loadProfile();
      onPaymentSaved?.();
    } catch (err) {
      setPaymentError(getApiErrorMessage(err, 'Не удалось сохранить оплату долга'));
    } finally {
      setSavingPayment(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide clients-profile-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Карточка клиента</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="clients-profile-modal__body">
          {loading && <Loading />}
          {!loading && error && <p className="modal__error">{error}</p>}
          {!loading && !error && profile && (
            <>
              <section className="clients-profile__block">
                <h4 className="clients-profile__title">Основа</h4>
                <dl className="clients-profile__dl">
                  <div className="clients-profile__row"><dt>Тип</dt><dd>{clientTypeLabel(client)}</dd></div>
                  <div className="clients-profile__row"><dt>{clientTypeValue(client) === 'company' ? 'Компания' : 'ФИО'}</dt><dd>{textDisplay(client.name || client.label)}</dd></div>
                  <div className="clients-profile__row"><dt>Телефон</dt><dd>{textDisplay(client.phone || client.phone_number)}</dd></div>
                  {getPhoneExtra(client) ? (
                    <div className="clients-profile__row"><dt>Доп. телефон</dt><dd>{textDisplay(getPhoneExtra(client))}</dd></div>
                  ) : null}
                  {innField(client) && clientTypeValue(client) !== 'company' ? (
                    <div className="clients-profile__row"><dt>ИНН</dt><dd>{textDisplay(innField(client))}</dd></div>
                  ) : null}
                  {clientTypeValue(client) === 'company' ? (
                    <>
                      <div className="clients-profile__row"><dt>Расчётный счёт</dt><dd>{textDisplay(companyAccountField(client))}</dd></div>
                      <div className="clients-profile__row"><dt>ИНН</dt><dd>{textDisplay(innField(client))}</dd></div>
                      <div className="clients-profile__row"><dt>Адрес</dt><dd>{textDisplay(addressField(client))}</dd></div>
                    </>
                  ) : null}
                  <div className="clients-profile__row"><dt>Статус</dt><dd>{textDisplay(client.status_label || client.status || (client.is_active === false ? 'Неактивен' : 'Активен'))}</dd></div>
                </dl>
              </section>
              <section className="clients-profile__block">
                <h4 className="clients-profile__title">Сводка</h4>
                <dl className="clients-profile__dl">
                  <div className="clients-profile__row"><dt>Покупок на сумму</dt><dd>{toMoney(totalSalesAmount)}</dd></div>
                  <div className="clients-profile__row"><dt>Оплачено</dt><dd>{toMoney(totalPaidAmount)}</dd></div>
                  <div className="clients-profile__row"><dt>Долг</dt><dd>{toMoney(totalDebt)}</dd></div>
                  <div className="clients-profile__row"><dt>Заявок</dt><dd>{textDisplay(summary.total_orders)}</dd></div>
                </dl>
              </section>
              <section className="clients-profile__block clients-profile__block--accent">
                <div className="clients-profile__head-row">
                  <h4 className="clients-profile__title">Погашение долга</h4>
                  <button type="button" className="btn btn--primary" onClick={() => setPayModalOpen(true)}>Погасить долг</button>
                </div>
              </section>
              <section className="clients-profile__block">
                <h4 className="clients-profile__title">История покупок</h4>
                {purchases.length === 0 ? <p className="clients-profile__muted">Нет покупок.</p> : (
                  <div className="commercial-table-wrap clients-profile__table-wrap">
                    <table className="data-table data-table--order-detail-lines clients-profile__table">
                      <thead><tr><th>Дата</th><th>Продажа</th><th className="data-table__cell--num">Сумма</th></tr></thead>
                      <tbody>{purchases.map((x) => (
                        <tr key={x.id}><td className="clients-profile__td-date">{formatDate(x.date || x.created_at)}</td><td><ProfileSaleLabel item={x} /></td><td className="data-table__cell--num">{toMoney(x.total_amount ?? x.revenue)}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </section>
              <section className="clients-profile__block">
                <h4 className="clients-profile__title">Заявки</h4>
                {orders.length === 0 ? <p className="clients-profile__muted">Нет заявок.</p> : (
                  <div className="commercial-table-wrap clients-profile__table-wrap">
                    <table className="data-table data-table--order-detail-lines clients-profile__table">
                      <thead><tr><th>Заявка</th><th>Дата</th><th>Статус</th></tr></thead>
                      <tbody>{orders.map((x) => (
                        <tr key={x.id}><td>{textDisplay(x.display || x.order_display)}</td><td>{formatDate(x.date || x.created_at)}</td><td>{textDisplay(x.status_label || x.request_status)}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </section>
              <section className="clients-profile__block">
                <h4 className="clients-profile__title">Долги</h4>
                {debtRows.length === 0 ? <p className="clients-profile__muted">Нет долгов по продажам.</p> : (
                  <div className="commercial-table-wrap clients-profile__table-wrap">
                    <table className="data-table data-table--order-detail-lines clients-profile__table">
                      <thead><tr><th>Продажа</th><th className="data-table__cell--num">Сумма</th><th className="data-table__cell--num">Долг</th></tr></thead>
                      <tbody>{debtRows.map((d, i) => (
                        <tr key={d.id != null ? `debt-${d.id}` : `debt-${i}`}>
                          <td><ProfileSaleLabel item={d} /></td>
                          <td className="data-table__cell--num">{toMoney(d.total_amount ?? d.amount)}</td>
                          <td className="data-table__cell--num">{toMoney(d.debt_amount)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
      {payModalOpen && (
        <div className="modal-overlay" onClick={() => setPayModalOpen(false)}>
          <div className="modal" onClick={(ev) => ev.stopPropagation()}>
            <div className="modal__head">
              <h3>Погашение долга</h3>
              <button type="button" className="modal__close" onClick={() => setPayModalOpen(false)} aria-label="Закрыть">×</button>
            </div>
            <form className="clients-profile__pay-form" onSubmit={submitDebtPayment}>
              <label>Продажа (долг)</label>
              <SearchableSelect value={selectedDebtSale} onChange={(v) => setSelectedDebtSale(v != null ? String(v) : '')} options={debtSaleOptions} placeholder="Не выбрана" />
              <label>Сумма оплаты *</label>
              <input inputMode="decimal" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
              <label>Способ оплаты *</label>
              <SearchableSelect value={paymentMethod} onChange={(v) => setPaymentMethod(v != null ? String(v) : 'cash')} options={paymentMethodOptions} />
              <label>Комментарий</label>
              <textarea rows={2} value={paymentComment} onChange={(e) => setPaymentComment(e.target.value)} />
              {paymentError && <p className="modal__error">{paymentError}</p>}
              <div className="modal__actions">
                <button type="button" className="btn btn--secondary" onClick={() => setPayModalOpen(false)}>Отмена</button>
                <button type="submit" className="btn btn--primary" disabled={savingPayment}>{savingPayment ? 'Сохранение…' : 'Сохранить'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsPage;

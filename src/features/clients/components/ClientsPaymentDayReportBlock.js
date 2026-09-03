import React, { useMemo, useState, useCallback } from 'react';
import { CalendarRange, ClipboardList, CircleCheck, Wallet } from 'lucide-react';
import { EmptyState, ErrorState, Spinner } from '../../../shared/ui';
import { formatMoney } from '../../../shared/constants/common';
import { normalizeClientsPaymentDayReportResponse } from '../lib/paymentDayReportNormalize';
import PaymentDayClientsModal from './PaymentDayClientsModal';
import './ClientsPaymentDayReportBlock.scss';

/**
 * @param {object} props
 * @param {unknown} props.raw
 * @param {boolean} props.loading
 * @param {string | null} props.errorMessage
 * @param {boolean} props.endpointMissing
 * @param {string} [props.year]
 * @param {string} [props.month]
 * @param {(c: { id: string|number }) => void} [props.onOpenClient] — открыть карточку клиента (после клика в модалке)
 */
const ClientsPaymentDayReportBlock = ({
  raw,
  loading,
  errorMessage,
  endpointMissing,
  year,
  month,
  onOpenClient,
  onRetry,
}) => {
  const { rows } = useMemo(
    () =>
      raw != null
        ? normalizeClientsPaymentDayReportResponse(raw, { year, month })
        : { rows: [] },
    [raw, year, month]
  );

  const [detail, setDetail] = useState(null);

  const handleOpenFromModal = useCallback(
    (c) => {
      setDetail(null);
      onOpenClient?.(c);
    },
    [onOpenClient]
  );

  const totals = useMemo(() => {
    let reg = 0;
    let paid = 0;
    let amountSum = 0;
    let hasAmount = false;
    for (const r of rows) {
      reg += r.registeredCount;
      paid += r.paidCount;
      if (r.paidTotalAmount != null) {
        hasAmount = true;
        amountSum += r.paidTotalAmount;
      }
    }
    return { registered: reg, paid, amountSum, hasAmount };
  }, [rows]);

  const renderCountCell = (count, dayIso, dayLabel, kind) => {
    if (count <= 0 || !dayIso) {
      return <span className="clients-payment-day-report__count--zero">{count.toLocaleString('ru-RU')}</span>;
    }
    return (
      <button
        type="button"
        className="clients-payment-day-report__count-btn"
        onClick={() => setDetail({ dayIso, dayLabel, kind })}
      >
        {count.toLocaleString('ru-RU')}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="clients-payment-day-report">
        <h3 className="clients-payment-day-report__title"><CalendarRange size={16} /> Записи и оплаты по дням</h3>
        <p className="clients-payment-day-report__hint">
          По каждому дню: сколько клиентов записали (дата начала) и сколько фактически оплатили в этот день (поле «Фактический день
          оплаты»).
        </p>
        <div className="clients-payment-day-report__loading">
          <Spinner label="Загрузка отчёта…" />
        </div>
      </div>
    );
  }

  if (endpointMissing) {
    return (
      <div className="clients-payment-day-report">
        <h3 className="clients-payment-day-report__title"><CalendarRange size={16} /> Записи и оплаты по дням</h3>
        <p className="clients-payment-day-report__hint">
          Таблица появится после того, как бэкенд отдаст агрегированные данные за выбранный месяц. Поле клиента{' '}
          <code className="clients-payment-day-report__code">actualPaymentDate</code> уже можно заполнять в форме — оно уйдёт в API
          при сохранении.
        </p>
        <div className="clients-payment-day-report__placeholder" role="status">
          Ожидается API:{' '}
          <code className="clients-payment-day-report__code">GET /api/clients/stats/payment-days/</code>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="clients-payment-day-report">
        <h3 className="clients-payment-day-report__title"><CalendarRange size={16} /> Записи и оплаты по дням</h3>
        <ErrorState compact message={errorMessage} onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className="clients-payment-day-report">
      <h3 className="clients-payment-day-report__title"><CalendarRange size={16} /> Записи и оплаты по дням</h3>

      {rows.length > 0 && (
        <div className="clients-payment-day-report__totals">
          <div className="clients-payment-day-report__total">
            <span className="clients-payment-day-report__total-icon"><ClipboardList size={15} /></span>
            <div>
              <div className="clients-payment-day-report__total-strong">{totals.registered.toLocaleString('ru-RU')}</div>
              <div className="clients-payment-day-report__total-label">Записей за месяц</div>
            </div>
          </div>
          <div className="clients-payment-day-report__total">
            <span className="clients-payment-day-report__total-icon clients-payment-day-report__total-icon--success"><CircleCheck size={15} /></span>
            <div>
              <div className="clients-payment-day-report__total-strong">{totals.paid.toLocaleString('ru-RU')}</div>
              <div className="clients-payment-day-report__total-label">Оплат по фактической дате</div>
            </div>
          </div>
          <div className="clients-payment-day-report__total">
            <span className="clients-payment-day-report__total-icon clients-payment-day-report__total-icon--money"><Wallet size={15} /></span>
            <div>
              <div className="clients-payment-day-report__total-strong">
                {totals.hasAmount ? formatMoney(totals.amountSum) : '—'}
              </div>
              <div className="clients-payment-day-report__total-label">Итого за месяц</div>
            </div>
          </div>
        </div>
      )}

      <div className="ui-list__table-wrap clients-payment-day-report__table-wrap">
        <table className="ui-list__table clients-payment-day-report__table">
          <thead>
            <tr>
              <th>День</th>
              <th>Записались</th>
              <th>Оплатили</th>
              <th>Сумма итога</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr>
                <td colSpan={4} className="clients-payment-day-report__empty">
                  <EmptyState compact tableCell message="Нет данных за выбранный период" />
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={String(r.dayKey)}>
                  <td>{r.dayLabel}</td>
                  <td>{renderCountCell(r.registeredCount, r.dayIso, r.dayLabel, 'registered')}</td>
                  <td>{renderCountCell(r.paidCount, r.dayIso, r.dayLabel, 'paid')}</td>
                  <td className="clients-payment-day-report__amount-cell">
                    {r.paidTotalAmount > 0 ? (
                      <span className="clients-payment-day-report__amount">{formatMoney(r.paidTotalAmount)}</span>
                    ) : (
                      <span className="clients-payment-day-report__count--zero">{formatMoney(r.paidTotalAmount)}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {detail && year && month && (
        <PaymentDayClientsModal
          open
          onClose={() => setDetail(null)}
          year={year}
          month={month}
          dayIso={detail.dayIso}
          dayLabel={detail.dayLabel}
          kind={detail.kind}
          onOpenCard={onOpenClient ? handleOpenFromModal : undefined}
        />
      )}
    </div>
  );
};

export default ClientsPaymentDayReportBlock;

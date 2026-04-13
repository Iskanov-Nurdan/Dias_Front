import React, { useMemo, useState, useCallback } from 'react';
import { EmptyState } from '../../../shared/ui';
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
        <h3 className="clients-payment-day-report__title">Записи и оплаты по дням</h3>
        <p className="clients-payment-day-report__hint">
          По каждому дню: сколько клиентов записали (дата начала) и сколько фактически оплатили в этот день (поле «Фактический день
          оплаты»).
        </p>
        <div className="clients-payment-day-report__loading">
          <span className="loading-inline">
            <span className="loading-inline__spinner" aria-hidden />
            Загрузка отчёта…
          </span>
        </div>
      </div>
    );
  }

  if (endpointMissing) {
    return (
      <div className="clients-payment-day-report">
        <h3 className="clients-payment-day-report__title">Записи и оплаты по дням</h3>
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
        <h3 className="clients-payment-day-report__title">Записи и оплаты по дням</h3>
        <p className="clients-payment-day-report__error" role="alert">
          {errorMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="clients-payment-day-report">
      <h3 className="clients-payment-day-report__title">Записи и оплаты по дням</h3>
      <p className="clients-payment-day-report__hint">
        <strong>Записались</strong> — клиенты с датой начала в этот день. <strong>Оплатили</strong> — число <strong>платежей</strong>
        с этой датой (частичные оплаты в карточке клиента); у одного человека может быть несколько строк в разные дни.{' '}
        <strong>Сумма итога</strong> — сумма этих платежей за день. Числа в колонках «Записались» и «Оплатили» открывают список,
        строку в списке — карточку клиента.
      </p>

      <div className="clients-payment-day-report__table-wrap">
        <table className="clients-payment-day-report__table">
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
                  <td className="clients-payment-day-report__amount-cell">{formatMoney(r.paidTotalAmount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div className="clients-payment-day-report__totals">
          <span>
            Всего записей за месяц:
            <span className="clients-payment-day-report__total-strong">{totals.registered.toLocaleString('ru-RU')}</span>
          </span>
          <span>
            Всего оплат по фактической дате:
            <span className="clients-payment-day-report__total-strong">{totals.paid.toLocaleString('ru-RU')}</span>
          </span>
          <span>
            Итого по суммам за месяц:
            <span className="clients-payment-day-report__total-strong">
              {totals.hasAmount ? formatMoney(totals.amountSum) : '—'}
            </span>
          </span>
        </div>
      )}

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

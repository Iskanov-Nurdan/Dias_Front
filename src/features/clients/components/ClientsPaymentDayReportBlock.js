import React, { useMemo } from 'react';
import { EmptyState } from '../../../shared/ui';
import { normalizeClientsPaymentDayReportResponse } from '../lib/paymentDayReportNormalize';
import './ClientsPaymentDayReportBlock.scss';

/**
 * Отчёт: по каждому календарному дню месяца — сколько записалось (date_start) и сколько оплатили (фактический день оплаты).
 *
 * @param {object} props
 * @param {unknown} props.raw
 * @param {boolean} props.loading
 * @param {string | null} props.errorMessage
 * @param {boolean} props.endpointMissing
 */
const ClientsPaymentDayReportBlock = ({ raw, loading, errorMessage, endpointMissing }) => {
  const { rows } = useMemo(
    () => (raw != null ? normalizeClientsPaymentDayReportResponse(raw) : { rows: [] }),
    [raw]
  );

  const totals = useMemo(() => {
    let reg = 0;
    let paid = 0;
    for (const r of rows) {
      reg += r.registeredCount;
      paid += r.paidCount;
    }
    return { registered: reg, paid };
  }, [rows]);

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
        <strong>Записались</strong> — клиенты с датой начала в этот день. <strong>Оплатили</strong> — у кого в этот день указан
        фактический день оплаты (независимо от флага «Оплачено»).
      </p>

      <div className="clients-payment-day-report__table-wrap">
        <table className="clients-payment-day-report__table">
          <thead>
            <tr>
              <th>День</th>
              <th>Записались</th>
              <th>Оплатили</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr>
                <td colSpan={3} className="clients-payment-day-report__empty">
                  <EmptyState compact tableCell message="Нет данных за выбранный период" />
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={String(r.dayKey)}>
                  <td>{r.dayLabel}</td>
                  <td>{r.registeredCount.toLocaleString('ru-RU')}</td>
                  <td>{r.paidCount.toLocaleString('ru-RU')}</td>
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
        </div>
      )}
    </div>
  );
};

export default ClientsPaymentDayReportBlock;

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { EmptyState, ErrorState, Spinner } from '../../../shared/ui';
import { fetchClientsPaymentDayClients } from '../api';
import { formatPaymentsThatDayCell, normalizePaymentDayClientsResponse } from '../lib/paymentDayClientsNormalize';
import { getClientPaymentsForCard } from '../lib/clientActualPayments';
import './PaymentDayClientsModal.scss';

const getInitials = (fio) =>
  (fio || '').split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

const fmtRuDate = (isoOrRaw) => {
  if (isoOrRaw == null || isoOrRaw === '') return '—';
  const s = String(isoOrRaw).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return '—';
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('ru-RU');
};

const KIND_LABELS = {
  registered: 'Записались в этот день',
  paid: 'Оплатили в этот день',
};

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.year
 * @param {string} props.month
 * @param {string} props.dayIso — YYYY-MM-DD
 * @param {string} props.dayLabel — для заголовка
 * @param {'registered'|'paid'} props.kind
 * @param {(c: { id: string|number }) => void} [props.onOpenCard]
 */
const PaymentDayClientsModal = ({
  open,
  onClose,
  year,
  month,
  dayIso,
  dayLabel,
  kind,
  onOpenCard,
}) => {
  useModalEffect(open, onClose);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [missing, setMissing] = useState(false);
  const [reloadSeq, setReloadSeq] = useState(0);
  const ctrlRef = useRef(null);

  useEffect(() => {
    if (!open || !year || !month || !dayIso || !kind) return undefined;
    ctrlRef.current?.abort();
    ctrlRef.current = new AbortController();
    const { signal } = ctrlRef.current;
    setLoading(true);
    setError(null);
    setMissing(false);
    setRows([]);
    fetchClientsPaymentDayClients({ year, month, day: dayIso, kind }, signal)
      .then((raw) => {
        setRows(normalizePaymentDayClientsResponse(raw));
      })
      .catch((err) => {
        if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        if (err?.response?.status === 404) {
          setMissing(true);
        } else {
          const msg =
            err?.response?.data?.error?.message ??
            err?.response?.data?.message ??
            err?.response?.data?.detail ??
            err?.message ??
            'Ошибка загрузки';
          setError(typeof msg === 'string' ? msg : 'Ошибка загрузки');
        }
      })
      .finally(() => {
        setLoading(false);
      });
    return () => {
      ctrlRef.current?.abort();
    };
  }, [open, year, month, dayIso, kind, reloadSeq]);

  if (!open) return null;

  const kindTitle = KIND_LABELS[kind] ?? kind;

  const content = (
    <div
      className="payment-day-clients-modal__backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-day-clients-modal-title"
    >
      <div className="payment-day-clients-modal" onClick={(e) => e.stopPropagation()}>
        <div className="payment-day-clients-modal__header">
          <div>
            <h2 id="payment-day-clients-modal-title" className="payment-day-clients-modal__title">
              {kindTitle}
            </h2>
            <p className="payment-day-clients-modal__subtitle">
              {dayLabel}
              <span className="payment-day-clients-modal__muted">
                {' '}
                ·{' '}
                {kind === 'paid'
                  ? 'дата записи (абонемент) и суммы платежей именно в выбранный день.'
                  : 'дата записи (начало) и при необходимости дата из карточки (legacy).'}
              </span>
            </p>
          </div>
          <button type="button" className="payment-day-clients-modal__close" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>

        <div className="payment-day-clients-modal__body">
          {loading && (
            <p className="payment-day-clients-modal__loading">
              <Spinner />
            </p>
          )}
          {!loading && missing && (
            <p className="payment-day-clients-modal__placeholder" role="status">
              Эндпоинт списка клиентов по дню ещё не подключён. Ожидается:{' '}
              <code>GET /api/clients/stats/payment-days/clients/</code>
            </p>
          )}
          {!loading && !missing && error && (
            <ErrorState compact message={error} onRetry={() => setReloadSeq((s) => s + 1)} />
          )}
          {!loading && !missing && !error && !rows.length && (
            <EmptyState compact message="Нет клиентов в этой выборке" />
          )}
          {!loading && !missing && !error && rows.length > 0 && (
            <div className="ui-list__table-wrap payment-day-clients-modal__table-wrap">
              <table className="ui-list__table payment-day-clients-modal__table">
                <thead>
                  <tr>
                    <th>ФИО</th>
                    <th>Дата записи</th>
                    {kind === 'paid' ? (
                      <th>Платежи за день</th>
                    ) : (
                      <th>Факт. оплата</th>
                    )}
                    <th>Телефон</th>
                    <th>Тренер</th>
                    <th>Спорт</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={String(r.id)}
                      className={onOpenCard ? 'payment-day-clients-modal__row--clickable' : undefined}
                      onClick={onOpenCard ? () => onOpenCard({ id: r.id }) : undefined}
                      role={onOpenCard ? 'button' : undefined}
                      tabIndex={onOpenCard ? 0 : undefined}
                      onKeyDown={
                        onOpenCard
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onOpenCard({ id: r.id });
                              }
                            }
                          : undefined
                      }
                    >
                      <td className="payment-day-clients-modal__fio">
                        <div className="ui-list__name-cell">
                          <span className="ui-avatar">{getInitials(r.fio)}</span>
                          <span className="ui-list__title">{r.fio}</span>
                        </div>
                      </td>
                      <td className="payment-day-clients-modal__date">{fmtRuDate(r.dateStart)}</td>
                      <td className="payment-day-clients-modal__payments-cell">
                        {kind === 'paid'
                          ? (() => {
                              const raw = formatPaymentsThatDayCell(r.paymentsThatDay) || fmtRuDate(r.actualPaymentDate);
                              const match = raw && String(raw).match(/^([\d\s]+)\s*сом$/);
                              if (match) {
                                return (
                                  <span className="payment-day-clients-modal__money">
                                    {match[1].trim()}
                                    <span className="payment-day-clients-modal__money-unit">сом</span>
                                  </span>
                                );
                              }
                              return raw || <span className="payment-day-clients-modal__dash">—</span>;
                            })()
                          : (() => {
                              const dates = getClientPaymentsForCard(r).map((p) => p.date).filter(Boolean).sort();
                              const latest = dates[dates.length - 1];
                              return latest ? fmtRuDate(latest) : <span className="payment-day-clients-modal__dash">—</span>;
                            })()}
                      </td>
                      <td className="payment-day-clients-modal__date">{r.phone || '—'}</td>
                      <td style={{ fontSize: 13, color: 'var(--color-text)' }}>{r.trainerName || '—'}</td>
                      <td>
                        {r.sportName
                          ? <span className="ui-pill">{r.sportName}</span>
                          : <span className="payment-day-clients-modal__dash">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="payment-day-clients-modal__actions">
          <button type="button" className="ui-modal-btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default PaymentDayClientsModal;

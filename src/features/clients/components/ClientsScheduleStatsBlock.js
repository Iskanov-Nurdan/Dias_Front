import React, { useMemo, useState } from 'react';
import { EmptyState, ErrorState, Spinner } from '../../../shared/ui';
import {
  normalizeClientsScheduleStatsResponse,
  sortScheduleSlots,
  formatScheduleSlotLabel,
} from '../lib/scheduleStatsNormalize';
import './ClientsScheduleStatsBlock.scss';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * @param {object} props
 * @param {unknown} props.raw — ответ API (или null)
 * @param {boolean} props.loading
 * @param {string | null} props.errorMessage — текст ошибки (не 404)
 * @param {boolean} props.endpointMissing — true если 404 (эндпоинт ещё не на бэке)
 * @param {(id: number|string, name: string, slot?: { weekday: number, timeFrom: string, timeTo: string }) => void} [props.onTrainerRowClick]
 */
const ClientsScheduleStatsBlock = ({
  raw,
  loading,
  errorMessage,
  endpointMissing,
  onTrainerRowClick,
  onRetry,
}) => {
  const [expandedTrainerId, setExpandedTrainerId] = useState(null);
  const { trainers } = useMemo(
    () => (raw != null ? normalizeClientsScheduleStatsResponse(raw) : { trainers: [], unassigned: null }),
    [raw]
  );

  const grouped = useMemo(() => {
    const items = trainers
      .map((t) => {
        const slots = sortScheduleSlots(t.slots).filter(
          (s) => s.weekday >= 1 && s.weekday <= 7 && s.timeFrom && s.timeTo
        );
        const slotRows = slots.map((s) => ({
          trainerId: t.trainerId,
          trainerName: t.trainerName,
          ...s,
          slotLabel: formatScheduleSlotLabel(s.weekday, s.timeFrom, s.timeTo),
        }));
        slotRows.sort((a, b) => {
          if (a.weekday !== b.weekday) return a.weekday - b.weekday;
          return String(a.timeFrom).localeCompare(String(b.timeFrom), undefined, { numeric: true });
        });
        const total = slotRows.reduce((acc, r) => acc + num(r.total), 0);
        const paid = slotRows.reduce((acc, r) => acc + num(r.paid), 0);
        const unpaid = slotRows.reduce((acc, r) => acc + num(r.unpaid), 0);
        return {
          trainerId: t.trainerId,
          trainerName: t.trainerName,
          total,
          paid,
          unpaid,
          slots: slotRows,
        };
      })
      .sort((a, b) => String(a.trainerName).localeCompare(String(b.trainerName), 'ru'));
    return items;
  }, [trainers]);

  if (loading) {
    return (
      <div className="clients-schedule-stats">
        <h3 className="clients-schedule-stats__title">По графику тренеров</h3>
        <div className="clients-schedule-stats__loading">
          <Spinner label="Загрузка статистики по графику…" />
        </div>
      </div>
    );
  }

  if (endpointMissing) {
    return (
      <div className="clients-schedule-stats">
        <h3 className="clients-schedule-stats__title">По графику тренеров</h3>
        <div className="clients-schedule-stats__placeholder" role="status">
          Ожидается API: <code className="clients-schedule-stats__code">GET /api/clients/stats/schedule/</code>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="clients-schedule-stats">
        <h3 className="clients-schedule-stats__title">По графику тренеров</h3>
        <ErrorState compact message={errorMessage} onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className="clients-schedule-stats">
      <h3 className="clients-schedule-stats__title">По графику тренеров</h3>

      <div className="clients-schedule-stats__table-wrap">
        <table className="clients-schedule-stats__table">
          <thead>
            <tr>
              <th>Тренер</th>
              <th>Слот</th>
              <th>Учеников</th>
              <th>Оплатили</th>
              <th>Не оплатили</th>
            </tr>
          </thead>
          <tbody>
            {!grouped.length ? (
              <tr>
                <td colSpan={5} className="clients-schedule-stats__empty">
                  <EmptyState compact tableCell message="Нет данных по слотам за период" />
                </td>
              </tr>
            ) : (
              grouped.flatMap((t) => {
                const tid = t.trainerId ?? t.trainerName;
                const isOpen = expandedTrainerId != null && String(expandedTrainerId) === String(tid);
                const headerRow = (
                  <tr
                    key={`trainer-${tid}`}
                    className={[
                      t.trainerId ? 'clients-schedule-stats__row--clickable' : '',
                      isOpen ? 'clients-schedule-stats__row--open' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={t.trainerId ? () => setExpandedTrainerId((prev) => (String(prev) === String(tid) ? null : tid)) : undefined}
                    role={t.trainerId ? 'button' : undefined}
                    tabIndex={t.trainerId ? 0 : undefined}
                    onKeyDown={
                      t.trainerId
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setExpandedTrainerId((prev) => (String(prev) === String(tid) ? null : tid));
                            }
                          }
                        : undefined
                    }
                  >
                    <td className="clients-schedule-stats__trainer-cell">
                      <span className="clients-schedule-stats__expand-icon">{isOpen ? '▾' : '▸'}</span>
                      {t.trainerName}
                    </td>
                    <td className="clients-schedule-stats__slot">{isOpen ? '' : ''}</td>
                    <td>{t.total}</td>
                    <td>{t.paid}</td>
                    <td>{t.unpaid}</td>
                  </tr>
                );

                const slotRows = isOpen
                  ? t.slots.map((r, idx) => (
                      <tr
                        key={`slot-${tid}-${r.weekday}-${r.timeFrom}-${r.timeTo}-${idx}`}
                        className={['clients-schedule-stats__row--slot', r.trainerId ? 'clients-schedule-stats__row--clickable' : ''].filter(Boolean).join(' ')}
                        onClick={
                          r.trainerId && onTrainerRowClick
                            ? () =>
                                onTrainerRowClick(r.trainerId, r.trainerName, {
                                  weekday: r.weekday,
                                  timeFrom: r.timeFrom,
                                  timeTo: r.timeTo,
                                })
                            : undefined
                        }
                        role={r.trainerId ? 'button' : undefined}
                        tabIndex={r.trainerId ? 0 : undefined}
                        onKeyDown={
                          r.trainerId && onTrainerRowClick
                            ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onTrainerRowClick(r.trainerId, r.trainerName, {
                                    weekday: r.weekday,
                                    timeFrom: r.timeFrom,
                                    timeTo: r.timeTo,
                                  });
                                }
                              }
                            : undefined
                        }
                      >
                        <td>{''}</td>
                        <td className="clients-schedule-stats__slot">{r.slotLabel}</td>
                        <td>{r.total}</td>
                        <td>{r.paid}</td>
                        <td>{r.unpaid}</td>
                      </tr>
                    ))
                  : [];

                return [headerRow, ...slotRows];
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClientsScheduleStatsBlock;

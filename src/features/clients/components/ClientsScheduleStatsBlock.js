import React, { useMemo } from 'react';
import { EmptyState } from '../../../shared/ui';
import {
  normalizeClientsScheduleStatsResponse,
  sortScheduleSlots,
  formatScheduleSlotLabel,
} from '../lib/scheduleStatsNormalize';
import './ClientsScheduleStatsBlock.scss';

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
}) => {
  const { trainers } = useMemo(
    () => (raw != null ? normalizeClientsScheduleStatsResponse(raw) : { trainers: [], unassigned: null }),
    [raw]
  );

  const flatRows = useMemo(() => {
    const rows = [];
    for (const t of trainers) {
      const slots = sortScheduleSlots(t.slots).filter((s) => s.weekday >= 1 && s.weekday <= 7 && s.timeFrom && s.timeTo);
      for (const s of slots) {
        rows.push({
          trainerId: t.trainerId,
          trainerName: t.trainerName,
          ...s,
          slotLabel: formatScheduleSlotLabel(s.weekday, s.timeFrom, s.timeTo),
        });
      }
    }
    rows.sort((a, b) => {
      const na = String(a.trainerName).localeCompare(String(b.trainerName), 'ru');
      if (na !== 0) return na;
      if (a.weekday !== b.weekday) return a.weekday - b.weekday;
      return String(a.timeFrom).localeCompare(String(b.timeFrom), undefined, { numeric: true });
    });
    return rows;
  }, [trainers]);

  if (loading) {
    return (
      <div className="clients-schedule-stats">
        <h3 className="clients-schedule-stats__title">По графику тренеров</h3>
        <p className="clients-schedule-stats__hint">
          Сколько учеников приходится на каждый интервал из графика (день недели + время), в выбранном периоде.
        </p>
        <div className="clients-schedule-stats__loading">
          <span className="loading-inline">
            <span className="loading-inline__spinner" aria-hidden />
            Загрузка статистики по графику…
          </span>
        </div>
      </div>
    );
  }

  if (endpointMissing) {
    return (
      <div className="clients-schedule-stats">
        <h3 className="clients-schedule-stats__title">По графику тренеров</h3>
        <p className="clients-schedule-stats__hint">
          Здесь будет таблица: по каждому слоту графика (как в «Настройка графика» тренера) — число учеников, оплативших и не
          оплативших за период. После реализации эндпоинта на бэкенде данные подтянутся автоматически.
        </p>
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
        <p className="clients-schedule-stats__error" role="alert">
          {errorMessage}
        </p>
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
            {!flatRows.length ? (
              <tr>
                <td colSpan={5} className="clients-schedule-stats__empty">
                  <EmptyState compact tableCell message="Нет данных по слотам за период" />
                </td>
              </tr>
            ) : (
              flatRows.map((r, idx) => (
                <tr
                  key={`${r.trainerId ?? r.trainerName}-${r.weekday}-${r.timeFrom}-${r.timeTo}-${idx}`}
                  className={r.trainerId ? 'clients-schedule-stats__row--clickable' : undefined}
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
                  <td>{r.trainerName}</td>
                  <td className="clients-schedule-stats__slot">{r.slotLabel}</td>
                  <td>{r.total}</td>
                  <td>{r.paid}</td>
                  <td>{r.unpaid}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClientsScheduleStatsBlock;

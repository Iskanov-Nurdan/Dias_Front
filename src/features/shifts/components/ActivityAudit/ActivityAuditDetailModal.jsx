import React from 'react';
import {
  getActivitySummary,
  getActivitySummaryForOperator,
  getActivityModule,
  getActivityTime,
  getActivityChanges,
  getActivityPayloadMeta,
  getActivityShiftRef,
  getActivityLineRef,
  getActivityShiftHumanLabelForOperator,
  getActivityLineHumanLabelForOperator,
  getActivityFieldLabelForOperator,
  getActivityChangesForDisplay,
  fieldTypeLabel,
  formatChangeOld,
  formatChangeNew,
} from '../../lib/activityAuditUtils';
import './ActivityAudit.scss';

const formatDateTime = (dt) => {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dt;
  }
};

/**
 * @param {'operator' | 'admin'} [detailPresentation] — по умолчанию operator (клиентский вид). admin — полный тех. diff.
 */
export default function ActivityAuditDetailModal({
  open,
  onClose,
  activity,
  loading,
  detailPresentation = 'operator',
}) {
  if (!open || !activity) return null;

  const isAdmin = detailPresentation === 'admin';
  const changes = getActivityChanges(activity);
  const entityType = activity?.entity_type != null ? String(activity.entity_type) : '';
  const displayChanges = getActivityChangesForDisplay(changes, entityType, isAdmin);
  const summary = isAdmin ? getActivitySummary(activity) : getActivitySummaryForOperator(activity);
  const moduleLabel = getActivityModule(activity);
  const payloadMeta = getActivityPayloadMeta(activity);
  const shiftRef = getActivityShiftRef(activity);
  const lineRef = getActivityLineRef(activity);
  const shiftHumanOperator = getActivityShiftHumanLabelForOperator(activity);
  const lineHumanOperator = getActivityLineHumanLabelForOperator(activity);

  return (
    <div
      className="modal-overlay activity-feed-overlay activity-feed-overlay--detail"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal activity-feed-modal activity-feed-modal--detail"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h3>{isAdmin ? 'Технические детали' : 'Что изменилось'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="modal__body">
          {loading ? (
            <div className="activity-audit-detail__loading">
              <div className="activity-feed__spinner" />
              <span>Загрузка…</span>
            </div>
          ) : (
            <>
              <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-sm)', lineHeight: 1.45 }}>
                {summary}
              </p>
              <div className="activity-audit-detail__meta">
                <div className="activity-audit-detail__meta-row">
                  <span>
                    <span className="activity-audit-detail__meta-k">Время:</span>{' '}
                    {formatDateTime(getActivityTime(activity))}
                  </span>
                  {moduleLabel ? (
                    <span>
                      <span className="activity-audit-detail__meta-k">Раздел:</span> {moduleLabel}
                    </span>
                  ) : null}
                </div>
                {isAdmin && activity.entity_type ? (
                  <div className="activity-audit-detail__meta-row">
                    <span>
                      <span className="activity-audit-detail__meta-k">Сущность:</span>{' '}
                      <span className="activity-audit-detail__mono">{activity.entity_type}</span>
                      {activity.entity_id != null && activity.entity_id !== '' ? (
                        <>
                          {' '}
                          <span className="activity-audit-detail__meta-k">id:</span>{' '}
                          <span className="activity-audit-detail__mono">{String(activity.entity_id)}</span>
                        </>
                      ) : null}
                    </span>
                  </div>
                ) : null}
                {isAdmin && activity.request_id ? (
                  <div className="activity-audit-detail__meta-row">
                    <span>
                      <span className="activity-audit-detail__meta-k">request_id:</span>{' '}
                      <span className="activity-audit-detail__mono">{activity.request_id}</span>
                    </span>
                  </div>
                ) : null}
                {isAdmin && activity.actor_role_snapshot ? (
                  <div className="activity-audit-detail__meta-row">
                    <span>
                      <span className="activity-audit-detail__meta-k">Роль:</span>{' '}
                      {activity.actor_role_snapshot}
                    </span>
                  </div>
                ) : null}
                {isAdmin && shiftRef ? (
                  <div className="activity-audit-detail__meta-row">
                    <span>
                      <span className="activity-audit-detail__meta-k">Смена:</span>{' '}
                      <span className="activity-audit-detail__mono">{shiftRef}</span>
                    </span>
                  </div>
                ) : null}
                {!isAdmin && shiftHumanOperator ? (
                  <div className="activity-audit-detail__meta-row">
                    <span>
                      <span className="activity-audit-detail__meta-k">Смена:</span>{' '}
                      {shiftHumanOperator}
                    </span>
                  </div>
                ) : null}
                {isAdmin && lineRef ? (
                  <div className="activity-audit-detail__meta-row">
                    <span>
                      <span className="activity-audit-detail__meta-k">Линия:</span>{' '}
                      <span className="activity-audit-detail__mono">{lineRef}</span>
                    </span>
                  </div>
                ) : null}
                {!isAdmin && lineHumanOperator ? (
                  <div className="activity-audit-detail__meta-row">
                    <span>
                      <span className="activity-audit-detail__meta-k">Линия:</span>{' '}
                      {lineHumanOperator}
                    </span>
                  </div>
                ) : null}
                {isAdmin && payloadMeta ? (
                  <div
                    className="activity-audit-detail__meta-row"
                    style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}
                  >
                    <span className="activity-audit-detail__meta-k">Контекст операции:</span>
                    <pre
                      className="activity-audit-detail__mono"
                      style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 11, lineHeight: 1.4 }}
                    >
                      {typeof activity?.payload?.meta === 'string'
                        ? activity.payload.meta
                        : JSON.stringify(payloadMeta, null, 2)}
                    </pre>
                  </div>
                ) : null}
                {isAdmin && (activity.client_ip || activity.user_agent) ? (
                  <div className="activity-audit-detail__meta-row" style={{ flexDirection: 'column', gap: 4 }}>
                    {activity.client_ip ? (
                      <span>
                        <span className="activity-audit-detail__meta-k">IP:</span> {activity.client_ip}
                      </span>
                    ) : null}
                    {activity.user_agent ? (
                      <span style={{ fontSize: 10, opacity: 0.9 }}>
                        <span className="activity-audit-detail__meta-k">UA:</span> {activity.user_agent}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {displayChanges.length === 0 ? (
                <p className="activity-audit-detail__empty">
                  {isAdmin && payloadMeta
                    ? 'Список изменений полей пуст. Дополнительный контекст операции см. в блоке «Контекст» выше.'
                    : 'Подробный список полей для этой записи недоступен.'}
                </p>
              ) : (
                <div className="activity-audit-detail__table-wrap">
                  <table
                    className={`activity-audit-detail__table${isAdmin ? '' : ' activity-audit-detail__table--simple'}`}
                  >
                    <thead>
                      <tr>
                        <th>{isAdmin ? 'Поле' : 'Что'}</th>
                        {isAdmin ? <th>Тип</th> : null}
                        <th>Было</th>
                        <th>Стало</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayChanges.map((row, i) => (
                        <tr key={`${row.path || row.field || i}-${i}`}>
                          <td>
                            <span className={isAdmin ? 'activity-audit-detail__mono' : ''}>
                              {isAdmin
                                ? row.path || row.field || '—'
                                : getActivityFieldLabelForOperator(row.path || row.field)}
                            </span>
                            {isAdmin && row.raw_json ? (
                              <span className="activity-audit-detail__badge" title="Сравнение как сырой JSON">
                                JSON
                              </span>
                            ) : null}
                          </td>
                          {isAdmin ? <td>{fieldTypeLabel(row.type)}</td> : null}
                          <td className="activity-audit-detail__mono">{formatChangeOld(row, activity)}</td>
                          <td className="activity-audit-detail__mono">{formatChangeNew(row, activity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

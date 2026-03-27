import React, { useState, useEffect, useCallback } from 'react';
import ActivityAuditDetailModal from './ActivityAuditDetailModal';
import {
  ACTIVITY_ACTION_LABELS,
  ACTIVITY_ACTION_COLORS,
  getActivitySummaryForOperator,
  getActivityModule,
  getActivityTime,
  activityShowsDetailInPresentation,
  getActivityChanges,
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
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {React.ReactNode} props.title
 * @param {object[]} props.items
 * @param {boolean} props.loading
 * @param {(id: string|number) => Promise<{ data: object }>} [props.fetchActivityDetail] — догрузка полного payload
 * @param {string} [props.banner] — пояснение над списком (например fallback по датам)
 * @param {'operator' | 'admin'} [props.detailPresentation] — по умолчанию operator (клиентский вид). admin — для отладки.
 */
export default function ShiftActivityListModal({
  open,
  onClose,
  title,
  items,
  loading,
  fetchActivityDetail,
  banner,
  detailPresentation = 'operator',
}) {
  const [detailRecord, setDetailRecord] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setDetailRecord(null);
      setDetailLoading(false);
    }
  }, [open]);

  const isAdminPresentation = detailPresentation === 'admin';

  const openDetail = useCallback(
    async (a) => {
      if (!activityShowsDetailInPresentation(a, isAdminPresentation) || a.id == null) return;
      setDetailRecord(a);
      const changes = getActivityChanges(a);
      const needsFetch =
        changes.length === 0 && typeof fetchActivityDetail === 'function';
      if (!needsFetch) {
        setDetailLoading(false);
        return;
      }
      setDetailLoading(true);
      try {
        const res = await fetchActivityDetail(a.id);
        setDetailRecord(res.data);
      } catch {
        setDetailRecord(a);
      } finally {
        setDetailLoading(false);
      }
    },
    [fetchActivityDetail, isAdminPresentation]
  );

  const closeDetail = useCallback(() => {
    setDetailRecord(null);
    setDetailLoading(false);
  }, []);

  if (!open) return null;

  return (
    <>
      <div className="modal-overlay activity-feed-overlay" onClick={onClose} role="presentation">
        <div className="modal activity-feed-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal__head">
            <h3>{title}</h3>
            <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          </div>
          <div className="modal__body">
            {banner && !loading ? (
              <p className="activity-feed__banner" role="status">
                {banner}
              </p>
            ) : null}
            {loading ? (
              <div className="activity-feed__loading">
                <div className="activity-feed__spinner" />
                <span>Загрузка...</span>
              </div>
            ) : items.length === 0 ? (
              <p className="activity-feed__empty">Действий не найдено</p>
            ) : (
              <div className="activity-feed__list">
                {items.map((a, i) => {
                  const actionKey = a.action || a.action_type || 'view';
                  const actionLabel = a.action_display || ACTIVITY_ACTION_LABELS[actionKey] || actionKey;
                  const color = ACTIVITY_ACTION_COLORS[actionKey] || 'var(--text-muted)';
                  const clickable = activityShowsDetailInPresentation(a, isAdminPresentation) && a.id != null;
                  const summary = getActivitySummaryForOperator(a);
                  const moduleLabel = getActivityModule(a);
                  const time = getActivityTime(a);

                  const inner = (
                    <>
                      <div className="activity-feed__dot" style={{ background: color }} />
                      <div className="activity-feed__content">
                        <div className="activity-feed__top">
                          <span className="activity-feed__label" style={{ color }}>
                            {actionLabel}
                          </span>
                          {moduleLabel ? (
                            <span className="activity-feed__section">{moduleLabel}</span>
                          ) : null}
                        </div>
                        <span className="activity-feed__desc">{summary}</span>
                        <span className="activity-feed__time">{formatDateTime(time)}</span>
                        {clickable ? (
                          <span className="activity-feed-item__hint">Нажмите для подробностей</span>
                        ) : null}
                      </div>
                    </>
                  );

                  if (clickable) {
                    return (
                      <button
                        key={a.id || i}
                        type="button"
                        className="activity-feed-item activity-feed-item--clickable"
                        onClick={() => openDetail(a)}
                      >
                        {inner}
                      </button>
                    );
                  }

                  return (
                    <div key={a.id || i} className="activity-feed-item">
                      {inner}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <ActivityAuditDetailModal
        open={Boolean(detailRecord)}
        onClose={closeDetail}
        activity={detailRecord}
        loading={detailLoading}
        detailPresentation={detailPresentation}
      />
    </>
  );
}

import React from 'react';
import { ErrorState, EmptyState, ConfirmModal, SkeletonTable } from '../../../shared/ui';
import './TrainersList.scss';

const getInitials = (fio = '') => {
  const parts = fio.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return fio.slice(0, 2).toUpperCase() || '?';
};

const TrainersList = ({
  items,
  sports = [],
  loading,
  error,
  onRetry,
  onEdit,
  onDelete,
  onSchedule,
  confirmDelete,
  onConfirmDelete,
  onCancelDelete,
  emptyStateActionLabel,
  emptyStateOnAction,
}) => {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  const list = items?.items ?? items?.results ?? (Array.isArray(items) ? items : []);
  const sportsMap = (Array.isArray(sports) ? sports : []).reduce((acc, s) => { acc[s.id] = s.name || ''; return acc; }, {});

  const getSportNames = (t) => {
    const arr = t.sportIds ?? t.sport_ids ?? t.sports ?? [];
    return arr.map((s) => (typeof s === 'object' ? s?.name : (sportsMap[s] ?? sportsMap[Number(s)]))).filter(Boolean);
  };

  return (
    <>
      <div className="trainers-list">
        <div className="trainers-list__table-wrap">
          <table className="trainers-list__table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Виды спорта</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="trainers-list__skeleton-cell">
                    <SkeletonTable rows={8} cols={3} />
                  </td>
                </tr>
              ) : !list.length ? (
                <tr>
                  <td colSpan={3} className="trainers-list__empty-cell">
                    <EmptyState
                      compact
                      tableCell
                      message="Нет тренеров"
                      actionLabel={emptyStateActionLabel}
                      onAction={emptyStateOnAction}
                    />
                  </td>
                </tr>
              ) : list.map((t) => {
                const sportNames = getSportNames(t);
                return (
                  <tr key={t.id}>
                    <td data-label="ФИО">
                      <div className="trainers-list__name-cell">
                        <span className="trainers-list__avatar">{getInitials(t.fio)}</span>
                        <span className="trainers-list__fio">{t.fio || '—'}</span>
                      </div>
                    </td>
                    <td data-label="Виды спорта">
                      <div className="trainers-list__sports-cell">
                        {sportNames.length ? sportNames.map((name, i) => (
                          <span key={i} className="trainers-list__sport-badge">{name}</span>
                        )) : <span className="trainers-list__no-sports">—</span>}
                      </div>
                    </td>
                    <td className="trainers-list__actions" data-label="">
                      {onSchedule && (
                        <button type="button" className="trainers-list__btn trainers-list__btn--schedule" onClick={() => onSchedule(t)}>График</button>
                      )}
                      <button type="button" className="trainers-list__btn trainers-list__btn--edit" onClick={() => onEdit(t)}>Изменить</button>
                      <button type="button" className="trainers-list__btn trainers-list__btn--danger" onClick={() => onDelete(t)}>Удалить</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmModal
          title="Удалить тренера?"
          message={confirmDelete.fio ? `Тренер: ${confirmDelete.fio}` : undefined}
          confirmText="Удалить"
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
          danger
        />
      )}
    </>
  );
};

export default TrainersList;

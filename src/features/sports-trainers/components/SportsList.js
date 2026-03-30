import React from 'react';
import { ErrorState, EmptyState, ConfirmModal, SkeletonTable } from '../../../shared/ui';
import './SportsList.scss';

const SportsList = ({
  items,
  loading,
  error,
  onRetry,
  onEdit,
  onDelete,
  confirmDelete,
  onConfirmDelete,
  onCancelDelete,
  emptyStateActionLabel,
  emptyStateOnAction,
}) => {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  const list = Array.isArray(items) ? items : items?.items ?? items?.results ?? [];

  return (
    <>
      <div className="sports-list">
        <div className="sports-list__table-wrap">
          <table className="sports-list__table">
            <thead>
              <tr>
                <th>Название</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={2} className="sports-list__skeleton-cell">
                    <SkeletonTable rows={8} cols={2} />
                  </td>
                </tr>
              ) : !list.length ? (
                <tr>
                  <td colSpan={2} className="sports-list__empty-cell">
                    <EmptyState
                      compact
                      tableCell
                      message="Нет видов спорта"
                      actionLabel={emptyStateActionLabel}
                      onAction={emptyStateOnAction}
                    />
                  </td>
                </tr>
              ) : list.map((s) => (
                <tr key={s.id}>
                  <td data-label="Название">{s.name || '—'}</td>
                  <td className="sports-list__actions" data-label="">
                    <button type="button" className="sports-list__btn sports-list__btn--primary" onClick={() => onEdit(s)}>Изменить</button>
                    <button type="button" className="sports-list__btn sports-list__btn--danger" onClick={() => onDelete(s)}>Удалить</button>
                  </td>
                </tr>
              )) }
            </tbody>
          </table>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmModal title="Удалить вид спорта?" message={confirmDelete.name ? `Вид спорта: ${confirmDelete.name}` : undefined} confirmText="Удалить" onConfirm={onConfirmDelete} onCancel={onCancelDelete} danger />
      )}
    </>
  );
};

export default SportsList;

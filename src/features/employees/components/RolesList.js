import React from 'react';
import { ErrorState, EmptyState, ConfirmModal } from '../../../shared/ui';
import './RolesList.scss';

const RolesList = ({
  items,
  loading,
  error,
  onRetry,
  onEdit,
  onDelete,
  confirmDelete,
  onConfirmDelete,
  onCancelDelete,
}) => {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  const list = Array.isArray(items) ? items : items?.items ?? [];

  return (
    <>
      <div className="roles-list">
        <div className="roles-list__table-wrap">
          <table className="roles-list__table">
            <thead>
              <tr>
                <th>Название</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={2} className="roles-list__loading-cell">
                    <span className="loading-inline">
                      <span className="loading-inline__spinner" aria-hidden />
                      Загрузка…
                    </span>
                  </td>
                </tr>
              ) : !list.length ? (
                <tr>
                  <td colSpan={2} className="roles-list__empty-cell">
                    <EmptyState message="Нет ролей" />
                  </td>
                </tr>
              ) : list.map((role) => (
                <tr key={role.id}>
                  <td>{role.name || '—'}</td>
                  <td className="roles-list__actions">
                    <button type="button" className="roles-list__btn" onClick={() => onEdit(role)}>
                      Изменить
                    </button>
                    <button type="button" className="roles-list__btn roles-list__btn--danger" onClick={() => onDelete(role)}>
                      Удалить
                    </button>
                  </td>
                </tr>
              )) }
            </tbody>
          </table>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmModal
          title="Удалить роль?"
          message={confirmDelete.name ? `Роль: ${confirmDelete.name}` : undefined}
          confirmText="Удалить"
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
          danger
        />
      )}
    </>
  );
};

export default RolesList;

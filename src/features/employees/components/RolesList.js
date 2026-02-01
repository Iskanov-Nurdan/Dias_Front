import React from 'react';
import { Loading, ErrorState, EmptyState, ConfirmModal } from '../../../shared/ui';
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
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  const list = Array.isArray(items) ? items : items?.items ?? [];
  if (!list.length) return <EmptyState message="Нет ролей" />;

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
              {list.map((role) => (
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
              ))}
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

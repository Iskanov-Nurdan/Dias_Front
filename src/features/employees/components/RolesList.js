import React from 'react';
import { ErrorState, EmptyState, ConfirmModal } from '../../../shared/ui';
import './RolesList.scss';

const isSystemRole = (role) => role?.is_system === true || role?.isSystem === true;

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
  canManageRoles,
  onAccessDenied,
}) => {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  const list = Array.isArray(items) ? items : items?.items ?? [];

  const handleEdit = (role) => {
    if (canManageRoles) onEdit(role);
    else if (onAccessDenied) onAccessDenied();
  };
  const handleDelete = (role) => {
    if (canManageRoles) onDelete(role);
    else if (onAccessDenied) onAccessDenied();
  };

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
                    <EmptyState compact message="Нет ролей" />
                  </td>
                </tr>
              ) : list.map((role) => {
                const systemRole = isSystemRole(role);
                return (
                  <tr key={role.id}>
                    <td>{role.name || '—'}</td>
                    <td className="roles-list__actions">
                      {!systemRole && (
                        <>
                          <button type="button" className="roles-list__btn roles-list__btn--primary" onClick={() => handleEdit(role)}>
                            Изменить
                          </button>
                          <button type="button" className="roles-list__btn roles-list__btn--danger" onClick={() => handleDelete(role)}>
                            Удалить
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              }) }
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

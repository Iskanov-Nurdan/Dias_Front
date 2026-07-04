import React from 'react';
import { Lock } from 'lucide-react';
import { ErrorState, EmptyState, ConfirmModal, SkeletonTable } from '../../../shared/ui';
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
                  <td colSpan={2} className="roles-list__skeleton-cell">
                    <SkeletonTable rows={4} cols={2} />
                  </td>
                </tr>
              ) : !list.length ? (
                <tr>
                  <td colSpan={2} className="roles-list__empty-cell">
                    <EmptyState compact tableCell message="Нет ролей" />
                  </td>
                </tr>
              ) : list.map((role) => {
                const system = isSystemRole(role);
                return (
                  <tr key={role.id} className={system ? 'roles-list__row--system' : ''}>
                    <td>
                      <div className="roles-list__name-cell">
                        {system ? (
                          <span className="roles-list__system-icon"><Lock size={14} /></span>
                        ) : (
                          <span className="roles-list__dot" />
                        )}
                        <span className="roles-list__name">{role.name || '—'}</span>
                        {system && <span className="roles-list__system-badge">Системная</span>}
                      </div>
                    </td>
                    <td className="roles-list__actions">
                      {!system ? (
                        <>
                          <button type="button" className="roles-list__btn roles-list__btn--edit" onClick={() => handleEdit(role)}>
                            Изменить
                          </button>
                          <button type="button" className="roles-list__btn roles-list__btn--danger" onClick={() => handleDelete(role)}>
                            Удалить
                          </button>
                        </>
                      ) : (
                        <span className="roles-list__system-note">нельзя изменить</span>
                      )}
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

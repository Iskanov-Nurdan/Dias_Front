import React from 'react';
import { Lock, Pencil, Trash2 } from 'lucide-react';
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
        <div className="ui-list__table-wrap">
          <table className="ui-list__table">
            <thead>
              <tr>
                <th>Название</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={2} className="ui-list__skeleton-cell">
                    <SkeletonTable rows={4} cols={2} />
                  </td>
                </tr>
              ) : !list.length ? (
                <tr>
                  <td colSpan={2} className="ui-list__empty-cell">
                    <EmptyState compact tableCell message="Нет ролей" />
                  </td>
                </tr>
              ) : list.map((role, idx) => {
                const system = isSystemRole(role);
                return (
                  <tr
                    key={role.id}
                    className={system ? 'roles-list__row--system' : ''}
                    style={{ '--row-i': idx }}
                  >
                    <td>
                      <div className="ui-list__name-cell">
                        {system ? (
                          <span className="ui-avatar ui-avatar--icon"><Lock size={14} /></span>
                        ) : (
                          <span className="ui-avatar">{(role.name || '?').slice(0, 1).toUpperCase()}</span>
                        )}
                        <span className="ui-list__title">{role.name || '—'}</span>
                        {system && <span className="ui-pill">Системная</span>}
                      </div>
                    </td>
                    <td className="ui-list__actions">
                      {!system ? (
                        <>
                          <button type="button" className="ui-list-btn ui-list-btn--edit" onClick={() => handleEdit(role)}>
                            <Pencil size={13} /> Изменить
                          </button>
                          <button type="button" className="ui-list-btn ui-list-btn--danger" onClick={() => handleDelete(role)}>
                            <Trash2 size={13} /> Удалить
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

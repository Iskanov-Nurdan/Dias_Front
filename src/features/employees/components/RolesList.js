import React, { useEffect, useState } from 'react';
import {
  Lock, Pencil, Trash2, MoreVertical,
} from 'lucide-react';
import {
  ErrorState, EmptyState, ConfirmModal, SkeletonTable, ActionSheet,
} from '../../../shared/ui';
import './RolesList.scss';

const MOBILE_MQ = '(max-width: 768px)';

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
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches,
  );
  const [menuRole, setMenuRole] = useState(null);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

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

  const closeMenu = () => setMenuRole(null);
  const handleMenuAction = (action) => {
    if (!menuRole) return;
    const role = menuRole;
    closeMenu();
    action(role);
  };

  const renderMobileCards = () => (
    <div className="roles-list__cards">
      {list.map((role, idx) => {
        const system = isSystemRole(role);
        return (
          <article
            key={role.id}
            className={`roles-list__card${system ? ' roles-list__card--system' : ''}`}
            style={{ '--row-i': idx }}
            onClick={system ? undefined : () => handleEdit(role)}
          >
            {system ? (
              <span className="ui-avatar ui-avatar--icon"><Lock size={14} /></span>
            ) : (
              <span className="ui-avatar">{(role.name || '?').slice(0, 1).toUpperCase()}</span>
            )}
            <div className="roles-list__card-info">
              <span className="roles-list__card-name">{role.name || '—'}</span>
              {system && <span className="ui-pill">Системная</span>}
            </div>
            {!system && (
              <button
                type="button"
                className="roles-list__card-menu-btn"
                aria-label="Действия"
                onClick={(e) => { e.stopPropagation(); setMenuRole(role); }}
              >
                <MoreVertical size={17} />
              </button>
            )}
          </article>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="roles-list">
        {loading ? (
          <div className="ui-list__table-wrap">
            <SkeletonTable rows={4} cols={2} />
          </div>
        ) : !list.length ? (
          <div className="roles-list__empty-wrap">
            <EmptyState message="Нет ролей" />
          </div>
        ) : isMobile ? (
          renderMobileCards()
        ) : (
          <div className="ui-list__table-wrap">
            <table className="ui-list__table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((role, idx) => {
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
        )}
      </div>
      <ActionSheet open={!!menuRole} onClose={closeMenu} title={menuRole?.name}>
        <button type="button" className="action-sheet__item" onClick={() => handleMenuAction(handleEdit)}>
          <Pencil size={17} /> Изменить
        </button>
        <button type="button" className="action-sheet__item action-sheet__item--danger action-sheet__item--divider" onClick={() => handleMenuAction(handleDelete)}>
          <Trash2 size={17} /> Удалить
        </button>
      </ActionSheet>
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

import React, { useState, useEffect } from 'react';
import { KeyRound, Pencil, Trash2, MoreVertical } from 'lucide-react';
import { ErrorState, EmptyState, ConfirmModal, SkeletonTable, ActionSheet } from '../../../shared/ui';
import './EmployeesList.scss';

const MOBILE_MQ = '(max-width: 768px)';

const getInitials = (name) =>
  (name || '').split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

const EmployeeAvatar = ({ name, className = 'ui-avatar' }) => (
  <span className={className} aria-hidden>{getInitials(name)}</span>
);

const EmployeesList = ({
  items,
  roles,
  loading,
  error,
  onRetry,
  onEdit,
  onDelete,
  onAccess,
  confirmDelete,
  onConfirmDelete,
  onCancelDelete,
  emptyStateActionLabel,
  emptyStateOnAction,
}) => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches,
  );
  const [menuEmployee, setMenuEmployee] = useState(null);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const list = items?.items ?? items ?? [];
  const roleNameById = (roles || []).reduce((o, r) => ({ ...o, [r.id]: r.name }), {});
  const getRoleName = (emp) => roleNameById[emp.role] ?? null;

  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  const closeMenu = () => setMenuEmployee(null);
  const handleMenuAction = (action) => {
    if (!menuEmployee) return;
    const emp = menuEmployee;
    closeMenu();
    action(emp);
  };

  const renderMobileCards = () => (
    <div className="employees-list__cards">
      {list.map((emp, idx) => {
        const roleName = getRoleName(emp);
        return (
          <article
            key={emp.id}
            className="employees-list__card"
            style={{ '--row-i': idx }}
            onClick={() => onEdit(emp)}
          >
            <EmployeeAvatar name={emp.name} className="ui-avatar ui-avatar--lg" />
            <div className="employees-list__card-info">
              <div className="employees-list__card-name">{emp.name || '—'}</div>
              {roleName && <span className="ui-pill ui-pill--info">{roleName}</span>}
            </div>
            <button
              type="button"
              className="employees-list__card-menu-btn"
              aria-label="Действия"
              onClick={(e) => { e.stopPropagation(); setMenuEmployee(emp); }}
            >
              <MoreVertical size={17} />
            </button>
          </article>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="employees-list">
        <div className="ui-list__table-wrap employees-list__table-wrap">
          {loading ? (
            <SkeletonTable rows={8} cols={3} />
          ) : !list.length ? (
            <div className="employees-list__empty-wrap">
              <EmptyState message="Нет сотрудников" actionLabel={emptyStateActionLabel} onAction={emptyStateOnAction} />
            </div>
          ) : isMobile ? (
            renderMobileCards()
          ) : (
            <table className="ui-list__table employees-list__table">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Роль</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((emp, idx) => {
                  const roleName = getRoleName(emp);
                  return (
                    <tr key={emp.id} style={{ '--row-i': idx }}>
                      <td>
                        <div className="ui-list__name-cell">
                          <EmployeeAvatar name={emp.name} />
                          <span className="ui-list__title">{emp.name || '—'}</span>
                        </div>
                      </td>
                      <td>
                        {roleName ? (
                          <span className="ui-pill ui-pill--info">{roleName}</span>
                        ) : '—'}
                      </td>
                      <td className="ui-list__actions">
                        <button type="button" className="ui-list-btn" onClick={() => onAccess(emp)}><KeyRound size={13} /> Доступы</button>
                        <button type="button" className="ui-list-btn ui-list-btn--edit" onClick={() => onEdit(emp)}><Pencil size={13} /> Изменить</button>
                        <button type="button" className="ui-list-btn ui-list-btn--danger" onClick={() => onDelete(emp)}><Trash2 size={13} /> Удалить</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <ActionSheet open={!!menuEmployee} onClose={closeMenu} title={menuEmployee?.name}>
        <button type="button" className="action-sheet__item" onClick={() => handleMenuAction(onEdit)}>
          <Pencil size={17} /> Изменить
        </button>
        <button type="button" className="action-sheet__item" onClick={() => handleMenuAction(onAccess)}>
          <KeyRound size={17} /> Доступы
        </button>
        <button type="button" className="action-sheet__item action-sheet__item--danger action-sheet__item--divider" onClick={() => handleMenuAction(onDelete)}>
          <Trash2 size={17} /> Удалить
        </button>
      </ActionSheet>
      {confirmDelete && (
        <ConfirmModal
          title="Удалить сотрудника?"
          message={confirmDelete.name ? `Сотрудник: ${confirmDelete.name}` : undefined}
          confirmText="Удалить"
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
          danger
        />
      )}
    </>
  );
};

export default EmployeesList;

import React, { useCallback, useState, useEffect } from 'react';
import { List } from 'react-window';
import { ErrorState, EmptyState, ConfirmModal, SkeletonTable } from '../../../shared/ui';
import './EmployeesList.scss';

const MOBILE_MQ = '(max-width: 768px)';
const ROW_HEIGHT = 52;
const VIRTUALIZE_THRESHOLD = 30;
const LIST_HEIGHT = 420;

const EmployeesList = ({
  items,
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

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const list = items?.items ?? items ?? [];
  const useVirtual = !isMobile && list.length > VIRTUALIZE_THRESHOLD;

  const Row = useCallback(
    ({ index, style }) => {
      const emp = list[index];
      return (
        <div className="employees-list__virtual-row" style={style} role="row">
          <div className="employees-list__virtual-cell">{emp.fio || '—'}</div>
          <div className="employees-list__virtual-cell">{emp.login || '—'}</div>
          <div className="employees-list__virtual-cell">{emp.phone || '—'}</div>
          <div className="employees-list__virtual-cell">{emp.roleName ?? emp.role?.name ?? '—'}</div>
          <div className="employees-list__virtual-cell employees-list__actions">
            <button type="button" className="employees-list__btn" onClick={() => onAccess(emp)}>Доступы</button>
            <button type="button" className="employees-list__btn employees-list__btn--primary" onClick={() => onEdit(emp)}>Изменить</button>
            <button type="button" className="employees-list__btn employees-list__btn--danger" onClick={() => onDelete(emp)}>Удалить</button>
          </div>
        </div>
      );
    },
    [list, onAccess, onEdit, onDelete],
  );

  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  const renderMobileCards = () => (
    <div className="employees-list__cards">
      {list.map((emp) => (
        <article key={emp.id} className="employees-list__card">
          <div className="employees-list__card-head">
            <div className="employees-list__card-name" title={emp.fio || undefined}>{emp.fio || '—'}</div>
            <div className="employees-list__card-role">{emp.roleName ?? emp.role?.name ?? '—'}</div>
          </div>
          <dl className="employees-list__card-dl">
            <div className="employees-list__card-row">
              <dt>Логин</dt>
              <dd title={emp.login || undefined}>{emp.login || '—'}</dd>
            </div>
            <div className="employees-list__card-row">
              <dt>Телефон</dt>
              <dd>{emp.phone || '—'}</dd>
            </div>
          </dl>
          <div className="employees-list__card-actions">
            <button type="button" className="employees-list__card-btn employees-list__card-btn--primary" onClick={() => onEdit(emp)}>Изменить</button>
            <details className="employees-list__card-more">
              <summary className="employees-list__card-more-summary">Ещё действия</summary>
              <div className="employees-list__card-more-body">
                <button type="button" className="employees-list__card-btn employees-list__card-btn--secondary" onClick={() => onAccess(emp)}>Доступы</button>
                <button type="button" className="employees-list__card-btn employees-list__card-btn--danger" onClick={() => onDelete(emp)}>Удалить</button>
              </div>
            </details>
          </div>
        </article>
      ))}
    </div>
  );

  return (
    <>
      <div className="employees-list">
        <div className="employees-list__table-wrap">
          {loading ? (
            <SkeletonTable rows={8} cols={5} />
          ) : !list.length ? (
            <div className="employees-list__empty-wrap">
              <EmptyState
                message="Нет сотрудников"
                actionLabel={emptyStateActionLabel}
                onAction={emptyStateOnAction}
              />
            </div>
          ) : isMobile ? (
            renderMobileCards()
          ) : useVirtual ? (
            <>
              <div className="employees-list__virtual-header" role="row">
                <div className="employees-list__virtual-cell">ФИО</div>
                <div className="employees-list__virtual-cell">Логин</div>
                <div className="employees-list__virtual-cell">Телефон</div>
                <div className="employees-list__virtual-cell">Роль</div>
                <div className="employees-list__virtual-cell" />
              </div>
              <List
                height={Math.min(LIST_HEIGHT, list.length * ROW_HEIGHT)}
                itemCount={list.length}
                itemSize={ROW_HEIGHT}
                width="100%"
                className="employees-list__virtual-list"
              >
                {Row}
              </List>
            </>
          ) : (
            <table className="employees-list__table">
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>Логин</th>
                  <th>Телефон</th>
                  <th>Роль</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((emp) => (
                  <tr key={emp.id}>
                    <td>{emp.fio || '—'}</td>
                    <td>{emp.login || '—'}</td>
                    <td>{emp.phone || '—'}</td>
                    <td>{emp.roleName ?? emp.role?.name ?? '—'}</td>
                    <td className="employees-list__actions">
                      <button type="button" className="employees-list__btn" onClick={() => onAccess(emp)}>Доступы</button>
                      <button type="button" className="employees-list__btn employees-list__btn--primary" onClick={() => onEdit(emp)}>Изменить</button>
                      <button type="button" className="employees-list__btn employees-list__btn--danger" onClick={() => onDelete(emp)}>Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {confirmDelete && (
        <ConfirmModal
          title="Удалить сотрудника?"
          message={confirmDelete.fio ? `Сотрудник: ${confirmDelete.fio}` : undefined}
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

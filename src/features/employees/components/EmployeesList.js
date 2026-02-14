import React, { useCallback } from 'react';
import { List } from 'react-window';
import { ErrorState, EmptyState, ConfirmModal, SkeletonTable } from '../../../shared/ui';
import './EmployeesList.scss';

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
  const list = items?.items ?? items ?? [];
  const useVirtual = list.length > VIRTUALIZE_THRESHOLD;

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
            <button type="button" className="employees-list__btn" onClick={() => onEdit(emp)}>Изменить</button>
            <button type="button" className="employees-list__btn employees-list__btn--danger" onClick={() => onDelete(emp)}>Удалить</button>
          </div>
        </div>
      );
    },
    [list, onAccess, onEdit, onDelete]
  );

  if (error) return <ErrorState message={error} onRetry={onRetry} />;

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
                    <button type="button" className="employees-list__btn" onClick={() => onEdit(emp)}>Изменить</button>
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

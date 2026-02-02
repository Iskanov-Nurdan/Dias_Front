import React from 'react';
import { ErrorState, EmptyState, ConfirmModal } from '../../../shared/ui';
import './EmployeesList.scss';

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
}) => {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  const list = items?.items ?? items ?? [];

  return (
    <>
      <div className="employees-list">
        <div className="employees-list__table-wrap">
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
              {loading ? (
                <tr>
                  <td colSpan={5} className="employees-list__loading-cell">
                    <span className="loading-inline">
                      <span className="loading-inline__spinner" aria-hidden />
                      Загрузка…
                    </span>
                  </td>
                </tr>
              ) : !list.length ? (
                <tr>
                  <td colSpan={5} className="employees-list__empty-cell">
                    <EmptyState message="Нет сотрудников" />
                  </td>
                </tr>
              ) : list.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.fio || emp.fio || '—'}</td>
                  <td>{emp.login || '—'}</td>
                  <td>{emp.phone || '—'}</td>
                  <td>{emp.roleName ?? emp.role?.name ?? '—'}</td>
                  <td className="employees-list__actions">
                    <button type="button" className="employees-list__btn" onClick={() => onAccess(emp)}>
                      Доступы
                    </button>
                    <button type="button" className="employees-list__btn" onClick={() => onEdit(emp)}>
                      Изменить
                    </button>
                    <button type="button" className="employees-list__btn employees-list__btn--danger" onClick={() => onDelete(emp)}>
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

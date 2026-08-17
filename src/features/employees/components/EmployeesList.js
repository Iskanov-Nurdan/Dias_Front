import React, { useCallback, useState, useEffect } from 'react';
import { List } from 'react-window';
import { KeyRound, Pencil, Trash2 } from 'lucide-react';
import { ErrorState, EmptyState, ConfirmModal, SkeletonTable } from '../../../shared/ui';
import './EmployeesList.scss';

const MOBILE_MQ = '(max-width: 768px)';
const ROW_HEIGHT = 56;
const VIRTUALIZE_THRESHOLD = 30;
const LIST_HEIGHT = 448;

const getInitials = (fio) =>
  (fio || '').split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

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
      const initials = getInitials(emp.fio);
      return (
        <div className="employees-list__virtual-row" style={style} role="row">
          <div className="employees-list__virtual-cell employees-list__cell--name">
            <span className="ui-avatar">{initials}</span>
            <span className="ui-list__title">{emp.fio || '—'}</span>
          </div>
          <div className="employees-list__virtual-cell">{emp.login || '—'}</div>
          <div className="employees-list__virtual-cell">{emp.phone || '—'}</div>
          <div className="employees-list__virtual-cell">
            {(emp.roleName ?? emp.role?.name) ? (
              <span className="ui-pill ui-pill--info">{emp.roleName ?? emp.role?.name}</span>
            ) : '—'}
          </div>
          <div className="employees-list__virtual-cell ui-list__actions">
            <button type="button" className="ui-list-btn" onClick={() => onAccess(emp)}><KeyRound size={13} /> Доступы</button>
            <button type="button" className="ui-list-btn ui-list-btn--edit" onClick={() => onEdit(emp)}><Pencil size={13} /> Изменить</button>
            <button type="button" className="ui-list-btn ui-list-btn--danger" onClick={() => onDelete(emp)}><Trash2 size={13} /> Удалить</button>
          </div>
        </div>
      );
    },
    [list, onAccess, onEdit, onDelete],
  );

  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  const renderMobileCards = () => (
    <div className="employees-list__cards">
      {list.map((emp) => {
        const initials = getInitials(emp.fio);
        const roleName = emp.roleName ?? emp.role?.name;
        return (
          <article key={emp.id} className="employees-list__card">
            <div className="employees-list__card-head">
              <span className="ui-avatar ui-avatar--lg">{initials}</span>
              <div>
                <div className="employees-list__card-name">{emp.fio || '—'}</div>
                {roleName && <span className="ui-pill ui-pill--info">{roleName}</span>}
              </div>
            </div>
            <dl className="employees-list__card-dl">
              <div className="employees-list__card-row">
                <dt>Логин</dt>
                <dd>{emp.login || '—'}</dd>
              </div>
              {emp.phone && (
                <div className="employees-list__card-row">
                  <dt>Телефон</dt>
                  <dd>{emp.phone}</dd>
                </div>
              )}
            </dl>
            <div className="employees-list__card-actions">
              <button type="button" className="ui-list-btn ui-list-btn--edit employees-list__card-btn" onClick={() => onEdit(emp)}><Pencil size={13} /> Изменить</button>
              <details className="employees-list__card-more">
                <summary className="employees-list__card-more-summary">Ещё</summary>
                <div className="employees-list__card-more-body">
                  <button type="button" className="ui-list-btn employees-list__card-btn" onClick={() => onAccess(emp)}><KeyRound size={13} /> Доступы</button>
                  <button type="button" className="ui-list-btn ui-list-btn--danger employees-list__card-btn" onClick={() => onDelete(emp)}><Trash2 size={13} /> Удалить</button>
                </div>
              </details>
            </div>
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
            <SkeletonTable rows={8} cols={5} />
          ) : !list.length ? (
            <div className="employees-list__empty-wrap">
              <EmptyState message="Нет сотрудников" actionLabel={emptyStateActionLabel} onAction={emptyStateOnAction} />
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
            <table className="ui-list__table employees-list__table">
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
                {list.map((emp) => {
                  const initials = getInitials(emp.fio);
                  const roleName = emp.roleName ?? emp.role?.name;
                  return (
                    <tr key={emp.id}>
                      <td>
                        <div className="ui-list__name-cell">
                          <span className="ui-avatar">{initials}</span>
                          <span className="ui-list__title">{emp.fio || '—'}</span>
                        </div>
                      </td>
                      <td className="ui-list__muted">{emp.login || '—'}</td>
                      <td className="ui-list__muted">{emp.phone || '—'}</td>
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

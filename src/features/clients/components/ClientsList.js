import React from 'react';
import { ErrorState, EmptyState, SkeletonTable } from '../../../shared/ui';
import { isClientPaid } from '../../../shared/constants/common';
import { composeClientDataRowClass } from '../lib/clientRowHighlight';
import './ClientsList.scss';

const ClientsList = ({
  items,
  loading,
  error,
  onRetry,
  onEdit,
  onDelete,
  onDetails,
  onExtend,
  emptyMessage,
  emptyStateActionLabel,
  emptyStateOnAction,
}) => {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  const list = items?.items ?? items?.results ?? items ?? [];

  return (
    <div className="clients-list">
      <div className="clients-list__table-wrap">
        <table className="clients-list__table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Дата начала</th>
              <th>Вид спорта</th>
              <th>Оплачено</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="clients-list__skeleton-cell">
                  <SkeletonTable rows={8} cols={5} />
                </td>
              </tr>
            ) : !list.length ? (
              <tr>
                <td colSpan={5} className="clients-list__empty-cell">
                  <EmptyState
                    compact
                    tableCell
                    message={emptyMessage || 'Нет клиентов'}
                    actionLabel={emptyStateActionLabel}
                    onAction={emptyStateOnAction}
                  />
                </td>
              </tr>
            ) : list.map((c) => {
              const paid = isClientPaid(c);
              const dateStart = c.dateStart ?? c.date_start;
              const rowClass = composeClientDataRowClass(c, 'clients-list__row');
              return (
                <tr key={c.id} className={rowClass}>
                  <td data-label="ФИО" title={c.fio || undefined}>{c.fio || '—'}</td>
                  <td data-label="Дата начала">{dateStart ? new Date(dateStart).toLocaleDateString() : '—'}</td>
                  <td data-label="Вид спорта" title={(c.sportName ?? c.sport?.name) || undefined}>{c.sportName ?? c.sport?.name ?? '—'}</td>
                  <td data-label="Оплачено">{paid ? 'Да' : 'Нет'}</td>
                  <td className="clients-list__actions" data-label="">
                    <button type="button" className="clients-list__btn clients-list__btn--primary" onClick={() => onDetails(c)}>Подробнее</button>
                    <button type="button" className="clients-list__btn" onClick={() => onExtend(c)}>Продлить</button>
                  </td>
                </tr>
              );
            }) }
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClientsList;

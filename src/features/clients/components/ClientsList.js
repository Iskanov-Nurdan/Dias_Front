import React from 'react';
import { ErrorState, EmptyState, SkeletonTable } from '../../../shared/ui';
import { isClientPaid, isClientSubscriptionExpired } from '../../../shared/constants/common';
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
              const expired = isClientSubscriptionExpired(c);
              const paid = isClientPaid(c);
              const dateStart = c.dateStart ?? c.date_start;
              let rowClass = 'clients-list__row';
              if (expired) rowClass += ' clients-list__row--subscription-expired';
              else if (!paid) rowClass += ' clients-list__row--unpaid';
              else if (c.clientType === 'one-time') rowClass += ' clients-list__row--one-time';
              else if (c.clientType === 'individual') rowClass += ' clients-list__row--individual';
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

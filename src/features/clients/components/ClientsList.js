import React from 'react';
import { ErrorState, EmptyState, Skeleton } from '../../../shared/ui';
import { isClientPaid } from '../../../shared/constants/common';
import './ClientsList.scss';

const ClientsList = ({ items, loading, error, onRetry, onEdit, onDelete, onDetails, onExtend }) => {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  const list = items?.items ?? items?.results ?? items ?? [];

  return (
    <div className="clients-list">
      <div className="clients-list__table-wrap">
        <table className="clients-list__table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Телефон</th>
              <th>Вид спорта</th>
              <th>Оплачено</th>
              <th>Тип</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }, (_, i) => (
                <tr key={`sk-${i}`}>
                  {Array.from({ length: 6 }, (_, j) => (
                    <td key={j}><Skeleton variant="text" /></td>
                  ))}
                </tr>
              ))
            ) : !list.length ? (
              <tr>
                <td colSpan={6} className="clients-list__empty-cell">
                  <EmptyState message="Нет клиентов" />
                </td>
              </tr>
            ) : list.map((c) => (
              <tr
                key={c.id}
                className={
                  !isClientPaid(c)
                    ? 'clients-list__row clients-list__row--unpaid'
                    : c.clientType === 'one-time'
                      ? 'clients-list__row clients-list__row--one-time'
                      : c.clientType === 'individual'
                        ? 'clients-list__row clients-list__row--individual'
                        : 'clients-list__row'
                }
              >
                <td data-label="ФИО">{c.fio || '—'}</td>
                <td data-label="Телефон">{c.phone || '—'}</td>
                <td data-label="Вид спорта">{c.sportName ?? c.sport?.name ?? '—'}</td>
                <td data-label="Оплачено">{isClientPaid(c) ? 'Да' : 'Нет'}</td>
                <td data-label="Тип" className={c.clientType === 'individual' ? 'clients-list__type-cell clients-list__type-cell--individual' : c.clientType === 'one-time' ? 'clients-list__type-cell clients-list__type-cell--one-time' : ''}>{c.clientType === 'individual' ? 'Индивид.' : c.clientType === 'regular' ? 'Регуляр' : c.clientType === 'one-time' ? 'Разовый' : c.clientType || '—'}</td>
                <td className="clients-list__actions" data-label="">
                  <button type="button" className="clients-list__btn" onClick={() => onDetails(c)}>Подробнее</button>
                  <button type="button" className="clients-list__btn" onClick={() => onExtend(c)}>Продлить</button>
                </td>
              </tr>
            )) }
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClientsList;

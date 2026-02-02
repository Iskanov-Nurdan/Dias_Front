import React from 'react';
import { ErrorState, EmptyState } from '../../../shared/ui';
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
              <tr>
                <td colSpan={6} className="clients-list__loading-cell">
                  <span className="loading-inline">
                    <span className="loading-inline__spinner" aria-hidden />
                    Загрузка…
                  </span>
                </td>
              </tr>
            ) : !list.length ? (
              <tr>
                <td colSpan={6} className="clients-list__empty-cell">
                  <EmptyState message="Нет клиентов" />
                </td>
              </tr>
            ) : list.map((c) => (
              <tr key={c.id}>
                <td>{c.fio || '—'}</td>
                <td>{c.phone || '—'}</td>
                <td>{c.sportName ?? c.sport?.name ?? '—'}</td>
                <td>{c.paid ? 'Да' : 'Нет'}</td>
                <td>{c.clientType === 'individual' ? 'Индивид.' : c.clientType === 'regular' ? 'Регуляр' : c.clientType || '—'}</td>
                <td className="clients-list__actions">
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

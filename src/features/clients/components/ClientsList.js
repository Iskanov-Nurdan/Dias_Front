import React from 'react';
import { Loading, ErrorState, EmptyState } from '../../../shared/ui';
import './ClientsList.scss';

const ClientsList = ({ items, loading, error, onRetry, onAdd, onEdit, onDelete, onDetails, onExtend }) => {
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  const list = items?.items ?? items?.results ?? items ?? [];

  return (
    <div className="clients-list">
      <div className="clients-list__toolbar">
        <button type="button" className="clients-list__add" onClick={onAdd}>Добавить клиента</button>
      </div>
      {!list.length ? (
        <EmptyState message="Нет клиентов" />
      ) : (
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
            {list.map((c) => (
              <tr key={c.id}>
                <td>{c.fio || '—'}</td>
                <td>{c.phone || '—'}</td>
                <td>{c.sportName ?? c.sport?.name ?? '—'}</td>
                <td>{c.paid ? 'Да' : 'Нет'}</td>
                <td>{c.clientType === 'individual' ? 'Индивид.' : c.clientType === 'regular' ? 'Регуляр' : c.clientType || '—'}</td>
                <td className="clients-list__actions">
                  <button type="button" className="clients-list__btn" onClick={() => onDetails(c)}>Подробнее</button>
                  <button type="button" className="clients-list__btn" onClick={() => onExtend(c)}>Продлить</button>
                  <button type="button" className="clients-list__btn" onClick={() => onEdit(c)}>Изменить</button>
                  <button type="button" className="clients-list__btn clients-list__btn--danger" onClick={() => onDelete(c)}>Удалить</button>
                </td>
              </tr>
            ))}
            </tbody>
        </table>
      </div>
      )}
    </div>
  );
};

export default ClientsList;

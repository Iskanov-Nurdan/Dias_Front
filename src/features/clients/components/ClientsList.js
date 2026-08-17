import React from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import { ErrorState, EmptyState, SkeletonTable } from '../../../shared/ui';
import { isClientPaid } from '../../../shared/constants/common';
import { composeClientDataRowClass } from '../lib/clientRowHighlight';
import './ClientsList.scss';

const getInitials = (fio) =>
  (fio || '').split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

const TYPE_LABEL = {
  individual: { label: 'Индивид.', cls: 'clients-list__type-badge--individual' },
  regular:    { label: 'Регуляр',  cls: 'clients-list__type-badge--regular'    },
  'one-time': { label: 'Разовый', cls: 'clients-list__type-badge--onetime'    },
};

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
      <div className="ui-list__table-wrap clients-list__table-wrap">
        <table className="ui-list__table clients-list__table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Дата начала</th>
              <th>Вид спорта</th>
              <th>Оплата</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="ui-list__skeleton-cell clients-list__skeleton-cell">
                  <SkeletonTable rows={8} cols={5} />
                </td>
              </tr>
            ) : !list.length ? (
              <tr>
                <td colSpan={5} className="ui-list__empty-cell clients-list__empty-cell">
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
              const initials = getInitials(c.fio);
              const typeInfo = TYPE_LABEL[c.clientType];
              const sportName = c.sportName ?? c.sport?.name;
              return (
                <tr key={c.id} className={rowClass}>
                  <td data-label="ФИО">
                    <div className="ui-list__name-cell clients-list__name-cell">
                      <span className="ui-avatar">{initials}</span>
                      <div className="ui-list__name-info clients-list__name-info">
                        <span className="ui-list__title">{c.fio || '—'}</span>
                        {typeInfo && (
                          <span className={`ui-pill clients-list__type-badge ${typeInfo.cls}`}>{typeInfo.label}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td data-label="Дата начала" className="ui-list__muted">
                    {dateStart ? new Date(dateStart).toLocaleDateString('ru-RU') : '—'}
                  </td>
                  <td data-label="Вид спорта" title={sportName || undefined}>
                    <span className="clients-list__sport">{sportName ?? '—'}</span>
                  </td>
                  <td data-label="Оплата">
                    <span className={`ui-pill ${paid ? 'ui-pill--success' : 'ui-pill--danger'}`}>
                      {paid ? 'Оплачено' : 'Не оплачено'}
                    </span>
                  </td>
                  <td className="ui-list__actions" data-label="">
                    <button type="button" className="ui-list-btn clients-list__btn" onClick={() => onDetails(c)}>
                      <Eye size={13} /> Подробнее
                    </button>
                    <button type="button" className="ui-list-btn ui-list-btn--primary clients-list__btn" onClick={() => onExtend(c)}>
                      <RefreshCw size={13} /> Продлить
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClientsList;

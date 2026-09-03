import React, { useState } from 'react';
import { Eye, RefreshCw, AlertTriangle } from 'lucide-react';
import { ErrorState, EmptyState, SkeletonTable } from '../../../shared/ui';
import { isClientPaid, isClientSubscriptionExpired } from '../../../shared/constants/common';
import { composeClientDataRowClass } from '../lib/clientRowHighlight';
import { addClientWarning } from '../api';
import { getApiErrorMessage } from '../../../shared/lib/apiError';
import { MAX_WARNINGS } from '../lib/clientWarnings';
import WarnClientModal from './WarnClientModal';
import './ClientsList.scss';

const getWarningCount = (c) => Number(c?.warningCount ?? c?.warning_count) || 0;

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
  const [confirmWarnClient, setConfirmWarnClient] = useState(null);
  const [warnSaving, setWarnSaving] = useState(false);
  const [warnError, setWarnError] = useState(null);
  const list = items?.items ?? items?.results ?? items ?? [];

  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  const handleAddWarning = async (clientId) => {
    setWarnSaving(true);
    setWarnError(null);
    try {
      await addClientWarning(clientId);
      setConfirmWarnClient(null);
      onRetry?.();
    } catch (e) {
      setWarnError(getApiErrorMessage(e));
    } finally {
      setWarnSaving(false);
    }
  };

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
            ) : list.map((c, idx) => {
              const paid = isClientPaid(c);
              const dateStart = c.dateStart ?? c.date_start;
              const rowClass = composeClientDataRowClass(c, 'clients-list__row');
              const initials = getInitials(c.fio);
              const typeInfo = TYPE_LABEL[c.clientType];
              const sportName = c.sportName ?? c.sport?.name;
              const warningCount = getWarningCount(c);
              const isMaxWarned = warningCount >= MAX_WARNINGS;
              // Предупреждение — для тех, кто не оплатил, но срок абонемента ещё не истёк
              // (для просроченных/не продливших это уже "Не продлили", не сюда).
              const canWarn = !paid && !isClientSubscriptionExpired(c);
              return (
                <tr
                  key={c.id}
                  className={`${rowClass}${isMaxWarned ? ' clients-list__row--warned-max' : ''}`}
                  style={{ '--row-i': idx }}
                >
                  <td data-label="ФИО">
                    <div className="ui-list__name-cell clients-list__name-cell">
                      <span className="ui-avatar">{initials}</span>
                      <div className="ui-list__name-info clients-list__name-info">
                        <span className="ui-list__title">{c.fio || '—'}</span>
                        <div className="clients-list__badges">
                          {typeInfo && (
                            <span className={`ui-pill clients-list__type-badge ${typeInfo.cls}`}>{typeInfo.label}</span>
                          )}
                          {warningCount > 0 && (
                            <span className={`ui-pill ${isMaxWarned ? 'ui-pill--danger' : 'ui-pill--warning'}`} title={isMaxWarned ? 'Максимум предупреждений — нужно связаться с клиентом' : 'Предупреждения'}>
                              <AlertTriangle size={11} /> {warningCount}/{MAX_WARNINGS}
                            </span>
                          )}
                        </div>
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
                    {canWarn && warningCount < MAX_WARNINGS && (
                      <button
                        type="button"
                        className="ui-list-btn ui-list-btn--warning clients-list__btn"
                        onClick={() => setConfirmWarnClient(c)}
                        title="Поставить предупреждение за неоплату"
                      >
                        <AlertTriangle size={13} /> Предупреждение
                      </button>
                    )}
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
      {confirmWarnClient && (
        <WarnClientModal
          client={confirmWarnClient}
          currentCount={getWarningCount(confirmWarnClient)}
          saving={warnSaving}
          error={warnError}
          onConfirm={() => handleAddWarning(confirmWarnClient.id)}
          onClose={() => { setConfirmWarnClient(null); setWarnError(null); }}
        />
      )}
    </div>
  );
};

export default ClientsList;

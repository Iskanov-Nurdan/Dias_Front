import React, { useState } from 'react';
import { Eye, RefreshCw, AlertTriangle, MessageCircle, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { ErrorState, EmptyState, SkeletonTable } from '../../../shared/ui';
import { isClientPaid, isClientSubscriptionExpired, formatSubscriptionEnd } from '../../../shared/constants/common';
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
  // onEdit/onDelete здесь не нужны: правка и удаление живут в карточке клиента,
  // в строке списка кнопок для них нет.
  onDetails,
  onExtend,
  emptyMessage,
  emptyStateActionLabel,
  emptyStateOnAction,
  ordering,
  onSort,
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


  /**
   * Заголовок-кнопка сортировки. Стрелка показывает текущее направление,
   * серые стрелки — «по этому столбцу можно отсортировать».
   */
  const SortTh = ({ field, children, className }) => {
    if (!onSort) return <th className={className}>{children}</th>;
    const active = ordering === field || ordering === `-${field}`;
    const desc = ordering === `-${field}`;
    return (
      <th className={className}>
        <button
          type="button"
          className={`clients-list__sort${active ? ' clients-list__sort--active' : ''}`}
          onClick={() => onSort(active && !desc ? `-${field}` : field)}
        >
          {children}
          {!active && <ChevronsUpDown size={12} />}
          {active && (desc ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
        </button>
      </th>
    );
  };

  return (
    <div className="clients-list">
      <div className="ui-list__table-wrap clients-list__table-wrap">
        <table className="ui-list__table clients-list__table">
          <thead>
            <tr>
              <SortTh field="fio" className="clients-list__col-name">Клиент</SortTh>
              <SortTh field="dateStart" className="clients-list__col-period">Период</SortTh>
              <SortTh field="sport" className="clients-list__col-sport">Вид спорта</SortTh>
              <SortTh field="paid" className="clients-list__col-pay">Оплата</SortTh>
              <th className="clients-list__col-actions" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="ui-list__skeleton-cell clients-list__skeleton-cell">
                  <SkeletonTable rows={8} cols={5} />
                </td>
              </tr>
            ) : !list.length ? (
              <tr>
                <td colSpan={6} className="ui-list__empty-cell clients-list__empty-cell">
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
              // Снимать вручную нечем и не нужно: бэкенд обнуляет счётчик сам,
              // как только клиент переходит в «оплачено», а от случайного клика
              // защищает модалка подтверждения.
              const canWarn = !paid && !isClientSubscriptionExpired(c);
              const subEnd = formatSubscriptionEnd(c);
              const waPhone = String(c.phone || '').replace(/\D/g, '');
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
                  {/* Начало и окончание — одни данные, а не две колонки: так они
                      читаются как период и освобождают ширину под действия */}
                  <td data-label="Период" className="clients-list__col-period">
                    <div className="clients-list__period">
                      <span className="clients-list__period-dates">
                        {dateStart ? new Date(dateStart).toLocaleDateString('ru-RU') : '—'}
                        {subEnd && <span className="clients-list__period-arrow">→</span>}
                        {subEnd && <span className="clients-list__period-end">{subEnd.text}</span>}
                      </span>
                      {subEnd?.note && (
                        <span className={`clients-list__until-note clients-list__until-note--${subEnd.tone}`}>
                          {subEnd.note}
                        </span>
                      )}
                    </div>
                  </td>
                  <td data-label="Вид спорта" className="clients-list__col-sport" title={sportName || undefined}>
                    <span className="clients-list__sport">{sportName ?? '—'}</span>
                  </td>
                  <td data-label="Оплата" className="clients-list__col-pay">
                    <span className={`ui-pill ${paid ? 'ui-pill--success' : 'ui-pill--danger'}`}>
                      {paid ? 'Оплачено' : 'Не оплачено'}
                    </span>
                  </td>
                  {/* Внутренний контейнер обязателен: общий .ui-list__actions ставит
                      display:flex прямо на td, и ячейка перестаёт быть табличной —
                      её ширину перестаёт задавать колонка, из-за чего кнопки
                      разъезжались от строки к строке. */}
                  <td className="clients-list__col-actions" data-label="">
                    <div className="clients-list__actions">
                    {/* Текстом — только главное действие. Остальные иконками:
                        четыре подписи не помещались и вызывали прокрутку вбок */}
                    {canWarn && warningCount < MAX_WARNINGS && (
                      <button
                        type="button"
                        className="clients-list__icon-btn clients-list__icon-btn--warn"
                        onClick={() => setConfirmWarnClient(c)}
                        title="Поставить предупреждение за неоплату"
                        aria-label="Поставить предупреждение за неоплату"
                      >
                        <AlertTriangle size={15} />
                        <span className="clients-list__btn-label">Предупредить</span>
                      </button>
                    )}
                    {waPhone.length >= 9 && !paid && (
                      <a
                        href={`https://wa.me/${waPhone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="clients-list__icon-btn clients-list__icon-btn--wa"
                        onClick={(e) => e.stopPropagation()}
                        title="Написать в WhatsApp"
                        aria-label="Написать в WhatsApp"
                      >
                        <MessageCircle size={15} />
                        <span className="clients-list__btn-label">WhatsApp</span>
                      </a>
                    )}
                    <button
                      type="button"
                      className="clients-list__icon-btn"
                      onClick={() => onDetails(c)}
                      title="Открыть карточку"
                      aria-label="Открыть карточку клиента"
                    >
                      <Eye size={15} />
                      <span className="clients-list__btn-label">Подробнее</span>
                    </button>
                    {/* Главное действие — крупной круглой иконкой без подписи:
                        значок продления узнаваем, а освободившаяся ширина ушла
                        под подписи трёх остальных кнопок */}
                    <button
                      type="button"
                      className="clients-list__extend-btn"
                      onClick={() => onExtend(c)}
                      title="Продлить абонемент"
                      aria-label="Продлить абонемент"
                    >
                      <RefreshCw size={17} strokeWidth={2.2} />
                    </button>
                    </div>
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

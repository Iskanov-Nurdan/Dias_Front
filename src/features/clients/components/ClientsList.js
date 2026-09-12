import React, { useState } from 'react';
import { Eye, RefreshCw, AlertTriangle, ShieldX, MessageCircle, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { ErrorState, EmptyState, SkeletonTable, ConfirmModal } from '../../../shared/ui';
import { isClientPaid, isClientSubscriptionExpired, formatSubscriptionEnd } from '../../../shared/constants/common';
import { composeClientDataRowClass } from '../lib/clientRowHighlight';
import { addClientWarning, resetClientWarning } from '../api';
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
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
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
  onWarningError,
  ordering,
  onSort,
}) => {
  const [confirmWarnClient, setConfirmWarnClient] = useState(null);
  const [confirmUnwarnClient, setConfirmUnwarnClient] = useState(null);
  const [warnSaving, setWarnSaving] = useState(false);
  const [warnError, setWarnError] = useState(null);
  const list = items?.items ?? items?.results ?? items ?? [];
  const picked = selectedIds instanceof Set ? selectedIds : new Set(selectedIds ?? []);
  const allPicked = list.length > 0 && list.every((c) => picked.has(c.id));
  const somePicked = list.some((c) => picked.has(c.id));

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

  /** Поставленное по ошибке предупреждение нужно уметь снять — иначе оно висит на клиенте навсегда. */
  const handleResetWarnings = async (clientId) => {
    setWarnSaving(true);
    try {
      await resetClientWarning(clientId);
      setConfirmUnwarnClient(null);
      onRetry?.();
    } catch (e) {
      setConfirmUnwarnClient(null);
      onWarningError?.(getApiErrorMessage(e));
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
              {/* Массовое выделение: раньше 20 клиентов продлевали двадцатью действиями */}
              {onToggleSelect && (
                <th className="clients-list__pick-cell">
                  <input
                    type="checkbox"
                    className="clients-list__pick"
                    checked={allPicked}
                    ref={(el) => { if (el) el.indeterminate = somePicked && !allPicked; }}
                    onChange={() => onToggleSelectAll?.(!allPicked)}
                    aria-label="Выделить все строки"
                  />
                </th>
              )}
              <SortTh field="fio">ФИО</SortTh>
              <SortTh field="dateStart">Дата начала</SortTh>
              <th>Действует до</th>
              <SortTh field="sport">Вид спорта</SortTh>
              <SortTh field="paid">Оплата</SortTh>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={onToggleSelect ? 7 : 6} className="ui-list__skeleton-cell clients-list__skeleton-cell">
                  <SkeletonTable rows={8} cols={5} />
                </td>
              </tr>
            ) : !list.length ? (
              <tr>
                <td colSpan={onToggleSelect ? 7 : 6} className="ui-list__empty-cell clients-list__empty-cell">
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
              const subEnd = formatSubscriptionEnd(c);
              const waPhone = String(c.phone || '').replace(/\D/g, '');
              return (
                <tr
                  key={c.id}
                  className={`${rowClass}${isMaxWarned ? ' clients-list__row--warned-max' : ''}`}
                  style={{ '--row-i': idx }}
                >
                  {onToggleSelect && (
                    <td className="clients-list__pick-cell" data-label="">
                      <input
                        type="checkbox"
                        className="clients-list__pick"
                        checked={picked.has(c.id)}
                        onChange={() => onToggleSelect(c.id)}
                        aria-label={`Выделить ${c.fio || 'клиента'}`}
                      />
                    </td>
                  )}
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
                  {/* Срок абонемента: сервер присылал dateEnd, но раньше он нигде
                      не показывался — сотрудник не знал, у кого заканчивается завтра */}
                  <td data-label="Действует до">
                    {subEnd ? (
                      <span className={`clients-list__until clients-list__until--${subEnd.tone}`}>
                        {subEnd.text}
                        {subEnd.note && <span className="clients-list__until-note">{subEnd.note}</span>}
                      </span>
                    ) : <span className="ui-list__muted">—</span>}
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
                    {/* Снять предупреждение: поставленное по ошибке иначе оставалось навсегда */}
                    {warningCount > 0 && (
                      <button
                        type="button"
                        className="ui-list-btn clients-list__btn"
                        onClick={() => setConfirmUnwarnClient(c)}
                        title="Снять все предупреждения с клиента"
                      >
                        <ShieldX size={13} /> Снять
                      </button>
                    )}
                    {/* Написать должнику прямо из списка: телефон уже есть,
                        раньше его копировали вручную в мессенджер */}
                    {waPhone.length >= 9 && !paid && (
                      <a
                        href={`https://wa.me/${waPhone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ui-list-btn clients-list__btn clients-list__btn--wa"
                        onClick={(e) => e.stopPropagation()}
                        title="Написать в WhatsApp"
                      >
                        <MessageCircle size={13} /> WhatsApp
                      </a>
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
      {confirmUnwarnClient && (
        <ConfirmModal
          title="Снять предупреждения?"
          message={`${confirmUnwarnClient.fio} — счётчик обнулится (было ${getWarningCount(confirmUnwarnClient)} из ${MAX_WARNINGS})`}
          confirmText={warnSaving ? 'Снимаем…' : 'Снять'}
          onConfirm={() => handleResetWarnings(confirmUnwarnClient.id)}
          onCancel={() => setConfirmUnwarnClient(null)}
        />
      )}
    </div>
  );
};

export default ClientsList;

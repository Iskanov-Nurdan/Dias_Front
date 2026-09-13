import React from 'react';
import { CalendarClock, Pencil, Trash2, KeyRound } from 'lucide-react';
import { ErrorState, EmptyState, ConfirmModal, SkeletonTable } from '../../../shared/ui';
import './TrainersList.scss';

const getInitials = (fio = '') => {
  const parts = fio.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return fio.slice(0, 2).toUpperCase() || '?';
};

const TrainersList = ({
  items,
  sports = [],
  photos = {},
  loading,
  error,
  onRetry,
  onEdit,
  onDelete,
  onSchedule,
  confirmDelete,
  onConfirmDelete,
  onCancelDelete,
  emptyStateActionLabel,
  emptyStateOnAction,
}) => {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  const list = items?.items ?? items?.results ?? (Array.isArray(items) ? items : []);
  const sportsMap = (Array.isArray(sports) ? sports : []).reduce((acc, s) => { acc[s.id] = s.name || ''; return acc; }, {});

  const getSportNames = (t) => {
    const arr = t.sportIds ?? t.sport_ids ?? t.sports ?? [];
    return arr.map((s) => (typeof s === 'object' ? s?.name : (sportsMap[s] ?? sportsMap[Number(s)]))).filter(Boolean);
  };

  return (
    <>
      <div className="trainers-list">
        <div className="ui-list__table-wrap">
          <table className="ui-list__table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Виды спорта</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="ui-list__skeleton-cell">
                    <SkeletonTable rows={8} cols={3} />
                  </td>
                </tr>
              ) : !list.length ? (
                <tr>
                  <td colSpan={3} className="ui-list__empty-cell">
                    <EmptyState
                      compact
                      tableCell
                      message="Нет тренеров"
                      actionLabel={emptyStateActionLabel}
                      onAction={emptyStateOnAction}
                    />
                  </td>
                </tr>
              ) : list.map((t) => {
                const sportNames = getSportNames(t);
                return (
                  <tr key={t.id}>
                    <td data-label="ФИО">
                      <div className="ui-list__name-cell">
                        {/* Фото, если оно загружено в карточке тренера; иначе
                            инициалы. Битую ссылку прячем и откатываемся на них же,
                            чтобы в списке не осталось «сломанной картинки». */}
                        {photos[String(t.id)] ? (
                          <img
                            src={photos[String(t.id)]}
                            alt=""
                            className="ui-avatar trainers-list__avatar-img"
                            loading="lazy"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <span className="ui-avatar">{getInitials(t.fio)}</span>
                        )}
                        <span className="ui-list__title">{t.fio || '—'}</span>
                        {/* Есть вход на сайт — тренер видит «Мой отчёт». Выключенный
                            доступ подсвечен отдельно: логин остался, но не работает. */}
                        {t.hasAccount && (
                          <span
                            className={`ui-pill${t.accountActive ? ' ui-pill--success' : ''} trainers-list__access-pill`}
                            title={t.accountActive ? `Есть доступ на сайт: ${t.accountLogin}` : 'Доступ на сайт выключен'}
                          >
                            <KeyRound size={11} /> {t.accountActive ? 'Доступ' : 'Выключен'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Виды спорта">
                      <div className="trainers-list__sports-cell">
                        {sportNames.length ? sportNames.map((name, i) => (
                          <span key={i} className="ui-pill ui-pill--info">{name}</span>
                        )) : <span className="trainers-list__no-sports">—</span>}
                      </div>
                    </td>
                    <td className="ui-list__actions" data-label="">
                      {onSchedule && (
                        <button type="button" className="ui-list-btn" onClick={() => onSchedule(t)}><CalendarClock size={13} /> График</button>
                      )}
                      <button type="button" className="ui-list-btn ui-list-btn--edit" onClick={() => onEdit(t)}><Pencil size={13} /> Изменить</button>
                      <button type="button" className="ui-list-btn ui-list-btn--danger" onClick={() => onDelete(t)}><Trash2 size={13} /> Удалить</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmModal
          title="Удалить тренера?"
          message={confirmDelete.fio ? `Тренер: ${confirmDelete.fio}` : undefined}
          confirmText="Удалить"
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
          danger
        />
      )}
    </>
  );
};

export default TrainersList;

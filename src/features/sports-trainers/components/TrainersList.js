import React from 'react';
import { Loading, ErrorState, EmptyState, ConfirmModal } from '../../../shared/ui';
import './TrainersList.scss';

const TrainersList = ({ items, loading, error, onRetry, onAdd, onEdit, onDelete, confirmDelete, onConfirmDelete, onCancelDelete }) => {
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  const list = items?.items ?? items?.results ?? (Array.isArray(items) ? items : []);
  if (!list.length) return <EmptyState message="Нет тренеров" />;

  const getSportsLabel = (t) => {
    const arr = t.sportIds ?? t.sport_ids ?? t.sports ?? [];
    return arr.map((s) => (typeof s === 'object' ? s?.name : s)).filter(Boolean).join(', ') || '—';
  };

  return (
    <>
      <div className="trainers-list">
        <div className="trainers-list__toolbar">
          <button type="button" className="trainers-list__add" onClick={onAdd}>Добавить</button>
        </div>
        <div className="trainers-list__table-wrap">
          <table className="trainers-list__table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Виды спорта</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id}>
                  <td>{t.fio || '—'}</td>
                  <td>{getSportsLabel(t)}</td>
                  <td className="trainers-list__actions">
                    <button type="button" className="trainers-list__btn" onClick={() => onEdit(t)}>Изменить</button>
                    <button type="button" className="trainers-list__btn trainers-list__btn--danger" onClick={() => onDelete(t)}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmModal title="Удалить тренера?" message={confirmDelete.fio ? `Тренер: ${confirmDelete.fio}` : undefined} confirmText="Удалить" onConfirm={onConfirmDelete} onCancel={onCancelDelete} danger />
      )}
    </>
  );
};

export default TrainersList;

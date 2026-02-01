import React from 'react';
import { Loading, ErrorState, EmptyState, ConfirmModal } from '../../../shared/ui';
import './SportsList.scss';

const SportsList = ({ items, loading, error, onRetry, onAdd, onEdit, onDelete, confirmDelete, onConfirmDelete, onCancelDelete }) => {
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  const list = Array.isArray(items) ? items : items?.items ?? items?.results ?? [];
  if (!list.length) return <EmptyState message="Нет видов спорта" />;

  return (
    <>
      <div className="sports-list">
        <div className="sports-list__toolbar">
          <button type="button" className="sports-list__add" onClick={onAdd}>Добавить</button>
        </div>
        <div className="sports-list__table-wrap">
          <table className="sports-list__table">
            <thead>
              <tr>
                <th>Название</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td>{s.name || '—'}</td>
                  <td className="sports-list__actions">
                    <button type="button" className="sports-list__btn" onClick={() => onEdit(s)}>Изменить</button>
                    <button type="button" className="sports-list__btn sports-list__btn--danger" onClick={() => onDelete(s)}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmModal title="Удалить вид спорта?" message={confirmDelete.name ? `Вид спорта: ${confirmDelete.name}` : undefined} confirmText="Удалить" onConfirm={onConfirmDelete} onCancel={onCancelDelete} danger />
      )}
    </>
  );
};

export default SportsList;

import React from 'react';
import { Dumbbell, Pencil, Trash2 } from 'lucide-react';
import { ErrorState, EmptyState, ConfirmModal, SkeletonTable } from '../../../shared/ui';
import './SportsList.scss';

const SportsList = ({
  items,
  photos = {},
  loading,
  error,
  onRetry,
  onEdit,
  onDelete,
  confirmDelete,
  onConfirmDelete,
  onCancelDelete,
  emptyStateActionLabel,
  emptyStateOnAction,
}) => {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  const list = Array.isArray(items) ? items : items?.items ?? items?.results ?? [];

  return (
    <>
      <div className="sports-list">
        <div className="ui-list__table-wrap">
          <table className="ui-list__table">
            <thead>
              <tr>
                <th>Название</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={2} className="ui-list__skeleton-cell">
                    <SkeletonTable rows={8} cols={2} />
                  </td>
                </tr>
              ) : !list.length ? (
                <tr>
                  <td colSpan={2} className="ui-list__empty-cell">
                    <EmptyState
                      compact
                      tableCell
                      message="Нет видов спорта"
                      actionLabel={emptyStateActionLabel}
                      onAction={emptyStateOnAction}
                    />
                  </td>
                </tr>
              ) : list.map((s) => (
                <tr key={s.id}>
                  <td data-label="Название">
                    <div className="ui-list__name-cell">
                      {/* Фото секции с публичной страницы, если оно загружено.
                          Иначе — гантель: у части секций фото может не быть,
                          и строка не должна оставаться пустой. Битую ссылку
                          прячем, чтобы вместо неё не торчал значок «нет картинки». */}
                      {photos[String(s.id)] ? (
                        <img
                          src={photos[String(s.id)]}
                          alt=""
                          className="ui-avatar sports-list__avatar-img"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <span className="ui-avatar ui-avatar--icon">
                          <Dumbbell size={16} />
                        </span>
                      )}
                      <span className="ui-list__title">{s.name || '—'}</span>
                    </div>
                  </td>
                  <td className="ui-list__actions" data-label="">
                    <button type="button" className="ui-list-btn ui-list-btn--edit" onClick={() => onEdit(s)}><Pencil size={13} /> Изменить</button>
                    <button type="button" className="ui-list-btn ui-list-btn--danger" onClick={() => onDelete(s)}><Trash2 size={13} /> Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmModal
          title="Удалить вид спорта?"
          message={confirmDelete.name ? `Вид спорта: ${confirmDelete.name}` : undefined}
          confirmText="Удалить"
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
          danger
        />
      )}
    </>
  );
};

export default SportsList;

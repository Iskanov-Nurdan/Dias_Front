import React, { useState, useEffect } from 'react';
import {
  ListTree, Pencil, Trash2, Layers, MoreVertical,
} from 'lucide-react';
import {
  ErrorState, EmptyState, ConfirmModal, SkeletonTable, ActionSheet,
} from '../../../shared/ui';
import './BlanksList.scss';

const MOBILE_MQ = '(max-width: 768px)';

const formatKg = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} кг`;
};

const BlanksList = ({
  items,
  loading,
  error,
  onRetry,
  onEdit,
  onComposition,
  onDelete,
  confirmDelete,
  onConfirmDelete,
  onCancelDelete,
  emptyStateActionLabel,
  emptyStateOnAction,
}) => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches,
  );
  const [menuRow, setMenuRow] = useState(null);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const list = items ?? [];

  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  const closeMenu = () => setMenuRow(null);
  const handleMenuAction = (action) => {
    if (!menuRow) return;
    const row = menuRow;
    closeMenu();
    action(row);
  };

  const renderMobileCards = () => (
    <div className="blanks-list__cards">
      {list.map((row, idx) => (
        <article
          key={row.id}
          className="blanks-list__card"
          style={{ '--row-i': idx }}
          onClick={() => onEdit(row)}
        >
          <span className="blanks-list__avatar"><Layers size={15} /></span>
          <div className="blanks-list__card-info">
            <div className="blanks-list__card-name">
              {row.name}
              {row.is_active === false && <span className="blanks-list__inactive-pill">Неактивна</span>}
            </div>
            <div className="blanks-list__card-sub">{formatKg(row.recipe_kg_per_barrel)} / бочка</div>
          </div>
          <button
            type="button"
            className="blanks-list__card-menu-btn"
            aria-label="Действия"
            onClick={(e) => { e.stopPropagation(); setMenuRow(row); }}
          >
            <MoreVertical size={17} />
          </button>
        </article>
      ))}
    </div>
  );

  return (
    <>
      <div className="blanks-list">
        <div className={isMobile ? '' : 'blanks-list__panel'}>
          {loading ? (
            <SkeletonTable rows={8} cols={3} />
          ) : !list.length ? (
            <div className="blanks-list__empty-wrap">
              <EmptyState message="Нет заготовок" actionLabel={emptyStateActionLabel} onAction={emptyStateOnAction} />
            </div>
          ) : isMobile ? (
            renderMobileCards()
          ) : (
            <table className="blanks-list__table">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Кг / бочка</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((row, idx) => (
                  <tr key={row.id} style={{ '--row-i': idx }}>
                    <td>
                      <div className="blanks-list__name-cell">
                        <span className="blanks-list__avatar"><Layers size={14} /></span>
                        <span className="blanks-list__name-text">{row.name}</span>
                        {row.is_active === false && <span className="blanks-list__inactive-pill">Неактивна</span>}
                      </div>
                    </td>
                    <td className="blanks-list__muted">{formatKg(row.recipe_kg_per_barrel)}</td>
                    <td>
                      <div className="blanks-list__row-actions">
                        <button type="button" className="blanks-list__pill-btn" onClick={() => onComposition(row)}><ListTree size={13} /> Состав</button>
                        <button type="button" className="blanks-list__icon-btn" title="Редактировать" onClick={() => onEdit(row)}><Pencil size={13} /></button>
                        <button type="button" className="blanks-list__icon-btn blanks-list__icon-btn--danger" title="Удалить" onClick={() => onDelete(row)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <ActionSheet open={!!menuRow} onClose={closeMenu} title={menuRow?.name}>
        <button type="button" className="action-sheet__item" onClick={() => handleMenuAction(onComposition)}>
          <ListTree size={17} /> Состав
        </button>
        <button type="button" className="action-sheet__item" onClick={() => handleMenuAction(onEdit)}>
          <Pencil size={17} /> Изменить
        </button>
        <button type="button" className="action-sheet__item action-sheet__item--danger action-sheet__item--divider" onClick={() => handleMenuAction(onDelete)}>
          <Trash2 size={17} /> Удалить
        </button>
      </ActionSheet>
      {confirmDelete && (
        <ConfirmModal
          title="Удалить заготовку?"
          message={`«${confirmDelete.name}». Доступно только если нет партий производства по этой заготовке.`}
          confirmText="Удалить"
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
          danger
        />
      )}
    </>
  );
};

export default BlanksList;

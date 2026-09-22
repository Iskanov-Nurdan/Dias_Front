import React, { useState, useEffect } from 'react';
import {
  Pencil, Trash2, Info, MoreVertical,
} from 'lucide-react';
import {
  ErrorState, EmptyState, ConfirmModal, SkeletonTable, ActionSheet,
} from '../../../shared/ui';
import './ProfilesList.scss';

const MOBILE_MQ = '(max-width: 768px)';

const formatKg = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} кг` : '—';
};

const formatMoney = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} сом` : '—';
};

const initials = (name) => (name || '?').trim().slice(0, 1).toUpperCase();

const ProfilesList = ({
  items,
  loading,
  error,
  onRetry,
  onEdit,
  onDetails,
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
    <div className="profiles-list__cards">
      {list.map((row, idx) => (
        <article
          key={row.id}
          className="profiles-list__card"
          style={{ '--row-i': idx }}
          onClick={() => onEdit(row)}
        >
          <span className="profiles-list__avatar">{initials(row.name)}</span>
          <div className="profiles-list__card-info">
            <div className="profiles-list__card-name">
              {row.name}
              {row.is_active === false && <span className="profiles-list__inactive-pill">Неактивен</span>}
            </div>
            <div className="profiles-list__card-sub">
              {row.code && <span className="profiles-list__card-code">{row.code}</span>}
              {row.sale_unit_price != null && <span className="profiles-list__card-price">{formatMoney(row.sale_unit_price)}</span>}
            </div>
          </div>
          <button
            type="button"
            className="profiles-list__card-menu-btn"
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
      <div className="profiles-list">
        <div className={isMobile ? '' : 'profiles-list__panel'}>
          {loading ? (
            <SkeletonTable rows={8} cols={6} />
          ) : !list.length ? (
            <div className="profiles-list__empty-wrap">
              <EmptyState message="Нет профилей" actionLabel={emptyStateActionLabel} onAction={emptyStateOnAction} />
            </div>
          ) : isMobile ? (
            renderMobileCards()
          ) : (
            <table className="profiles-list__table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Код</th>
                  <th>Заготовка</th>
                  <th>Вес/шт</th>
                  <th>Себестоимость</th>
                  <th>Цена продажи</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((row, idx) => (
                  <tr key={row.id} style={{ '--row-i': idx }}>
                    <td>
                      <div className="profiles-list__name-cell">
                        <span className="profiles-list__avatar">{initials(row.name)}</span>
                        <span className="profiles-list__name-text">{row.name}</span>
                        {row.is_active === false && <span className="profiles-list__inactive-pill">Неактивен</span>}
                      </div>
                    </td>
                    <td className="profiles-list__code">{row.code || '—'}</td>
                    <td className="profiles-list__muted">{row.blank_name || '—'}</td>
                    <td className="profiles-list__muted">{row.weight_kg_per_piece != null ? formatKg(row.weight_kg_per_piece) : '—'}</td>
                    <td className="profiles-list__muted">{row.cost_price != null ? formatMoney(row.cost_price) : '—'}</td>
                    <td className="profiles-list__price">{row.sale_unit_price != null ? formatMoney(row.sale_unit_price) : '—'}</td>
                    <td>
                      <div className="profiles-list__row-actions">
                        <button type="button" className="profiles-list__icon-btn" title="Подробности" onClick={() => onDetails(row)}><Info size={13} /></button>
                        <button type="button" className="profiles-list__icon-btn" title="Изменить" onClick={() => onEdit(row)}><Pencil size={13} /></button>
                        <button type="button" className="profiles-list__icon-btn profiles-list__icon-btn--danger" title="Удалить" onClick={() => onDelete(row)}><Trash2 size={13} /></button>
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
        <button type="button" className="action-sheet__item" onClick={() => handleMenuAction(onDetails)}>
          <Info size={17} /> Подробности
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
          title="Удалить профиль?"
          message={`«${confirmDelete.name}». Доступно только если нет рецептов или партий производства — иначе деактивируйте профиль вместо удаления.`}
          confirmText="Удалить"
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
          danger
        />
      )}
    </>
  );
};

export default ProfilesList;

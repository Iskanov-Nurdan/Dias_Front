import React, { useState, useEffect } from 'react';
import {
  PackagePlus, Pencil, Trash2, MoreVertical,
} from 'lucide-react';
import {
  ErrorState, EmptyState, ConfirmModal, SkeletonTable, ActionSheet,
} from '../../../shared/ui';
import './MaterialsCatalogList.scss';

const MOBILE_MQ = '(max-width: 768px)';

const unitLabel = (unit) => (unit === 'g' ? 'г' : 'кг');

const formatQty = (value, unit) => {
  if (value == null) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} ${unitLabel(unit)}`;
};

const getStockLevel = (row) => {
  const balance = Number(row.balance);
  const min = row.min_balance != null ? Number(row.min_balance) : null;
  if (!(balance > 0)) return 'empty';
  if (min != null && balance <= min) return 'low';
  return 'ok';
};

const STATUS_LABEL = { ok: 'В наличии', low: 'Ниже минимума', empty: 'Пусто' };
const initials = (name) => (name || '?').trim().slice(0, 1).toUpperCase();

const MaterialsCatalogList = ({
  items,
  loading,
  error,
  onRetry,
  onEdit,
  onDelete,
  onReplenish,
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
    <div className="materials-list__cards">
      {list.map((row, idx) => {
        const level = getStockLevel(row);
        return (
          <article
            key={row.material_id ?? row.id}
            className={`materials-list__card materials-list__card--${level}`}
            style={{ '--row-i': idx }}
            onClick={() => onEdit(row)}
          >
            <span className={`materials-list__avatar materials-list__avatar--${level}`}>{initials(row.name)}</span>
            <div className="materials-list__card-info">
              <div className="materials-list__card-name">
                {row.name}
                {row.is_active === false && <span className="materials-list__inactive-pill">Неактивно</span>}
              </div>
              <div className="materials-list__card-sub">
                <span className={`materials-list__status materials-list__status--${level}`} title={STATUS_LABEL[level]}>
                  <span className="materials-list__status-dot" />
                  {formatQty(row.balance, row.unit)}
                </span>
                {row.min_balance != null && <span className="materials-list__card-min"> · мин. {formatQty(row.min_balance, row.unit)}</span>}
              </div>
            </div>
            <button
              type="button"
              className="materials-list__card-menu-btn"
              aria-label="Действия"
              onClick={(e) => { e.stopPropagation(); setMenuRow(row); }}
            >
              <MoreVertical size={17} />
            </button>
          </article>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="materials-list">
        <div className="materials-list__panel">
          {loading ? (
            <SkeletonTable rows={8} cols={4} />
          ) : !list.length ? (
            <div className="materials-list__empty-wrap">
              <EmptyState message="Нет сырья" actionLabel={emptyStateActionLabel} onAction={emptyStateOnAction} />
            </div>
          ) : isMobile ? (
            renderMobileCards()
          ) : (
            <table className="materials-list__table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Текущий остаток</th>
                  <th>Минимальный остаток</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((row, idx) => {
                  const level = getStockLevel(row);
                  return (
                    <tr key={row.material_id ?? row.id} style={{ '--row-i': idx }}>
                      <td>
                        <div className="materials-list__name-cell">
                          <span className={`materials-list__avatar materials-list__avatar--${level}`}>{initials(row.name)}</span>
                          <span className="materials-list__name-text">{row.name}</span>
                          {row.is_active === false && <span className="materials-list__inactive-pill">Неактивно</span>}
                        </div>
                      </td>
                      <td>
                        <span className={`materials-list__status materials-list__status--${level}`} title={STATUS_LABEL[level]}>
                          <span className="materials-list__status-dot" />
                          {formatQty(row.balance, row.unit)}
                        </span>
                      </td>
                      <td className="materials-list__muted">{row.min_balance != null ? formatQty(row.min_balance, row.unit) : '—'}</td>
                      <td>
                        <div className="materials-list__row-actions">
                          <button type="button" className="materials-list__pill-btn" onClick={() => onReplenish(row)}><PackagePlus size={13} /> Приход</button>
                          <button type="button" className="materials-list__icon-btn" title="Изменить" onClick={() => onEdit(row)}><Pencil size={13} /></button>
                          <button type="button" className="materials-list__icon-btn materials-list__icon-btn--danger" title="Удалить" onClick={() => onDelete(row)}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <ActionSheet open={!!menuRow} onClose={closeMenu} title={menuRow?.name}>
        <button type="button" className="action-sheet__item" onClick={() => handleMenuAction(onReplenish)}>
          <PackagePlus size={17} /> Приход
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
          title="Удалить сырьё?"
          message={`Сырьё «${confirmDelete.name}». Доступно только если не было приходов, партий, движений и использования в химии/рецептах.`}
          confirmText="Удалить"
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
          danger
        />
      )}
    </>
  );
};

export default MaterialsCatalogList;

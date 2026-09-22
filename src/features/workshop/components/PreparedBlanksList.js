import React, { useState, useEffect } from 'react';
import {
  PackagePlus, Info, Warehouse, MoreVertical,
} from 'lucide-react';
import { ErrorState, EmptyState, SkeletonTable, ActionSheet } from '../../../shared/ui';
import './PreparedBlanksList.scss';

const MOBILE_MQ = '(max-width: 768px)';

const formatKg = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} кг`;
};

const PreparedBlanksList = ({ items, loading, error, onRetry, onAddBarrel, addingBarrelId, onDetails }) => {
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
  const menuCanAdd = menuRow ? Number(menuRow.recipe_kg_per_barrel) > 0 : false;

  const renderMobileCards = () => (
    <div className="prepared-list__cards">
      {list.map((row, idx) => (
        <article
          key={row.blank_id}
          className="prepared-list__card"
          style={{ '--row-i': idx }}
          onClick={() => onDetails(row)}
        >
          <span className="prepared-list__avatar"><Warehouse size={15} /></span>
          <div className="prepared-list__card-info">
            <div className="prepared-list__card-name">{row.blank_name}</div>
            <div className="prepared-list__card-sub">{formatKg(row.total_kg)} итого · {row.barrels} бочек</div>
          </div>
          <button
            type="button"
            className="prepared-list__card-menu-btn"
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
      <div className="prepared-list">
        <div className={isMobile ? '' : 'prepared-list__panel'}>
          {loading ? (
            <SkeletonTable rows={8} cols={5} />
          ) : !list.length ? (
            <div className="prepared-list__empty-wrap">
              <EmptyState message="В справочнике нет заготовок" />
            </div>
          ) : isMobile ? (
            renderMobileCards()
          ) : (
            <table className="prepared-list__table">
              <thead>
                <tr>
                  <th>Заготовка</th>
                  <th>Бочек</th>
                  <th>Остаток, кг</th>
                  <th>Итого, кг</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((row, idx) => {
                  const canAdd = Number(row.recipe_kg_per_barrel) > 0;
                  return (
                    <tr key={row.blank_id} style={{ '--row-i': idx }}>
                      <td>
                        <div className="prepared-list__name-cell">
                          <span className="prepared-list__avatar"><Warehouse size={14} /></span>
                          <span className="prepared-list__name-text">{row.blank_name}</span>
                        </div>
                      </td>
                      <td className="prepared-list__barrels">{row.barrels}</td>
                      <td className="prepared-list__muted">{formatKg(row.extra_kg)}</td>
                      <td className="prepared-list__total">{formatKg(row.total_kg)}</td>
                      <td>
                        <div className="prepared-list__row-actions">
                          <button type="button" className="prepared-list__icon-btn" title="Подробнее" onClick={() => onDetails(row)}><Info size={13} /></button>
                          <button
                            type="button"
                            className="prepared-list__pill-btn"
                            onClick={() => onAddBarrel(row)}
                            disabled={!canAdd || addingBarrelId === row.blank_id}
                            title={!canAdd ? 'У заготовки пустой состав' : undefined}
                          >
                            <PackagePlus size={13} /> {addingBarrelId === row.blank_id ? 'Добавляем…' : 'Бочка'}
                          </button>
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
      <ActionSheet open={!!menuRow} onClose={closeMenu} title={menuRow?.blank_name}>
        <button type="button" className="action-sheet__item" onClick={() => { onDetails(menuRow); closeMenu(); }}>
          <Info size={17} /> Подробнее
        </button>
        <button
          type="button"
          className="action-sheet__item"
          disabled={!menuCanAdd || addingBarrelId === menuRow?.blank_id}
          onClick={() => { onAddBarrel(menuRow); closeMenu(); }}
        >
          <PackagePlus size={17} /> {!menuCanAdd ? 'Бочка (пустой состав)' : 'Бочка'}
        </button>
      </ActionSheet>
    </>
  );
};

export default PreparedBlanksList;

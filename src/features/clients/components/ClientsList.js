import React, { useState, useEffect } from 'react';
import {
  Pencil, Ban, CheckCircle2, Info, MoreVertical,
} from 'lucide-react';
import { ErrorState, EmptyState, SkeletonTable, ActionSheet } from '../../../shared/ui';
import './ClientsList.scss';

const MOBILE_MQ = '(max-width: 768px)';

const CLIENT_TYPE_LABEL = { individual: 'Физ. лицо', company: 'Компания' };
const initials = (name) => (name || '?').trim().slice(0, 1).toUpperCase();

const ClientsList = ({ items, loading, error, onRetry, onEdit, onToggleActive, onProfile, emptyMessage }) => {
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
  const menuInactive = menuRow ? menuRow.is_active === false : false;

  const renderMobileCards = () => (
    <div className="clients-list__cards">
      {list.map((c, idx) => {
        const inactive = c.is_active === false;
        return (
          <article
            key={c.id}
            className={`clients-list__card${inactive ? ' clients-list__card--inactive' : ''}`}
            style={{ '--row-i': idx }}
            onClick={() => onProfile(c)}
          >
            <span className="clients-list__avatar">{initials(c.name)}</span>
            <div className="clients-list__card-info">
              <div className="clients-list__card-name">
                {c.name}
                {inactive && (
                  <span className="clients-list__badge clients-list__badge--inactive">
                    <span className="clients-list__badge-dot" /> Неактивен
                  </span>
                )}
              </div>
              <div className="clients-list__card-sub">
                <span className={`clients-list__type-badge clients-list__type-badge--${c.client_type}`}>
                  {CLIENT_TYPE_LABEL[c.client_type] || c.client_type}
                </span>
                {c.phone && <span className="clients-list__card-phone">{c.phone}</span>}
                {c.credit_limit != null && <span className="clients-list__card-phone">Лимит {Number(c.credit_limit).toLocaleString('ru-RU')} сом</span>}
              </div>
            </div>
            <button
              type="button"
              className="clients-list__card-menu-btn"
              aria-label="Действия"
              onClick={(e) => { e.stopPropagation(); setMenuRow(c); }}
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
      <div className="clients-list">
        <div className={isMobile ? '' : 'clients-list__panel'}>
          {loading ? (
          <SkeletonTable rows={8} cols={4} />
        ) : !list.length ? (
          <div className="clients-list__empty-wrap">
            <EmptyState message={emptyMessage} />
          </div>
        ) : isMobile ? (
          renderMobileCards()
        ) : (
          <table className="clients-list__table">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Телефон</th>
                <th>Тип</th>
                <th>Лимит долга</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c, idx) => {
                const inactive = c.is_active === false;
                return (
                  <tr key={c.id} style={{ '--row-i': idx }} className={inactive ? 'clients-list__row--inactive' : ''}>
                    <td>
                      <div className="clients-list__name-cell">
                        <span className="clients-list__avatar">{initials(c.name)}</span>
                        <span className="clients-list__name-text">{c.name}</span>
                        {inactive && (
                          <span className="clients-list__badge clients-list__badge--inactive">
                            <span className="clients-list__badge-dot" /> Неактивен
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="clients-list__muted">{c.phone || '—'}</td>
                    <td>
                      <span className={`clients-list__type-badge clients-list__type-badge--${c.client_type}`}>
                        {CLIENT_TYPE_LABEL[c.client_type] || c.client_type}
                      </span>
                    </td>
                    <td className="clients-list__limit">{c.credit_limit != null ? `${Number(c.credit_limit).toLocaleString('ru-RU')} сом` : '—'}</td>
                    <td>
                      <div className="clients-list__row-actions">
                        <button type="button" className="clients-list__pill-btn" onClick={() => onProfile(c)}>
                          <Info size={13} /> Карточка
                        </button>
                        <button type="button" className="clients-list__icon-btn" title="Изменить" onClick={() => onEdit(c)}>
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          className={`clients-list__icon-btn${inactive ? ' clients-list__icon-btn--success' : ' clients-list__icon-btn--danger'}`}
                          title={inactive ? 'Активировать' : 'Деактивировать'}
                          onClick={() => onToggleActive(c)}
                        >
                          {inactive ? <CheckCircle2 size={13} /> : <Ban size={13} />}
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
      <ActionSheet open={!!menuRow} onClose={closeMenu} title={menuRow?.name}>
        <button type="button" className="action-sheet__item" onClick={() => handleMenuAction(onProfile)}>
          <Info size={17} /> Карточка
        </button>
        <button type="button" className="action-sheet__item" onClick={() => handleMenuAction(onEdit)}>
          <Pencil size={17} /> Изменить
        </button>
        <button
          type="button"
          className={`action-sheet__item action-sheet__item--divider${menuInactive ? '' : ' action-sheet__item--danger'}`}
          onClick={() => handleMenuAction(onToggleActive)}
        >
          {menuInactive ? <CheckCircle2 size={17} /> : <Ban size={17} />} {menuInactive ? 'Активировать' : 'Деактивировать'}
        </button>
      </ActionSheet>
    </>
  );
};

export default ClientsList;

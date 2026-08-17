import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { PAGE_IDS, PAGE_LABELS, PAGE_ICONS } from '../../../shared/constants/pages';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { SubmitButton } from '../../../shared/ui';
import './AccessModal.scss';

const ACCESS_MODAL_GROUPS = [
  { label: 'Аналитика',           ids: ['analytics', 'reports'] },
  { label: 'Персонал',            ids: ['employees'] },
  { label: 'Спорт, клиенты и лиды', ids: ['clients', 'sports-trainers', 'leads'] },
  { label: 'Финансы',             ids: ['expenses', 'salary'] },
  { label: 'Смены',               ids: ['shifts'] },
  { label: 'Сайт',                ids: ['taplink'] },
  { label: 'Таблицы',             ids: ['spreadsheet'] },
];

// Consecutive single-item groups → one compact row to save vertical space
const GROUP_ROWS = (() => {
  const rows = [];
  let i = 0;
  while (i < ACCESS_MODAL_GROUPS.length) {
    if (ACCESS_MODAL_GROUPS[i].ids.length === 1) {
      const batch = [];
      while (i < ACCESS_MODAL_GROUPS.length && ACCESS_MODAL_GROUPS[i].ids.length === 1) {
        batch.push(ACCESS_MODAL_GROUPS[i++]);
      }
      rows.push(batch);
    } else {
      rows.push([ACCESS_MODAL_GROUPS[i++]]);
    }
  }
  return rows;
})();

const normalizeAccess = (raw) => {
  if (!raw || typeof raw !== 'object') return {};
  const inner = raw?.data?.access ?? raw?.access ?? raw;
  if (Array.isArray(inner)) {
    return PAGE_IDS.reduce((o, id) => ({ ...o, [id]: inner.includes(id) }), {});
  }
  if (typeof inner !== 'object') return {};
  return PAGE_IDS.reduce((o, id) => ({ ...o, [id]: inner[id] === true }), {});
};

const AccessModal = ({ employee, currentAccess, onSave, onClose, error, saving }) => {
  const [access, setAccess] = useState({});

  useModalEffect(!!employee, onClose);

  useEffect(() => {
    setAccess(normalizeAccess(currentAccess));
  }, [employee?.id, currentAccess]);

  const toggle = (pageId) => {
    setAccess((prev) => ({ ...prev, [pageId]: !(prev[pageId] === true) }));
  };

  const setAll = useCallback((value) => {
    setAccess(PAGE_IDS.reduce((o, id) => ({ ...o, [id]: value }), {}));
  }, []);

  const setGroup = useCallback((ids, value) => {
    setAccess((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = value; });
      return next;
    });
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = PAGE_IDS.reduce((o, id) => ({ ...o, [id]: access[id] === true }), {});
    onSave(payload);
  };

  const displayName = employee?.fio || employee?.login || '';

  const content = (
    <div className="access-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="access-modal-title">
      <div className="access-modal" onClick={(e) => e.stopPropagation()}>

        <div className="access-modal__header">
          <div>
            <p className="access-modal__header-sub">Управление доступами</p>
            <h2 id="access-modal-title" className="access-modal__title">{displayName}</h2>
          </div>
          <button type="button" className="access-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>

        {error && <p className="access-modal__error" role="alert">{error}</p>}

        <form onSubmit={handleSubmit} className="access-modal__form">
          <div className="access-modal__toolbar">
            <button type="button" className="access-modal__bulk-btn" onClick={() => setAll(true)}>
              <Check size={13} />Выбрать всё
            </button>
            <button type="button" className="access-modal__bulk-btn access-modal__bulk-btn--clear" onClick={() => setAll(false)}>
              <X size={13} />Снять всё
            </button>
          </div>

          <div className="access-modal__body">
            {GROUP_ROWS.map((batch, ri) => {
              const isCompact = batch.length > 1;
              const renderGroup = ({ label, ids }) => {
                const checkedCount = ids.filter((id) => access[id] === true).length;
                return (
                  <section key={label} className={`access-modal__group${isCompact ? ' access-modal__group--compact' : ''}`}>
                    <div className="access-modal__group-head">
                      <div className="access-modal__group-head-left">
                        <h3 className="access-modal__group-title">{label}</h3>
                        <span className="access-modal__group-count">{checkedCount}/{ids.length}</span>
                      </div>
                      <div className="access-modal__group-bulk">
                        <button type="button" className="access-modal__mini-btn" onClick={() => setGroup(ids, true)}>Все</button>
                        <button type="button" className="access-modal__mini-btn access-modal__mini-btn--off" onClick={() => setGroup(ids, false)}>Нет</button>
                      </div>
                    </div>
                    <div className="access-modal__grid">
                      {ids.map((pageId) => {
                        const Icon = PAGE_ICONS[pageId];
                        const checked = access[pageId] === true;
                        return (
                          <label key={pageId} className={`access-modal__item${checked ? ' access-modal__item--on' : ''}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggle(pageId)} className="access-modal__checkbox-hidden" />
                            <span className="access-modal__item-left">
                              <span className={`access-modal__item-icon-wrap${checked ? ' access-modal__item-icon-wrap--on' : ''}`}>
                                {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden />}
                              </span>
                              <span className="access-modal__item-label">{PAGE_LABELS[pageId] || pageId}</span>
                            </span>
                            <span className={`access-modal__toggle${checked ? ' access-modal__toggle--on' : ''}`} aria-hidden>
                              <span className="access-modal__toggle-thumb" />
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                );
              };

              return isCompact ? (
                <div key={ri} className="access-modal__compact-row">{batch.map(renderGroup)}</div>
              ) : (
                <React.Fragment key={ri}>{batch.map(renderGroup)}</React.Fragment>
              );
            })}
          </div>

          <div className="access-modal__actions">
            <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary">
              Сохранить
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default AccessModal;

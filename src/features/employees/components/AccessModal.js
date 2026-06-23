import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { PAGE_IDS, PAGE_LABELS, PAGE_ICONS } from '../../../shared/constants/pages';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { SubmitButton } from '../../../shared/ui';
import './AccessModal.scss';

/** Логические группы доступа (не хаос из одной линии) */
const ACCESS_MODAL_GROUPS = [
  { label: 'Аналитика', ids: ['analytics', 'reports'] },
  { label: 'Персонал', ids: ['employees'] },
  { label: 'Спорт, клиенты и лиды', ids: ['clients', 'sports-trainers', 'leads'] },
  { label: 'Склад', ids: ['warehouse'] },
  { label: 'Продажи и финансы', ids: ['sales', 'expenses', 'salary'] },
  { label: 'Сайт', ids: ['taplink'] },
];

/** Нормализует ответ бэка (data.access, data.data.access, массив id) в объект { pageId: boolean } */
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
          <h2 id="access-modal-title" className="access-modal__title">Доступы — {displayName}</h2>
          <button type="button" className="access-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        {error && <p className="access-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="access-modal__form">
          <div className="access-modal__toolbar">
            <button type="button" className="access-modal__bulk" onClick={() => setAll(true)}>Выбрать всё</button>
            <button type="button" className="access-modal__bulk" onClick={() => setAll(false)}>Снять всё</button>
          </div>
          <div className="access-modal__body">
            {ACCESS_MODAL_GROUPS.map(({ label, ids }) => (
              <section key={label} className="access-modal__group">
                <div className="access-modal__group-head">
                  <h3 className="access-modal__group-title">{label}</h3>
                  <div className="access-modal__group-bulk">
                    <button type="button" className="access-modal__bulk access-modal__bulk--small" onClick={() => setGroup(ids, true)}>Все</button>
                    <button type="button" className="access-modal__bulk access-modal__bulk--small" onClick={() => setGroup(ids, false)}>Нет</button>
                  </div>
                </div>
                <div className="access-modal__grid">
                  {ids.map((pageId) => {
                    const Icon = PAGE_ICONS[pageId];
                    return (
                      <label key={pageId} className="access-modal__item">
                        <span className="access-modal__item-text">
                          {Icon && <Icon className="access-modal__item-icon" size={18} strokeWidth={1.75} aria-hidden />}
                          <span className="access-modal__item-label">{PAGE_LABELS[pageId] || pageId}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={access[pageId] === true}
                          onChange={() => toggle(pageId)}
                          className="access-modal__checkbox"
                        />
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <div className="access-modal__actions">
            <button type="button" className="access-modal__btn access-modal__btn--cancel" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <SubmitButton loading={saving} className="access-modal__btn access-modal__btn--submit">
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

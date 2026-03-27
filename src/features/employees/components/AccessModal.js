import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { PAGE_IDS, PAGE_LABELS, PAGE_ICONS, PAGE_GROUPS } from '../../../shared/constants/pages';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { SubmitButton } from '../../../shared/ui';
import './AccessModal.scss';

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
    setAccess((prev) => {
      const next = { ...prev };
      next[pageId] = !(prev[pageId] === true);
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = PAGE_IDS.reduce((o, id) => ({ ...o, [id]: access[id] === true }), {});
    onSave(payload);
  };

  const content = (
    <div className="access-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="access-modal-title">
      <div className="access-modal" onClick={(e) => e.stopPropagation()}>
        <div className="access-modal__header">
          <h2 id="access-modal-title" className="access-modal__title">Доступы: {employee?.fio || employee?.login || ''}</h2>
          <button type="button" className="access-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        {error && <p className="access-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="access-modal__form">
          <div className="access-modal__body">
            {Object.entries(PAGE_GROUPS).map(([groupLabel, pageIds]) => (
              <div key={groupLabel} className="access-modal__group">
                <div className="access-modal__group-title">{groupLabel}</div>
                <div className="access-modal__list">
                  {pageIds.map((pageId) => {
                    const Icon = PAGE_ICONS[pageId];
                    return (
                      <label key={pageId} className="access-modal__item">
                        <input
                          type="checkbox"
                          checked={access[pageId] === true}
                          onChange={() => toggle(pageId)}
                        />
                        {Icon && <Icon className="access-modal__item-icon" size={18} />}
                        <span className="access-modal__item-label">{PAGE_LABELS[pageId] || pageId}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
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

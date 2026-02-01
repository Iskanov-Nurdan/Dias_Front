import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PAGE_IDS, PAGE_LABELS } from '../../../shared/constants/pages';
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

const AccessModal = ({ employee, currentAccess, onSave, onClose }) => {
  const [access, setAccess] = useState({});

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
    onClose();
  };

  const content = (
    <div className="access-modal__backdrop" onClick={onClose}>
      <div className="access-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="access-modal__title">Доступы: {employee?.fio || employee?.login || ''}</h2>
        <form onSubmit={handleSubmit} className="access-modal__form">
          <div className="access-modal__list">
            {PAGE_IDS.map((pageId) => (
              <label key={pageId} className="access-modal__item">
                <input
                  type="checkbox"
                  checked={access[pageId] === true}
                  onChange={() => toggle(pageId)}
                />
                <span>{PAGE_LABELS[pageId] || pageId}</span>
              </label>
            ))}
          </div>
          <div className="access-modal__actions">
            <button type="button" className="access-modal__btn access-modal__btn--cancel" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="access-modal__btn access-modal__btn--submit">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default AccessModal;

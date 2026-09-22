import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, ShieldCheck, TriangleAlert } from 'lucide-react';
import { ACCESS_KEYS, ACCESS_KEY_LABELS, ACCESS_KEY_ICONS, ACCESS_KEY_GROUPS } from '../../../shared/constants/accessKeys';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { SubmitButton } from '../../../shared/ui';
import './AccessModal.scss';

const normalizeAccess = (raw) => {
  const list = Array.isArray(raw) ? raw : [];
  return ACCESS_KEYS.reduce((o, key) => ({ ...o, [key]: list.includes(key) }), {});
};

const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase() || '?';
};

const AccessModal = ({ employee, currentAccess, roleName, onSave, onClose, error, saving }) => {
  const [access, setAccess] = useState({});

  useModalEffect(!!employee, onClose);

  // currentAccess остаётся null, пока не пришли данные — отличаем это от
  // «загружено и там пусто», чтобы шапка не мигнула недостоверным «0 из N».
  const isKnown = currentAccess != null;

  useEffect(() => {
    setAccess(normalizeAccess(currentAccess));
  }, [employee?.id, currentAccess]);

  const toggle = (key) => {
    setAccess((prev) => ({ ...prev, [key]: !(prev[key] === true) }));
  };

  const setAll = useCallback((value) => {
    setAccess(ACCESS_KEYS.reduce((o, key) => ({ ...o, [key]: value }), {}));
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
    onSave(ACCESS_KEYS.filter((key) => access[key] === true));
  };

  const totalOn = useMemo(() => ACCESS_KEYS.filter((key) => access[key] === true).length, [access]);
  const totalAll = ACCESS_KEYS.length;

  const displayName = employee?.name || '';

  const content = (
    <div className="access-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="access-modal-title">
      <div className="access-modal" onClick={(e) => e.stopPropagation()}>

        <div className="access-modal__header">
          <span className="ui-avatar ui-avatar--lg access-modal__avatar" aria-hidden>
            {getInitials(displayName)}
          </span>
          <div className="access-modal__header-text">
            <p className="access-modal__header-sub"><ShieldCheck size={12} /> Управление доступами</p>
            <h2 id="access-modal-title" className="access-modal__title">{displayName}</h2>
            <div className="access-modal__header-meta">
              {roleName && <span className="ui-pill ui-pill--info access-modal__role-pill">{roleName}</span>}
            </div>
          </div>
          <button type="button" className="access-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>

        {error && (
          <p className="access-modal__error" role="alert">
            <TriangleAlert size={15} aria-hidden />
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="access-modal__form">
          <div className="access-modal__toolbar">
            <div className="access-modal__toolbar-actions">
              <button type="button" className="access-modal__bulk-btn" onClick={() => setAll(true)}>
                <Check size={13} />Выбрать всё
              </button>
              <button type="button" className="access-modal__bulk-btn access-modal__bulk-btn--clear" onClick={() => setAll(false)}>
                <X size={13} />Снять всё
              </button>
            </div>
            <div className={`access-modal__stat${!isKnown ? ' access-modal__stat--loading' : ''}`}>
              {isKnown ? (
                <>
                  <strong>{totalOn}</strong> из {totalAll} включено
                </>
              ) : (
                <span className="access-modal__stat-skeleton" aria-hidden />
              )}
            </div>
          </div>

          <div className="access-modal__body">
            {ACCESS_KEY_GROUPS.map(({ label, ids }) => {
              const checkedCount = ids.filter((id) => access[id] === true).length;
              return (
                <section key={label} className="access-modal__group">
                  <div className="access-modal__group-head">
                    <div className="access-modal__group-head-left">
                      <h3 className="access-modal__group-title">{label}</h3>
                      <span className={`access-modal__group-count${checkedCount === ids.length ? ' access-modal__group-count--full' : ''}`}>
                        {checkedCount}/{ids.length}
                      </span>
                    </div>
                    <div className="access-modal__group-bulk">
                      <button type="button" className="access-modal__mini-btn" onClick={() => setGroup(ids, true)} title="Включить все пункты раздела">
                        Все
                      </button>
                      <button type="button" className="access-modal__mini-btn access-modal__mini-btn--off" onClick={() => setGroup(ids, false)} title="Выключить все пункты раздела">
                        Нет
                      </button>
                    </div>
                  </div>
                  <div className="access-modal__grid">
                    {ids.map((key) => {
                      const Icon = ACCESS_KEY_ICONS[key];
                      const checked = access[key] === true;
                      return (
                        <label key={key} className={`access-modal__item${checked ? ' access-modal__item--on' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(key)}
                            className="access-modal__checkbox-hidden"
                          />
                          <span className="access-modal__item-left">
                            <span className={`access-modal__item-icon-wrap${checked ? ' access-modal__item-icon-wrap--on' : ''}`}>
                              {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden />}
                            </span>
                            <span className="access-modal__item-label">{ACCESS_KEY_LABELS[key] || key}</span>
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
            })}
          </div>

          <div className="access-modal__actions">
            <span className="access-modal__actions-summary">
              Выбрано <strong>{totalOn}</strong> из {totalAll}
            </span>
            <div className="access-modal__actions-buttons">
              <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>
                Отмена
              </button>
              <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary">
                Сохранить
              </SubmitButton>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default AccessModal;

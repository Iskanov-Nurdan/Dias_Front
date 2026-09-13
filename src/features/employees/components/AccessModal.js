import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, ShieldCheck, TriangleAlert } from 'lucide-react';
import { PAGE_IDS, PAGE_LABELS, PAGE_ICONS } from '../../../shared/constants/pages';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { SubmitButton } from '../../../shared/ui';
import { useTrainerPhotosByFio } from '../hooks/useTrainerPhotosByFio';
import './AccessModal.scss';

const ACCESS_MODAL_GROUPS = [
  { label: 'Аналитика',           ids: ['analytics', 'reports', 'activity-log'] },
  { label: 'Персонал',            ids: ['employees'] },
  { label: 'Спорт, клиенты и лиды', ids: ['clients', 'sports-trainers', 'leads'] },
  { label: 'Финансы',             ids: ['expenses', 'salary'] },
  { label: 'Смены',               ids: ['shifts'] },
  { label: 'Сайт',                ids: ['taplink'] },
  { label: 'Таблицы',             ids: ['spreadsheet'] },
  // Обычно выдаётся через «выдать доступ» в карточке тренера, но чекбокс
  // здесь тоже должен быть — например, чтобы включить кабинет тренера
  // сотруднику, у которого уже есть логин по другой причине.
  { label: 'Кабинет тренера',     ids: ['trainer-report'] },
];

/**
 * Разделы с одним пунктом раньше сжимались в один тесный ряд с вертикальными
 * разделителями — на обычной ширине модалки это переполняло её и появлялся
 * горизонтальный скролл. Вместо этого приёма все одиночные разделы собраны
 * в одну общую секцию «Отдельные разделы» с обычной сеткой: и скролла нет,
 * и кнопки «Все/Нет» у неё снова осмысленны (пунктов пять, а не один).
 */
const MULTI_GROUPS = ACCESS_MODAL_GROUPS.filter((g) => g.ids.length > 1);
const MISC_GROUP = {
  label: 'Отдельные разделы',
  ids: ACCESS_MODAL_GROUPS.filter((g) => g.ids.length === 1).flatMap((g) => g.ids),
};
const RENDER_GROUPS = [...MULTI_GROUPS, MISC_GROUP];

const normalizeAccess = (raw) => {
  if (!raw || typeof raw !== 'object') return {};
  const inner = raw?.data?.access ?? raw?.access ?? raw;
  if (Array.isArray(inner)) {
    return PAGE_IDS.reduce((o, id) => ({ ...o, [id]: inner.includes(id) }), {});
  }
  if (typeof inner !== 'object') return {};
  return PAGE_IDS.reduce((o, id) => ({ ...o, [id]: inner[id] === true }), {});
};

const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase() || '?';
};

const AccessModal = ({ employee, currentAccess, onSave, onClose, error, saving }) => {
  const [access, setAccess] = useState({});
  // Фото сотрудника — то же самое, что уже загружено в карточке тренера
  // и в общем списке сотрудников (см. хук). Не нашли — инициалы, как раньше.
  const getPhoto = useTrainerPhotosByFio();
  const [photoBroken, setPhotoBroken] = useState(false);
  const avatarPhoto = photoBroken ? null : getPhoto(employee?.fio);

  useEffect(() => { setPhotoBroken(false); }, [employee?.fio]);

  useModalEffect(!!employee, onClose);

  // currentAccess остаётся null, пока идёт запрос за реальными правами —
  // отличаем это от «загружено и там пусто», чтобы шапка не мигнула
  // недостоверным «0 из N» на долю секунды.
  const isKnown = currentAccess != null;

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

  const totalOn = useMemo(() => PAGE_IDS.filter((id) => access[id] === true).length, [access]);
  const totalAll = PAGE_IDS.length;

  const displayName = employee?.fio || employee?.login || '';
  const roleName = employee?.roleName ?? employee?.role?.name ?? '';

  const content = (
    <div className="access-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="access-modal-title">
      <div className="access-modal" onClick={(e) => e.stopPropagation()}>

        <div className="access-modal__header">
          {avatarPhoto ? (
            <img
              src={avatarPhoto}
              alt=""
              className="ui-avatar ui-avatar--lg access-modal__avatar access-modal__avatar-img"
              onError={() => setPhotoBroken(true)}
            />
          ) : (
            <span className="ui-avatar ui-avatar--lg access-modal__avatar" aria-hidden>
              {getInitials(displayName)}
            </span>
          )}
          <div className="access-modal__header-text">
            <p className="access-modal__header-sub"><ShieldCheck size={12} /> Управление доступами</p>
            <h2 id="access-modal-title" className="access-modal__title">{displayName}</h2>
            <div className="access-modal__header-meta">
              {roleName && <span className="ui-pill ui-pill--info access-modal__role-pill">{roleName}</span>}
              {employee?.login && <span className="access-modal__login">@{employee.login}</span>}
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
            {RENDER_GROUPS.map(({ label, ids }) => {
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
                    {ids.map((pageId) => {
                      const Icon = PAGE_ICONS[pageId];
                      const checked = access[pageId] === true;
                      return (
                        <label key={pageId} className={`access-modal__item${checked ? ' access-modal__item--on' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(pageId)}
                            className="access-modal__checkbox-hidden"
                          />
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

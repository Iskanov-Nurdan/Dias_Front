import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Bookmark, Trash2, ArrowRight, User, Dumbbell, Wallet } from 'lucide-react';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { ConfirmModal } from '../../../shared/ui';
import './ClientDraftsModal.scss';

/** «15 минут назад» / «вчера» — точная дата в черновике не нужна, важна свежесть. */
const formatWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} ч назад`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return 'вчера';
  if (diffD < 7) return `${diffD} дн назад`;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

/** Короткая сводка по черновику: что уже успели заполнить. */
const draftSummary = (payload, sports) => {
  const p = payload || {};
  const chips = [];
  const sportName = (sports || []).find((s) => String(s.id) === String(p.sportId))?.name;
  if (sportName) chips.push({ icon: Dumbbell, text: sportName });
  if (p.price) chips.push({ icon: Wallet, text: `${p.price} сом` });
  if (p.phone) chips.push({ icon: User, text: p.phone });
  return chips;
};

const ClientDraftsModal = ({ drafts, sports, onOpen, onDelete, onClose, deletingId }) => {
  const [confirmDelete, setConfirmDelete] = useState(null);
  useModalEffect(true, onClose);

  const content = (
    <div className="cdm__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="cdm-title">
      <div className="cdm" onClick={(e) => e.stopPropagation()}>
        <div className="cdm__header">
          <span className="cdm__header-icon" aria-hidden><Bookmark size={18} strokeWidth={2} /></span>
          <div className="cdm__header-text">
            <h2 id="cdm-title" className="cdm__title">Черновики</h2>
            <p className="cdm__subtitle">
              Незаконченные карточки клиентов. Хранятся на сервере — не пропадут при очистке браузера.
            </p>
          </div>
          <button type="button" className="cdm__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>

        <div className="cdm__body">
          {drafts.length === 0 ? (
            <div className="cdm__empty">
              <Bookmark size={22} strokeWidth={1.75} />
              <p className="cdm__empty-title">Черновиков нет</p>
              <p className="cdm__empty-text">
                Начните заполнять карточку клиента и нажмите «Отложить» — она появится здесь.
              </p>
            </div>
          ) : (
            <ul className="cdm__list">
              {drafts.map((d) => {
                const chips = draftSummary(d.payload, sports);
                return (
                  <li key={d.id} className="cdm__item">
                    <div className="cdm__item-main">
                      <span className="cdm__item-title">{d.title || 'Без имени'}</span>
                      <div className="cdm__item-meta">
                        <span className="cdm__item-when">{formatWhen(d.updatedAt ?? d.updated_at)}</span>
                        {chips.map(({ icon: Icon, text }, i) => (
                          <span key={i} className="cdm__item-chip"><Icon size={11} strokeWidth={2} /> {text}</span>
                        ))}
                      </div>
                    </div>
                    <div className="cdm__item-actions">
                      <button type="button" className="cdm__continue" onClick={() => onOpen(d)}>
                        Продолжить <ArrowRight size={14} strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        className="cdm__del"
                        onClick={() => setConfirmDelete(d)}
                        disabled={deletingId === d.id}
                        aria-label="Удалить черновик"
                        title="Удалить черновик"
                      >
                        <Trash2 size={15} strokeWidth={2} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="cdm__actions">
          <button type="button" className="ui-modal-btn" onClick={onClose}>Закрыть</button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Удалить черновик?"
          message={`«${confirmDelete.title || 'Без имени'}» будет удалён безвозвратно.`}
          confirmText="Удалить"
          onConfirm={() => { onDelete(confirmDelete); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
          danger
        />
      )}
    </div>
  );

  return createPortal(content, document.body);
};

export default ClientDraftsModal;

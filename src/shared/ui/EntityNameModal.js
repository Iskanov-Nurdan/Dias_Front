import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalEffect } from '../hooks/useModalEffect';
import SubmitButton from './SubmitButton';
import './EntityNameModal.scss';

/**
 * Универсальная модалка «Добавить/Редактировать <сущность с одним полем name>».
 * Используется для видов спорта, категорий расходов, ролей и т.п.
 */
const EntityNameModal = ({
  item,
  icon: Icon,
  noun,
  newEyebrow,
  editEyebrow = 'Редактирование',
  addTitle,
  placeholder,
  onSave,
  onClose,
  error,
  saving,
}) => {
  const [name, setName] = useState('');
  const isEdit = !!item?.id;

  useModalEffect(true, onClose);

  useEffect(() => {
    setName(item?.name ?? '');
  }, [item]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name: name.trim() });
  };

  const content = (
    <div className="enm__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="enm-title">
      <div className="enm" onClick={(e) => e.stopPropagation()}>

        <div className="enm__header">
          <div>
            <p className="enm__header-sub">{isEdit ? editEyebrow : newEyebrow}</p>
            <h2 id="enm-title" className="enm__title">{isEdit ? (item?.name || noun) : addTitle}</h2>
          </div>
          <button type="button" className="enm__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>

        {error && <p className="enm__error" role="alert">{error}</p>}

        <form onSubmit={handleSubmit} className="enm__form">
          <div className="enm__body">
            <div className="enm__field">
              <label className="enm__label" htmlFor="enm-name">
                {Icon && <Icon size={14} className="enm__label-icon" />}
                Название <span className="enm__required">*</span>
              </label>
              <input
                id="enm-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="enm__input"
                autoFocus
                placeholder={placeholder}
              />
            </div>
          </div>

          <div className="enm__actions">
            <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary">
              {isEdit ? 'Сохранить' : 'Добавить'}
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default EntityNameModal;

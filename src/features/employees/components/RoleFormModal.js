import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Tag } from 'lucide-react';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { SubmitButton } from '../../../shared/ui';
import './RoleFormModal.scss';

const RoleFormModal = ({ role, onSave, onClose, error, saving }) => {
  const [name, setName] = useState('');
  const isEdit = !!role?.id;

  useModalEffect(true, onClose);

  useEffect(() => {
    if (role) setName(role.name || '');
  }, [role]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name });
  };

  const content = (
    <div className="rfm__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="rfm-title">
      <div className="rfm" onClick={(e) => e.stopPropagation()}>

        <div className="rfm__header">
          <div>
            <p className="rfm__header-sub">{isEdit ? 'Редактирование' : 'Новая роль'}</p>
            <h2 id="rfm-title" className="rfm__title">{isEdit ? role?.name || 'Роль' : 'Добавить роль'}</h2>
          </div>
          <button type="button" className="rfm__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>

        {error && <p className="rfm__error" role="alert">{error}</p>}

        <form onSubmit={handleSubmit} className="rfm__form">
          <div className="rfm__body">
            <div className="rfm__field">
              <label className="rfm__label" htmlFor="rfm-name">
                <Tag size={14} className="rfm__label-icon" />
                Название <span className="rfm__required">*</span>
              </label>
              <input
                id="rfm-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="rfm__input"
                autoFocus
                placeholder="Например: Тренер"
              />
            </div>
          </div>

          <div className="rfm__actions">
            <button type="button" className="rfm__btn rfm__btn--cancel" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <SubmitButton loading={saving} className="rfm__btn rfm__btn--submit">
              {isEdit ? 'Сохранить' : 'Добавить'}
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default RoleFormModal;

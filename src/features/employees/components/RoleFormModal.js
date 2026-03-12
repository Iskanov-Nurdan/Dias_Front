import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
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
    <div className="role-form-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="role-form-modal-title">
      <div className="role-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="role-form-modal__header">
          <h2 id="role-form-modal-title" className="role-form-modal__title">{isEdit ? 'Редактировать роль' : 'Добавить роль'}</h2>
          <button type="button" className="role-form-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        {error && <p className="role-form-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="role-form-modal__form">
          <div className="role-form-modal__form-body">
          <label className="role-form-modal__label">
            <span className="role-form-modal__label-caption">Название <span className="form-label-required" aria-hidden="true">*</span></span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="role-form-modal__input" />
          </label>
          </div>
          <div className="role-form-modal__actions">
            <button type="button" className="role-form-modal__btn role-form-modal__btn--cancel" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <button type="submit" className="role-form-modal__btn role-form-modal__btn--submit" disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default RoleFormModal;

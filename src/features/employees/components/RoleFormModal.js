import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './RoleFormModal.scss';

const RoleFormModal = ({ role, onSave, onClose, error, saving }) => {
  const [name, setName] = useState('');
  const isEdit = !!role?.id;

  useEffect(() => {
    if (role) setName(role.name || '');
  }, [role]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name });
  };

  const content = (
    <div className="role-form-modal__backdrop" onClick={onClose}>
      <div className="role-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="role-form-modal__title">{isEdit ? 'Редактировать роль' : 'Добавить роль'}</h2>
        {error && <p className="role-form-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="role-form-modal__form">
          <label className="role-form-modal__label">
            <span className="role-form-modal__label-caption">Название <span className="form-label-required" aria-hidden="true">*</span></span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="role-form-modal__input" />
          </label>
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

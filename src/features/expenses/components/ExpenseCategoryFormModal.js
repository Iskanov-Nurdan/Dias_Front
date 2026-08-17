import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { SubmitButton } from '../../../shared/ui';
import './ExpenseCategoryFormModal.scss';

const ExpenseCategoryFormModal = ({ category, onSave, onClose, error, saving }) => {
  const [name, setName] = useState('');

  useModalEffect(true, onClose);

  useEffect(() => {
    setName(category?.name ?? '');
  }, [category]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name: name.trim() });
  };

  const content = (
    <div className="expense-form-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="expense-category-form-modal-title">
      <div className="expense-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="expense-form-modal__header">
          <h2 id="expense-category-form-modal-title" className="expense-form-modal__title">{category?.id ? 'Редактировать категорию' : 'Добавить категорию'}</h2>
          <button type="button" className="expense-form-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        {error && <p className="expense-form-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="expense-form-modal__form">
          <label className="expense-form-modal__label">
            <span className="expense-form-modal__label-caption">Название <span className="form-label-required" aria-hidden="true">*</span></span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="expense-form-modal__input" placeholder="Название" />
          </label>
          <div className="expense-form-modal__actions">
            <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>Отмена</button>
            <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary">
              Сохранить
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default ExpenseCategoryFormModal;

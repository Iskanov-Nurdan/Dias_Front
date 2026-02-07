import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './ExpenseCategoryFormModal.scss';

const ExpenseCategoryFormModal = ({ category, onSave, onClose, error, saving }) => {
  const [name, setName] = useState('');

  useEffect(() => {
    setName(category?.name ?? '');
  }, [category]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name: name.trim() });
  };

  const content = (
    <div className="expense-form-modal__backdrop" onClick={onClose}>
      <div className="expense-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="expense-form-modal__title">{category?.id ? 'Редактировать категорию' : 'Добавить категорию'}</h2>
        {error && <p className="expense-form-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="expense-form-modal__form">
          <label className="expense-form-modal__label">
            <span className="expense-form-modal__label-caption">Название <span className="form-label-required" aria-hidden="true">*</span></span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="expense-form-modal__input" placeholder="Название категории" />
          </label>
          <div className="expense-form-modal__actions">
            <button type="button" className="expense-form-modal__btn expense-form-modal__btn--cancel" onClick={onClose} disabled={saving}>Отмена</button>
            <button type="submit" className="expense-form-modal__btn expense-form-modal__btn--submit" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default ExpenseCategoryFormModal;

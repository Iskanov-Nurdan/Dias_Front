import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './CategoryFormModal.scss';

const CategoryFormModal = ({ category, onSave, onClose }) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (category) {
      setName(category.name || '');
    } else {
      setName('');
    }
  }, [category]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name: name.trim() });
    onClose();
  };

  const content = (
    <div className="warehouse-form-modal__backdrop" onClick={onClose}>
      <div className="warehouse-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="warehouse-form-modal__title">{category?.id ? 'Редактировать категорию' : 'Добавить категорию'}</h2>
        <form onSubmit={handleSubmit} className="warehouse-form-modal__form">
          <label className="warehouse-form-modal__label">
            <span className="warehouse-form-modal__label-caption">Название <span className="form-label-required" aria-hidden="true">*</span></span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="warehouse-form-modal__input" placeholder="Название категории" />
          </label>
          <div className="warehouse-form-modal__actions">
            <button type="button" className="warehouse-form-modal__btn warehouse-form-modal__btn--cancel" onClick={onClose}>Отмена</button>
            <button type="submit" className="warehouse-form-modal__btn warehouse-form-modal__btn--submit">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default CategoryFormModal;

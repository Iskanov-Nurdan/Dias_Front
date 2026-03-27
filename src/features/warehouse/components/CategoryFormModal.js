import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { SubmitButton } from '../../../shared/ui';
import './CategoryFormModal.scss';

const CategoryFormModal = ({ category, onSave, onClose, error, saving }) => {
  const [name, setName] = useState('');

  useModalEffect(true, onClose);

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
  };

  const content = (
    <div className="warehouse-form-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="warehouse-category-form-modal-title">
      <div className="warehouse-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="warehouse-form-modal__header">
          <h2 id="warehouse-category-form-modal-title" className="warehouse-form-modal__title">{category?.id ? 'Редактировать категорию' : 'Добавить категорию'}</h2>
          <button type="button" className="warehouse-form-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        {error && <p className="warehouse-form-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="warehouse-form-modal__form">
          <label className="warehouse-form-modal__label">
            <span className="warehouse-form-modal__label-caption">Название <span className="form-label-required" aria-hidden="true">*</span></span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="warehouse-form-modal__input" placeholder="Название" />
          </label>
          <div className="warehouse-form-modal__actions">
            <button type="button" className="warehouse-form-modal__btn warehouse-form-modal__btn--cancel" onClick={onClose} disabled={saving}>Отмена</button>
            <SubmitButton loading={saving} className="warehouse-form-modal__btn warehouse-form-modal__btn--submit">
              Сохранить
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default CategoryFormModal;

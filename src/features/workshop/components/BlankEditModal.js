import React, { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { SubmitButton, FormModal } from '../../../shared/ui';
import './BlankModal.scss';

const BlankEditModal = ({ item, onSave, onClose, error, saving }) => {
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);

  const nameError = touched && !name.trim() ? 'Укажите название' : null;

  useEffect(() => {
    if (item) setName(item.name || '');
  }, [item]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim()) return;
    onSave({ name: name.trim() });
  };

  return (
    <FormModal icon={Pencil} eyebrow="Редактирование" title={item?.name || 'Заготовка'} onClose={onClose} error={error} size="sheet">
      <form onSubmit={handleSubmit} className="form-modal__form">
        <div className="form-modal__body">
          <div className="wbm__field">
            <label className="wbm__label" htmlFor="wbem-name">
              Название <span className="wbm__required">*</span>
            </label>
            <input
              id="wbem-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              required
              className={`wbm__input${nameError ? ' wbm__input--invalid' : ''}`}
              autoFocus
            />
            {nameError && <span className="wbm__field-error">{nameError}</span>}
          </div>
        </div>

        <div className="form-modal__actions">
          <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary">
            Сохранить
          </SubmitButton>
        </div>
      </form>
    </FormModal>
  );
};

export default BlankEditModal;

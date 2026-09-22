import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { SubmitButton, FormModal } from '../../../shared/ui';
import CompositionRowsEditor, { emptyRow } from './CompositionRowsEditor';
import './BlankModal.scss';

/** Создание заготовки: название + состав одним запросом — recipe_kg_per_barrel считает бэкенд (сумма состава). */
const BlankFormModal = ({ onSave, onClose, error, saving }) => {
  const [name, setName] = useState('');
  const [rows, setRows] = useState([emptyRow()]);
  const [touched, setTouched] = useState(false);

  const nameError = touched && !name.trim() ? 'Укажите название' : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim()) return;
    const composition = rows
      .filter((r) => r.raw_material_id && Number(r.quantity_kg) > 0)
      .map((r) => ({ raw_material_id: Number(r.raw_material_id), quantity_kg: Number(r.quantity_kg) }));
    if (!composition.length) return;
    onSave({ name: name.trim(), composition });
  };

  return (
    <FormModal icon={Layers} eyebrow="Новая заготовка" title="Добавить заготовку" onClose={onClose} error={error} size="sheet">
      <form onSubmit={handleSubmit} className="form-modal__form">
        <div className="form-modal__body">
          <div className="wbm__field">
            <label className="wbm__label" htmlFor="wbfm-name">
              Название <span className="wbm__required">*</span>
            </label>
            <input
              id="wbfm-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              required
              className={`wbm__input${nameError ? ' wbm__input--invalid' : ''}`}
              autoFocus
              placeholder="Например: ПВХ смесь белая"
            />
            {nameError && <span className="wbm__field-error">{nameError}</span>}
          </div>

          <div className="wbm__field">
            <label className="wbm__label">Состав (сырьё на одну бочку)</label>
            <CompositionRowsEditor rows={rows} onChange={setRows} />
          </div>
        </div>

        <div className="form-modal__actions">
          <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary">
            Добавить
          </SubmitButton>
        </div>
      </form>
    </FormModal>
  );
};

export default BlankFormModal;

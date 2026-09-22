import React, { useState } from 'react';
import { Layers, Pencil } from 'lucide-react';
import { SubmitButton, MoneyInput, FormModal } from '../../../shared/ui';
import './FoamModals.scss';

const FoamDensityGradeModal = ({ grade, onSave, onClose, error, saving }) => {
  const isEdit = !!grade;
  const [code, setCode] = useState(grade?.code || '');
  const [density, setDensity] = useState(grade?.min_kg_m3 != null ? String(grade.min_kg_m3) : '');

  const canSubmit = code.trim().length > 0 && Number(density) > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    // Модель хранит диапазон (min/max_kg_m3), но по факту марка — это точное
    // число: шлём одно и то же значение в оба поля, а не выдумываем разброс.
    onSave({ code: code.trim(), minKgM3: density, maxKgM3: density });
  };

  return (
    <FormModal
      icon={isEdit ? Pencil : Layers}
      eyebrow="Пенополистирол"
      title={isEdit ? `Марка ${grade.code}` : 'Новая марка плотности'}
      onClose={onClose}
      error={error}
      size="sheet"
    >
      <form onSubmit={handleSubmit} className="form-modal__form">
        <div className="form-modal__body">
          <div className="fm__field">
            <label className="fm__label">Код марки <span className="fm__required">*</span></label>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} className="fm__input" autoFocus placeholder="ПСБ-С-25" />
          </div>
          <div className="fm__field">
            <label className="fm__label">Плотность, кг/м³ <span className="fm__required">*</span></label>
            <MoneyInput value={density} onChange={setDensity} placeholder="0" className="fm__input" />
          </div>
        </div>

        <div className="form-modal__actions">
          <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>Отмена</button>
          <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary" disabled={!canSubmit}>
            {isEdit ? 'Сохранить' : 'Добавить'}
          </SubmitButton>
        </div>
      </form>
    </FormModal>
  );
};

export default FoamDensityGradeModal;

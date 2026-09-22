import React, { useState } from 'react';
import { Factory, TriangleAlert } from 'lucide-react';
import { Select, SubmitButton, FormModal } from '../../../shared/ui';
import './ProduceRunModal.scss';

/** Лимит ёмкости машины — реальное поле бэкенда vat_max_kg_demo (см. BlankProductionRun), не наша выдумка. */
const VAT_MAX_KG_DEMO = 180;

const formatKg = (value) => Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 3 });

/** blanks — справочник заготовок; preparedByBlankId — { [blank_id]: total_kg на цеху }. */
const ProduceRunModal = ({ blanks, preparedByBlankId, onSave, onClose, error, saving }) => {
  const [blankId, setBlankId] = useState('');

  const blankOptions = (blanks || []).map((b) => ({ value: String(b.id), label: b.name }));
  const selectedBlank = (blanks || []).find((b) => String(b.id) === blankId);

  const recipeKg = Number(selectedBlank?.recipe_kg_per_barrel) || 0;
  const usedKg = Math.min(recipeKg, VAT_MAX_KG_DEMO);
  const availableKg = Number(preparedByBlankId?.[blankId]) || 0;
  const notEnough = selectedBlank && availableKg < usedKg;

  const canSubmit = selectedBlank && recipeKg > 0 && !notEnough;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSave({
      blank_id: Number(blankId),
      blank_total_kg: recipeKg,
      blank_used_in_production_kg: usedKg,
      vat_max_kg_demo: VAT_MAX_KG_DEMO,
    });
  };

  return (
    <FormModal icon={Factory} eyebrow="Партия производства" title="Произвести" onClose={onClose} error={error} size="sheet">
      <form onSubmit={handleSubmit} className="form-modal__form">
        <div className="form-modal__body">
          <div className="prm__field">
            <label className="prm__label">Заготовка <span className="prm__required">*</span></label>
            <Select
              value={blankId}
              onChange={setBlankId}
              options={blankOptions}
              placeholder="Выберите заготовку"
              className="prm__select"
            />
          </div>

          {selectedBlank && (
            <>
              {recipeKg > VAT_MAX_KG_DEMO && (
                <p className="prm__hint">
                  <TriangleAlert size={13} />
                  В партии учитывается не больше {VAT_MAX_KG_DEMO} кг (ёмкость машины). По рецепту {formatKg(recipeKg)} кг — в машину уйдёт {VAT_MAX_KG_DEMO} кг.
                </p>
              )}
              <div className="prm__summary">
                <span>На цеху сейчас: <strong>{formatKg(availableKg)} кг</strong></span>
                <span>Нужно для партии: <strong>{formatKg(usedKg)} кг</strong></span>
              </div>
              {notEnough && (
                <p className="prm__field-error">
                  <TriangleAlert size={13} />
                  Недостаточно заготовки на цеху: есть {formatKg(availableKg)} кг, нужно {formatKg(usedKg)} кг. Добавьте бочку на вкладке «Цех».
                </p>
              )}
            </>
          )}
        </div>

        <div className="form-modal__actions">
          <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <SubmitButton loading={saving} disabled={!canSubmit} className="ui-modal-btn ui-modal-btn--primary">
            Произвести
          </SubmitButton>
        </div>
      </form>
    </FormModal>
  );
};

export default ProduceRunModal;

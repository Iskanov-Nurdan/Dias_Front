import React, { useState } from 'react';
import { Scissors } from 'lucide-react';
import { Select, SubmitButton, MoneyInput, FormModal } from '../../../shared/ui';
import './FoamModals.scss';

const THICKNESS_OPTIONS = [
  { value: '2', label: '2 см' },
  { value: '3', label: '3 см' },
  { value: '4', label: '4 см' },
];

/**
 * Высота куба для расчёта числа листов — та же константа, что и на бэкенде
 * (apps.foam.constants.CUBE_HEIGHT_CM). Формула зеркалит formulas.sheets_from_cut:
 * листов с куба = floor(высота / толщина), итог = floor(листов_с_куба × кубов).
 * Потерь на распил (LOSS_RATE) тут нет — в отличие от предпросмотра
 * производства, эта операция их не учитывает и на бэкенде.
 */
const CUBE_HEIGHT_CM = 60;

/** Нарезка куба на листы — операция склада ГП, а не производства (см. отчёт по apps.foam). */
const CutFoamModal = ({ cubeRow, onSave, onClose, error, saving }) => {
  const [thicknessCm, setThicknessCm] = useState('2');
  const [cubesQty, setCubesQty] = useState('');

  const qty = Number(cubesQty);
  const overStock = qty > Number(cubeRow.qty);
  const canSubmit = qty > 0 && !overStock;

  const sheetsPerCube = Math.floor(CUBE_HEIGHT_CM / (Number(thicknessCm) || 1));
  const previewSheets = qty > 0 ? Math.floor(sheetsPerCube * qty) : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSave({ cubeStockId: cubeRow.id, thicknessCm: Number(thicknessCm), cubesQty: qty });
  };

  return (
    <FormModal icon={Scissors} eyebrow="Пенополистирол — склад ГП" title="Нарезать на листы" onClose={onClose} error={error} size="sheet">
      <form onSubmit={handleSubmit} className="form-modal__form">
        <div className="form-modal__body">
          <p className="fm__hint">
            Доступно кубов: {cubeRow.qty}
            {cubeRow.grade_code && ` · марка ${cubeRow.grade_code}${cubeRow.grade_density_range ? ` (${cubeRow.grade_density_range})` : ''}`}
          </p>
          <div className="fm__row">
            <div className="fm__field">
              <label className="fm__label">Кубов на нарезку</label>
              <MoneyInput value={cubesQty} onChange={setCubesQty} placeholder="0" className={`fm__input${overStock ? ' fm__input--invalid' : ''}`} />
              {overStock && <span className="fm__field-error">Доступно только {cubeRow.qty}</span>}
            </div>
            <div className="fm__field">
              <label className="fm__label">Толщина листа</label>
              <Select value={thicknessCm} onChange={setThicknessCm} options={THICKNESS_OPTIONS} />
            </div>
          </div>

          {previewSheets != null && !overStock && (
            <div className="fm__preview">
              <div className="fm__preview-row">
                <span>Получится листов</span>
                <strong>{previewSheets} шт</strong>
              </div>
            </div>
          )}
        </div>

        <div className="form-modal__actions">
          <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>Отмена</button>
          <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary" disabled={!canSubmit}>Нарезать</SubmitButton>
        </div>
      </form>
    </FormModal>
  );
};

export default CutFoamModal;

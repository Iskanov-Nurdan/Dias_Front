import React, { useState } from 'react';
import { ListTree } from 'lucide-react';
import { SubmitButton, FormModal } from '../../../shared/ui';
import CompositionRowsEditor, { emptyRow } from './CompositionRowsEditor';
import './BlankModal.scss';

/** item.composition уже приходит со списком заготовок — отдельный запрос не нужен. */
const BlankCompositionModal = ({ item, onSave, onClose, error, saving }) => {
  const initial = (item?.composition ?? []).length
    ? item.composition.map((l, i) => ({ key: `existing-${i}`, raw_material_id: String(l.raw_material_id), quantity_kg: String(l.quantity_kg) }))
    : [emptyRow()];
  const [rows, setRows] = useState(initial);

  const handleSubmit = (e) => {
    e.preventDefault();
    const composition = rows
      .filter((r) => r.raw_material_id && Number(r.quantity_kg) > 0)
      .map((r) => ({ raw_material_id: Number(r.raw_material_id), quantity_kg: Number(r.quantity_kg) }));
    if (!composition.length) return;
    onSave(composition);
  };

  return (
    <FormModal icon={ListTree} eyebrow="Состав" title={item?.name} onClose={onClose} error={error} size="sheet">
      <form onSubmit={handleSubmit} className="form-modal__form">
        <div className="form-modal__body">
          <div className="wbm__field">
            <label className="wbm__label">Сырьё на одну бочку</label>
            <CompositionRowsEditor rows={rows} onChange={setRows} />
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

export default BlankCompositionModal;

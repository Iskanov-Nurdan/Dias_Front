import React from 'react';
import { DecimalInput, Select } from '../../../../shared/ui';
import {
  materialOptions,
  newLineKey,
  previewSumKgFromRows,
  compositionTotalSummaryText,
} from '../../lib/blankRecipeShared';
import '../ChemistryPage/ChemistryPage.scss';

const BlankRecipeRowsEditor = ({ recipeRows, setRecipeRows, errorText }) => {
  const addRow = () => {
    setRecipeRows((prev) => [...prev, { key: newLineKey(), raw_material_id: '', quantity_per_unit: '' }]);
  };

  const removeRow = (key) => {
    setRecipeRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  };

  const setRow = (key, field, value) => {
    setRecipeRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const previewSum = previewSumKgFromRows(recipeRows);
  const summaryLine = compositionTotalSummaryText(previewSum);

  return (
    <>
      <label className="chemistry-blank-stock__composition-label">Состав *</label>
      <div className="chemistry-recipe-grid chemistry-recipe-grid--head">
        <span>Сырьё *</span>
        <span>Вес, кг *</span>
        <span aria-hidden />
      </div>
      {recipeRows.map((row) => (
        <div key={row.key} className="chemistry-recipe-grid chemistry-recipe-grid--row">
          <Select
            value={row.raw_material_id === '' ? '' : String(row.raw_material_id)}
            onChange={(v) => setRow(row.key, 'raw_material_id', v)}
            placeholder="Выберите сырьё"
            options={materialOptions}
          />
          <DecimalInput
            className="chemistry-recipe-grid__kg-input"
            min={0}
            value={row.quantity_per_unit}
            onChange={(v) => setRow(row.key, 'quantity_per_unit', v)}
            placeholder="Напр. 1,4"
            title="Масса в кг"
          />
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => removeRow(row.key)}
            disabled={recipeRows.length <= 1}
            aria-label="Удалить строку"
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn btn--secondary btn--sm chemistry-element-form__add-line" onClick={addRow}>
        + Строка
      </button>
      {summaryLine ? (
        <p className="chemistry-blank-stock__total-preview">{summaryLine}</p>
      ) : null}
      {errorText ? <p className="modal__error">{errorText}</p> : null}
    </>
  );
};

export default BlankRecipeRowsEditor;

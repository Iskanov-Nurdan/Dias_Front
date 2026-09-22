import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Select, MoneyInput } from '../../../shared/ui';
import { fetchRawMaterials } from '../../materials/api';
import './CompositionRowsEditor.scss';

let rowSeq = 0;
const nextRowId = () => `row-${++rowSeq}`;

const emptyRow = () => ({ key: nextRowId(), raw_material_id: '', quantity_kg: '' });

/** Строки состава заготовки: сырьё + кг на одну бочку (абсолютный вес, без процентов). */
const CompositionRowsEditor = ({ rows, onChange }) => {
  const [materials, setMaterials] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchRawMaterials({}, null)
      .then((data) => {
        if (cancelled) return;
        setMaterials(data?.items ?? []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const materialOptions = materials.map((m) => ({ value: String(m.id), label: m.name }));

  const setRow = (key, patch) => {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addRow = () => onChange([...rows, emptyRow()]);
  const removeRow = (key) => onChange(rows.length > 1 ? rows.filter((r) => r.key !== key) : rows);

  const usedIds = new Set(rows.map((r) => r.raw_material_id).filter(Boolean));
  const total = rows.reduce((sum, r) => sum + (Number(r.quantity_kg) || 0), 0);

  return (
    <div className="comp-rows">
      {rows.map((row) => {
        const isDuplicate = row.raw_material_id && rows.filter((r) => r.raw_material_id === row.raw_material_id).length > 1;
        return (
          <div key={row.key} className="comp-rows__row">
            <Select
              value={row.raw_material_id}
              onChange={(v) => setRow(row.key, { raw_material_id: v })}
              options={materialOptions.filter((o) => o.value === row.raw_material_id || !usedIds.has(o.value))}
              placeholder="Сырьё"
              className={`comp-rows__material${isDuplicate ? ' comp-rows__material--invalid' : ''}`}
            />
            <MoneyInput
              value={row.quantity_kg}
              onChange={(v) => setRow(row.key, { quantity_kg: v })}
              allowDecimals
              placeholder="0"
              className="comp-rows__qty"
            />
            <button
              type="button"
              className="comp-rows__remove"
              onClick={() => removeRow(row.key)}
              disabled={rows.length <= 1}
              aria-label="Удалить строку"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
      <button type="button" className="comp-rows__add" onClick={addRow}>
        <Plus size={14} /> Строка
      </button>
      <div className="comp-rows__total">
        Итого на бочку: <strong>{total.toLocaleString('ru-RU', { maximumFractionDigits: 4 })} кг</strong>
      </div>
    </div>
  );
};

export default CompositionRowsEditor;
export { emptyRow };

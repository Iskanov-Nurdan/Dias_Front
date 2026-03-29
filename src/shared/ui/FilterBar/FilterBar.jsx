import React from 'react';
import Select from '../Select/Select';
import './FilterBar.scss';

const FilterBar = ({ filters, queryState, onChange, variant, stack }) => (
  <div
    className={`filter-bar${variant === 'row' ? ' filter-bar--row' : ''}${stack ? ' filter-bar--stack' : ''}`.trim()}
  >
    {filters.map((f) => (
      <div key={f.key} className="filter-bar__item">
        {f.type === 'search' && (
          <input
            type="text"
            className="filter-bar__input"
            placeholder={f.placeholder ?? 'Поиск'}
            value={queryState[f.key] ?? ''}
            onChange={(e) => onChange({ [f.key]: e.target.value || undefined })}
          />
        )}
        {(f.type === 'select' || f.type === 'ordering') && (
          <Select
            value={queryState[f.key] ?? ''}
            placeholder={f.placeholder ?? 'Выберите'}
            options={
              (f.options ?? []).some((o) => String(o.value) === '')
                ? f.options
                : [{ value: '', label: 'Все' }, ...(f.options ?? [])]
            }
            onChange={(val) => onChange({ [f.key]: val || undefined })}
          />
        )}
      </div>
    ))}
  </div>
);

export default FilterBar;

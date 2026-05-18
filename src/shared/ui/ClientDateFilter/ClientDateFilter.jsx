import React from 'react';

/**
 * Локальный фильтр по дате (value YYYY-MM-DD или '').
 */
const ClientDateFilter = ({ value, onChange, id = 'client-date-filter', className = '' }) => (
  <div className={`commercial-date-filter ${className}`.trim()} role="group" aria-label="Фильтр по дате">
    <span className="commercial-date-filter__label" id={`${id}-label`}>
      По дате
    </span>
    <input
      id={id}
      type="date"
      aria-labelledby={`${id}-label`}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    />
    {value ? (
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange('')}>
        Все даты
      </button>
    ) : null}
  </div>
);

export default ClientDateFilter;

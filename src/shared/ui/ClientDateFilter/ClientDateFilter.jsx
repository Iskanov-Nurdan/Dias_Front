import React from 'react';
import './ClientDateFilter.scss';

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
      className="commercial-date-filter__input"
      type="date"
      aria-labelledby={`${id}-label`}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    />
    {value ? (
      <button
        type="button"
        className="btn btn--ghost btn--sm commercial-date-filter__clear"
        onClick={() => onChange('')}
      >
        Все даты
      </button>
    ) : null}
  </div>
);

export default ClientDateFilter;

import React from 'react';
import './FilterBar.scss';

/**
 * Плоская панель фильтров без карточки.
 * flex, gap 12px, без border и shadow.
 */
const FilterBar = ({ children, className = '' }) => (
  <div className={`filter-bar ${className}`.trim()}>
    {children}
  </div>
);

export default FilterBar;

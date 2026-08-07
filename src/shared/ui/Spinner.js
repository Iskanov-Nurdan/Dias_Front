import React from 'react';

const Spinner = ({ label = 'Загрузка…' }) => (
  <span className="loading-inline">
    <span className="loading-inline__spinner" aria-hidden />
    {label}
  </span>
);

export default Spinner;

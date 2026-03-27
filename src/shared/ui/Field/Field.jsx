import React from 'react';
import './Field.scss';

const Field = ({
  label,
  htmlFor,
  error,
  children,
  className = '',
}) => (
  <div className={`ds-field ${className}`.trim()}>
    {label && (
      <label className="ds-field__label" htmlFor={htmlFor}>
        {label}
      </label>
    )}
    {children}
    {error ? (
      <p className="ds-field__error" role="alert">
        {error}
      </p>
    ) : null}
  </div>
);

export default Field;

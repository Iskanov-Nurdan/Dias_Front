import React from 'react';
import './Field.scss';

const Field = ({ label, hint, children }) => (
  <div className="ui-field">
    <label className="ui-field__label">{label}</label>
    {children}
    {hint && <p className="ui-field__hint">{hint}</p>}
  </div>
);

export default Field;

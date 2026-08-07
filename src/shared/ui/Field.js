import React from 'react';
import './Field.scss';

const Field = ({ label, children }) => (
  <div className="ui-field">
    <label className="ui-field__label">{label}</label>
    {children}
  </div>
);

export default Field;

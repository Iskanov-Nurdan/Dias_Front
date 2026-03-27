import React from 'react';
import './Card.scss';

const Card = ({ children, className = '', padded }) => (
  <div className={`ds-surface ${padded ? 'ds-surface--pad' : ''} ${className}`.trim()}>
    {children}
  </div>
);

export default Card;

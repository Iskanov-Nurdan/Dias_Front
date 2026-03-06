import React from 'react';
import './Badge.scss';

const VARIANTS = ['success', 'danger', 'warning', 'neutral', 'info'];

const Badge = ({ children, variant = 'neutral', className = '' }) => {
  const v = VARIANTS.includes(variant) ? variant : 'neutral';
  return (
    <span className={`badge badge--${v} ${className}`.trim()}>
      {children}
    </span>
  );
};

export default Badge;

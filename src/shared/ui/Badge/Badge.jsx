import React from 'react';
import './Badge.scss';

const Badge = ({ children, variant = 'default', size = 'md', dot = false }) => (
  <span className={`badge badge--${variant} badge--${size}${dot ? ' badge--dot' : ''}`}>
    {dot && <span className="badge__dot" aria-hidden="true" />}
    {children}
  </span>
);

export default Badge;

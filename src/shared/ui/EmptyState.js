import React from 'react';
import './EmptyState.scss';

const ILLUSTRATION_SRC = `${process.env.PUBLIC_URL || ''}/empty-state.png`;

const EmptyState = ({ message = 'Нет данных', actionLabel, onAction, compact, className = '' }) => (
  <div className={`empty-state${compact ? ' empty-state--compact' : ''}${className ? ` ${className}` : ''}`.trim()}>
    <img
      className="empty-state__illustration"
      src={ILLUSTRATION_SRC}
      alt=""
      loading="lazy"
      decoding="async"
    />
    <div className="empty-state__message">{message}</div>
    {actionLabel && onAction && (
      <button type="button" className="empty-state__action" onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </div>
);

export default EmptyState;

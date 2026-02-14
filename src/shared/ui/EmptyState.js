import React from 'react';
import './EmptyState.scss';

const IconEmpty = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M12 18v-6" />
    <path d="M9 15h6" />
  </svg>
);

const EmptyState = ({ message = 'Нет данных', actionLabel, onAction }) => (
  <div className="empty-state">
    <span className="empty-state__icon" aria-hidden><IconEmpty /></span>
    <p className="empty-state__message">{message}</p>
    {actionLabel && onAction && (
      <button type="button" className="empty-state__action" onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </div>
);

export default EmptyState;

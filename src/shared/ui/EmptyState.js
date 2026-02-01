import React from 'react';
import './EmptyState.scss';

const EmptyState = ({ message = 'Нет данных' }) => (
  <div className="empty-state">
    <p className="empty-state__message">{message}</p>
  </div>
);

export default EmptyState;

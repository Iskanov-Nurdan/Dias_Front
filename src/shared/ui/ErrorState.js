import React from 'react';
import './ErrorState.scss';

const ErrorState = ({ message = 'Произошла ошибка', onRetry }) => (
  <div className="error-state">
    <div className="error-state__icon">!</div>
    <p className="error-state__message">{message}</p>
    {onRetry && (
      <button type="button" className="error-state__retry" onClick={onRetry}>
        Повторить
      </button>
    )}
  </div>
);

export default ErrorState;

import React from 'react';
import FeedbackVisual from './FeedbackVisual';
import './ErrorState.scss';

const ErrorState = ({ message = 'Произошла ошибка', onRetry, compact, className = '' }) => (
  <div className={`error-state${compact ? ' error-state--compact' : ''}${className ? ` ${className}` : ''}`}>
    <FeedbackVisual variant="error" />
    <p className="error-state__message" role="alert">{message}</p>
    {onRetry && (
      <button type="button" className="error-state__retry" onClick={onRetry}>
        Повторить
      </button>
    )}
  </div>
);

export default ErrorState;

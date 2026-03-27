import React from 'react';
import FeedbackVisual from './FeedbackVisual';
import './ErrorState.scss';

const ErrorState = ({ message = 'Произошла ошибка', onRetry }) => (
  <div className="error-state">
    <FeedbackVisual variant="error" />
    <p className="error-state__message">{message}</p>
    {onRetry && (
      <button type="button" className="error-state__retry" onClick={onRetry}>
        Повторить
      </button>
    )}
  </div>
);

export default ErrorState;

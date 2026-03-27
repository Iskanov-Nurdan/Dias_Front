import './ErrorState.scss';
import { getErrorPayloadMessage } from '../../lib/apiError';

const ErrorState = ({ error, onRetry }) => {
  const message = getErrorPayloadMessage(error, 'Не удалось загрузить');

  return (
    <div className="error-state" role="alert">
      <div className="error-state__mark" aria-hidden="true" />
      <p className="error-state__title">{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn--primary btn--sm" onClick={onRetry}>
          Повторить
        </button>
      ) : null}
    </div>
  );
};

export default ErrorState;

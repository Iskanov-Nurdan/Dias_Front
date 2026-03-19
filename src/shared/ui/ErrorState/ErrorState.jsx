import './ErrorState.scss';

const ErrorState = ({ error, onRetry }) => {
  const message = error?.error ?? 'Произошла ошибка';
  const details = error?.details;
  const missing = error?.missing;

  return (
    <div className="error-state">
      <div className="error-state__icon">!</div>
      <h3 className="error-state__title">{message}</h3>
      {details && Object.keys(details).length > 0 && (
        <ul className="error-state__details">
          {Object.entries(details).map(([field, msgs]) => (
            <li key={field}>
              {field}: {Array.isArray(msgs) ? msgs.join(', ') : msgs}
            </li>
          ))}
        </ul>
      )}
      {missing && missing.length > 0 && (
        <ul className="error-state__missing">
          {missing.map((m, i) => (
            <li key={i}>
              {m.component}: требуется {m.required} {m.unit}, доступно {m.available}
            </li>
          ))}
        </ul>
      )}
      {onRetry && (
        <button type="button" className="error-state__retry" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
};

export default ErrorState;

import './Loading.scss';

const Loading = ({ label = 'Загрузка' }) => (
  <div className="loading" role="status" aria-live="polite">
    <div className="loading__spinner" />
    <span className="loading__text">{label}</span>
  </div>
);

export default Loading;

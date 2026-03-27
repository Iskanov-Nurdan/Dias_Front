import './EmptyState.scss';

const EmptyState = ({ title = 'Нет данных', description }) => (
  <div className="empty-state">
    <div className="empty-state__visual" aria-hidden="true" />
    <p className="empty-state__title">{title}</p>
    {description ? <p className="empty-state__desc">{description}</p> : null}
  </div>
);

export default EmptyState;

import './EmptyState.scss';

const EmptyState = ({ title = 'Нет данных', description }) => (
  <div className="empty-state">
    <div className="empty-state__icon">∅</div>
    <h3 className="empty-state__title">{title}</h3>
    {description && <p className="empty-state__desc">{description}</p>}
  </div>
);

export default EmptyState;

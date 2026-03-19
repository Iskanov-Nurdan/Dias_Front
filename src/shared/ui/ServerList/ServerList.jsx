import React from 'react';
import './ServerList.scss';
import { Loading, EmptyState, ErrorState } from '../index';

const ServerList = ({
  loading,
  error,
  items,
  meta,
  onRetry,
  emptyTitle = 'Нет данных',
  emptyDesc,
  renderFilters,
  renderItem,
  renderPagination,
  renderTable,
  className = '',
}) => {
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;

  const content = items.length === 0 ? (
    <EmptyState title={emptyTitle} description={emptyDesc} />
  ) : renderTable ? (
    renderTable(items)
  ) : (
    <ul className="server-list__items">
      {items.map((item) => (
        <li key={item.id}>{renderItem(item)}</li>
      ))}
    </ul>
  );

  return (
    <div className={`server-list ${className}`}>
      {renderFilters && <div className="server-list__filters">{renderFilters()}</div>}
      <div className="server-list__content">{content}</div>
      {meta && renderPagination && (
        <div className="server-list__pagination">{renderPagination(meta)}</div>
      )}
    </div>
  );
};

export default ServerList;

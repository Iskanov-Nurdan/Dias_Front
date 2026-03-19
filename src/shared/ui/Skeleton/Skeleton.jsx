import React from 'react';
import './Skeleton.scss';

const Skeleton = ({ width, height, borderRadius, className = '' }) => (
  <span
    className={`skeleton ${className}`}
    style={{ width, height, borderRadius }}
    aria-hidden="true"
  />
);

export const SkeletonTable = ({ rows = 5, cols = 4 }) => (
  <div className="skeleton-table" aria-hidden="true">
    <div className="skeleton-table__header">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} height="14px" borderRadius="4px" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="skeleton-table__row">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} height="16px" borderRadius="4px" />
        ))}
      </div>
    ))}
  </div>
);

export default Skeleton;

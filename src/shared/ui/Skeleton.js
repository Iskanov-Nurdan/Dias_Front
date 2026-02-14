import React from 'react';
import './Skeleton.scss';

/**
 * Плейсхолдер загрузки. variant: 'text' | 'title' | 'card' | 'row'
 */
const Skeleton = ({ variant = 'text', className = '', style = {} }) => (
  <div className={`skeleton skeleton--${variant} ${className}`.trim()} style={style} aria-hidden />
);

/**
 * Таблица-скелетон (N строк)
 */
export const SkeletonTable = ({ rows = 5, cols = 4 }) => (
  <table className="skeleton-table">
    <tbody>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }, (_, j) => (
            <td key={j}><Skeleton variant="text" /></td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

export default Skeleton;

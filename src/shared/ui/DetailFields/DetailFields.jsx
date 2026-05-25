import React from 'react';
import './DetailFields.scss';

/**
 * @param {{ label: string, value: React.ReactNode, full?: boolean }[]} rows
 */
export default function DetailFields({ rows }) {
  if (!rows?.length) return null;
  return (
    <dl className="detail-fields">
      {rows.map((row, i) => (
        <div
          key={`${row.label}-${i}`}
          className={`detail-fields__row${row.full ? ' detail-fields__row--full' : ''}`}
        >
          <dt className="detail-fields__label">{row.label}</dt>
          <dd className="detail-fields__value">{row.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

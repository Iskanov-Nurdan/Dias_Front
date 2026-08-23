import React from 'react';
import './DetailFields.scss';

const Row = ({ row, i }) => (
  <div
    key={`${row.label}-${i}`}
    className={`detail-fields__row${row.full ? ' detail-fields__row--full' : ''}`}
  >
    <dt className="detail-fields__label">{row.label}</dt>
    <dd className="detail-fields__value">{row.value ?? '—'}</dd>
  </div>
);

/**
 * @param {{ label: string, value: React.ReactNode, full?: boolean, section?: string }[]} rows
 * Строки с одинаковым `section` группируются под общий uppercase-подзаголовок.
 * Без `section` — плоский список (как раньше).
 */
export default function DetailFields({ rows }) {
  if (!rows?.length) return null;

  const hasSections = rows.some((r) => r.section);
  if (!hasSections) {
    return (
      <dl className="detail-fields">
        {rows.map((row, i) => (
          <Row row={row} i={i} key={`${row.label}-${i}`} />
        ))}
      </dl>
    );
  }

  const groups = [];
  rows.forEach((row) => {
    const key = row.section || '';
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(row);
    else groups.push({ key, rows: [row] });
  });

  return (
    <div className="detail-fields-groups">
      {groups.map((g, gi) => (
        <div className="detail-fields-group" key={`${g.key}-${gi}`}>
          {g.key && <h4 className="detail-fields-group__title">{g.key}</h4>}
          <dl className="detail-fields">
            {g.rows.map((row, i) => (
              <Row row={row} i={i} key={`${row.label}-${i}`} />
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

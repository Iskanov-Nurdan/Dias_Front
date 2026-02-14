import React from 'react';
import { DONUT_COLORS } from '../constants/common';
import './DonutChart.scss';

/**
 * Донат-диаграмма. data = [{ label, value, color? }]
 */
const DonutChart = ({ data, size = 180, strokeWidth = 22, centerLabel = '' }) => {
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
  if (total === 0) return <div className="donut-chart donut-chart--empty">Нет данных</div>;
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const segments = data.filter((d) => Number(d.value) > 0).map((d, i) => {
    const pct = Number(d.value) / total;
    const dash = circumference * pct;
    const seg = { color: d.color || DONUT_COLORS[i % DONUT_COLORS.length], dash, offset };
    offset += dash;
    return seg;
  });
  return (
    <div className="donut-chart" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-chart__svg">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-bg)" strokeWidth={strokeWidth} />
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${seg.dash} ${circumference}`}
            strokeDashoffset={-seg.offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
      </svg>
      <span className="donut-chart__center">{centerLabel}</span>
    </div>
  );
};

export default DonutChart;

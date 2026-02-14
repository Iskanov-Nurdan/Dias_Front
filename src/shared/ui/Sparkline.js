import React from 'react';
import './Sparkline.scss';

/**
 * Мини-линия по массиву чисел (спарклайн).
 */
const Sparkline = ({ values, width = 140, height = 44, color = '#2563eb' }) => {
  const arr = Array.isArray(values) ? values.filter((v) => typeof v === 'number' && !Number.isNaN(v)) : [];
  if (arr.length < 2) return null;
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const range = max - min || 1;
  const padding = 4;
  const w = width - padding * 2;
  const h = height - padding * 2;
  const points = arr.map((v, i) => {
    const x = padding + (i / (arr.length - 1)) * w;
    const y = padding + h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  const id = `spark-${(color || '').replace(/[^a-z0-9]/gi, '')}-${Math.random().toString(36).slice(2, 9)}`;
  return (
    <svg width={width} height={height} className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default Sparkline;

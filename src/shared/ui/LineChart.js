import React, { useEffect, useMemo, useRef, useState } from 'react';
import './LineChart.scss';

const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 26, left: 56 };

const niceStep = (range) => {
  const raw = range / 4;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
};

const shortNum = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`;
  if (a >= 1e3) return `${(v / 1e3).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} тыс`;
  return v.toLocaleString('ru-RU');
};

/**
 * Линейный график на чистом SVG (без библиотек — в проекте их нет, см.
 * DonutChart/Sparkline). Ширина — по контейнеру (ResizeObserver), наведение/
 * тап по точке показывает подсказку со всеми сериями.
 *
 * labels: ['2026-09-01', …] — подписи по оси X (formatLabel переводит в текст)
 * series: [{ key, label, color, values: number[] }] — values той же длины
 * formatValue: число → текст в подсказке (деньги и т.п.)
 */
const LineChart = ({
  labels, series, formatLabel = (l) => l, formatValue = (v) => v.toLocaleString('ru-RU'), ariaLabel,
}) => {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { min, max, ticks } = useMemo(() => {
    const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v));
    let lo = Math.min(0, ...all);
    let hi = Math.max(0, ...all);
    if (lo === hi) hi = lo + 1;
    const step = niceStep(hi - lo);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    const t = [];
    for (let v = lo; v <= hi + step / 2; v += step) t.push(v);
    return { min: lo, max: hi, ticks: t };
  }, [series]);

  const n = labels.length;
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => PAD.top + innerH - ((v - min) / (max - min)) * innerH;
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 64))));

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const i = n <= 1 ? 0 : Math.round(((px - PAD.left) / innerW) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  if (n === 0) return null;

  return (
    <div className="ui-line-chart" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        role="img"
        aria-label={ariaLabel}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => onMove(e.touches[0] ? { ...e, clientX: e.touches[0].clientX, currentTarget: e.currentTarget } : e)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className={`ui-line-chart__grid${t === 0 ? ' ui-line-chart__grid--zero' : ''}`} />
            <text x={PAD.left - 8} y={y(t)} className="ui-line-chart__tick" textAnchor="end" dominantBaseline="middle">{shortNum(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => (i % labelEvery === 0 || i === n - 1) && (
          <text key={l} x={x(i)} y={HEIGHT - 6} className="ui-line-chart__tick" textAnchor="middle">{formatLabel(l)}</text>
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => `${x(i)},${y(Number.isFinite(v) ? v : 0)}`).join(' ');
          return (
            <g key={s.key}>
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" className="ui-line-chart__line" />
              {n <= 1 && <circle cx={x(0)} cy={y(s.values[0] || 0)} r="4" fill={s.color} />}
            </g>
          );
        })}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} className="ui-line-chart__cursor" />
            {series.map((s) => (
              <circle key={s.key} cx={x(hover)} cy={y(s.values[hover] || 0)} r="4.5" fill="var(--color-surface)" stroke={s.color} strokeWidth="2" />
            ))}
          </g>
        )}
      </svg>
      {hover != null && (
        <div
          className="ui-line-chart__tip"
          style={{ left: `${(x(hover) / width) * 100}%`, transform: `translateX(${x(hover) > width / 2 ? '-105%' : '5%'})` }}
        >
          <strong>{formatLabel(labels[hover], true)}</strong>
          {series.map((s) => (
            <span key={s.key}><i style={{ background: s.color }} />{s.label}: <b>{formatValue(s.values[hover] || 0)}</b></span>
          ))}
        </div>
      )}
      <div className="ui-line-chart__legend">
        {series.map((s) => (
          <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>
        ))}
      </div>
    </div>
  );
};

export default LineChart;

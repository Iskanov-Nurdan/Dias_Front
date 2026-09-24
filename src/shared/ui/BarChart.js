import React from 'react';
import './BarChart.scss';

/**
 * Горизонтальные бары (рейтинг: расходы по категориям, топ товаров) — вместо
 * круговой диаграммы с кучей сегментов: подписи читаются, длина сравнима.
 * items: [{ key, label, value: number, display: string, sub?: string, tone?: 'danger'|'success' }]
 * onItemClick — опционально, строка становится кнопкой.
 */
const BarChart = ({ items, color = 'var(--color-primary)', onItemClick }) => {
  const max = Math.max(0, ...items.map((i) => Math.abs(i.value)));
  return (
    <ul className="ui-bar-chart">
      {items.map((it, idx) => {
        const pct = max > 0 ? Math.max(2, (Math.abs(it.value) / max) * 100) : 0;
        const Tag = onItemClick ? 'button' : 'div';
        return (
          <li key={it.key} style={{ '--row-i': idx }}>
            <Tag
              type={onItemClick ? 'button' : undefined}
              className={`ui-bar-chart__row${onItemClick ? ' ui-bar-chart__row--click' : ''}`}
              onClick={onItemClick ? () => onItemClick(it) : undefined}
            >
              <span className="ui-bar-chart__head">
                <span className="ui-bar-chart__label">{it.label}</span>
                <span className={`ui-bar-chart__value${it.value < 0 ? ' ui-bar-chart__value--neg' : ''}`}>{it.display}</span>
              </span>
              <span className="ui-bar-chart__track">
                <span
                  className="ui-bar-chart__fill"
                  style={{ width: `${pct}%`, background: it.value < 0 ? 'var(--color-danger)' : (it.color || color) }}
                />
              </span>
              {it.sub && <span className="ui-bar-chart__sub">{it.sub}</span>}
            </Tag>
          </li>
        );
      })}
    </ul>
  );
};

export default BarChart;

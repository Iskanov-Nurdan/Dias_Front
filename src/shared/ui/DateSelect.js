import React from 'react';
import Select from './Select';
import './DateSelect.scss';

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const daysInMonth = (year, month) => new Date(year, month, 0).getDate();
const pad2 = (n) => String(n).padStart(2, '0');

/**
 * value — 'YYYY-MM' (день не выбран) или 'YYYY-MM-DD' (выбран). Без value —
 * текущие год/месяц, день не выбран (как и должно быть по умолчанию).
 */
const parseValue = (value) => {
  const now = new Date();
  if (!value) return { year: now.getFullYear(), month: now.getMonth() + 1, day: null };
  const [y, m, d] = value.split('-').map((p) => (p ? Number(p) : null));
  return { year: y || now.getFullYear(), month: m || now.getMonth() + 1, day: d || null };
};

/**
 * Год → Месяц → День на общем кастомном Select (тот же, что и везде в
 * приложении) — нативный <input type="date">/<select> нельзя стилизовать
 * одинаково во всех браузерах, поэтому используем уже готовый компонент
 * вместо трёх голых <select>.
 *
 * День — необязателен: пустая опция «День» означает «весь месяц», выбранный
 * день сужает до конкретной даты (вызывающий код сам решает, что делать с
 * «YYYY-MM» без дня — например, трактовать как диапазон весь месяц).
 *
 * yearsBack/yearsForward — диапазон лет относительно текущего года, не
 * хардкодим конкретные годы.
 */
const DateSelect = ({ value, onChange, yearsBack = 1, yearsForward = 1, className = '' }) => {
  const { year, month, day } = parseValue(value);
  const nowYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = nowYear - yearsBack; y <= nowYear + yearsForward; y++) yearOptions.push({ value: String(y), label: String(y) });

  const monthOptions = MONTHS.map((label, i) => ({ value: String(i + 1), label }));

  const dayOptions = [
    { value: '', label: 'День' },
    ...Array.from({ length: daysInMonth(year, month) }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
  ];

  const emit = (nextYear, nextMonth, nextDay) => {
    if (!nextDay) {
      onChange(`${nextYear}-${pad2(nextMonth)}`);
      return;
    }
    const safeDay = Math.min(nextDay, daysInMonth(nextYear, nextMonth));
    onChange(`${nextYear}-${pad2(nextMonth)}-${pad2(safeDay)}`);
  };

  return (
    <div className={`date-select ${className}`}>
      <Select
        value={String(year)}
        onChange={(v) => emit(Number(v), month, day)}
        options={yearOptions}
        className="date-select__control date-select__control--year"
      />
      <Select
        value={String(month)}
        onChange={(v) => emit(year, Number(v), day)}
        options={monthOptions}
        className="date-select__control date-select__control--month"
      />
      <Select
        value={day != null ? String(day) : ''}
        onChange={(v) => emit(year, month, v ? Number(v) : null)}
        options={dayOptions}
        className="date-select__control date-select__control--day"
      />
    </div>
  );
};

export default DateSelect;

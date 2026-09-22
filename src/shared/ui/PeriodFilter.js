import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import Select from './Select';
import FiltersModal from './FiltersModal';
import { MONTHS, MONTHS_SHORT, STATS_YEARS } from '../constants/common';
import './PeriodFilter.scss';

const YEAR_OPTIONS = [{ value: '', label: 'Год' }, ...STATS_YEARS.map((y) => ({ value: y, label: y }))];
const MONTH_OPTIONS = [
  { value: '', label: 'Месяц' },
  ...MONTHS.slice(1).map((m, i) => ({ value: String(i + 1), label: m })),
];
const DAY_OPTIONS = [
  { value: '', label: 'День' },
  ...Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
];

const formatPeriod = (year, month, day) => {
  if (!year) return 'Период';
  if (month && day) return `${day} ${(MONTHS_SHORT[Number(month)] || '').toLowerCase()} ${year}`;
  if (month) return `${MONTHS[Number(month)] || ''} ${year}`;
  return String(year);
};

/**
 * Единый выбор периода (год + месяц + день) — одна кнопка с читаемым
 * значением («21 сен 2026»), открывающая bottom sheet с тремя обычного
 * размера селектами. Раньше три узких Select в ряд обрезали подписи на
 * мобиле («2…», «С…», «Д…») — общий компонент, чинит это везде разом.
 *
 * extra — доп. фильтры этого же экрана (например «Сотрудник» у вкладки
 * «Итоги» в Сменах) — рендерятся в том же bottom sheet, ниже периода,
 * вместо отдельного набора виджетов.
 */
const PeriodFilter = ({
  year, month, day, onYear, onMonth, onDay, onReset, isDefault = true, extra,
}) => {
  const [open, setOpen] = useState(false);
  const label = formatPeriod(year, month, day);

  return (
    <>
      <button type="button" className="period-filter__btn" onClick={() => setOpen(true)}>
        <Calendar size={15} />
        <span className="period-filter__label">{label}</span>
        {!isDefault && <span className="period-filter__dot" aria-hidden />}
      </button>

      <FiltersModal
        open={open}
        onClose={() => setOpen(false)}
        title="Период"
        footer={(
          <>
            <button type="button" className="filters-modal__reset-btn" onClick={onReset}>Сброс</button>
            <button type="button" className="filters-modal__apply-btn" onClick={() => setOpen(false)}>Применить</button>
          </>
        )}
      >
        <div className="period-filter__fields">
          <label className="period-filter__field">
            <span>Год</span>
            <Select value={String(year ?? '')} onChange={onYear} options={YEAR_OPTIONS} placeholder="Год" />
          </label>
          <label className="period-filter__field">
            <span>Месяц</span>
            <Select value={String(month ?? '')} onChange={onMonth} options={MONTH_OPTIONS} placeholder="Месяц" />
          </label>
          <label className="period-filter__field">
            <span>День</span>
            <Select value={String(day ?? '')} onChange={onDay} options={DAY_OPTIONS} placeholder="День" />
          </label>
        </div>
        {extra && <div className="period-filter__extra">{extra}</div>}
      </FiltersModal>
    </>
  );
};

export default PeriodFilter;

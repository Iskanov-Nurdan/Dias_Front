import React, { useState } from 'react';
import { Calendar, Check } from 'lucide-react';
import { FiltersModal } from '../../../shared/ui';
import { PRESETS, presetRange, isoDate, rangeLabel } from '../format';

/**
 * Выбор периода аналитики — тот же вид, что общий PeriodFilter в Кассе/Сменах
 * (кнопка .period-filter__btn с читаемым значением + bottom sheet на мобиле),
 * только внутри — быстрые пресеты «Неделя / Месяц / Квартал…» и свой диапазон
 * вместо год/месяц/день: аналитике нужны периоды вроде «с начала квартала».
 * Черновик применяется по «Применить» — ввод дат не дёргает сервер на каждую цифру.
 */
const PeriodPresetFilter = ({ preset, custom, onApply }) => {
  const [open, setOpen] = useState(false);
  const [draftPreset, setDraftPreset] = useState(preset);
  const [draftCustom, setDraftCustom] = useState(custom);
  const today = isoDate(new Date());

  const current = preset === 'custom' ? custom : presetRange(preset);
  const presetName = PRESETS.find((p) => p.id === preset)?.label;
  const label = preset === 'custom' ? rangeLabel(current) : `${presetName} · ${rangeLabel(current)}`;
  const draftValid = draftPreset !== 'custom' || (draftCustom.dateFrom && draftCustom.dateTo && draftCustom.dateFrom <= draftCustom.dateTo && draftCustom.dateTo <= today);

  const openSheet = () => {
    setDraftPreset(preset);
    setDraftCustom(custom);
    setOpen(true);
  };

  const apply = () => {
    if (!draftValid) return;
    onApply(draftPreset, draftCustom);
    setOpen(false);
  };

  return (
    <>
      <button type="button" className="period-filter__btn an-period__btn" onClick={openSheet}>
        <Calendar size={15} />
        <span className="period-filter__label">{label}</span>
        {preset !== 'month' && <span className="period-filter__dot" aria-hidden />}
      </button>

      <FiltersModal
        open={open}
        onClose={() => setOpen(false)}
        title="Период"
        footer={(
          <>
            <button type="button" className="filters-modal__reset-btn" onClick={() => setDraftPreset('month')}>Сброс</button>
            <button type="button" className="filters-modal__apply-btn" onClick={apply} disabled={!draftValid}>Применить</button>
          </>
        )}
      >
        <div className="an-period__options" role="radiogroup" aria-label="Период">
          {PRESETS.map((p) => {
            const active = draftPreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`an-period__option${active ? ' an-period__option--active' : ''}`}
                onClick={() => setDraftPreset(p.id)}
              >
                <span className="an-period__option-text">
                  <strong>{p.label}</strong>
                  <small>{p.id === 'custom' ? 'Любые даты' : rangeLabel(presetRange(p.id))}</small>
                </span>
                {active && <Check size={16} />}
              </button>
            );
          })}
        </div>

        {draftPreset === 'custom' && (
          <div className="an-period__custom">
            <label className="period-filter__field">
              <span>С даты</span>
              <input
                type="date" className="an-period__date" value={draftCustom.dateFrom} max={draftCustom.dateTo || today}
                onChange={(e) => setDraftCustom((c) => ({ ...c, dateFrom: e.target.value }))}
              />
            </label>
            <label className="period-filter__field">
              <span>По дату</span>
              <input
                type="date" className="an-period__date" value={draftCustom.dateTo} min={draftCustom.dateFrom} max={today}
                onChange={(e) => setDraftCustom((c) => ({ ...c, dateTo: e.target.value }))}
              />
            </label>
          </div>
        )}
      </FiltersModal>
    </>
  );
};

export default PeriodPresetFilter;

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, CalendarClock } from 'lucide-react';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { Select, SubmitButton, Spinner } from '../../../shared/ui';
import { fetchTrainerSchedule, updateTrainerSchedule } from '../api';
import {
  WEEKDAYS,
  AGE_GROUP_OPTIONS,
  createEmptyScheduleState,
  scheduleFromApiResponse,
  scheduleToApiPayload,
  groupScheduleRows,
} from '../scheduleConstants';
import './TrainerScheduleModal.scss';

const validateRows = (rows) => {
  for (const row of rows) {
    if (!row.enabled) continue;
    const ints = (row.intervals || []).filter((i) => i.start || i.end);
    if (!ints.length) {
      return 'Для активного дня добавьте хотя бы один интервал времени.';
    }
    for (const i of ints) {
      if (!i.start || !i.end) {
        return 'Заполните время «с» и «до» для всех интервалов или удалите пустой.';
      }
      if (i.start >= i.end) {
        return 'Время «до» должно быть позже времени «с».';
      }
    }
  }
  return null;
};

const TrainerScheduleModal = ({ trainer, readOnly = false, onClose, onSaved }) => {
  const [rows, setRows] = useState(createEmptyScheduleState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useModalEffect(true, onClose);

  const load = useCallback(async () => {
    if (!trainer?.id) {
      setRows(createEmptyScheduleState());
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTrainerSchedule(trainer.id, null);
      setRows(scheduleFromApiResponse(data || {}));
    } catch (e) {
      const status = e.response?.status;
      if (status === 404) {
        setRows(createEmptyScheduleState());
      } else {
        setError(
          e.response?.data?.error?.message ??
            e.response?.data?.message ??
            e.response?.data?.detail ??
            e.userMessage ??
            'Не удалось загрузить график'
        );
        setRows(createEmptyScheduleState());
      }
    } finally {
      setLoading(false);
    }
  }, [trainer?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDay = (weekday, on) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.weekday !== weekday) return r;
        if (on) {
          return {
            ...r,
            enabled: true,
            intervals: r.intervals?.some((i) => i.start && i.end)
              ? r.intervals
              : [{ start: '10:00', end: '12:00', ageGroup: '' }],
          };
        }
        return { ...r, enabled: false, intervals: [{ start: '', end: '' }] };
      })
    );
  };

  /** Дни группируются по идентичному набору интервалов — «Ср+Пт 10:00–12:00» одной карточкой вместо двух. */
  const groups = useMemo(() => groupScheduleRows(rows), [rows]);
  const [openPickerKey, setOpenPickerKey] = useState(null);

  useEffect(() => {
    if (!openPickerKey) return undefined;
    const closeOnOutsideClick = (e) => {
      if (!e.target.closest('.trainer-schedule-modal__group-add-day')) setOpenPickerKey(null);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [openPickerKey]);

  const setGroupIntervalField = (weekdays, index, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (!weekdays.includes(r.weekday)) return r;
        const intervals = [...(r.intervals || [])];
        intervals[index] = { ...intervals[index], [field]: value };
        return { ...r, intervals };
      })
    );
  };

  const addGroupInterval = (weekdays) => {
    setRows((prev) =>
      prev.map((r) => {
        if (!weekdays.includes(r.weekday)) return r;
        return { ...r, intervals: [...(r.intervals || []), { start: '', end: '', ageGroup: '' }] };
      })
    );
  };

  const removeGroupInterval = (weekdays, index) => {
    setRows((prev) =>
      prev.map((r) => {
        if (!weekdays.includes(r.weekday)) return r;
        const intervals = (r.intervals || []).filter((_, i) => i !== index);
        return { ...r, intervals: intervals.length ? intervals : [{ start: '', end: '' }] };
      })
    );
  };

  /** Убрать день из группы — выключает его, как клик по чипу дня наверху. */
  const removeDayFromGroup = (weekday) => toggleDay(weekday, false);

  /** Присоединить день к группе: копируем её текущие интервалы, «забирая» день из прежней группы (если была). */
  const mergeDayIntoGroup = (weekday, groupIntervals) => {
    setRows((prev) =>
      prev.map((r) =>
        r.weekday === weekday
          ? { ...r, enabled: true, intervals: groupIntervals.map((i) => ({ ...i })) }
          : r
      )
    );
    setOpenPickerKey(null);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (readOnly || !trainer?.id) return;
    const msg = validateRows(rows);
    if (msg) {
      setError(msg);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateTrainerSchedule(trainer.id, scheduleToApiPayload(rows), null);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.error?.message ??
          err.response?.data?.message ??
          err.response?.data?.detail ??
          err.userMessage ??
          'Ошибка сохранения графика'
      );
    } finally {
      setSaving(false);
    }
  };

  const title = readOnly ? 'График тренера' : 'Настройка графика';
  const subtitle = trainer?.fio ? trainer.fio : '';

  const content = (
    <div
      className="trainer-schedule-modal__backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trainer-schedule-modal-title"
    >
      <div className="trainer-schedule-modal" onClick={(e) => e.stopPropagation()}>
        <div className="trainer-schedule-modal__header">
          <div className="trainer-schedule-modal__header-icon" aria-hidden>
            <CalendarClock size={20} strokeWidth={1.75} />
          </div>
          <div className="trainer-schedule-modal__header-text">
            <h2 id="trainer-schedule-modal-title" className="trainer-schedule-modal__title">
              {title}
            </h2>
            {subtitle ? <p className="trainer-schedule-modal__subtitle">{subtitle}</p> : null}
          </div>
          <button type="button" className="trainer-schedule-modal__close" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <p className="trainer-schedule-modal__hint">
          Отметьте дни, когда тренер ведёт занятия, и укажите интервалы времени (например 12:00–14:00 и 16:00–18:00).
        </p>
        {error && (
          <p className="trainer-schedule-modal__error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <div className="trainer-schedule-modal__loading">
            <Spinner />
            <span>Загружаем график…</span>
          </div>
        ) : (
          <form className="trainer-schedule-modal__form" onSubmit={handleFormSubmit}>
            <div className="trainer-schedule-modal__days-rail">
              <span className="trainer-schedule-modal__days-label">Дни недели</span>
              <div className="trainer-schedule-modal__days" role="group" aria-label="Дни недели">
              {WEEKDAYS.map(({ weekday, short }) => {
                const row = rows.find((r) => r.weekday === weekday);
                const active = row?.enabled;
                return (
                  <button
                    key={weekday}
                    type="button"
                    className={`trainer-schedule-modal__day-chip ${active ? 'trainer-schedule-modal__day-chip--active' : ''}`}
                    onClick={() => !readOnly && toggleDay(weekday, !active)}
                    disabled={readOnly}
                    aria-pressed={active}
                  >
                    {short}
                  </button>
                );
              })}
              </div>
            </div>

            <div className="trainer-schedule-modal__blocks">
              {groups.map((group, groupIndex) => {
                const groupKey = group.weekdays.join(',');
                const pickerOpen = openPickerKey === groupKey;
                const otherDays = WEEKDAYS.filter((w) => !group.weekdays.includes(w.weekday));
                const groupLabel = group.weekdays
                  .map((wd) => WEEKDAYS.find((w) => w.weekday === wd)?.short ?? wd)
                  .join(', ');
                return (
                  <div key={groupKey} className="trainer-schedule-modal__day-block">
                    <div className="trainer-schedule-modal__group-header">
                      <span className="trainer-schedule-modal__group-index" aria-hidden>{groupIndex + 1}</span>
                      <div className="trainer-schedule-modal__group-days" role="group" aria-label={`Дни занятия: ${groupLabel}`}>
                        {group.weekdays.map((wd) => {
                          const meta = WEEKDAYS.find((w) => w.weekday === wd);
                          return (
                            <button
                              key={wd}
                              type="button"
                              className="trainer-schedule-modal__group-day-badge"
                              onClick={() => !readOnly && removeDayFromGroup(wd)}
                              disabled={readOnly}
                              title="Убрать день из занятия"
                            >
                              {meta?.short ?? wd}
                              {!readOnly && <span className="trainer-schedule-modal__group-day-badge-x" aria-hidden>×</span>}
                            </button>
                          );
                        })}
                      </div>
                      {!readOnly && otherDays.length > 0 && (
                        <div className="trainer-schedule-modal__group-add-day">
                          <button
                            type="button"
                            className="trainer-schedule-modal__group-add-day-btn"
                            onClick={() => setOpenPickerKey(pickerOpen ? null : groupKey)}
                          >
                            <Plus size={13} /> День
                          </button>
                          {pickerOpen && (
                            <div className="trainer-schedule-modal__group-day-picker" role="menu">
                              {otherDays.map((d) => (
                                <button
                                  key={d.weekday}
                                  type="button"
                                  className="trainer-schedule-modal__group-day-picker-item"
                                  onClick={() => mergeDayIntoGroup(d.weekday, group.intervals)}
                                >
                                  {d.short}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="trainer-schedule-modal__intervals">
                      {(group.intervals || []).map((int, idx) => (
                        <div key={idx} className="trainer-schedule-modal__interval-row">
                          <div className="trainer-schedule-modal__time-range">
                            <input
                              type="time"
                              value={int.start}
                              onChange={(e) => setGroupIntervalField(group.weekdays, idx, 'start', e.target.value)}
                              disabled={readOnly}
                              className="trainer-schedule-modal__time"
                              aria-label="Время начала"
                            />
                            <span className="trainer-schedule-modal__time-sep" aria-hidden>—</span>
                            <input
                              type="time"
                              value={int.end}
                              onChange={(e) => setGroupIntervalField(group.weekdays, idx, 'end', e.target.value)}
                              disabled={readOnly}
                              className="trainer-schedule-modal__time"
                              aria-label="Время окончания"
                            />
                          </div>
                          <Select
                            value={int.ageGroup || ''}
                            onChange={(v) => setGroupIntervalField(group.weekdays, idx, 'ageGroup', v)}
                            placeholder="Категория"
                            disabled={readOnly}
                            options={[{ value: '', label: '— Не указана —' }, ...AGE_GROUP_OPTIONS]}
                            className="trainer-schedule-modal__age-select"
                          />
                          {!readOnly && (group.intervals || []).length > 1 && (
                            <button
                              type="button"
                              className="trainer-schedule-modal__remove-interval"
                              onClick={() => removeGroupInterval(group.weekdays, idx)}
                              aria-label="Удалить интервал"
                              title="Удалить интервал"
                            >
                              <Trash2 size={15} strokeWidth={1.75} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        className="trainer-schedule-modal__add-interval"
                        onClick={() => addGroupInterval(group.weekdays)}
                      >
                        <Plus size={14} /> Интервал
                      </button>
                    )}
                  </div>
                );
              })}
              {groups.length === 0 && (
                <div className="trainer-schedule-modal__empty">
                  <CalendarClock size={28} strokeWidth={1.5} aria-hidden />
                  <p>Нет активных дней</p>
                  <span>Включите дни кнопками выше, чтобы задать интервалы занятий</span>
                </div>
              )}
            </div>

            <div className="trainer-schedule-modal__actions">
              <button
                type="button"
                className="ui-modal-btn"
                onClick={onClose}
                disabled={saving}
              >
                {readOnly ? 'Закрыть' : 'Отмена'}
              </button>
              {!readOnly && (
                <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary">
                  Сохранить
                </SubmitButton>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default TrainerScheduleModal;

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { SubmitButton } from '../../../shared/ui';
import { fetchTrainerSchedule, updateTrainerSchedule } from '../api';
import {
  WEEKDAYS,
  createEmptyScheduleState,
  scheduleFromApiResponse,
  scheduleToApiPayload,
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
              : [{ start: '10:00', end: '12:00' }],
          };
        }
        return { ...r, enabled: false, intervals: [{ start: '', end: '' }] };
      })
    );
  };

  const setIntervalField = (weekday, index, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.weekday !== weekday) return r;
        const intervals = [...(r.intervals || [])];
        intervals[index] = { ...intervals[index], [field]: value };
        return { ...r, intervals };
      })
    );
  };

  const addInterval = (weekday) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.weekday !== weekday) return r;
        return { ...r, intervals: [...(r.intervals || []), { start: '', end: '' }] };
      })
    );
  };

  const removeInterval = (weekday, index) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.weekday !== weekday) return r;
        const intervals = (r.intervals || []).filter((_, i) => i !== index);
        return { ...r, intervals: intervals.length ? intervals : [{ start: '', end: '' }] };
      })
    );
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
          <div>
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
          <div className="trainer-schedule-modal__loading">Загрузка…</div>
        ) : (
          <form className="trainer-schedule-modal__form" onSubmit={handleFormSubmit}>
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

            <div className="trainer-schedule-modal__blocks">
              {rows
                .filter((r) => r.enabled)
                .map((row) => {
                  const meta = WEEKDAYS.find((w) => w.weekday === row.weekday);
                  return (
                    <div key={row.weekday} className="trainer-schedule-modal__day-block">
                      <h3 className="trainer-schedule-modal__day-block-title">{meta?.label ?? row.weekday}</h3>
                      <div className="trainer-schedule-modal__intervals">
                        {(row.intervals || []).map((int, idx) => (
                          <div key={idx} className="trainer-schedule-modal__interval-row">
                            <span className="trainer-schedule-modal__interval-label">с</span>
                            <input
                              type="time"
                              value={int.start}
                              onChange={(e) => setIntervalField(row.weekday, idx, 'start', e.target.value)}
                              disabled={readOnly}
                              className="trainer-schedule-modal__time"
                            />
                            <span className="trainer-schedule-modal__interval-label">до</span>
                            <input
                              type="time"
                              value={int.end}
                              onChange={(e) => setIntervalField(row.weekday, idx, 'end', e.target.value)}
                              disabled={readOnly}
                              className="trainer-schedule-modal__time"
                            />
                            {!readOnly && (row.intervals || []).length > 1 && (
                              <button
                                type="button"
                                className="trainer-schedule-modal__remove-interval"
                                onClick={() => removeInterval(row.weekday, idx)}
                                aria-label="Удалить интервал"
                              >
                                Удалить
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          className="trainer-schedule-modal__add-interval"
                          onClick={() => addInterval(row.weekday)}
                        >
                          + Интервал
                        </button>
                      )}
                    </div>
                  );
                })}
              {!rows.some((r) => r.enabled) && (
                <p className="trainer-schedule-modal__empty">Нет активных дней. Включите дни кнопками выше.</p>
              )}
            </div>

            <div className="trainer-schedule-modal__actions">
              <button
                type="button"
                className="trainer-schedule-modal__btn trainer-schedule-modal__btn--cancel"
                onClick={onClose}
                disabled={saving}
              >
                {readOnly ? 'Закрыть' : 'Отмена'}
              </button>
              {!readOnly && (
                <SubmitButton loading={saving} className="trainer-schedule-modal__btn trainer-schedule-modal__btn--submit">
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

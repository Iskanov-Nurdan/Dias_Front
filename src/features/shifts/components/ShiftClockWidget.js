import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Square } from 'lucide-react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useToast } from '../../../app/providers/ToastProvider';
import { getApiErrorMessage } from '../../../shared/lib/apiError';
import { fetchMyOpenShift, openMyShift, closeMyShift } from '../attendanceApi';
import './ShiftClockWidget.scss';

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * «1:03:45» с момента opened_at, с секундами — при тике раз в минуту счётчик
 * первые 59 секунд выглядел «зависшим» на 00:00, что и создавало ощущение
 * поломки. С секундами и тиком раз в секунду видно, что он живой, сразу.
 */
const formatElapsed = (openedAt) => {
  const start = new Date(openedAt).getTime();
  if (Number.isNaN(start)) return '—:—';
  const totalSeconds = Math.floor(Math.max(0, Date.now() - start) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${pad2(minutes)}:${pad2(seconds)}`;
};

/**
 * Кнопка «Начать/Завершить смену» — личный приход/уход (учёт времени),
 * не денежная сдача смены (та — отдельная фича внутри раздела «Смены»).
 * Живёт в шапке (MainLayout) — видна на любой странице, не только внутри
 * «Смены», чтобы начать смену мог кто угодно с правом my_shift, даже если
 * у него вообще нет доступа к разделу «Смены».
 */
const ShiftClockWidget = () => {
  const { hasAccess } = useAuth();
  const toast = useToast();
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [, forceTick] = useState(0);
  const canUse = hasAccess('my_shift');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const open = await fetchMyOpenShift();
      setShift(open);
    } catch {
      // тихо — это фоновый виджет в шапке, не мешаем работе ошибкой на весь экран
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canUse) return;
    load();
  }, [canUse, load]);

  // Тикаем раз в секунду, чтобы счётчик было видно живым, а не «зависшим»
  const tickRef = useRef(null);
  useEffect(() => {
    if (!shift) return undefined;
    tickRef.current = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(tickRef.current);
  }, [shift]);

  if (!canUse || loading) return null;

  const handleStart = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const created = await openMyShift();
      setShift(created);
      toast.success('Смена начата');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleEnd = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await closeMyShift();
      setShift(null);
      toast.success('Смена завершена');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (shift) {
    return (
      <button
        type="button"
        className="shift-clock shift-clock--active"
        onClick={handleEnd}
        disabled={busy}
        title="Завершить смену"
      >
        <span className="shift-clock__dot" aria-hidden />
        <span className="shift-clock__time">{formatElapsed(shift.opened_at)}</span>
        <Square size={13} className="shift-clock__icon" />
        <span className="shift-clock__label">Завершить</span>
      </button>
    );
  }

  return (
    <button type="button" className="shift-clock" onClick={handleStart} disabled={busy}>
      <Play size={14} className="shift-clock__icon" />
      <span className="shift-clock__label">Начать смену</span>
    </button>
  );
};

export default ShiftClockWidget;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock, CircleAlert, Clock, MessageCircle, RefreshCw, TriangleAlert, Users, Wallet,
} from 'lucide-react';
import { ErrorState, Spinner } from '../../../shared/ui';
import { formatMoney, formatSubscriptionEnd } from '../../../shared/constants/common';
import { WEEKDAYS } from '../../sports-trainers/scheduleConstants';
import { fetchClients, fetchExpiringClients } from '../api';
import { getClientDebt } from '../lib/clientMoney';
import './TodayBoard.scss';

/** ISO-номер дня недели: 1 = понедельник … 7 = воскресенье. */
const isoWeekdayToday = () => {
  const js = new Date().getDay();
  return js === 0 ? 7 : js;
};

const timeLabel = (client) => {
  const from = String(client.trainingTimeFrom ?? client.training_time_from ?? '').slice(0, 5);
  const to = String(client.trainingTimeTo ?? client.training_time_to ?? '').slice(0, 5);
  if (from && to) return `${from}–${to}`;
  return from || to || '';
};

const waLink = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 9 ? `https://wa.me/${digits}` : null;
};

/**
 * Экран «Сегодня»: три списка, с которых начинается рабочий день.
 * Раньше эти же данные собирали руками — переключая фильтры в четырёх местах.
 */
const TodayBoard = ({ onOpenClient, onExtend }) => {
  const [lessons, setLessons] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const weekday = isoWeekdayToday();
  const weekdayName = WEEKDAYS.find((d) => d.weekday === weekday)?.label ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1);
    try {
      const [lessonsRes, debtorsRes, expiringRes] = await Promise.all([
        fetchClients({ weekday, year, month, perPage: 100 }, null),
        fetchClients({ paid: 'false', year, month, perPage: 100 }, null),
        fetchExpiringClients({ days: 7 }, null),
      ]);
      setLessons(lessonsRes?.items ?? lessonsRes?.results ?? []);
      setDebtors(debtorsRes?.items ?? debtorsRes?.results ?? []);
      setExpiring(expiringRes?.items ?? []);
    } catch (e) {
      setError(e?.userMessage ?? 'Не удалось загрузить сводку за сегодня');
    } finally {
      setLoading(false);
    }
  }, [weekday]);

  useEffect(() => { load(); }, [load]);

  /** Занятия — по времени начала: так же, как идёт день. */
  const lessonsSorted = useMemo(
    () => [...lessons].sort((a, b) => timeLabel(a).localeCompare(timeLabel(b))),
    [lessons],
  );

  const debtTotal = useMemo(
    () => debtors.reduce((sum, c) => sum + (getClientDebt(c) ?? 0), 0),
    [debtors],
  );

  if (loading) {
    return <div className="today__state"><Spinner label="Собираем сводку за сегодня…" /></div>;
  }
  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  const renderRow = (client, right) => (
    <li key={client.id} className="today__row">
      <button type="button" className="today__row-main" onClick={() => onOpenClient?.(client)}>
        <span className="today__row-name">{client.fio || '—'}</span>
        <span className="today__row-sub">
          {client.sportName ?? client.sport?.name ?? '—'}
          {client.trainerName && <> · {client.trainerName}</>}
        </span>
      </button>
      <div className="today__row-right">{right}</div>
    </li>
  );

  return (
    <div className="today">
      <div className="today__head">
        <div className="today__title">
          <span className="today__date">{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span>
          <span className="today__weekday">{weekdayName}</span>
        </div>
        <button type="button" className="today__refresh" onClick={load} title="Обновить">
          <RefreshCw size={14} /> Обновить
        </button>
      </div>

      <div className="today__grid">
        {/* ── Занятия сегодня ── */}
        <section className="today__card">
          <header className="today__card-head">
            <span className="today__card-icon"><Clock size={15} /></span>
            <span className="today__card-title">Занятия сегодня</span>
            <span className="today__card-count">{lessonsSorted.length}</span>
          </header>
          {!lessonsSorted.length ? (
            <p className="today__empty">На сегодня занятий не назначено</p>
          ) : (
            <ul className="today__list">
              {lessonsSorted.map((c) => renderRow(c, (
                <span className="today__time">{timeLabel(c) || '—'}</span>
              )))}
            </ul>
          )}
        </section>

        {/* ── Должники ── */}
        <section className="today__card today__card--debt">
          <header className="today__card-head">
            <span className="today__card-icon today__card-icon--danger"><Wallet size={15} /></span>
            <span className="today__card-title">Не оплатили</span>
            <span className="today__card-count today__card-count--danger">{debtors.length}</span>
            {debtTotal > 0 && <span className="today__card-sum">{formatMoney(debtTotal)}</span>}
          </header>
          {!debtors.length ? (
            <p className="today__empty">Все оплатили — долгов нет</p>
          ) : (
            <ul className="today__list">
              {debtors.map((c) => {
                const link = waLink(c.phone);
                const debt = getClientDebt(c) ?? 0;
                return renderRow(c, (
                  <>
                    {debt > 0 && <span className="today__debt">{debt.toLocaleString('ru-RU')}</span>}
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="today__wa"
                        title="Написать в WhatsApp"
                      >
                        <MessageCircle size={13} />
                      </a>
                    )}
                  </>
                ));
              })}
            </ul>
          )}
        </section>

        {/* ── Истекающие абонементы ── */}
        <section className="today__card today__card--expiring">
          <header className="today__card-head">
            <span className="today__card-icon today__card-icon--warning"><CalendarClock size={15} /></span>
            <span className="today__card-title">Истекают за 7 дней</span>
            <span className="today__card-count today__card-count--warning">{expiring.length}</span>
          </header>
          {!expiring.length ? (
            <p className="today__empty">На этой неделе ничего не заканчивается</p>
          ) : (
            <ul className="today__list">
              {expiring.map((c) => {
                const end = formatSubscriptionEnd(c);
                return renderRow(c, (
                  <>
                    <span className={`today__until${(c.daysLeft ?? 9) <= 2 ? ' today__until--urgent' : ''}`}>
                      {end?.note ?? end?.text ?? '—'}
                    </span>
                    <button
                      type="button"
                      className="today__extend"
                      onClick={() => onExtend?.(c)}
                      title="Продлить абонемент"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </>
                ));
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Ограничение выдачи честно проговорено, а не спрятано */}
      {(lessons.length >= 100 || debtors.length >= 100) && (
        <p className="today__note">
          <CircleAlert size={13} /> Показаны первые 100 записей в списке — полный список во вкладке «Клиенты».
        </p>
      )}
    </div>
  );
};

export default TodayBoard;

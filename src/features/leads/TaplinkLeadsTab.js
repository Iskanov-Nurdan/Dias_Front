import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { fetchLeads, fetchLeadStats, updateLead } from './api';
import { useToast } from '../../app/providers/ToastProvider';
import { useAbortSafeFetch } from '../../shared/hooks/useAbortSafeFetch';
import { ErrorState, EmptyState, Pagination, SkeletonTable } from '../../shared/ui';
import Select from '../../shared/ui/Select';
import { Calendar, CalendarDays, CalendarClock, Check, X, AlertTriangle, Undo2, MessageCircle, ChevronDown, Dumbbell, UserCheck, Clock, MessageSquare } from 'lucide-react';
import { STATS_YEARS } from '../../shared/constants/common';

// ─── Константы ────────────────────────────────────────────────────────────────

const STATUS = {
  all:      { label: 'Все',         filter: undefined },
  pending:  { label: 'Новые',       filter: 'pending'  },
  accepted: { label: 'Запишутся',   filter: 'accepted' },
  rejected: { label: 'Не захотели', filter: 'rejected' },
  spam:     { label: 'Спам',        filter: 'spam'     },
};

const STATUS_BADGE = {
  pending:  { text: 'Новая',     cls: 'tlt__badge--new',      Icon: null           },
  accepted: { text: 'Запишется', cls: 'tlt__badge--accepted', Icon: Check          },
  rejected: { text: 'Отказался', cls: 'tlt__badge--rejected', Icon: X              },
  spam:     { text: 'Спам',      cls: 'tlt__badge--spam',     Icon: AlertTriangle  },
};

const MONTHS = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Подозрительность теперь считает бэкенд (Lead.save(), поля isSuspect/suspectReason) —
// одно правило для всех клиентов API, а не отдельная копия regex во фронте.
const isSuspect = (lead) => Boolean(lead.isSuspect ?? lead.is_suspect ?? (lead.isDuplicate ?? lead.is_duplicate));

const suspectReason = (lead) => {
  if (lead.isDuplicate ?? lead.is_duplicate) return 'Повторная заявка с этим телефоном';
  return lead.suspectReason ?? lead.suspect_reason ?? 'Подозрительная заявка';
};

const fmt = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

// Строим date_from / date_to из выбранных фильтров
const buildDateRange = (year, month, day) => {
  if (!year) return {};
  const y = year;
  const m = month; // 1-indexed, null = все
  const d = day;   // 1-indexed, null = все

  let from, to;
  if (d && m) {
    const ds = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    from = ds; to = ds;
  } else if (m) {
    const last = new Date(y, m, 0).getDate();
    from = `${y}-${String(m).padStart(2,'0')}-01`;
    to   = `${y}-${String(m).padStart(2,'0')}-${String(last).padStart(2,'0')}`;
  } else {
    from = `${y}-01-01`;
    to   = `${y}-12-31`;
  }
  return { date_from: from, date_to: to };
};

// ─── Компонент ────────────────────────────────────────────────────────────────

const TaplinkLeadsTab = () => {
  const toast = useToast();
  const { run } = useAbortSafeFetch();

  // Фильтры даты
  const now = new Date();
  const [filterYear,  setFilterYear]  = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(null); // null = все месяцы
  const [filterDay,   setFilterDay]   = useState(null); // null = все дни

  // Таблица
  const [statusKey, setStatusKey] = useState('all');
  const [page,      setPage]      = useState(1);
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [saving,    setSaving]    = useState(null);
  // Второстепенные поля заявки (секция/тренер/время/комментарий) скрыты по умолчанию —
  // Set, а не один id, чтобы можно было сравнить сразу несколько раскрытых заявок.
  const [expanded,  setExpanded]  = useState(() => new Set());
  const toggleExpanded = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Статистика
  const [stats,        setStats]        = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const dateRange = useMemo(
    () => buildDateRange(filterYear, filterMonth, filterDay),
    [filterYear, filterMonth, filterDay],
  );

  // Дни в выбранном месяце (для пикера дня)
  const daysInMonth = useMemo(() => {
    if (!filterMonth) return 31;
    return new Date(filterYear || now.getFullYear(), filterMonth, 0).getDate();
  }, [filterYear, filterMonth]);

  const years = STATS_YEARS;

  // ─── Загрузка таблицы ───────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = STATUS[statusKey]?.filter;
      const res = await run(signal => fetchLeads(
        { channel: 'taplink', status, page, perPage: 25, ...dateRange },
        signal,
      ));
      if (res === null) return;
      setData(res);
    } catch (e) {
      setError(e?.response?.data?.error?.message ?? e?.message ?? 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [run, statusKey, page, dateRange]);

  useEffect(() => { load(); }, [load]);

  // ─── Загрузка статистики — один агрегирующий запрос на бэке (GROUP BY status) ──

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetchLeadStats({ channel: 'taplink', ...dateRange });
      setStats({
        total:    res?.total ?? 0,
        pending:  res?.pending ?? 0,
        accepted: res?.accepted ?? 0,
        rejected: res?.rejected ?? 0,
        spam:     res?.spam ?? 0,
      });
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // ─── Смена статуса ──────────────────────────────────────────────────────────

  const setStatus = async (lead, status) => {
    setSaving(lead.id);
    try {
      await updateLead(lead.id, { status }, null);
      toast.success(
        status === 'accepted' ? 'Отмечен как «Запишется»' :
        status === 'rejected' ? 'Отмечен как «Отказался»' :
        status === 'spam'     ? 'Помечен как спам'        :
        status === 'pending'  ? 'Статус сброшен'          : 'Сохранено'
      );
      load();
      loadStats();
    } catch (e) {
      toast.error(e?.response?.data?.error?.message ?? 'Ошибка');
    } finally {
      setSaving(null);
    }
  };

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const changeYear = (y) => {
    setFilterYear(Number(y));
    setFilterDay(null);
    setPage(1);
  };

  const changeMonth = (m) => {
    setFilterMonth(m ? Number(m) : null);
    setFilterDay(null);
    setPage(1);
  };

  const changeDay = (d) => {
    setFilterDay(d ? Number(d) : null);
    setPage(1);
  };

  const items = data?.items ?? data?.results ?? (Array.isArray(data) ? data : []);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="tlt">

      {/* ── Фильтры даты ─────────────────────────────────────────────────── */}
      <div className="tlt__date-filters">
        <Select
          className="tlt__date-select"
          value={String(filterYear)}
          onChange={v => changeYear(v)}
          options={years.map(y => ({ value: String(y), label: String(y) }))}
          placeholder="Год"
          icon={<Calendar size={15} />}
        />
        <Select
          className="tlt__date-select"
          value={filterMonth ? String(filterMonth) : ''}
          onChange={v => changeMonth(v)}
          placeholder="Все месяцы"
          options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
          icon={<CalendarDays size={15} />}
        />
        <Select
          className="tlt__date-select"
          value={filterDay ? String(filterDay) : ''}
          onChange={v => changeDay(v)}
          placeholder="Все дни"
          disabled={!filterMonth}
          icon={<CalendarClock size={15} />}
          options={Array.from({ length: daysInMonth }, (_, i) => ({
            value: String(i + 1),
            label: String(i + 1),
          }))}
        />
      </div>

      {/* ── Мини-аналитика ───────────────────────────────────────────────── */}
      <div className="tlt__stats">
        {[
          { key: 'total',    label: 'Всего лидов', mod: ''          },
          { key: 'pending',  label: 'Новые',        mod: '--new'     },
          { key: 'accepted', label: 'Запишутся',    mod: '--accept'  },
          { key: 'rejected', label: 'Отказались',   mod: '--reject'  },
          { key: 'spam',     label: 'Спам',         mod: '--spam'    },
        ].map(({ key, label, mod }) => (
          <div key={key} className={`tlt__stat-card${mod ? ' tlt__stat-card' + mod : ''}`}>
            <span className="tlt__stat-num">
              {statsLoading ? '—' : (stats?.[key] ?? '—')}
            </span>
            <span className="tlt__stat-lbl">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Фильтр по статусу ────────────────────────────────────────────── */}
      <div className="tlt__status-tabs">
        {Object.entries(STATUS).map(([key, { label }]) => (
          <button
            key={key}
            type="button"
            className={`tlt__status-tab${statusKey === key ? ' tlt__status-tab--on' : ''}`}
            onClick={() => { setStatusKey(key); setPage(1); }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {/* ── Таблица ──────────────────────────────────────────────────────── */}
      <div className="ui-list__table-wrap tlt__table-wrap">
        <table className="ui-list__table tlt__table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Телефон</th>
              <th>Дата</th>
              <th>Статус</th>
              <th className="tlt__th-more"></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="ui-list__skeleton-cell tlt__skeleton-cell">
                  <SkeletonTable rows={6} cols={6} />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="ui-list__empty-cell tlt__empty-cell">
                  <EmptyState compact tableCell message="Нет заявок" />
                </td>
              </tr>
            ) : items.map(lead => {
              const status  = lead.status || 'pending';
              const badge   = STATUS_BADGE[status] ?? STATUS_BADGE.pending;
              const suspect = isSuspect(lead);
              const isOpen  = expanded.has(lead.id);
              const sport   = lead.taplinkSport ?? lead.taplink_sport ?? '';
              const trainer = lead.taplinkTrainer ?? lead.taplink_trainer ?? '';
              const time    = lead.preferredTime ?? lead.preferred_time ?? '';
              const comment = lead.comment ?? '';
              const hasDetails = Boolean(sport || trainer || time || comment);
              return (
                <React.Fragment key={lead.id}>
                <tr className={suspect && status === 'pending' ? 'tlt__row--suspect' : ''}>
                  <td>
                    <span className="tlt__name">
                      {suspect && status === 'pending' && (
                        <span className="tlt__suspect-icon" title={suspectReason(lead)}><AlertTriangle size={13} strokeWidth={2.25} /></span>
                      )}
                      {lead.name || '—'}
                    </span>
                  </td>
                  <td>
                    {lead.phone ? (
                      <a
                        href={`https://wa.me/${(lead.phone).replace(/\D/g, '')}`}
                        target="_blank" rel="noreferrer"
                        className="tlt__phone"
                        title="Написать в WhatsApp"
                      >
                        <MessageCircle size={12} strokeWidth={2} />
                        {lead.phone}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="tlt__date">{fmt(lead.createdAt ?? lead.created_at)}</td>
                  <td>
                    <span className={`tlt__badge ${badge.cls}`}>
                      {badge.Icon && <badge.Icon size={11} strokeWidth={2.5} />}
                      {badge.text}
                    </span>
                  </td>
                  <td className="tlt__th-more">
                    {hasDetails && (
                      <button
                        type="button"
                        className={`tlt__more-btn${isOpen ? ' tlt__more-btn--open' : ''}`}
                        onClick={() => toggleExpanded(lead.id)}
                        aria-expanded={isOpen}
                        title={isOpen ? 'Скрыть подробности' : 'Подробнее: секция, тренер, время, комментарий'}
                      >
                        Подробнее <ChevronDown size={13} strokeWidth={2.25} />
                      </button>
                    )}
                  </td>
                  <td className="tlt__actions">
                    {status === 'pending' && (
                      <div className="tlt__action-group">
                        <button type="button" className="tlt__btn tlt__btn--accept tlt__btn--wide"
                          disabled={saving === lead.id}
                          onClick={() => setStatus(lead, 'accepted')}
                          title="Запишется — клиент решил заниматься">
                          <Check size={13} strokeWidth={2.5} /> Запись
                        </button>
                        <button type="button" className="tlt__btn tlt__btn--reject tlt__btn--wide"
                          disabled={saving === lead.id}
                          onClick={() => setStatus(lead, 'rejected')}
                          title="Отказался — не захотел">
                          <X size={13} strokeWidth={2.5} /> Отказ
                        </button>
                        <button type="button" className="tlt__btn tlt__btn--spam tlt__btn--wide"
                          disabled={saving === lead.id}
                          onClick={() => setStatus(lead, 'spam')}
                          title="Пометить как спам">
                          <AlertTriangle size={13} strokeWidth={2.25} /> Спам
                        </button>
                      </div>
                    )}
                    {status === 'spam' && (
                      <button type="button" className="tlt__btn tlt__btn--undo tlt__btn--wide"
                        disabled={saving === lead.id}
                        onClick={() => setStatus(lead, 'pending')}
                        title="Не спам — вернуть в новые">
                        <Undo2 size={13} strokeWidth={2.25} /> Не спам
                      </button>
                    )}
                    {(status === 'accepted' || status === 'rejected') && (
                      <button type="button" className="tlt__btn tlt__btn--undo tlt__btn--wide"
                        disabled={saving === lead.id}
                        onClick={() => setStatus(lead, 'pending')}
                        title="Вернуть в новые">
                        <Undo2 size={13} strokeWidth={2.25} /> Вернуть
                      </button>
                    )}
                  </td>
                </tr>
                {isOpen && hasDetails && (
                  <tr className="tlt__detail-row">
                    <td colSpan={6}>
                      <div className="tlt__detail">
                        {sport && (
                          <span className="tlt__detail-item">
                            <Dumbbell size={13} strokeWidth={2} />
                            <span className="tlt__detail-label">Секция</span>
                            <span className="tlt__detail-val">{sport}</span>
                          </span>
                        )}
                        {trainer && (
                          <span className="tlt__detail-item">
                            <UserCheck size={13} strokeWidth={2} />
                            <span className="tlt__detail-label">Тренер</span>
                            <span className="tlt__detail-val">{trainer}</span>
                          </span>
                        )}
                        {time && (
                          <span className="tlt__detail-item">
                            <Clock size={13} strokeWidth={2} />
                            <span className="tlt__detail-label">Время</span>
                            <span className="tlt__detail-val">{time}</span>
                          </span>
                        )}
                        {comment && (
                          <span className="tlt__detail-item tlt__detail-item--comment">
                            <MessageSquare size={13} strokeWidth={2} />
                            <span className="tlt__detail-label">Комментарий</span>
                            <span className="tlt__detail-val">{comment}</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        meta={data?.meta}
        currentPage={page}
        onPage={setPage}
        loading={loading}
        entityLabel="заявок"
      />
    </div>
  );
};

export default TaplinkLeadsTab;

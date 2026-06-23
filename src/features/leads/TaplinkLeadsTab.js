import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { fetchLeads, updateLead } from './api';
import { useToast } from '../../app/providers/ToastProvider';
import { useAbortSafeFetch } from '../../shared/hooks/useAbortSafeFetch';
import { ErrorState, EmptyState, Pagination, SkeletonTable } from '../../shared/ui';
import Select from '../../shared/ui/Select';

// ─── Константы ────────────────────────────────────────────────────────────────

const STATUS = {
  all:      { label: 'Все',         filter: undefined },
  pending:  { label: 'Новые',       filter: 'pending'  },
  accepted: { label: 'Запишутся',   filter: 'accepted' },
  rejected: { label: 'Не захотели', filter: 'rejected' },
  spam:     { label: 'Спам',        filter: 'spam'     },
};

const STATUS_BADGE = {
  pending:  { text: 'Новая',     cls: 'tlt__badge--new'      },
  accepted: { text: 'Запишется', cls: 'tlt__badge--accepted' },
  rejected: { text: 'Отказался', cls: 'tlt__badge--rejected' },
  spam:     { text: 'Спам',      cls: 'tlt__badge--spam'     },
};

const MONTHS = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isSuspect = (lead) => {
  if (lead.isDuplicate ?? lead.is_duplicate) return true;
  const phone = (lead.phone || '').replace(/[\s\-()]/g, '');
  if (phone && !/^\+996\d{9}$|^0\d{9}$/.test(phone)) return true;
  if (!lead.name || lead.name.trim().length < 2) return true;
  return false;
};

const suspectReason = (lead) => {
  if (lead.isDuplicate ?? lead.is_duplicate) return 'Повторная заявка с этим телефоном';
  const phone = (lead.phone || '').replace(/[\s\-()]/g, '');
  if (phone && !/^\+996\d{9}$|^0\d{9}$/.test(phone)) return 'Номер не в кыргызском формате';
  if (!lead.name || lead.name.trim().length < 2) return 'Слишком короткое имя';
  return 'Подозрительная заявка';
};

const fmt = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const getTotal = (res) => res?.meta?.total ?? res?.count ?? res?.total ?? 0;

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

  const years = [2026, 2027];

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

  // ─── Загрузка статистики (5 параллельных запросов) ──────────────────────────

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    const base = { channel: 'taplink', page: 1, perPage: 1, ...dateRange };
    try {
      const [all, pending, accepted, rejected, spam] = await Promise.all([
        fetchLeads(base),
        fetchLeads({ ...base, status: 'pending'  }),
        fetchLeads({ ...base, status: 'accepted' }),
        fetchLeads({ ...base, status: 'rejected' }),
        fetchLeads({ ...base, status: 'spam'     }),
      ]);
      setStats({
        total:    getTotal(all),
        pending:  getTotal(pending),
        accepted: getTotal(accepted),
        rejected: getTotal(rejected),
        spam:     getTotal(spam),
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
        />
        <Select
          className="tlt__date-select"
          value={filterMonth ? String(filterMonth) : ''}
          onChange={v => changeMonth(v)}
          placeholder="Все месяцы"
          options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
        />
        <Select
          className="tlt__date-select"
          value={filterDay ? String(filterDay) : ''}
          onChange={v => changeDay(v)}
          placeholder="Все дни"
          disabled={!filterMonth}
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
      <div className="tlt__table-wrap">
        <table className="tlt__table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Телефон</th>
              <th>Секция</th>
              <th>Тренер</th>
              <th>Время</th>
              <th>Комментарий</th>
              <th>Дата</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="tlt__skeleton-cell">
                  <SkeletonTable rows={6} cols={9} />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="tlt__empty-cell">
                  <EmptyState compact tableCell message="Нет заявок" />
                </td>
              </tr>
            ) : items.map(lead => {
              const status  = lead.status || 'pending';
              const badge   = STATUS_BADGE[status] ?? STATUS_BADGE.pending;
              const suspect = isSuspect(lead);
              return (
                <tr key={lead.id} className={suspect && status === 'pending' ? 'tlt__row--suspect' : ''}>
                  <td>
                    <span className="tlt__name">
                      {suspect && status === 'pending' && (
                        <span className="tlt__suspect-icon" title={suspectReason(lead)}>⚠</span>
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
                      >
                        {lead.phone}
                      </a>
                    ) : '—'}
                  </td>
                  <td>{lead.taplinkSport ?? lead.taplink_sport ?? '—'}</td>
                  <td>{lead.taplinkTrainer ?? lead.taplink_trainer ?? '—'}</td>
                  <td className="tlt__time">{lead.preferredTime ?? lead.preferred_time ?? '—'}</td>
                  <td className="tlt__comment" title={lead.comment || ''}>{lead.comment || '—'}</td>
                  <td className="tlt__date">{fmt(lead.createdAt ?? lead.created_at)}</td>
                  <td>
                    <span className={`tlt__badge ${badge.cls}`}>{badge.text}</span>
                  </td>
                  <td className="tlt__actions">
                    {status === 'pending' && (
                      <div className="tlt__action-group">
                        <button type="button" className="tlt__btn tlt__btn--accept"
                          disabled={saving === lead.id}
                          onClick={() => setStatus(lead, 'accepted')}
                          title="Запишется — клиент решил заниматься">
                          ✓ Запись
                        </button>
                        <button type="button" className="tlt__btn tlt__btn--reject"
                          disabled={saving === lead.id}
                          onClick={() => setStatus(lead, 'rejected')}
                          title="Отказался — не захотел">
                          ✕ Отказ
                        </button>
                        <button type="button" className="tlt__btn tlt__btn--spam"
                          disabled={saving === lead.id}
                          onClick={() => setStatus(lead, 'spam')}
                          title="Пометить как спам">
                          ⚠ Спам
                        </button>
                      </div>
                    )}
                    {status === 'spam' && (
                      <button type="button" className="tlt__btn tlt__btn--undo"
                        disabled={saving === lead.id}
                        onClick={() => setStatus(lead, 'pending')}
                        title="Не спам — вернуть в новые">
                        ↩ Не спам
                      </button>
                    )}
                    {(status === 'accepted' || status === 'rejected') && (
                      <button type="button" className="tlt__btn tlt__btn--undo"
                        disabled={saving === lead.id}
                        onClick={() => setStatus(lead, 'pending')}
                        title="Вернуть в новые">
                        ↩ Вернуть
                      </button>
                    )}
                  </td>
                </tr>
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

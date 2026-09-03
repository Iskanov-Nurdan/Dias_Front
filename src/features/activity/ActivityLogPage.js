import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Search, Plus, Pencil, Trash2, AlertTriangle, RefreshCw, History, Eye, ListFilter, Layers, Calendar, CalendarDays, CalendarClock } from 'lucide-react';
import { Select, FilterBar, EmptyState, ErrorState, Pagination } from '../../shared/ui';
import { SkeletonTable } from '../../shared/ui/Skeleton';
import { useDebounce } from '../../shared/hooks/useDebounce';
import { useAbortSafeFetch } from '../../shared/hooks/useAbortSafeFetch';
import { getApiErrorMessage } from '../../shared/lib/apiError';
import { MONTHS, STATS_YEARS, SEARCH_DEBOUNCE_MS } from '../../shared/constants/common';
import { ACTION_TYPES, SECTIONS } from './constants';
import { fetchActivityLog } from './api';
import { fetchSports, fetchTrainers } from '../sports-trainers/api';
import ActivityDetailModal from './ActivityDetailModal';
import './ActivityLogPage.scss';

const ACTION_ICON = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  warning: AlertTriangle,
  payment: RefreshCw,
};

const getInitials = (name) =>
  (name || '').split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

const formatWhen = (iso) => {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 1) return 'только что';
  if (diffH < 24) return `${Math.floor(diffH)} ч назад`;
  const diffDays = Math.floor(diffH / 24);
  if (diffDays === 1) return 'вчера';
  if (diffDays < 7) return `${diffDays} дн назад`;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const ActivityLogPage = () => {
  const { run } = useAbortSafeFetch();
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, SEARCH_DEBOUNCE_MS);

  const [queryState, setQueryState] = useState(() => ({
    actionType: '',
    section: '',
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1),
    day: '',
    page: 1,
  }));

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detailEntry, setDetailEntry] = useState(null);
  const [sports, setSports] = useState([]);
  const [trainers, setTrainers] = useState([]);

  // Для карточки удалённого/изменённого клиента — резолвим ID вида спорта/тренера в названия
  useEffect(() => {
    fetchSports(null)
      .then((d) => setSports(Array.isArray(d) ? d : d?.results ?? d?.items ?? []))
      .catch(() => {});
    fetchTrainers({ perPage: 500 }, null)
      .then((d) => setTrainers(Array.isArray(d) ? d : d?.results ?? d?.items ?? []))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await run((signal) => fetchActivityLog(
        { ...queryState, search: debouncedSearch, perPage: 20 },
        signal,
      ));
      if (res === null) return;
      setData(res);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [run, queryState, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => {
    const list = data?.items ?? data?.results ?? (Array.isArray(data) ? data : []) ?? [];
    // Полностью пустые записи (ни entityLabel, ни description) — старый мусор до появления этих полей
    return list.filter((e) => e.entityLabel || e.description);
  }, [data]);

  const updateFilter = (patch) => setQueryState((q) => ({ ...q, ...patch, page: 1 }));

  return (
    <div className="activity-log-page">
      <div className="activity-log-page__notice">
        <span className="activity-log-page__notice-icon"><History size={15} /></span>
        Здесь отображаются действия всех сотрудников на сайте — создание, изменение, удаление, предупреждения и оплаты.
      </div>

      <FilterBar className="activity-log-page__filter-bar">
        <div className="ui-search activity-log-page__search">
          <Search size={15} className="ui-search__icon" />
          <input
            type="text"
            placeholder="Поиск по сотруднику или действию"
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setQueryState((q) => ({ ...q, page: 1 })); }}
            className="ui-search__input"
          />
        </div>
        <Select
          value={queryState.actionType}
          onChange={(v) => updateFilter({ actionType: v })}
          options={[{ value: '', label: 'Все действия' }, ...Object.entries(ACTION_TYPES).map(([v, o]) => ({ value: v, label: o.label }))]}
          placeholder="Все действия"
          className="activity-log-page__select"
          icon={<ListFilter size={15} />}
        />
        <Select
          value={queryState.section}
          onChange={(v) => updateFilter({ section: v })}
          options={[{ value: '', label: 'Все разделы' }, ...Object.entries(SECTIONS).map(([v, label]) => ({ value: v, label }))]}
          placeholder="Все разделы"
          className="activity-log-page__select"
          icon={<Layers size={15} />}
        />
        <Select
          value={queryState.year}
          onChange={(v) => updateFilter({ year: v, month: '', day: '' })}
          options={[{ value: '', label: 'Год — все' }, ...STATS_YEARS.map((y) => ({ value: y, label: y }))]}
          placeholder="Год"
          className="activity-log-page__select activity-log-page__select--date"
          icon={<Calendar size={15} />}
        />
        <Select
          value={queryState.month}
          onChange={(v) => updateFilter({ month: v, day: '' })}
          disabled={!queryState.year}
          options={[{ value: '', label: 'Месяц — все' }, ...MONTHS.slice(1).map((m, i) => ({ value: String(i + 1), label: m }))]}
          placeholder="Месяц"
          className="activity-log-page__select activity-log-page__select--date"
          icon={<CalendarDays size={15} />}
        />
        <Select
          value={queryState.day}
          onChange={(v) => updateFilter({ day: v })}
          disabled={!queryState.month}
          options={[{ value: '', label: 'День — все' }, ...Array.from({ length: 31 }, (_, i) => i + 1).map((d) => ({ value: String(d), label: String(d) }))]}
          placeholder="День"
          className="activity-log-page__select activity-log-page__select--date"
          icon={<CalendarClock size={15} />}
        />
      </FilterBar>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading && !data ? (
        <SkeletonTable rows={8} cols={5} />
      ) : (
        <div className="ui-list__table-wrap activity-log-page__table-wrap">
          <table className="ui-list__table activity-log-page__table">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Действие</th>
                <th>Раздел</th>
                <th>Когда</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="ui-list__empty-cell">
                    <EmptyState compact tableCell message="Ничего не найдено" />
                  </td>
                </tr>
              ) : items.map((e, idx) => {
                const actionInfo = ACTION_TYPES[e.actionType];
                const Icon = ACTION_ICON[e.actionType] ?? History;
                const hasDetail = (e.changes?.length || e.snapshot?.length) > 0;
                return (
                  <tr key={e.id} style={{ '--row-i': idx }}>
                    <td data-label="Сотрудник">
                      <div className="ui-list__name-cell">
                        <span className="ui-avatar">{getInitials(e.actorName)}</span>
                        <div className="ui-list__name-info">
                          <span className="ui-list__title">{e.actorName}</span>
                          <span className="ui-list__muted">{e.actorRole}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="Действие">
                      <div className="activity-log-page__action">
                        <span className={`ui-pill ${actionInfo?.cls ?? ''}`}>
                          <Icon size={11} /> {actionInfo?.label ?? e.actionType}
                        </span>
                        <span className="activity-log-page__action-text">
                          {e.entityLabel && <strong>{e.entityLabel} — </strong>}{e.description}
                        </span>
                      </div>
                    </td>
                    <td data-label="Раздел" className="ui-list__muted">{SECTIONS[e.section] ?? e.section}</td>
                    <td data-label="Когда" className="ui-list__muted">{formatWhen(e.createdAt)}</td>
                    <td className="ui-list__actions" data-label="">
                      {hasDetail && (
                        <button type="button" className="ui-list-btn" onClick={() => setDetailEntry(e)}>
                          <Eye size={13} /> Подробнее
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={data?.meta} currentPage={queryState.page} onPage={(p) => setQueryState((q) => ({ ...q, page: p }))} loading={loading} entityLabel="записей" />
      {detailEntry && <ActivityDetailModal entry={detailEntry} onClose={() => setDetailEntry(null)} sports={sports} trainers={trainers} />}
    </div>
  );
};

export default ActivityLogPage;

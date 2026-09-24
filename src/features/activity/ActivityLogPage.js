import React, { useState, useCallback, useEffect } from 'react';
import { Search, Plus, Pencil, Trash2, RotateCcw, History, Eye, ListFilter, Layers, Users } from 'lucide-react';
import { Select, FilterBar, EmptyState, ErrorState, Pagination, PeriodFilter } from '../../shared/ui';
import { SkeletonTable } from '../../shared/ui/Skeleton';
import { useDebounce } from '../../shared/hooks/useDebounce';
import { useAbortSafeFetch } from '../../shared/hooks/useAbortSafeFetch';
import { getApiErrorMessage } from '../../shared/lib/apiError';
import { SEARCH_DEBOUNCE_MS, STATS_YEARS } from '../../shared/constants/common';
import { ACTION_TYPES, SECTION_FILTER_OPTIONS, sectionLabel } from './constants';
import { fetchActivityLog } from './api';
import { fetchEmployees } from '../employees/api';
import { ymdToRange } from '../../shared/lib/dateRange';
import ActivityDetailModal from './ActivityDetailModal';
import './ActivityLogPage.scss';

const ACTION_ICON = { create: Plus, update: Pencil, delete: Trash2, restore: RotateCcw };

const NOW = new Date();
const CURRENT_YEAR_STR = String(NOW.getFullYear());
const DEFAULT_YEAR = STATS_YEARS.includes(CURRENT_YEAR_STR) ? CURRENT_YEAR_STR : STATS_YEARS[STATS_YEARS.length - 1];
const DEFAULT_MONTH = String(NOW.getMonth() + 1);

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
    action: '',
    section: '',
    userId: '',
    year: DEFAULT_YEAR,
    month: DEFAULT_MONTH,
    day: '',
    page: 1,
  }));

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detailEntry, setDetailEntry] = useState(null);

  // Список сотрудников для фильтра — грузим один раз, справочник небольшой.
  const [employees, setEmployees] = useState([]);
  useEffect(() => {
    fetchEmployees({ perPage: 500 }).then((res) => {
      const list = res?.items ?? res?.results ?? [];
      setEmployees(list);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { dateFrom, dateTo } = ymdToRange(queryState.year, queryState.month, queryState.day);
      const res = await run((signal) => fetchActivityLog(
        { ...queryState, dateFrom, dateTo, search: debouncedSearch, perPage: 20 },
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

  const items = data?.items ?? [];

  const updateFilter = (patch) => setQueryState((q) => ({ ...q, ...patch, page: 1 }));

  const isDefault = queryState.year === DEFAULT_YEAR && queryState.month === DEFAULT_MONTH
    && queryState.day === '' && !queryState.action && !queryState.section && !queryState.userId;

  const resetAll = () => setQueryState({
    action: '', section: '', userId: '', year: DEFAULT_YEAR, month: DEFAULT_MONTH, day: '', page: 1,
  });

  return (
    <div className="activity-log-page">
      <div className="activity-log-page__notice">
        <span className="activity-log-page__notice-icon"><History size={15} /></span>
        Здесь отображаются действия всех сотрудников на сайте — создание, изменение и удаление записей.
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
          value={queryState.action}
          onChange={(v) => updateFilter({ action: v })}
          options={[{ value: '', label: 'Все действия' }, ...Object.entries(ACTION_TYPES).map(([v, o]) => ({ value: v, label: o.label }))]}
          placeholder="Все действия"
          className="activity-log-page__select"
          icon={<ListFilter size={15} />}
        />
        <Select
          value={queryState.section}
          onChange={(v) => updateFilter({ section: v })}
          options={[{ value: '', label: 'Все разделы' }, ...SECTION_FILTER_OPTIONS]}
          placeholder="Все разделы"
          className="activity-log-page__select"
          icon={<Layers size={15} />}
        />
        <Select
          value={queryState.userId}
          onChange={(v) => updateFilter({ userId: v })}
          options={[{ value: '', label: 'Все сотрудники' }, ...employees.map((e) => ({ value: String(e.id), label: e.name }))]}
          placeholder="Все сотрудники"
          className="activity-log-page__select"
          icon={<Users size={15} />}
        />
        <PeriodFilter
          year={queryState.year}
          month={queryState.month}
          day={queryState.day}
          onYear={(v) => updateFilter({ year: v, month: '', day: '' })}
          onMonth={(v) => updateFilter({ month: v, day: '' })}
          onDay={(v) => updateFilter({ day: v })}
          onReset={resetAll}
          isDefault={isDefault}
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
                const actionInfo = ACTION_TYPES[e.action];
                const Icon = ACTION_ICON[e.action] ?? History;
                return (
                  <tr key={e.id} style={{ '--row-i': idx }}>
                    <td data-label="Сотрудник">
                      <div className="ui-list__name-cell">
                        <span className="ui-avatar">{getInitials(e.user_name)}</span>
                        <div className="ui-list__name-info">
                          <span className="ui-list__title">{e.user_name || 'Неизвестно'}</span>
                          <span className="ui-list__muted">{e.actor_role_snapshot}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="Действие">
                      <div className="activity-log-page__action">
                        <span className={`ui-pill ${actionInfo?.cls ?? ''}`}>
                          <Icon size={11} /> {actionInfo?.label ?? e.action}
                        </span>
                        <span className="activity-log-page__action-text">{e.description || e.summary}</span>
                      </div>
                    </td>
                    <td data-label="Раздел" className="ui-list__muted">{sectionLabel(e.section)}</td>
                    <td data-label="Когда" className="ui-list__muted">{formatWhen(e.created_at)}</td>
                    <td className="ui-list__actions" data-label="">
                      {e.has_detail && (
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
      {detailEntry && <ActivityDetailModal entry={detailEntry} onClose={() => setDetailEntry(null)} />}
    </div>
  );
};

export default ActivityLogPage;

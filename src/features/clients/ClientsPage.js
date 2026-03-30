import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { fetchClients, fetchClientsNotRenewed, fetchClient, createClient, updateClient, deleteClient, extendClient, fetchAllClientsPaginated, fetchClientsStats, createOneTimePayment } from './api';
import { fetchSports } from '../sports-trainers/api';
import { fetchTrainers } from '../sports-trainers/api';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { useDebounce } from '../../shared/hooks/useDebounce';
import { useAbortSafeFetch } from '../../shared/hooks/useAbortSafeFetch';
import { SEARCH_DEBOUNCE_MS, formatMoney, MONTHS, STATS_YEARS } from '../../shared/constants/common';
import { isPeriodClosedError, getApiErrorMessage } from '../../shared/lib/apiError';
import { filterClientsByPeriod, getExactDuplicates, getSimilarGroups } from '../../shared/lib/duplicates';
import { Select, ConfirmModal, Pagination, FiltersModal, FilterBar, EmptyState } from '../../shared/ui';
import { ClientsList, ClientCardModal, ClientFormModal, ExtendModal, TrainerDetailsModal, DuplicateGroup } from './components';
import './ClientsPage.scss';

const TAB_LIST = 'list';
const TAB_NOT_RENEWED = 'not_renewed';
const TAB_DUPS = 'dups';
const TAB_STATS = 'stats';
const TAB_ONETIME = 'onetime';

const SUBTAB_EXACT   = 'exact';
const SUBTAB_SIMILAR = 'similar';

/** Годы в фильтре списка клиентов: из STATS_YEARS + текущий, чтобы значение по умолчанию всегда было в списке. */
const getClientListFilterYearValues = () => {
  const cy = String(new Date().getFullYear());
  const set = new Set([...STATS_YEARS, cy]);
  return Array.from(set).sort((a, b) => Number(a) - Number(b));
};

const ClientsPage = () => {
  const { user, isAdmin, showAccessDenied } = useAuth();
  const toast = useToast();

  const clientListFilterYearValues = useMemo(() => getClientListFilterYearValues(), []);

  const [activeTab, setActiveTab] = useState(TAB_LIST);
  const [activeDupTab, setActiveDupTab] = useState(SUBTAB_EXACT);

  // ── Статистика ──
  const [statsYear, setStatsYear] = useState(new Date().getFullYear().toString());
  const [statsMonth, setStatsMonth] = useState(String(new Date().getMonth() + 1));

  // ── Дубликаты: фильтр по году/месяцу (2026/2027) ──
  const [dupYear, setDupYear] = useState(() => {
    const y = new Date().getFullYear();
    return (y === 2026 || y === 2027) ? String(y) : '2026';
  });
  const [dupMonth, setDupMonth] = useState(String(new Date().getMonth() + 1));

  // ── Основной список ──
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, SEARCH_DEBOUNCE_MS);
  const [queryState, setQueryState] = useState(() => ({
    search: '',
    sportId: '',
    trainerId: '',
    paid: '',
    clientType: '',
    year: String(new Date().getFullYear()),
    month: '',
    day: '',
    page: 1,
    perPage: 20,
  }));
  const [data, setData] = useState(null);
  const [sports, setSports] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notRenewedData, setNotRenewedData] = useState(null);
  const [notRenewedLoading, setNotRenewedLoading] = useState(false);
  const [notRenewedError, setNotRenewedError] = useState(null);
  const [nrYear, setNrYear] = useState(() => {
    const y = new Date().getFullYear();
    return y === 2026 || y === 2027 ? String(y) : '2026';
  });
  const [nrMonth, setNrMonth] = useState(String(new Date().getMonth() + 1));
  const [nrPage, setNrPage] = useState(1);
  const { run: runMain } = useAbortSafeFetch();
  const { run: runNotRenewed } = useAbortSafeFetch();

  // ── Все клиенты для дубликатов ──
  const [allClients, setAllClients] = useState([]);
  const [allLoading, setAllLoading] = useState(false);
  const allControllerRef = useRef(null);

  // ── Статистика (с бэкенда) ──
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const statsControllerRef = useRef(null);

  // ── Разовые оплаты ──
  const [oneTimeSearch, setOneTimeSearch] = useState('');
  const oneTimeDebounced = useDebounce(oneTimeSearch, SEARCH_DEBOUNCE_MS);
  const [oneTimeYear, setOneTimeYear] = useState('');
  const [oneTimeMonth, setOneTimeMonth] = useState('');
  const [oneTimePage, setOneTimePage] = useState(1);
  const [oneTimeData, setOneTimeData] = useState(null);
  const [oneTimeLoading, setOneTimeLoading] = useState(false);
  const [oneTimeAddInputs, setOneTimeAddInputs] = useState({});
  const [oneTimeAddLoading, setOneTimeAddLoading] = useState({});
  const [confirmAddOneTime, setConfirmAddOneTime] = useState(null);
  const oneTimeControllerRef = useRef(null);

  // ── Модалки ──
  const [formClient, setFormClient] = useState(null);
  const [cardClient, setCardClient] = useState(null);
  const [extendClientObj, setExtendClientObj] = useState(null);
  const [clientFormError, setClientFormError] = useState(null);
  const [clientFormSaving, setClientFormSaving] = useState(false);
  const [extendFormError, setExtendFormError] = useState(null);
  const [extendFormSaving, setExtendFormSaving] = useState(false);
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);

  const resetListFilters = useCallback(() => {
    setQueryState((q) => ({
      ...q,
      sportId: '',
      trainerId: '',
      paid: '',
      clientType: '',
      year: '',
      month: '',
      day: '',
      page: 1,
    }));
  }, []);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [trainerDetails, setTrainerDetails] = useState(null);

  const fetchSafe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = { ...queryState, search: debouncedSearch.trim() || undefined };
      const res = await runMain((signal) => fetchClients(q, signal));
      if (res === null) return;
      setData(res);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [runMain, queryState, debouncedSearch]);

  const fetchNotRenewedSafe = useCallback(async () => {
    if (!nrYear || !nrMonth) return;
    setNotRenewedLoading(true);
    setNotRenewedError(null);
    try {
      const res = await runNotRenewed((signal) =>
        fetchClientsNotRenewed({ year: nrYear, month: nrMonth, page: nrPage, perPage: 20 }, signal)
      );
      if (res === null) return;
      setNotRenewedData(res);
    } catch (err) {
      setNotRenewedError(getApiErrorMessage(err));
    } finally {
      setNotRenewedLoading(false);
    }
  }, [runNotRenewed, nrYear, nrMonth, nrPage]);

  const refreshClientTabsData = useCallback(() => {
    fetchSafe();
    fetchNotRenewedSafe();
  }, [fetchSafe, fetchNotRenewedSafe]);

  const fetchAllClients = useCallback(async () => {
    allControllerRef.current?.abort();
    allControllerRef.current = new AbortController();
    setAllLoading(true);
    try {
      const list = await fetchAllClientsPaginated({}, allControllerRef.current.signal);
      setAllClients(list);
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
    } finally {
      setAllLoading(false);
    }
  }, []);

  useEffect(() => {
    setQueryState((q) => (q.search === debouncedSearch ? q : { ...q, search: debouncedSearch, page: 1 }));
  }, [debouncedSearch]);

  useEffect(() => {
    setNrPage(1);
  }, [nrYear, nrMonth]);

  useEffect(() => {
    if (activeTab === TAB_LIST) {
      fetchSafe();
    }
    if (activeTab === TAB_NOT_RENEWED) {
      fetchNotRenewedSafe();
    }
  }, [activeTab, fetchSafe, fetchNotRenewedSafe]);

  useEffect(() => {
    if (activeTab === TAB_DUPS) {
      fetchAllClients();
      return () => allControllerRef.current?.abort();
    }
  }, [activeTab, fetchAllClients]);

  const fetchStats = useCallback(async () => {
    statsControllerRef.current?.abort();
    statsControllerRef.current = new AbortController();
    setStatsLoading(true);
    setStatsData(null);
    try {
      const params = {};
      if (statsYear) params.year = statsYear;
      if (statsMonth) params.month = statsMonth;
      const res = await fetchClientsStats(params, statsControllerRef.current.signal);
      setStatsData(res);
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
    } finally {
      setStatsLoading(false);
    }
  }, [statsYear, statsMonth]);

  useEffect(() => {
    if (activeTab === TAB_STATS) {
      fetchStats();
      return () => statsControllerRef.current?.abort();
    }
  }, [activeTab, fetchStats]);

  const fetchOneTime = useCallback(async () => {
    oneTimeControllerRef.current?.abort();
    oneTimeControllerRef.current = new AbortController();
    setOneTimeLoading(true);
    setOneTimeData(null);
    try {
      const params = { clientType: 'one-time', page: oneTimePage, perPage: 20 };
      if (oneTimeDebounced.trim()) params.search = oneTimeDebounced.trim();
      if (oneTimeYear) params.year = oneTimeYear;
      if (oneTimeMonth) params.month = oneTimeMonth;
      const res = await fetchClients(params, oneTimeControllerRef.current.signal);
      setOneTimeData(res);
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
    } finally {
      setOneTimeLoading(false);
    }
  }, [oneTimePage, oneTimeDebounced, oneTimeYear, oneTimeMonth]);

  useEffect(() => {
    if (activeTab === TAB_ONETIME) {
      setOneTimePage(1);
    }
  }, [activeTab, oneTimeDebounced, oneTimeYear, oneTimeMonth]);

  useEffect(() => {
    if (activeTab === TAB_ONETIME) {
      fetchOneTime();
      return () => oneTimeControllerRef.current?.abort();
    }
  }, [activeTab, fetchOneTime]);

  const handleAddOneTimeAmount = async (client, amount) => {
    if (!client?.id || !amount || amount <= 0) return;
    setConfirmAddOneTime(null);
    setOneTimeAddLoading((prev) => ({ ...prev, [client.id]: true }));
    try {
      await createOneTimePayment(client.id, { amount }, null);
      setOneTimeAddInputs((prev) => ({ ...prev, [client.id]: '' }));
      fetchOneTime();
      toast.success(`Добавлено ${amount.toLocaleString('ru-RU')} сом`);
    } catch (e) {
      const msg = isPeriodClosedError(e)
        ? 'Период закрыт. Изменение финансовых данных запрещено.'
        : (e.response?.data?.error?.message ?? e.response?.data?.message ?? e.response?.data?.detail ?? e.message ?? 'Ошибка');
      toast.error(msg);
    } finally {
      setOneTimeAddLoading((prev) => ({ ...prev, [client.id]: false }));
    }
  };

  useEffect(() => {
    fetchSports(null)
      .then((d) => setSports(Array.isArray(d) ? d : d?.results ?? d?.items ?? []))
      .catch((e) => {
        toast.error(e?.userMessage ?? e?.response?.data?.message ?? 'Ошибка загрузки видов спорта');
      });
  }, []);

  useEffect(() => {
    fetchTrainers({ perPage: 500 }, null)
      .then((d) => setTrainers(Array.isArray(d) ? d : d?.results ?? d?.items ?? []))
      .catch((e) => {
        toast.error(e?.userMessage ?? e?.response?.data?.message ?? 'Ошибка загрузки тренеров');
      });
  }, []);

  const items = data?.items ?? data?.results ?? (Array.isArray(data) ? data : []) ?? [];
  const notRenewedItems = notRenewedData?.items ?? notRenewedData?.results ?? (Array.isArray(notRenewedData) ? notRenewedData : []) ?? [];

  const nrNextPeriod = useMemo(() => {
    if (!nrYear || !nrMonth) return null;
    const y = Number(nrYear);
    const m = Number(nrMonth);
    if (!Number.isFinite(y) || m < 1 || m > 12) return null;
    return m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 };
  }, [nrYear, nrMonth]);

  const notRenewedSummary = useMemo(() => {
    const r = notRenewedData;
    if (!r) return null;
    const meta = r.meta ?? {};
    const totalFromMeta = meta.total ?? meta.totalCount ?? meta.count;
    const s = r.summary ?? r.data?.summary;
    const base = s?.baseMonthCount ?? s?.base_month_count ?? s?.inBaseMonthCount ?? s?.in_base_month_count;
    const next = s?.nextMonthCount ?? s?.next_month_count ?? s?.inNextMonthCount ?? s?.in_next_month_count;
    let notRen = s?.notRenewedCount ?? s?.not_renewed_count;
    if (notRen == null && totalFromMeta != null) notRen = totalFromMeta;
    let pct = s?.notRenewedPercent ?? s?.not_renewed_percent;
    if ((pct === undefined || pct === null) && base != null && notRen != null && Number(base) > 0) {
      pct = Math.round((Number(notRen) / Number(base)) * 1000) / 10;
    }
    return {
      base: base != null ? Number(base) : null,
      next: next != null ? Number(next) : null,
      notRen: notRen != null ? Number(notRen) : null,
      pct: pct != null && pct !== '' ? Number(pct) : null,
    };
  }, [notRenewedData]);

  // Дубликаты только среди клиентов выбранного месяца (по dateStart)
  const dupFilteredClients = useMemo(
    () => filterClientsByPeriod(allClients, dupYear, dupMonth || null),
    [allClients, dupYear, dupMonth]
  );
  const exactGroups  = useMemo(() => getExactDuplicates(dupFilteredClients), [dupFilteredClients]);
  const similarGroups = useMemo(() => getSimilarGroups(dupFilteredClients), [dupFilteredClients]);


  const handleSaveClient = async (payload) => {
    setClientFormError(null);
    setClientFormSaving(true);
    try {
      if (formClient?.id) await updateClient(formClient.id, payload, null);
      else await createClient(payload, null);
      setFormClient(null);
      refreshClientTabsData();
      toast.success(formClient?.id ? 'Клиент сохранён' : 'Клиент добавлен');
    } catch (e) {
      const d = e.response?.data;
      const msg = isPeriodClosedError(e)
        ? 'Период закрыт. Изменение финансовых данных запрещено.'
        : (d?.error?.message ?? d?.message ?? d?.detail ?? 'Ошибка сохранения');
      setClientFormError(msg);
      toast.error(msg);
    } finally {
      setClientFormSaving(false);
    }
  };

  const handleDeleteClient = () => {
    if (!confirmDelete) return;
    deleteClient(confirmDelete.id, null)
      .then(() => {
        setConfirmDelete(null);
        refreshClientTabsData();
        toast.success('Клиент удалён');
      })
      .catch((e) => {
        const msg = isPeriodClosedError(e)
          ? 'Период закрыт. Изменение финансовых данных запрещено.'
          : (e.response?.data?.error?.message ?? e.response?.data?.message ?? e.response?.data?.detail ?? e.message ?? 'Ошибка удаления');
        toast.error(msg);
      });
  };

  const handleOpenCard = (c) =>
    fetchClient(c.id, null)
      .then((res) => setCardClient(res?.data ?? res))
      .catch((e) => toast.error(getApiErrorMessage(e)));

  const handleSaveExtend = async (payload) => {
    if (!extendClientObj) return;
    setExtendFormError(null);
    setExtendFormSaving(true);
    try {
      await extendClient(extendClientObj.id, payload, null);
      setExtendClientObj(null);
      refreshClientTabsData();
      toast.success('Абонемент продлён');
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setExtendFormError(msg);
      toast.error(msg);
    } finally {
      setExtendFormSaving(false);
    }
  };

  return (
    <div className="clients-page">
      <h1 className="clients-page__title ui-page-h1">Клиенты</h1>

      {/* Главные табы */}
      <div className="clients-page__tabs">
        <button type="button" className={`clients-page__tab${activeTab === TAB_LIST ? ' clients-page__tab--active' : ''}`} onClick={() => setActiveTab(TAB_LIST)}>Клиенты</button>
        <button type="button" className={`clients-page__tab${activeTab === TAB_NOT_RENEWED ? ' clients-page__tab--active' : ''}`} onClick={() => setActiveTab(TAB_NOT_RENEWED)}>Не продлили</button>
        <button type="button" className={`clients-page__tab${activeTab === TAB_DUPS ? ' clients-page__tab--active' : ''}`} onClick={() => setActiveTab(TAB_DUPS)}>Дубликаты</button>
        <button type="button" className={`clients-page__tab${activeTab === TAB_STATS ? ' clients-page__tab--active' : ''}`} onClick={() => setActiveTab(TAB_STATS)}>Статистика</button>
        <button type="button" className={`clients-page__tab${activeTab === TAB_ONETIME ? ' clients-page__tab--active' : ''}`} onClick={() => setActiveTab(TAB_ONETIME)}>Разовый</button>
      </div>

      {/* ── Список клиентов ── */}
      {activeTab === TAB_LIST && (
        <>
          <FilterBar className="clients-page__filter-bar">
            <div className="clients-page__filters clients-page__filters--desktop">
              <div className="clients-page__filters-row clients-page__filters-row--main">
                <input type="text" placeholder="Поиск" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="clients-page__search" />
                <div className="clients-page__filters-group">
                  <Select value={queryState.sportId} onChange={(v) => setQueryState((q) => ({ ...q, sportId: v, page: 1 }))} options={[{ value: '', label: 'Все виды спорта' }, ...sports.map((s) => ({ value: String(s.id), label: s.name || '' }))]} placeholder="Спорт" className="clients-page__select-wrap" />
                  <Select value={queryState.trainerId} onChange={(v) => setQueryState((q) => ({ ...q, trainerId: v, page: 1 }))} options={[{ value: '', label: 'Тренер — все' }, ...trainers.map((t) => ({ value: String(t.id), label: t.fio || '' }))]} placeholder="Тренер" className="clients-page__select-wrap" />
                  <Select value={queryState.paid} onChange={(v) => setQueryState((q) => ({ ...q, paid: v, page: 1 }))} options={[{ value: '', label: 'Оплата — все' }, { value: 'true', label: 'Оплачено' }, { value: 'false', label: 'Не оплачено' }]} placeholder="Оплата" className="clients-page__select-wrap" />
                  <Select value={queryState.clientType} onChange={(v) => setQueryState((q) => ({ ...q, clientType: v, page: 1 }))} options={[{ value: '', label: 'Тип — все' }, { value: 'regular', label: 'Регулярный' }, { value: 'individual', label: 'Индивидуальный' }, { value: 'one-time', label: 'Разовый' }]} placeholder="Тип" className="clients-page__select-wrap" />
                </div>
                <button type="button" className="clients-page__add clients-page__add--desktop filter-bar__action" onClick={() => setFormClient({})}>Добавить клиента</button>
              </div>
              <div className="clients-page__filters-row clients-page__filters-row--date">
                <Select
                value={queryState.year}
                onChange={(v) => setQueryState((q) => ({ ...q, year: v, month: v ? q.month : '', day: v ? q.day : '', page: 1 }))}
                options={[{ value: '', label: 'Год — все' }, ...clientListFilterYearValues.map((y) => ({ value: y, label: y }))]}
                placeholder="Год"
                className="clients-page__select-wrap clients-page__select-year"
              />
              {queryState.year && (
                <Select
                  value={queryState.month}
                  onChange={(v) => setQueryState((q) => ({ ...q, month: v, day: v ? q.day : '', page: 1 }))}
                  options={[{ value: '', label: 'Месяц — все' }, { value: '1', label: 'Январь' }, { value: '2', label: 'Февраль' }, { value: '3', label: 'Март' }, { value: '4', label: 'Апрель' }, { value: '5', label: 'Май' }, { value: '6', label: 'Июнь' }, { value: '7', label: 'Июль' }, { value: '8', label: 'Август' }, { value: '9', label: 'Сентябрь' }, { value: '10', label: 'Октябрь' }, { value: '11', label: 'Ноябрь' }, { value: '12', label: 'Декабрь' }]}
                  placeholder="Месяц"
                  className="clients-page__select-wrap"
                />
              )}
              {queryState.year && queryState.month && (
                <Select
                  value={queryState.day}
                  onChange={(v) => setQueryState((q) => ({ ...q, day: v, page: 1 }))}
                  options={[{ value: '', label: 'День — все' }, ...Array.from({ length: 31 }, (_, i) => i + 1).map((d) => ({ value: String(d), label: String(d) }))]}
                  placeholder="День"
                  className="clients-page__select-wrap clients-page__select-day"
                />
              )}
                {(queryState.year || queryState.month || queryState.day) && (
                <button type="button" className="clients-page__date-clear" onClick={() => setQueryState((q) => ({ ...q, year: '', month: '', day: '', page: 1 }))} title="Сбросить дату">✕</button>
                )}
              </div>
            </div>
            <div className="clients-page__toolbar-mobile clients-page__toolbar-mobile--filter-bar">
              <input type="text" placeholder="Поиск" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="clients-page__search clients-page__search--mobile" />
              <div className="clients-page__toolbar-mobile-actions">
                <button type="button" className="clients-page__filters-btn" onClick={() => setFiltersModalOpen(true)}>Фильтры</button>
                <button type="button" className="clients-page__add filter-bar__action" onClick={() => setFormClient({})}>Добавить</button>
              </div>
            </div>
          </FilterBar>
          <FiltersModal
            open={filtersModalOpen}
            onClose={() => setFiltersModalOpen(false)}
            title="Фильтры"
            footer={(
              <div className="clients-page__filters-modal-footer">
                <button type="button" className="clients-page__filter-reset" onClick={resetListFilters}>Сброс</button>
                <button type="button" className="clients-page__filter-apply" onClick={() => setFiltersModalOpen(false)}>Применить</button>
              </div>
            )}
          >
            <div className="clients-page__filters-modal-content">
              <label className="clients-page__filter-label"><span>Вид спорта</span><Select value={queryState.sportId} onChange={(v) => setQueryState((q) => ({ ...q, sportId: v, page: 1 }))} options={[{ value: '', label: 'Все' }, ...sports.map((s) => ({ value: String(s.id), label: s.name || '' }))]} placeholder="Все" className="clients-page__select-wrap" /></label>
              <label className="clients-page__filter-label"><span>Тренер</span><Select value={queryState.trainerId} onChange={(v) => setQueryState((q) => ({ ...q, trainerId: v, page: 1 }))} options={[{ value: '', label: 'Все' }, ...trainers.map((t) => ({ value: String(t.id), label: t.fio || '' }))]} placeholder="Все" className="clients-page__select-wrap" /></label>
              <label className="clients-page__filter-label"><span>Оплата</span><Select value={queryState.paid} onChange={(v) => setQueryState((q) => ({ ...q, paid: v, page: 1 }))} options={[{ value: '', label: 'Все' }, { value: 'true', label: 'Оплачено' }, { value: 'false', label: 'Не оплачено' }]} placeholder="Все" className="clients-page__select-wrap" /></label>
              <label className="clients-page__filter-label"><span>Тип</span><Select value={queryState.clientType} onChange={(v) => setQueryState((q) => ({ ...q, clientType: v, page: 1 }))} options={[{ value: '', label: 'Все' }, { value: 'regular', label: 'Регулярный' }, { value: 'individual', label: 'Индивидуальный' }, { value: 'one-time', label: 'Разовый' }]} placeholder="Все" className="clients-page__select-wrap" /></label>
              <label className="clients-page__filter-label"><span>Год</span><Select value={queryState.year} onChange={(v) => setQueryState((q) => ({ ...q, year: v, month: v ? q.month : '', day: v ? q.day : '', page: 1 }))} options={[{ value: '', label: 'Все' }, ...clientListFilterYearValues.map((y) => ({ value: y, label: y }))]} placeholder="Все" className="clients-page__select-wrap" /></label>
              {queryState.year && <label className="clients-page__filter-label"><span>Месяц</span><Select value={queryState.month} onChange={(v) => setQueryState((q) => ({ ...q, month: v, day: v ? q.day : '', page: 1 }))} options={[{ value: '', label: 'Все' }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: MONTHS[i + 1] }))]} placeholder="Все" className="clients-page__select-wrap" /></label>}
              {queryState.year && queryState.month && <label className="clients-page__filter-label"><span>День</span><Select value={queryState.day} onChange={(v) => setQueryState((q) => ({ ...q, day: v, page: 1 }))} options={[{ value: '', label: 'Все' }, ...Array.from({ length: 31 }, (_, i) => i + 1).map((d) => ({ value: String(d), label: String(d) }))]} placeholder="Все" className="clients-page__select-wrap" /></label>}
            </div>
          </FiltersModal>
          <ClientsList
            items={items}
            loading={loading}
            error={error}
            onRetry={fetchSafe}
            onEdit={(c) => (isAdmin ? setFormClient(c) : showAccessDenied())}
            onDelete={(c) => (isAdmin ? setConfirmDelete(c) : showAccessDenied())}
            onDetails={handleOpenCard}
            onExtend={setExtendClientObj}
            emptyStateActionLabel="Добавить клиента"
            emptyStateOnAction={() => (isAdmin ? setFormClient({}) : showAccessDenied())}
          />
          <Pagination meta={data?.meta} currentPage={queryState.page} onPage={(p) => setQueryState((q) => ({ ...q, page: p }))} loading={loading} entityLabel="клиентов" />
        </>
      )}

      {/* ── Не продлили (только год + месяц, сводка с бэка) ── */}
      {activeTab === TAB_NOT_RENEWED && (
        <>
          <FilterBar className="clients-page__not-renewed-toolbar">
            <div className="clients-page__not-renewed-toolbar-inner">
              <span className="clients-page__not-renewed-toolbar-label">Месяц</span>
              <Select
                value={nrYear}
                onChange={setNrYear}
                options={STATS_YEARS.map((y) => ({ value: y, label: y }))}
                placeholder="Год"
                className="clients-page__not-renewed-select clients-page__not-renewed-select--year"
              />
              <Select
                value={nrMonth}
                onChange={setNrMonth}
                options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: MONTHS[i + 1] }))}
                placeholder="Месяц"
                className="clients-page__not-renewed-select"
              />
              <button type="button" className="clients-page__add clients-page__add--desktop filter-bar__action clients-page__not-renewed-add" onClick={() => setFormClient({})}>Добавить клиента</button>
            </div>
          </FilterBar>
          {nrNextPeriod && (
            <p className="clients-page__not-renewed-period">
              Учитываются записи за <strong>{MONTHS[Number(nrMonth)]} {nrYear}</strong>
              {' — '}без продления на <strong>{MONTHS[nrNextPeriod.month]} {nrNextPeriod.year}</strong>
            </p>
          )}
          {!notRenewedLoading && notRenewedSummary && (
            <div className="clients-page__not-renewed-cards">
              <div className="clients-page__not-renewed-card">
                <div className="clients-page__not-renewed-card-value">{notRenewedSummary.base != null ? notRenewedSummary.base.toLocaleString('ru-RU') : '—'}</div>
                <div className="clients-page__not-renewed-card-label">Учеников в базовом месяце</div>
              </div>
              <div className="clients-page__not-renewed-card">
                <div className="clients-page__not-renewed-card-value">{notRenewedSummary.next != null ? notRenewedSummary.next.toLocaleString('ru-RU') : '—'}</div>
                <div className="clients-page__not-renewed-card-label">Учеников в следующем месяце</div>
              </div>
              <div className="clients-page__not-renewed-card">
                <div className="clients-page__not-renewed-card-value">{notRenewedSummary.notRen != null ? notRenewedSummary.notRen.toLocaleString('ru-RU') : '—'}</div>
                <div className="clients-page__not-renewed-card-label">Не продлили</div>
              </div>
              <div className="clients-page__not-renewed-card">
                <div className="clients-page__not-renewed-card-value">
                  {notRenewedSummary.pct != null && !Number.isNaN(notRenewedSummary.pct) ? `${String(notRenewedSummary.pct).replace('.', ',')}%` : '—'}
                </div>
                <div className="clients-page__not-renewed-card-label">Доля не продливших</div>
              </div>
            </div>
          )}
          <ClientsList
            items={notRenewedItems}
            loading={notRenewedLoading}
            error={notRenewedError}
            onRetry={fetchNotRenewedSafe}
            onEdit={(c) => (isAdmin ? setFormClient(c) : showAccessDenied())}
            onDelete={(c) => (isAdmin ? setConfirmDelete(c) : showAccessDenied())}
            onDetails={handleOpenCard}
            onExtend={setExtendClientObj}
            emptyMessage="Нет клиентов без продления на следующий месяц"
          />
          <Pagination meta={notRenewedData?.meta} currentPage={nrPage} onPage={setNrPage} loading={notRenewedLoading} entityLabel="клиентов" />
        </>
      )}

      {/* ── Дубликаты ── */}
      {activeTab === TAB_DUPS && (
        <div className="clients-page__dup-section">
          {/* Фильтр по году/месяцу */}
          <FilterBar className="clients-page__dup-toolbar">
            <Select
              value={dupYear}
              onChange={setDupYear}
              options={[{ value: '', label: 'Год — все' }, ...STATS_YEARS.map((y) => ({ value: y, label: y }))]}
              placeholder="Год"
              className="clients-page__dup-select"
            />
            <Select
              value={dupMonth}
              onChange={setDupMonth}
              options={[
                { value: '', label: 'Месяц — все' },
                ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: MONTHS[i + 1] })),
              ]}
              placeholder="Месяц"
              className="clients-page__dup-select"
            />
          </FilterBar>
          {/* Подтабы */}
          <div className="clients-page__subtabs">
            <button type="button" className={`clients-page__subtab${activeDupTab === SUBTAB_EXACT ? ' clients-page__subtab--active' : ''}`} onClick={() => setActiveDupTab(SUBTAB_EXACT)}>Точные дубликаты</button>
            <button type="button" className={`clients-page__subtab${activeDupTab === SUBTAB_SIMILAR ? ' clients-page__subtab--active' : ''}`} onClick={() => setActiveDupTab(SUBTAB_SIMILAR)}>Похожие имена</button>
          </div>

          {allLoading ? (
            <div className="clients-page__dup-loading"><span className="loading-inline"><span className="loading-inline__spinner" aria-hidden />Загрузка всех клиентов…</span></div>
          ) : !dupYear ? (
            <div className="clients-page__dup-empty">Выберите год и месяц для просмотра дубликатов</div>
          ) : activeDupTab === SUBTAB_EXACT ? (
            exactGroups.length === 0 ? (
              <div className="clients-page__dup-empty">
                <EmptyState compact message="Точных дубликатов не найдено" />
              </div>
            ) : (
              <>
                <p className="clients-page__dup-info">
                  Период: <strong>{dupYear}</strong>{dupMonth ? ` · ${MONTHS[Number(dupMonth)]}` : ' · весь год'}
                  {' · '}Найдено групп с одинаковым ФИО: <strong>{exactGroups.length}</strong>
                </p>
                {exactGroups.map((group, i) => <DuplicateGroup key={i} group={group} label={group[0].fio} onDetails={handleOpenCard} />)}
              </>
            )
          ) : (
            similarGroups.length === 0 ? (
              <div className="clients-page__dup-empty">
                <EmptyState compact message="Похожих имён не найдено" />
              </div>
            ) : (
              <>
                <p className="clients-page__dup-info">
                  Период: <strong>{dupYear}</strong>{dupMonth ? ` · ${MONTHS[Number(dupMonth)]}` : ' · весь год'}
                  {' · '}Найдено групп с похожими именами: <strong>{similarGroups.length}</strong>
                </p>
                {similarGroups.map((group, i) => <DuplicateGroup key={i} group={group} label={`${group[0].fio} / ${group[1].fio}${group.length > 2 ? ` +${group.length - 2}` : ''}`} onDetails={handleOpenCard} />)}
              </>
            )
          )}
        </div>
      )}

      {/* ── Статистика ── */}
      {activeTab === TAB_STATS && (
        <div className="clients-page__stats-section">
          <FilterBar className="clients-page__stats-toolbar">
            <Select
              value={statsYear}
              onChange={setStatsYear}
              options={[{ value: '', label: 'Год — все' }, ...STATS_YEARS.map((y) => ({ value: y, label: y }))]}
              placeholder="Год"
              className="clients-page__stats-select"
            />
            <Select
              value={statsMonth}
              onChange={setStatsMonth}
              options={[
                { value: '', label: 'Месяц — все' },
                ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: MONTHS[i + 1] })),
              ]}
              placeholder="Месяц"
              className="clients-page__stats-select"
            />
          </FilterBar>

          {statsLoading ? (
            <div className="clients-page__dup-loading"><span className="loading-inline"><span className="loading-inline__spinner" aria-hidden />Загрузка статистики…</span></div>
          ) : statsData ? (
            <>
              <p className="clients-page__stats-info">
                Период: <strong>{statsYear || 'все годы'}</strong>
                {statsMonth ? ` · ${MONTHS[Number(statsMonth)]}` : ''}
              </p>

              <div className="clients-page__stats-cards">
                <div className="clients-page__stats-card">
                  <div className="clients-page__stats-card-value">{statsData.summary?.total ?? 0}</div>
                  <div className="clients-page__stats-card-label">Учеников</div>
                </div>
                <div className="clients-page__stats-card">
                  <div className="clients-page__stats-card-value">{statsData.summary?.paid ?? 0}</div>
                  <div className="clients-page__stats-card-label">Оплатили</div>
                </div>
                <div className="clients-page__stats-card">
                  <div className="clients-page__stats-card-value">{statsData.summary?.unpaid ?? 0}</div>
                  <div className="clients-page__stats-card-label">Не оплатили</div>
                </div>
              </div>

              <div className="clients-page__stats-block">
                <h3 className="clients-page__stats-block-title">По тренерам</h3>
                <table className="clients-page__stats-table">
                  <thead>
                    <tr><th>Тренер</th><th>Учеников</th><th>Оплатили</th><th>Не оплатили</th></tr>
                  </thead>
                  <tbody>
                    {!statsData.byTrainer?.length ? (
                      <tr>
                        <td colSpan={4} className="clients-page__stats-empty">
                          <EmptyState compact tableCell message="Нет данных" />
                        </td>
                      </tr>
                    ) : (
                      statsData.byTrainer.map((r) => (
                        <tr
                          key={r.trainerId ?? r.trainerName ?? 'no-trainer'}
                          className={r.trainerId ? 'clients-page__stats-row--clickable' : ''}
                          onClick={r.trainerId ? () => setTrainerDetails({ trainerId: r.trainerId, trainerName: r.trainerName }) : undefined}
                          role={r.trainerId ? 'button' : undefined}
                          tabIndex={r.trainerId ? 0 : undefined}
                          onKeyDown={r.trainerId ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTrainerDetails({ trainerId: r.trainerId, trainerName: r.trainerName }); } } : undefined}
                        >
                          <td>{r.trainerName}</td>
                          <td>{r.total}</td>
                          <td>{r.paid}</td>
                          <td>{r.unpaid}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── Разовый ── */}
      {activeTab === TAB_ONETIME && (
        <div className="clients-page__onetime-section">
          <p className="clients-page__onetime-desc">
            Разовые доплаты к абонементам по месяцам. Введите сумму и нажмите «Добавить доплату», чтобы зафиксировать доплату за выбранный период.
          </p>
          <FilterBar className="clients-page__onetime-toolbar">
            <div className="clients-page__onetime-search-wrap">
              <input
                type="text"
                placeholder="Поиск по имени"
                value={oneTimeSearch}
                onChange={(e) => setOneTimeSearch(e.target.value)}
                className="clients-page__onetime-search"
              />
            </div>
            <span className="clients-page__onetime-filter-label">Период:</span>
            <Select
              value={oneTimeYear}
              onChange={setOneTimeYear}
              options={[{ value: '', label: 'Год — все' }, { value: '2025', label: '2025' }, ...STATS_YEARS.map((y) => ({ value: y, label: y }))]}
              placeholder="Год"
              className="clients-page__onetime-select"
            />
            <Select
              value={oneTimeMonth}
              onChange={setOneTimeMonth}
              options={[
                { value: '', label: 'Месяц — все' },
                ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: MONTHS[i + 1] })),
              ]}
              placeholder="Месяц"
              className="clients-page__onetime-select"
            />
            {(oneTimeYear || oneTimeMonth) && (
              <button type="button" className="clients-page__date-clear" onClick={() => { setOneTimeYear(''); setOneTimeMonth(''); setOneTimePage(1); }} title="Сбросить дату">✕</button>
            )}
          </FilterBar>

          {oneTimeLoading ? (
            <div className="clients-page__dup-loading"><span className="loading-inline"><span className="loading-inline__spinner" aria-hidden />Загрузка…</span></div>
          ) : (
            <>
              <div className="clients-page__onetime-block">
                <table className="clients-page__onetime-table">
                  <thead>
                    <tr><th>Имя</th><th>Месяц</th><th>Год</th><th>Текущая сумма</th><th>Доплата</th></tr>
                  </thead>
                  <tbody>
                    {!(oneTimeData?.items ?? oneTimeData?.results ?? []).length ? (
                      <tr>
                        <td colSpan={5} className="clients-page__stats-empty">
                          <EmptyState
                            compact
                            tableCell
                            message={
                              <>
                                Нет данных
                                {(oneTimeYear || oneTimeMonth) && (
                                  <span className="clients-page__onetime-empty-hint"> · Попробуйте сбросить год/месяц</span>
                                )}
                              </>
                            }
                          />
                        </td>
                      </tr>
                    ) : (
                      (oneTimeData.items ?? oneTimeData.results ?? []).map((c) => {
                        const ds = c.dateStart ?? c.date_start;
                        const d = ds ? new Date(ds) : null;
                        const yearStr = d && !isNaN(d.getTime()) ? String(d.getFullYear()) : '—';
                        const monthName = d && !isNaN(d.getTime()) ? MONTHS[d.getMonth() + 1] : '—';
                        const priceDisplay = c.priceDisplay ?? c.totalPrice ?? c.price_display ?? c.total_price;
                        const priceBase = Number(c.price) || 0;
                        const discountPct = Number(c.discount ?? c.discount_percent) || 0;
                        const oneTimeTotal = Number(c.oneTimeTotal ?? c.one_time_total) || 0;
                        const totalAmount = priceDisplay != null ? Number(priceDisplay) : (discountPct > 0 ? priceBase * (1 - discountPct / 100) : priceBase) + oneTimeTotal;
                        const amountStr = formatMoney(totalAmount);
                        const isLoading = oneTimeAddLoading[c.id];
                        const inputVal = oneTimeAddInputs[c.id] ?? '';
                        return (
                          <tr key={c.id}>
                            <td>{c.fio || '—'}</td>
                            <td>{monthName}</td>
                            <td>{yearStr}</td>
                            <td>{amountStr}</td>
                            <td>
                              <div className="clients-page__onetime-actions">
                                <label className="clients-page__onetime-add-label">
                                  <span className="clients-page__onetime-add-label-text">Сумма, сом</span>
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="0"
                                    value={inputVal}
                                    onChange={(e) => setOneTimeAddInputs((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                    className="clients-page__onetime-input"
                                    disabled={isLoading}
                                  />
                                </label>
                                <button
                                  type="button"
                                  className="clients-page__onetime-add-btn"
                                  onClick={() => {
                                    const val = oneTimeAddInputs[c.id];
                                    const amount = Number(val);
                                    if (!val || Number.isNaN(amount) || amount <= 0) {
                                      toast.error('Введите корректную сумму');
                                      return;
                                    }
                                    setConfirmAddOneTime({ client: c, amount });
                                  }}
                                  disabled={isLoading}
                                >
                                  {isLoading ? '…' : 'Добавить доплату'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="clients-page__onetime-pagination">
                <Pagination meta={oneTimeData?.meta} currentPage={oneTimePage} onPage={(p) => setOneTimePage(p)} loading={oneTimeLoading} entityLabel="записей" />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Модалки ── */}
      {formClient && (
        <ClientFormModal client={formClient} sports={sports} fetchTrainers={fetchTrainers} currentUserFio={user?.fio || user?.login || ''} onSave={handleSaveClient} onClose={() => { setFormClient(null); setClientFormError(null); }} error={clientFormError} saving={clientFormSaving} />
      )}
      {cardClient && (
        <ClientCardModal
          client={cardClient}
          onEdit={(c) => (isAdmin ? setFormClient(c) : showAccessDenied())}
          onDelete={(c) => (isAdmin ? setConfirmDelete(c) : showAccessDenied())}
          onRefresh={() => fetchClient(cardClient.id, null).then((res) => setCardClient(res?.data ?? res)).catch(() => {})}
          onClose={() => setCardClient(null)}
        />
      )}
      {extendClientObj && (
        <ExtendModal client={extendClientObj} onSave={handleSaveExtend} onClose={() => { setExtendClientObj(null); setExtendFormError(null); }} error={extendFormError} saving={extendFormSaving} />
      )}
      {confirmDelete && (
        <ConfirmModal title="Удалить клиента?" message={confirmDelete.fio} confirmText="Удалить" onConfirm={handleDeleteClient} onCancel={() => setConfirmDelete(null)} danger />
      )}
      {confirmAddOneTime && (
        <ConfirmModal
          title="Добавить доплату?"
          message={`Добавить доплату ${confirmAddOneTime.amount.toLocaleString('ru-RU')} сом для ${confirmAddOneTime.client?.fio || '—'}?`}
          confirmText="Добавить"
          onConfirm={() => handleAddOneTimeAmount(confirmAddOneTime.client, confirmAddOneTime.amount)}
          onCancel={() => setConfirmAddOneTime(null)}
        />
      )}
      {trainerDetails && (
        <TrainerDetailsModal
          trainerId={trainerDetails.trainerId}
          trainerName={trainerDetails.trainerName}
          year={statsYear}
          month={statsMonth}
          onDetails={(c) => { setTrainerDetails(null); handleOpenCard(c); }}
          onClose={() => setTrainerDetails(null)}
        />
      )}
    </div>
  );
};

export default ClientsPage;

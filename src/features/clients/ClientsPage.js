import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { fetchClients, fetchClient, createClient, updateClient, deleteClient, extendClient, fetchAllClientsPaginated, createOneTimePayment, uploadClientPhotos, fetchClientDrafts, createClientDraft, updateClientDraft, deleteClientDraft } from './api';
import { fetchSports } from '../sports-trainers/api';
import { fetchTrainers } from '../sports-trainers/api';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { useDebounce } from '../../shared/hooks/useDebounce';
import { useAbortSafeFetch } from '../../shared/hooks/useAbortSafeFetch';
import { SEARCH_DEBOUNCE_MS, formatMoney, MONTHS, STATS_YEARS } from '../../shared/constants/common';
import { isPeriodClosedError, getApiErrorMessage } from '../../shared/lib/apiError';
import { filterClientsByPeriod, getExactDuplicates, getSimilarGroups } from '../../shared/lib/duplicates';
import { prepareClientSavePayload } from './lib/prepareClientSavePayload';
import { getClientCorrectionReasons, clientNeedsCorrection } from './lib/needsCorrection';
import { UsersRound, Copy, Ticket, Wrench, Search, Dumbbell, UserCheck, CreditCard, Tag, Calendar, CalendarDays, CalendarClock, Plus, ScanSearch, SpellCheck2, ChevronDown, Filter, Bookmark } from 'lucide-react';
import { Select, ConfirmModal, Pagination, FiltersModal, FilterBar, EmptyState, Spinner } from '../../shared/ui';
import { ClientsList, ClientCardModal, ClientFormModal, ClientDraftsModal, ExtendModal, DuplicateGroup } from './components';
import './ClientsPage.scss';

const getInitials = (fio) =>
  (fio || '').split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

const TAB_LIST = 'list';
const TAB_DUPS = 'dups';
const TAB_ONETIME = 'onetime';
const TAB_FIX = 'fix';

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

  // ── Дубликаты: фильтр по году/месяцу (доступные года — STATS_YEARS) ──
  const [dupYear, setDupYear] = useState(() => {
    const y = String(new Date().getFullYear());
    return STATS_YEARS.includes(y) ? y : STATS_YEARS[STATS_YEARS.length - 1];
  });
  const [dupMonth, setDupMonth] = useState(String(new Date().getMonth() + 1));

  // ── Исправление: клиенты с неполными данными — фильтр год/месяц/день ──
  const [fixYear, setFixYear] = useState(String(new Date().getFullYear()));
  const [fixMonth, setFixMonth] = useState('');
  const [fixDay, setFixDay] = useState('');

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
  const { run: runMain } = useAbortSafeFetch();

  // ── Все клиенты для дубликатов ──
  const [allClients, setAllClients] = useState([]);
  const [allLoading, setAllLoading] = useState(false);
  const allControllerRef = useRef(null);

  // ── Разовые оплаты ──
  const [oneTimeSearch, setOneTimeSearch] = useState('');
  const oneTimeDebounced = useDebounce(oneTimeSearch, SEARCH_DEBOUNCE_MS);
  const [oneTimeYear, setOneTimeYear] = useState(() => {
    const y = String(new Date().getFullYear());
    return STATS_YEARS.includes(y) ? y : '';
  });
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

  // ── Черновики карточки клиента (хранятся на сервере) ──
  const [drafts, setDrafts] = useState([]);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [deletingDraftId, setDeletingDraftId] = useState(null);
  // Черновик, который сейчас открыт в форме: при успешном сохранении клиента удаляем его,
  // при повторном «Отложить» — обновляем на месте, а не плодим копии.
  const [activeDraft, setActiveDraft] = useState(null);
  const [extendFormError, setExtendFormError] = useState(null);
  const [extendFormSaving, setExtendFormSaving] = useState(false);
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [filtersDropOpen, setFiltersDropOpen] = useState(false);
  const filtersDropRef = useRef(null);

  // Закрываем дропдаун при клике вне
  useEffect(() => {
    if (!filtersDropOpen) return;
    const handler = (e) => {
      if (filtersDropRef.current && !filtersDropRef.current.contains(e.target)) {
        setFiltersDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filtersDropOpen]);

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
    if (activeTab === TAB_LIST) {
      fetchSafe();
    }
  }, [activeTab, fetchSafe]);

  useEffect(() => {
    if (activeTab === TAB_DUPS || activeTab === TAB_FIX) {
      fetchAllClients();
      return () => allControllerRef.current?.abort();
    }
  }, [activeTab, fetchAllClients]);

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
      /** Договорная price на бэке — до скидки; как при доплате из формы редактирования. Иначе колонка «Текущая сумма» (priceDisplay) не растёт. */
      const contractBase = Number(client.price) || 0;
      const newContractPrice = Math.max(0, Math.round(contractBase + amount));
      let pricePatchOk = true;
      try {
        await updateClient(client.id, { price: newContractPrice }, null);
      } catch (patchErr) {
        pricePatchOk = false;
        const pmsg = isPeriodClosedError(patchErr)
          ? 'Период закрыт — обновите цену договора вручную в карточке клиента.'
          : (patchErr.response?.data?.error?.message ?? patchErr.response?.data?.message ?? patchErr.message ?? 'Не удалось обновить цену');
        toast.error(`Доплата записана, но сумма договора на сервере не изменилась: ${pmsg}`);
      }
      fetchOneTime();
      if (pricePatchOk) {
        toast.success(`Добавлено ${formatMoney(amount)}`);
      }
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

  // Дубликаты только среди клиентов выбранного месяца (по dateStart)
  const dupFilteredClients = useMemo(
    () => filterClientsByPeriod(allClients, dupYear, dupMonth || null),
    [allClients, dupYear, dupMonth]
  );
  const exactGroups  = useMemo(() => getExactDuplicates(dupFilteredClients), [dupFilteredClients]);
  const similarGroups = useMemo(() => getSimilarGroups(dupFilteredClients), [dupFilteredClients]);

  // Клиенты с неполными данными (за выбранный период)
  const fixPeriodClients = useMemo(
    () => filterClientsByPeriod(allClients, fixYear, fixMonth || null, fixDay || null),
    [allClients, fixYear, fixMonth, fixDay]
  );
  const fixClients = useMemo(
    () => fixPeriodClients.filter(clientNeedsCorrection),
    [fixPeriodClients]
  );


  // ── Черновики ───────────────────────────────────────────────────────────────

  const loadDrafts = useCallback(async () => {
    try {
      setDrafts(await fetchClientDrafts(null));
    } catch {
      // Черновики — вспомогательная функция: молча пропускаем сбой, чтобы не мешать
      // работе со списком клиентов (ошибку покажем, только если пользователь сам их откроет).
      setDrafts([]);
    }
  }, []);

  useEffect(() => { if (isAdmin) loadDrafts(); }, [isAdmin, loadDrafts]);

  /** «Отложить» из формы: новый черновик или обновление уже открытого. */
  const handleSaveDraft = async (snapshot) => {
    setSavingDraft(true);
    try {
      const body = { title: (snapshot.fio || '').trim(), payload: snapshot };
      if (activeDraft?.id) await updateClientDraft(activeDraft.id, body, null);
      else await createClientDraft(body, null);
      await loadDrafts();
      setFormClient(null);
      setActiveDraft(null);
      setClientFormError(null);
      toast.success('Черновик отложен — вернуться к нему можно кнопкой «Черновики»');
    } catch (e) {
      toast.error(getApiErrorMessage(e) || 'Не удалось отложить черновик');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleOpenDraft = (draft) => {
    setDraftsOpen(false);
    setActiveDraft(draft);
    setClientFormError(null);
    setFormClient({});
  };

  const handleDeleteDraft = async (draft) => {
    setDeletingDraftId(draft.id);
    try {
      await deleteClientDraft(draft.id, null);
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      if (activeDraft?.id === draft.id) setActiveDraft(null);
      toast.success('Черновик удалён');
    } catch (e) {
      toast.error(getApiErrorMessage(e) || 'Не удалось удалить черновик');
    } finally {
      setDeletingDraftId(null);
    }
  };

  const handleSaveClient = async (payload) => {
    setClientFormError(null);
    setClientFormSaving(true);
    try {
      const { body, photoUploads } = prepareClientSavePayload(payload);
      let targetId = formClient?.id;
      if (targetId) await updateClient(formClient.id, body, null);
      else {
        const created = await createClient(body, null);
        targetId = created?.id ?? created?.data?.id;
      }
      if (photoUploads.length > 0 && targetId != null) {
        try {
          await uploadClientPhotos(targetId, photoUploads, null);
        } catch (photoErr) {
          const pmsg =
            photoErr?.response?.data?.error?.message ??
            photoErr?.response?.data?.message ??
            photoErr?.message ??
            'ошибка загрузки';
          toast.error(`Клиент сохранён, но фото не загрузились: ${pmsg}`);
        }
      }
      // Черновик доведён до реального клиента — убираем его, чтобы не дублировался в списке
      if (activeDraft?.id) {
        try {
          await deleteClientDraft(activeDraft.id, null);
          setDrafts((prev) => prev.filter((d) => d.id !== activeDraft.id));
        } catch { /* черновик останется — не повод показывать ошибку поверх успеха */ }
        setActiveDraft(null);
      }
      setFormClient(null);
      fetchSafe();
      toast.success(formClient?.id ? 'Клиент сохранён' : 'Клиент добавлен');
    } catch (e) {
      const d = e.response?.data;
      const msg = isPeriodClosedError(e)
        ? 'Период закрыт. Изменение финансовых данных запрещено.'
        : (d?.error?.message ?? d?.message ?? d?.detail ?? 'Ошибка сохранения');
      // Ошибка уже показывается внутри модалки (ClientFormModal сам красиво парсит список полей) — дублирующий toast не нужен
      setClientFormError(msg);
    } finally {
      setClientFormSaving(false);
    }
  };

  const handleDeleteClient = () => {
    if (!confirmDelete) return;
    deleteClient(confirmDelete.id, null)
      .then(() => {
        setConfirmDelete(null);
        fetchSafe();
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
      fetchSafe();
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
      

      {/* Главные табы */}
      <div className="ui-tabs">
        <button type="button" className={`ui-tabs__tab${activeTab === TAB_LIST ? ' ui-tabs__tab--active' : ''}`} onClick={() => setActiveTab(TAB_LIST)}><UsersRound size={15} /> Клиенты</button>
        <button type="button" className={`ui-tabs__tab${activeTab === TAB_DUPS ? ' ui-tabs__tab--active' : ''}`} onClick={() => setActiveTab(TAB_DUPS)}><Copy size={15} /> Дубликаты</button>
        <button type="button" className={`ui-tabs__tab${activeTab === TAB_ONETIME ? ' ui-tabs__tab--active' : ''}`} onClick={() => setActiveTab(TAB_ONETIME)}><Ticket size={15} /> Разовый</button>
        <button type="button" className={`ui-tabs__tab${activeTab === TAB_FIX ? ' ui-tabs__tab--active' : ''}`} onClick={() => setActiveTab(TAB_FIX)}>
          <Wrench size={15} /> Исправление
          {fixClients.length > 0 && <span className="ui-tabs__badge">{fixClients.length}</span>}
        </button>
      </div>

      {/* ── Список клиентов ── */}
      {activeTab === TAB_LIST && (
        <>
          <FilterBar className="clients-page__filter-bar">
            <div className="clients-page__filters clients-page__filters--desktop">
              <div className="clients-page__filters-row clients-page__filters-row--main">
                <div className="ui-search clients-page__search">
                  <Search size={15} className="ui-search__icon" />
                  <input type="text" placeholder="Поиск" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="ui-search__input" />
                </div>

                {/* Кнопка Фильтры с дропдауном */}
                <div className="clients-page__filter-drop-wrap" ref={filtersDropRef}>
                  <button
                    type="button"
                    className={`clients-page__filter-drop-btn${filtersDropOpen ? ' clients-page__filter-drop-btn--open' : ''}`}
                    onClick={() => setFiltersDropOpen((v) => !v)}
                  >
                    <Filter size={14} />
                    Фильтры
                    {[queryState.sportId, queryState.trainerId, queryState.paid, queryState.clientType, queryState.year, queryState.month, queryState.day].filter(Boolean).length > 0 && (
                      <span className="clients-page__filter-drop-count">
                        {[queryState.sportId, queryState.trainerId, queryState.paid, queryState.clientType, queryState.year, queryState.month, queryState.day].filter(Boolean).length}
                      </span>
                    )}
                    <span className={`clients-page__filter-drop-arrow${filtersDropOpen ? ' clients-page__filter-drop-arrow--open' : ''}`}><ChevronDown size={14} /></span>
                  </button>

                  {filtersDropOpen && (
                    <>
                    <div className="clients-page__filter-drop-backdrop" onClick={() => setFiltersDropOpen(false)} />
                    <div className="clients-page__filter-drop-panel">
                      <div className="clients-page__filter-drop-grid">
                        <label className="clients-page__filter-drop-label">
                          <span><Dumbbell size={13} /> Вид спорта</span>
                          <Select value={queryState.sportId} onChange={(v) => setQueryState((q) => ({ ...q, sportId: v, page: 1 }))} options={[{ value: '', label: 'Все' }, ...sports.map((s) => ({ value: String(s.id), label: s.name || '' }))]} placeholder="Все" className="clients-page__select-wrap" icon={<Dumbbell size={15} />} />
                        </label>
                        <label className="clients-page__filter-drop-label">
                          <span><UserCheck size={13} /> Тренер</span>
                          <Select value={queryState.trainerId} onChange={(v) => setQueryState((q) => ({ ...q, trainerId: v, page: 1 }))} options={[{ value: '', label: 'Все' }, ...trainers.map((t) => ({ value: String(t.id), label: t.fio || '' }))]} placeholder="Все" className="clients-page__select-wrap" icon={<UserCheck size={15} />} />
                        </label>
                        <label className="clients-page__filter-drop-label">
                          <span><CreditCard size={13} /> Оплата</span>
                          <Select value={queryState.paid} onChange={(v) => setQueryState((q) => ({ ...q, paid: v, page: 1 }))} options={[{ value: '', label: 'Все' }, { value: 'true', label: 'Оплачено' }, { value: 'false', label: 'Не оплачено' }]} placeholder="Все" className="clients-page__select-wrap" icon={<CreditCard size={15} />} />
                        </label>
                        <label className="clients-page__filter-drop-label">
                          <span><Tag size={13} /> Тип</span>
                          <Select value={queryState.clientType} onChange={(v) => setQueryState((q) => ({ ...q, clientType: v, page: 1 }))} options={[{ value: '', label: 'Все' }, { value: 'regular', label: 'Регулярный' }, { value: 'individual', label: 'Индивидуальный' }, { value: 'one-time', label: 'Разовый' }]} placeholder="Все" className="clients-page__select-wrap" icon={<Tag size={15} />} />
                        </label>
                        <label className="clients-page__filter-drop-label">
                          <span><Calendar size={13} /> Год</span>
                          <Select value={queryState.year} onChange={(v) => setQueryState((q) => ({ ...q, year: v, month: v ? q.month : '', day: v ? q.day : '', page: 1 }))} options={[{ value: '', label: 'Все' }, ...clientListFilterYearValues.map((y) => ({ value: y, label: y }))]} placeholder="Все" className="clients-page__select-wrap" icon={<Calendar size={15} />} />
                        </label>
                        <label className="clients-page__filter-drop-label">
                          <span><CalendarDays size={13} /> Месяц</span>
                          <Select value={queryState.month} onChange={(v) => setQueryState((q) => ({ ...q, month: v, day: v ? q.day : '', page: 1 }))} disabled={!queryState.year} options={[{ value: '', label: 'Все' }, { value: '1', label: 'Январь' }, { value: '2', label: 'Февраль' }, { value: '3', label: 'Март' }, { value: '4', label: 'Апрель' }, { value: '5', label: 'Май' }, { value: '6', label: 'Июнь' }, { value: '7', label: 'Июль' }, { value: '8', label: 'Август' }, { value: '9', label: 'Сентябрь' }, { value: '10', label: 'Октябрь' }, { value: '11', label: 'Ноябрь' }, { value: '12', label: 'Декабрь' }]} placeholder="Все" className="clients-page__select-wrap" icon={<CalendarDays size={15} />} />
                        </label>
                        <label className="clients-page__filter-drop-label">
                          <span><CalendarClock size={13} /> День</span>
                          <Select value={queryState.day} onChange={(v) => setQueryState((q) => ({ ...q, day: v, page: 1 }))} disabled={!queryState.month} options={[{ value: '', label: 'Все' }, ...Array.from({ length: 31 }, (_, i) => i + 1).map((d) => ({ value: String(d), label: String(d) }))]} placeholder="Все" className="clients-page__select-wrap" icon={<CalendarClock size={15} />} />
                        </label>
                      </div>
                      <div className="clients-page__filter-drop-footer">
                        <button type="button" className="clients-page__filter-drop-reset" onClick={() => resetListFilters()}>Сбросить всё</button>
                      </div>
                    </div>
                    </>
                  )}
                </div>

                {/* Кнопку показываем только когда черновики есть — пустая кнопка
                    в панели действий была бы просто шумом. */}
                {drafts.length > 0 && (
                  <button
                    type="button"
                    className="clients-page__drafts-btn"
                    onClick={() => setDraftsOpen(true)}
                    title="Отложенные карточки клиентов"
                  >
                    <Bookmark size={15} /> Черновики
                    <span className="clients-page__drafts-count">{drafts.length}</span>
                  </button>
                )}
                <button type="button" className="clients-page__add clients-page__add--desktop filter-bar__action" onClick={() => { setActiveDraft(null); setFormClient({}); }}><Plus size={16} /> Добавить клиента</button>
              </div>
            </div>
            <div className="clients-page__toolbar-mobile clients-page__toolbar-mobile--filter-bar">
              <div className="ui-search clients-page__search clients-page__search--mobile">
                <Search size={15} className="ui-search__icon" />
                <input type="text" placeholder="Поиск" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="ui-search__input" />
              </div>
              <div className="clients-page__toolbar-mobile-actions">
                <button type="button" className="clients-page__filters-btn" onClick={() => setFiltersModalOpen(true)}>Фильтры</button>
                {drafts.length > 0 && (
                  <button type="button" className="clients-page__drafts-btn" onClick={() => setDraftsOpen(true)} aria-label="Черновики">
                    <Bookmark size={15} />
                    <span className="clients-page__drafts-count">{drafts.length}</span>
                  </button>
                )}
                <button type="button" className="clients-page__add filter-bar__action" onClick={() => { setActiveDraft(null); setFormClient({}); }}><Plus size={16} /> Добавить</button>
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
              <label className="clients-page__filter-label"><span><Dumbbell size={13} /> Вид спорта</span><Select value={queryState.sportId} onChange={(v) => setQueryState((q) => ({ ...q, sportId: v, page: 1 }))} options={[{ value: '', label: 'Все' }, ...sports.map((s) => ({ value: String(s.id), label: s.name || '' }))]} placeholder="Все" className="clients-page__select-wrap" icon={<Dumbbell size={15} />} /></label>
              <label className="clients-page__filter-label"><span><UserCheck size={13} /> Тренер</span><Select value={queryState.trainerId} onChange={(v) => setQueryState((q) => ({ ...q, trainerId: v, page: 1 }))} options={[{ value: '', label: 'Все' }, ...trainers.map((t) => ({ value: String(t.id), label: t.fio || '' }))]} placeholder="Все" className="clients-page__select-wrap" icon={<UserCheck size={15} />} /></label>
              <label className="clients-page__filter-label"><span><CreditCard size={13} /> Оплата</span><Select value={queryState.paid} onChange={(v) => setQueryState((q) => ({ ...q, paid: v, page: 1 }))} options={[{ value: '', label: 'Все' }, { value: 'true', label: 'Оплачено' }, { value: 'false', label: 'Не оплачено' }]} placeholder="Все" className="clients-page__select-wrap" icon={<CreditCard size={15} />} /></label>
              <label className="clients-page__filter-label"><span><Tag size={13} /> Тип</span><Select value={queryState.clientType} onChange={(v) => setQueryState((q) => ({ ...q, clientType: v, page: 1 }))} options={[{ value: '', label: 'Все' }, { value: 'regular', label: 'Регулярный' }, { value: 'individual', label: 'Индивидуальный' }, { value: 'one-time', label: 'Разовый' }]} placeholder="Все" className="clients-page__select-wrap" icon={<Tag size={15} />} /></label>
              <label className="clients-page__filter-label"><span><Calendar size={13} /> Год</span><Select value={queryState.year} onChange={(v) => setQueryState((q) => ({ ...q, year: v, month: v ? q.month : '', day: v ? q.day : '', page: 1 }))} options={[{ value: '', label: 'Все' }, ...clientListFilterYearValues.map((y) => ({ value: y, label: y }))]} placeholder="Все" className="clients-page__select-wrap" icon={<Calendar size={15} />} /></label>
              {queryState.year && <label className="clients-page__filter-label"><span><CalendarDays size={13} /> Месяц</span><Select value={queryState.month} onChange={(v) => setQueryState((q) => ({ ...q, month: v, day: v ? q.day : '', page: 1 }))} options={[{ value: '', label: 'Все' }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: MONTHS[i + 1] }))]} placeholder="Все" className="clients-page__select-wrap" icon={<CalendarDays size={15} />} /></label>}
              {queryState.year && queryState.month && <label className="clients-page__filter-label"><span><CalendarClock size={13} /> День</span><Select value={queryState.day} onChange={(v) => setQueryState((q) => ({ ...q, day: v, page: 1 }))} options={[{ value: '', label: 'Все' }, ...Array.from({ length: 31 }, (_, i) => i + 1).map((d) => ({ value: String(d), label: String(d) }))]} placeholder="Все" className="clients-page__select-wrap" icon={<CalendarClock size={15} />} /></label>}
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
              icon={<Calendar size={15} />}
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
              icon={<CalendarDays size={15} />}
            />
          </FilterBar>
          {/* Подтабы */}
          <div className="clients-page__subtabs">
            <button type="button" className={`clients-page__subtab${activeDupTab === SUBTAB_EXACT ? ' clients-page__subtab--active' : ''}`} onClick={() => setActiveDupTab(SUBTAB_EXACT)}><ScanSearch size={14} /> Точные дубликаты</button>
            <button type="button" className={`clients-page__subtab${activeDupTab === SUBTAB_SIMILAR ? ' clients-page__subtab--active' : ''}`} onClick={() => setActiveDupTab(SUBTAB_SIMILAR)}><SpellCheck2 size={14} /> Похожие имена</button>
          </div>

          {allLoading ? (
            <div className="clients-page__dup-loading"><Spinner label="Загрузка клиентов…" /></div>
          ) : !dupYear ? (
            <div className="clients-page__dup-empty">Выберите год и месяц для просмотра дубликатов</div>
          ) : activeDupTab === SUBTAB_EXACT ? (
            exactGroups.length === 0 ? (
              <div className="clients-page__dup-empty">
                <EmptyState compact message="Точных дубликатов не найдено" />
              </div>
            ) : (
              <>
                <div className="clients-page__dup-stats">
                  <span><strong>{dupYear}</strong>{dupMonth ? ` · ${MONTHS[Number(dupMonth)]}` : ''}</span>
                  <span className="clients-page__dup-stats-sep">·</span>
                  <span>Групп с одинаковым ФИО: <strong>{exactGroups.length}</strong></span>
                </div>
                {exactGroups.map((group, i) => <DuplicateGroup key={i} index={i} group={group} label={group[0].fio} onDetails={handleOpenCard} />)}
              </>
            )
          ) : (
            similarGroups.length === 0 ? (
              <div className="clients-page__dup-empty">
                <EmptyState compact message="Похожих имён не найдено" />
              </div>
            ) : (
              <>
                <div className="clients-page__dup-stats">
                  <span><strong>{dupYear}</strong>{dupMonth ? ` · ${MONTHS[Number(dupMonth)]}` : ''}</span>
                  <span className="clients-page__dup-stats-sep">·</span>
                  <span>Групп с похожими именами: <strong>{similarGroups.length}</strong></span>
                </div>
                {similarGroups.map((group, i) => <DuplicateGroup key={i} index={i} group={group} label={`${group[0].fio} / ${group[1].fio}${group.length > 2 ? ` +${group.length - 2}` : ''}`} onDetails={handleOpenCard} />)}
              </>
            )
          )}
        </div>
      )}

      {/* ── Разовый ── */}
      {activeTab === TAB_ONETIME && (
        <div className="clients-page__onetime-section">
          <FilterBar className="clients-page__onetime-toolbar clients-page__dup-toolbar">
            <div className="ui-search clients-page__onetime-search">
              <Search size={15} className="ui-search__icon" />
              <input
                type="text"
                placeholder="Поиск по имени"
                value={oneTimeSearch}
                onChange={(e) => setOneTimeSearch(e.target.value)}
                className="ui-search__input"
              />
            </div>
            <Select
              value={oneTimeYear}
              onChange={setOneTimeYear}
              options={[{ value: '', label: 'Год — все' }, ...STATS_YEARS.map((y) => ({ value: y, label: y }))]}
              placeholder="Год"
              className="clients-page__onetime-select"
              icon={<Calendar size={15} />}
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
              icon={<CalendarDays size={15} />}
            />
            {(oneTimeYear || oneTimeMonth) && (
              <button type="button" className="clients-page__date-clear" onClick={() => { setOneTimeYear(''); setOneTimeMonth(''); setOneTimePage(1); }} title="Сбросить фильтры">✕</button>
            )}
          </FilterBar>

          {oneTimeLoading ? (
            <div className="clients-page__dup-loading"><Spinner /></div>
          ) : (
            <>
              <div className="ui-list__table-wrap clients-page__onetime-block">
                <table className="ui-list__table clients-page__onetime-table">
                  <thead>
                    <tr>
                      <th>Имя</th>
                      <th>Период</th>
                      <th>Текущая сумма</th>
                      <th>Добавить доплату</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!(oneTimeData?.items ?? oneTimeData?.results ?? []).length ? (
                      <tr>
                        <td colSpan={4} className="ui-list__empty-cell clients-page__stats-empty">
                          <EmptyState
                            compact
                            tableCell
                            message={
                              <>
                                Нет данных
                                {(oneTimeYear || oneTimeMonth) && (
                                  <span className="clients-page__onetime-empty-hint"> · Попробуйте сбросить фильтры</span>
                                )}
                              </>
                            }
                          />
                        </td>
                      </tr>
                    ) : (
                      (oneTimeData.items ?? oneTimeData.results ?? []).map((c, idx) => {
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
                          <tr key={c.id} style={{ '--row-i': idx }}>
                            <td className="clients-page__onetime-name">
                              <div className="ui-list__name-cell">
                                <span className="ui-avatar">{getInitials(c.fio)}</span>
                                <span className="ui-list__title">{c.fio || '—'}</span>
                              </div>
                            </td>
                            <td className="clients-page__onetime-period">
                              <span className="clients-page__onetime-month">{monthName}</span>
                              <span className="clients-page__onetime-year">{yearStr}</span>
                            </td>
                            <td className="clients-page__onetime-amount">{amountStr}</td>
                            <td>
                              <div className={`clients-page__onetime-combo${isLoading ? ' clients-page__onetime-combo--loading' : ''}`}>
                                <div className="clients-page__onetime-field">
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="Сумма"
                                    value={inputVal}
                                    onChange={(e) => setOneTimeAddInputs((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                    className="clients-page__onetime-input"
                                    disabled={isLoading}
                                  />
                                  <span className="clients-page__onetime-input-unit">сом</span>
                                </div>
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
                                  {isLoading ? <span className="clients-page__onetime-spin" /> : <Plus size={14} />}
                                  <span className="clients-page__onetime-add-btn-label">Доплата</span>
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

      {/* ── Исправление ── */}
      {activeTab === TAB_FIX && (
        <div className="clients-page__fix-section">
          <FilterBar className="clients-page__dup-toolbar">
            <Select
              value={fixYear}
              onChange={(v) => { setFixYear(v); setFixMonth(''); setFixDay(''); }}
              options={[{ value: '', label: 'Год — все' }, ...clientListFilterYearValues.map((y) => ({ value: y, label: y }))]}
              placeholder="Год"
              className="clients-page__dup-select"
              icon={<Calendar size={15} />}
            />
            <Select
              value={fixMonth}
              onChange={(v) => { setFixMonth(v); setFixDay(''); }}
              disabled={!fixYear}
              options={[
                { value: '', label: 'Месяц — все' },
                ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: MONTHS[i + 1] })),
              ]}
              placeholder="Месяц"
              className="clients-page__dup-select"
              icon={<CalendarDays size={15} />}
            />
            <Select
              value={fixDay}
              onChange={setFixDay}
              disabled={!fixMonth}
              options={[{ value: '', label: 'День — все' }, ...Array.from({ length: 31 }, (_, i) => i + 1).map((d) => ({ value: String(d), label: String(d) }))]}
              placeholder="День"
              className="clients-page__dup-select"
              icon={<CalendarClock size={15} />}
            />
          </FilterBar>

          {allLoading ? (
            <div className="clients-page__dup-loading"><Spinner label="Загрузка клиентов…" /></div>
          ) : fixClients.length === 0 ? (
            <div className="clients-page__dup-empty">
              <EmptyState compact message="Клиентов с неполными данными за этот период не найдено" />
            </div>
          ) : (
            <>
              <div className="clients-page__dup-stats">
                <Wrench size={13} />
                <span><strong>{fixYear || 'Все годы'}</strong>{fixMonth ? ` · ${MONTHS[Number(fixMonth)]}` : ''}{fixDay ? ` · ${fixDay}` : ''}</span>
                <span className="clients-page__dup-stats-sep">·</span>
                <span>Требуют исправления: <strong>{fixClients.length}</strong></span>
              </div>
              <div className="ui-list__table-wrap clients-page__onetime-block">
                <table className="ui-list__table clients-page__fix-table">
                  <thead>
                    <tr>
                      <th>ФИО</th>
                      <th>Дата начала</th>
                      <th>Вид спорта</th>
                      <th>Оплата</th>
                      <th>Что не заполнено</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {fixClients.map((c, idx) => {
                      const dateStart = c.dateStart ?? c.date_start;
                      const sportName = c.sportName ?? c.sport?.name;
                      const paid = c.paid === true || c.paid === 'true';
                      const reasons = getClientCorrectionReasons(c);
                      return (
                        <tr key={c.id} style={{ '--row-i': idx }}>
                          <td className="clients-page__onetime-name">{c.fio || '—'}</td>
                          <td>{dateStart ? new Date(dateStart).toLocaleDateString('ru-RU') : '—'}</td>
                          <td>{sportName ?? '—'}</td>
                          <td>
                            <span className={`clients-page__fix-paid ${paid ? 'clients-page__fix-paid--yes' : 'clients-page__fix-paid--no'}`}>
                              {paid ? 'Оплачено' : 'Не оплачено'}
                            </span>
                          </td>
                          <td>
                            <ul className="clients-page__fix-reasons">
                              {reasons.map((r) => <li key={r}>{r}</li>)}
                            </ul>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="clients-page__fix-btn"
                              onClick={() => (isAdmin ? setFormClient(c) : showAccessDenied())}
                            >
                              <Wrench size={12} /> Исправить
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Модалки ── */}
      {formClient && (
        <ClientFormModal
          // В ключе и черновик: иначе при переходе от одного отложенного клиента
          // к другому форма осталась бы с данными предыдущего.
          key={formClient?.id != null ? String(formClient.id) : `new-client-${activeDraft?.id ?? 'blank'}`}
          client={formClient}
          draft={activeDraft?.payload ?? null}
          sports={sports}
          fetchTrainers={fetchTrainers}
          currentUserFio={user?.fio || user?.login || ''}
          onSave={handleSaveClient}
          onSaveDraft={handleSaveDraft}
          savingDraft={savingDraft}
          onClose={() => { setFormClient(null); setActiveDraft(null); setClientFormError(null); }}
          error={clientFormError}
          saving={clientFormSaving}
          fullscreen
        />
      )}
      {draftsOpen && (
        <ClientDraftsModal
          drafts={drafts}
          sports={sports}
          onOpen={handleOpenDraft}
          onDelete={handleDeleteDraft}
          deletingId={deletingDraftId}
          onClose={() => setDraftsOpen(false)}
        />
      )}
      {cardClient && (
        <ClientCardModal
          client={cardClient}
          onEdit={(c) => (isAdmin ? setFormClient(c) : showAccessDenied())}
          onDelete={(c) => (isAdmin ? setConfirmDelete(c) : showAccessDenied())}
          onClose={() => setCardClient(null)}
          onClientUpdated={(updated) => {
            setCardClient(updated);
            fetchSafe();
          }}
          canManageFreeze={isAdmin}
          onFreezeAccessDenied={showAccessDenied}
        />
      )}
      {extendClientObj && (
        <ExtendModal client={extendClientObj} onSave={handleSaveExtend} onClose={() => { setExtendClientObj(null); setExtendFormError(null); }} error={extendFormError} saving={extendFormSaving} fullscreen />
      )}
      {confirmDelete && (
        <ConfirmModal title="Удалить клиента?" message={confirmDelete.fio} confirmText="Удалить" onConfirm={handleDeleteClient} onCancel={() => setConfirmDelete(null)} danger />
      )}
      {confirmAddOneTime && (
        <ConfirmModal
          title="Добавить доплату?"
          message={`Добавить доплату ${formatMoney(confirmAddOneTime.amount)} для ${confirmAddOneTime.client?.fio || '—'}?`}
          confirmText="Добавить"
          onConfirm={() => handleAddOneTimeAmount(confirmAddOneTime.client, confirmAddOneTime.amount)}
          onCancel={() => setConfirmAddOneTime(null)}
        />
      )}
    </div>
  );
};

export default ClientsPage;

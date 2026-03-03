import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { fetchClients, fetchClient, createClient, updateClient, deleteClient, extendClient, fetchAllClientsPaginated } from './api';
import { fetchSports } from '../sports-trainers/api';
import { fetchTrainers } from '../sports-trainers/api';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { useDebounce } from '../../shared/hooks/useDebounce';
import { SEARCH_DEBOUNCE_MS, isClientPaid } from '../../shared/constants/common';
import { Select, ConfirmModal, Pagination } from '../../shared/ui';
import { ClientsList, ClientCardModal, ClientFormModal, ExtendModal } from './components';
import './ClientsPage.scss';

const TAB_LIST = 'list';
const TAB_DUPS = 'dups';
const TAB_STATS = 'stats';

const SUBTAB_EXACT   = 'exact';
const SUBTAB_SIMILAR = 'similar';

const MONTH_NAMES = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const STATS_YEARS = ['2026', '2027'];

// Фильтрация клиентов по году/месяцу (по dateStart)
const filterClientsByPeriod = (clients, year, month) => {
  if (!year) return clients;
  const y = Number(year);
  const m = month ? Number(month) : null;
  return clients.filter((c) => {
    const ds = c.dateStart ?? c.date_start;
    if (!ds) return false;
    const d = new Date(ds);
    if (isNaN(d.getTime())) return false;
    if (d.getFullYear() !== y) return false;
    if (m != null && d.getMonth() + 1 !== m) return false;
    return true;
  });
};

// Статистика по тренерам: { trainerId, trainerName, total, paid, unpaid }
const getStatsByTrainer = (clients) => {
  const map = {};
  clients.forEach((c) => {
    const id = c.trainerId ?? c.trainer_id ?? (c.trainer?.id != null ? c.trainer.id : null);
    const key = id ?? '__no_trainer__';
    const name = c.trainerName ?? c.trainer?.fio ?? (key === '__no_trainer__' ? 'Без тренера' : '—');
    if (!map[key]) map[key] = { trainerId: id, trainerName: name, total: 0, paid: 0, unpaid: 0 };
    map[key].total += 1;
    if (isClientPaid(c)) map[key].paid += 1;
    else map[key].unpaid += 1;
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
};

// Расстояние Левенштейна
const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const curr = [i + 1];
    for (let j = 0; j < b.length; j++) {
      curr[j + 1] = a[i] === b[j] ? prev[j] : 1 + Math.min(prev[j + 1], curr[j], prev[j]);
    }
    prev = curr;
  }
  return prev[b.length];
};

const normName = (fio) => (fio || '').trim().toLowerCase();

// Точные дубликаты — одинаковое ФИО
const getExactDuplicates = (clients) => {
  const map = {};
  clients.forEach((c) => {
    const key = normName(c.fio);
    if (!key) return;
    if (!map[key]) map[key] = [];
    map[key].push(c);
  });
  return Object.values(map).filter((g) => g.length > 1).sort((a, b) => b.length - a.length);
};

// Похожие имена — расстояние 1–2 символа, исключая точные совпадения
const getSimilarGroups = (clients) => {
  const items = clients.map((c, idx) => ({ ...c, _idx: idx, _norm: normName(c.fio) })).filter((c) => c._norm);
  const visited = new Set();
  const groups = [];

  for (let i = 0; i < items.length; i++) {
    if (visited.has(i)) continue;
    const a = items[i]._norm;
    const group = [items[i]];

    for (let j = i + 1; j < items.length; j++) {
      if (visited.has(j)) continue;
      const b = items[j]._norm;
      if (a === b) continue; // точный дубликат — не сюда
      const dist = levenshtein(a, b);
      if (dist >= 1 && dist <= 2) {
        group.push(items[j]);
        visited.add(j);
      }
    }

    if (group.length > 1) {
      visited.add(i);
      groups.push(group);
    }
  }

  return groups.sort((a, b) => b.length - a.length);
};

const ClientsPage = () => {
  const { isAdmin, showAccessDenied } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState(TAB_LIST);
  const [activeDupTab, setActiveDupTab] = useState(SUBTAB_EXACT);

  // ── Статистика ──
  const [statsYear, setStatsYear] = useState(new Date().getFullYear().toString());
  const [statsMonth, setStatsMonth] = useState(String(new Date().getMonth() + 1));

  // ── Основной список ──
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, SEARCH_DEBOUNCE_MS);
  const [queryState, setQueryState] = useState({ search: '', sportId: '', trainerId: '', paid: '', clientType: '', year: '', month: '', day: '', page: 1, perPage: 20 });
  const [data, setData] = useState(null);
  const [sports, setSports] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const controllerRef = useRef(null);
  const lastRequestId = useRef(0);

  // ── Все клиенты для дубликатов ──
  const [allClients, setAllClients] = useState([]);
  const [allLoading, setAllLoading] = useState(false);
  const allControllerRef = useRef(null);

  // ── Модалки ──
  const [formClient, setFormClient] = useState(null);
  const [cardClient, setCardClient] = useState(null);
  const [extendClientObj, setExtendClientObj] = useState(null);
  const [clientFormError, setClientFormError] = useState(null);
  const [clientFormSaving, setClientFormSaving] = useState(false);
  const [extendFormError, setExtendFormError] = useState(null);
  const [extendFormSaving, setExtendFormSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchSafe = useCallback(async () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const rid = ++lastRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const q = { ...queryState, search: debouncedSearch.trim() || undefined };
      const res = await fetchClients(q, controllerRef.current.signal);
      if (rid !== lastRequestId.current) return;
      setData(res);
    } catch (err) {
      if (rid !== lastRequestId.current || err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      if (rid === lastRequestId.current) setLoading(false);
    }
  }, [queryState, debouncedSearch]);

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
      return () => controllerRef.current?.abort();
    }
  }, [activeTab, fetchSafe]);

  useEffect(() => {
    if (activeTab === TAB_DUPS || activeTab === TAB_STATS) {
      fetchAllClients();
      return () => allControllerRef.current?.abort();
    }
  }, [activeTab, fetchAllClients]);

  useEffect(() => {
    fetchSports(null).then((d) => setSports(Array.isArray(d) ? d : d?.results ?? d?.items ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchTrainers({ perPage: 500 }, null).then((d) => setTrainers(Array.isArray(d) ? d : d?.results ?? d?.items ?? [])).catch(() => {});
  }, []);

  const items = data?.items ?? data?.results ?? (Array.isArray(data) ? data : []) ?? [];

  const exactGroups  = useMemo(() => getExactDuplicates(allClients), [allClients]);
  const similarGroups = useMemo(() => getSimilarGroups(allClients), [allClients]);

  const statsFilteredClients = useMemo(
    () => filterClientsByPeriod(allClients, statsYear, statsMonth || null),
    [allClients, statsYear, statsMonth]
  );
  const statsByTrainer = useMemo(() => getStatsByTrainer(statsFilteredClients), [statsFilteredClients]);

  const handleSaveClient = async (payload) => {
    setClientFormError(null);
    setClientFormSaving(true);
    try {
      if (formClient?.id) await updateClient(formClient.id, payload, null);
      else await createClient(payload, null);
      setFormClient(null);
      fetchSafe();
      toast.success(formClient?.id ? 'Клиент сохранён' : 'Клиент добавлен');
    } catch (e) {
      const d = e.response?.data;
      const msg = d?.error?.message ?? d?.message ?? d?.detail ?? 'Ошибка сохранения';
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
        fetchSafe();
        toast.success('Клиент удалён');
      })
      .catch((e) => {
        const msg = e.response?.data?.message ?? e.response?.data?.detail ?? e.message ?? 'Ошибка удаления';
        toast.error(msg);
      });
  };

  const handleOpenCard = (c) =>
    fetchClient(c.id, null)
      .then((res) => setCardClient(res?.data ?? res))
      .catch(console.error);

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
      const d = e.response?.data;
      const msg = d?.error?.message ?? d?.message ?? d?.detail ?? 'Ошибка';
      setExtendFormError(msg);
      toast.error(msg);
    } finally {
      setExtendFormSaving(false);
    }
  };

  const DuplicateGroup = ({ group, label }) => (
    <div className="dup-group">
      <div className="dup-group__header">
        <span className="dup-group__label">{label}</span>
        <span className="dup-group__count">{group.length} клиента</span>
      </div>
      <table className="dup-group__table">
        <thead>
          <tr><th>ФИО</th><th>Телефон</th><th>Вид спорта</th><th>Оплачено</th><th>Тип</th><th></th></tr>
        </thead>
        <tbody>
          {group.map((c) => (
            <tr key={c.id}>
              <td>{c.fio || '—'}</td>
              <td>{c.phone || '—'}</td>
              <td>{c.sportName ?? c.sport?.name ?? '—'}</td>
              <td>{isClientPaid(c) ? 'Да' : 'Нет'}</td>
              <td>{c.clientType === 'individual' ? 'Индивид.' : c.clientType === 'regular' ? 'Регуляр' : c.clientType || '—'}</td>
              <td>
                <button type="button" className="dup-group__btn" onClick={() => handleOpenCard(c)}>Подробнее</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="clients-page">
      <h1 className="clients-page__title">Клиенты</h1>

      {/* Главные табы */}
      <div className="clients-page__tabs">
        <button type="button" className={`clients-page__tab${activeTab === TAB_LIST ? ' clients-page__tab--active' : ''}`} onClick={() => setActiveTab(TAB_LIST)}>Клиенты</button>
        <button type="button" className={`clients-page__tab${activeTab === TAB_DUPS ? ' clients-page__tab--active' : ''}`} onClick={() => setActiveTab(TAB_DUPS)}>Дубликаты</button>
        <button type="button" className={`clients-page__tab${activeTab === TAB_STATS ? ' clients-page__tab--active' : ''}`} onClick={() => setActiveTab(TAB_STATS)}>Статистика</button>
      </div>

      {/* ── Список ── */}
      {activeTab === TAB_LIST && (
        <>
          <div className="clients-page__toolbar">
            <div className="clients-page__filters">
              <input type="text" placeholder="Поиск (ФИО, телефон)" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="clients-page__search" />
              <Select value={queryState.sportId} onChange={(v) => setQueryState((q) => ({ ...q, sportId: v, page: 1 }))} options={[{ value: '', label: 'Все виды спорта' }, ...sports.map((s) => ({ value: String(s.id), label: s.name || '' }))]} placeholder="Все виды спорта" className="clients-page__select-wrap" />
              <Select value={queryState.trainerId} onChange={(v) => setQueryState((q) => ({ ...q, trainerId: v, page: 1 }))} options={[{ value: '', label: 'Тренер — все' }, ...trainers.map((t) => ({ value: String(t.id), label: t.fio || '' }))]} placeholder="Тренер — все" className="clients-page__select-wrap" />
              <Select value={queryState.paid} onChange={(v) => setQueryState((q) => ({ ...q, paid: v, page: 1 }))} options={[{ value: '', label: 'Оплата — все' }, { value: 'true', label: 'Оплачено' }, { value: 'false', label: 'Не оплачено' }]} placeholder="Оплата — все" className="clients-page__select-wrap" />
              <Select value={queryState.clientType} onChange={(v) => setQueryState((q) => ({ ...q, clientType: v, page: 1 }))} options={[{ value: '', label: 'Тип — все' }, { value: 'regular', label: 'Регулярный' }, { value: 'individual', label: 'Индивидуальный' }]} placeholder="Тип — все" className="clients-page__select-wrap" />
              <Select
                value={queryState.year}
                onChange={(v) => setQueryState((q) => ({ ...q, year: v, month: v ? q.month : '', day: v ? q.day : '', page: 1 }))}
                options={[{ value: '', label: 'Год — все' }, { value: '2026', label: '2026' }, { value: '2027', label: '2027' }]}
                placeholder="Год — все"
                className="clients-page__select-wrap clients-page__select-year"
              />
              {queryState.year && (
                <Select
                  value={queryState.month}
                  onChange={(v) => setQueryState((q) => ({ ...q, month: v, day: v ? q.day : '', page: 1 }))}
                  options={[{ value: '', label: 'Месяц — все' }, { value: '1', label: 'Январь' }, { value: '2', label: 'Февраль' }, { value: '3', label: 'Март' }, { value: '4', label: 'Апрель' }, { value: '5', label: 'Май' }, { value: '6', label: 'Июнь' }, { value: '7', label: 'Июль' }, { value: '8', label: 'Август' }, { value: '9', label: 'Сентябрь' }, { value: '10', label: 'Октябрь' }, { value: '11', label: 'Ноябрь' }, { value: '12', label: 'Декабрь' }]}
                  placeholder="Месяц — все"
                  className="clients-page__select-wrap"
                />
              )}
              {queryState.year && queryState.month && (
                <Select
                  value={queryState.day}
                  onChange={(v) => setQueryState((q) => ({ ...q, day: v, page: 1 }))}
                  options={[{ value: '', label: 'День — все' }, ...Array.from({ length: 31 }, (_, i) => i + 1).map((d) => ({ value: String(d), label: String(d) }))]}
                  placeholder="День — все"
                  className="clients-page__select-wrap clients-page__select-day"
                />
              )}
              {(queryState.year || queryState.month || queryState.day) && (
                <button type="button" className="clients-page__date-clear" onClick={() => setQueryState((q) => ({ ...q, year: '', month: '', day: '', page: 1 }))} title="Сбросить дату">✕</button>
              )}
            </div>
            <button type="button" className="clients-page__add" onClick={() => setFormClient({})}>Добавить клиента</button>
          </div>
          <ClientsList items={items} loading={loading} error={error} onRetry={fetchSafe} onEdit={(c) => (isAdmin ? setFormClient(c) : showAccessDenied())} onDelete={(c) => (isAdmin ? setConfirmDelete(c) : showAccessDenied())} onDetails={handleOpenCard} onExtend={setExtendClientObj} />
          <Pagination meta={data?.meta} currentPage={queryState.page} onPage={(p) => setQueryState((q) => ({ ...q, page: p }))} loading={loading} entityLabel="клиентов" />
        </>
      )}

      {/* ── Дубликаты ── */}
      {activeTab === TAB_DUPS && (
        <div className="clients-page__dup-section">
          {/* Подтабы */}
          <div className="clients-page__subtabs">
            <button type="button" className={`clients-page__subtab${activeDupTab === SUBTAB_EXACT ? ' clients-page__subtab--active' : ''}`} onClick={() => setActiveDupTab(SUBTAB_EXACT)}>Точные дубликаты</button>
            <button type="button" className={`clients-page__subtab${activeDupTab === SUBTAB_SIMILAR ? ' clients-page__subtab--active' : ''}`} onClick={() => setActiveDupTab(SUBTAB_SIMILAR)}>Похожие имена</button>
          </div>

          {allLoading ? (
            <div className="clients-page__dup-loading"><span className="loading-inline"><span className="loading-inline__spinner" aria-hidden />Загрузка всех клиентов…</span></div>
          ) : activeDupTab === SUBTAB_EXACT ? (
            exactGroups.length === 0 ? (
              <div className="clients-page__dup-empty">Точных дубликатов не найдено 👍</div>
            ) : (
              <>
                <p className="clients-page__dup-info">Найдено групп с одинаковым ФИО: <strong>{exactGroups.length}</strong></p>
                {exactGroups.map((group, i) => <DuplicateGroup key={i} group={group} label={group[0].fio} />)}
              </>
            )
          ) : (
            similarGroups.length === 0 ? (
              <div className="clients-page__dup-empty">Похожих имён не найдено 👍</div>
            ) : (
              <>
                <p className="clients-page__dup-info">Найдено групп с похожими именами: <strong>{similarGroups.length}</strong></p>
                {similarGroups.map((group, i) => <DuplicateGroup key={i} group={group} label={`${group[0].fio} / ${group[1].fio}${group.length > 2 ? ` +${group.length - 2}` : ''}`} />)}
              </>
            )
          )}
        </div>
      )}

      {/* ── Статистика ── */}
      {activeTab === TAB_STATS && (
        <div className="clients-page__stats-section">
          <div className="clients-page__stats-toolbar">
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
                ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: MONTH_NAMES[i + 1] })),
              ]}
              placeholder="Месяц"
              className="clients-page__stats-select"
            />
          </div>

          {allLoading ? (
            <div className="clients-page__dup-loading"><span className="loading-inline"><span className="loading-inline__spinner" aria-hidden />Загрузка клиентов…</span></div>
          ) : (
            <>
              <p className="clients-page__stats-info">
                Период: <strong>{statsYear || 'все годы'}</strong>
                {statsMonth ? ` · ${MONTH_NAMES[Number(statsMonth)]}` : ''}
                {' · '}Учеников: <strong>{statsFilteredClients.length}</strong>
                {' · '}Оплатили: <strong>{statsFilteredClients.filter((c) => isClientPaid(c)).length}</strong>
                {' · '}Не оплатили: <strong>{statsFilteredClients.filter((c) => !isClientPaid(c)).length}</strong>
              </p>

              <div className="clients-page__stats-block">
                <h3 className="clients-page__stats-block-title">По тренерам</h3>
                <table className="clients-page__stats-table">
                  <thead>
                    <tr><th>Тренер</th><th>Учеников</th><th>Оплатили</th><th>Не оплатили</th></tr>
                  </thead>
                  <tbody>
                    {statsByTrainer.length === 0 ? (
                      <tr><td colSpan={4} className="clients-page__stats-empty">Нет данных</td></tr>
                    ) : (
                      statsByTrainer.map((r) => (
                        <tr key={r.trainerId ?? r.trainerName}>
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
          )}
        </div>
      )}

      {/* ── Модалки ── */}
      {formClient && (
        <ClientFormModal client={formClient} sports={sports} fetchTrainers={fetchTrainers} onSave={handleSaveClient} onClose={() => { setFormClient(null); setClientFormError(null); }} error={clientFormError} saving={clientFormSaving} />
      )}
      {cardClient && (
        <ClientCardModal client={cardClient} onEdit={(c) => (isAdmin ? setFormClient(c) : showAccessDenied())} onDelete={(c) => (isAdmin ? setConfirmDelete(c) : showAccessDenied())} onClose={() => setCardClient(null)} />
      )}
      {extendClientObj && (
        <ExtendModal client={extendClientObj} onSave={handleSaveExtend} onClose={() => { setExtendClientObj(null); setExtendFormError(null); }} error={extendFormError} saving={extendFormSaving} />
      )}
      {confirmDelete && (
        <ConfirmModal title="Удалить клиента?" message={confirmDelete.fio} confirmText="Удалить" onConfirm={handleDeleteClient} onCancel={() => setConfirmDelete(null)} danger />
      )}
    </div>
  );
};

export default ClientsPage;

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchLeads, createLead, updateLead, deleteLead, fetchFunnelStages } from './api';
import { fetchSports, fetchTrainers } from '../sports-trainers/api';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { useDebounce } from '../../shared/hooks/useDebounce';
import { useAbortSafeFetch } from '../../shared/hooks/useAbortSafeFetch';
import { SEARCH_DEBOUNCE_MS } from '../../shared/constants/common';
import { getApiErrorMessage } from '../../shared/lib/apiError';
import { LeadFormModal, LeadCardModal, FunnelBoard } from './components';
import { Inbox, Link2, Filter, Check, X as XIcon, Pencil, Trash2, Search, Plus } from 'lucide-react';
import { ErrorState, EmptyState, ConfirmModal, Pagination, FilterBar, SkeletonTable, Spinner } from '../../shared/ui';
import { formatPhoneDisplay } from '../../shared/lib/phone';
import TaplinkLeadsTab from './TaplinkLeadsTab';
import './LeadsPage.scss';
import './TaplinkLeadsTab.scss';

const CHANNEL_LABELS = { instagram: 'Instagram', whatsapp: 'WhatsApp', tiktok: 'TikTok', other: 'Другое' };

const getStatusLabel = (status) => {
  if (status === 'accepted') return 'Принято';
  if (status === 'rejected') return 'Отказано';
  return '—';
};

const hasFinalStatus = (lead) => lead?.status === 'accepted' || lead?.status === 'rejected';

const getInitials = (name) =>
  (name || '').split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

const TAB_LEADS   = 'leads';
const TAB_TAPLINK = 'taplink';
const TAB_FUNNEL  = 'funnel';

const LeadsPage = () => {
  const { isAdmin, showAccessDenied } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState(TAB_LEADS);

  // ── Список заявок ──────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, SEARCH_DEBOUNCE_MS);
  const [queryState, setQueryState] = useState({ page: 1, perPage: 20 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formLead, setFormLead] = useState(null);
  const [formError, setFormError] = useState(null);
  const [formSaving, setFormSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [statusSaving, setStatusSaving] = useState(null);
  const { run: runLeads } = useAbortSafeFetch();

  // ── Воронка ────────────────────────────────────────────────────────────────
  const [funnelSearch, setFunnelSearch] = useState('');
  const [stages, setStages] = useState([]);
  const [stagesLoading, setStagesLoading] = useState(false);
  const [funnelLeads, setFunnelLeads] = useState([]);
  const [funnelLeadsLoading, setFunnelLeadsLoading] = useState(false);
  const [cardLead, setCardLead] = useState(null);          // лид, открытый в карточке
  const [cardError, setCardError] = useState(null);
  const [cardSaving, setCardSaving] = useState(false);

  // ── Справочники ─────────────────────────────────────────────────────────────
  const [sports, setSports] = useState([]);

  // ── Загрузка заявок ────────────────────────────────────────────────────────
  const fetchSafe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = { ...queryState, search: debouncedSearch.trim() || undefined };
      const res = await runLeads((signal) => fetchLeads(q, signal));
      if (res === null) return;
      setData(res);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [runLeads, queryState, debouncedSearch]);

  useEffect(() => {
    fetchSafe();
  }, [fetchSafe]);

  // ── Загрузка этапов воронки ─────────────────────────────────────────────
  const fetchStages = useCallback(async () => {
    setStagesLoading(true);
    try {
      const res = await fetchFunnelStages(null);
      const list = Array.isArray(res) ? res : res?.items ?? res?.results ?? [];
      const sorted = [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setStages(sorted);
      return sorted;
    } catch {
      return [];
    } finally {
      setStagesLoading(false);
    }
  }, []);

  // ── Загрузка лидов воронки (accepted, со stageId) ─────────────────────
  const fetchFunnelLeads = useCallback(async () => {
    setFunnelLeadsLoading(true);
    try {
      const res = await fetchLeads({ status: 'accepted', perPage: 500 }, null);
      const list = res?.items ?? res?.results ?? (Array.isArray(res) ? res : []);
      setFunnelLeads(list);
    } catch {
      /* ignore */
    } finally {
      setFunnelLeadsLoading(false);
    }
  }, []);

  // ── Загрузка видов спорта ──────────────────────────────────────────────
  useEffect(() => {
    fetchSports({}, null)
      .then((d) => setSports(Array.isArray(d) ? d : d?.items ?? d?.results ?? []))
      .catch((e) => {
        toast.error(e?.userMessage ?? e?.response?.data?.message ?? 'Ошибка загрузки видов спорта');
      });
  }, []);

  useEffect(() => {
    if (activeTab === TAB_FUNNEL) {
      fetchStages();
      fetchFunnelLeads();
    }
  }, [activeTab, fetchStages, fetchFunnelLeads]);

  const items = data?.items ?? data?.results ?? (Array.isArray(data) ? data : []) ?? [];

  // ── Поиск по воронке (клиентский, без учёта регистра) ─────────────────────
  const norm = (s) => (s ?? '').toString().trim().toLowerCase();
  const funnelSearchNorm = norm(funnelSearch);
  const filteredFunnelLeads = useMemo(() => {
    if (!funnelSearchNorm) return funnelLeads;
    return funnelLeads.filter((lead) => {
      const name = norm(lead.name);
      const phone = norm(lead.phone);
      const channel = norm(lead.channel);
      return name.includes(funnelSearchNorm) || phone.includes(funnelSearchNorm) || channel.includes(funnelSearchNorm);
    });
  }, [funnelLeads, funnelSearchNorm]);

  // ── Группировка лидов по этапам ────────────────────────────────────────
  const NO_STAGE_KEY = '__no_stage__';
  const leadsByStage = useMemo(() => {
    const byStage = {};
    filteredFunnelLeads.forEach((lead) => {
      const sid = lead.stageId ?? lead.stage_id ?? lead.stage?.id;
      const key = sid ?? NO_STAGE_KEY;
      if (!byStage[key]) byStage[key] = [];
      byStage[key].push(lead);
    });
    return byStage;
  }, [filteredFunnelLeads]);

  const stagesForBoard = useMemo(() => {
    const noStageLeads = leadsByStage[NO_STAGE_KEY];
    if (noStageLeads?.length) {
      return [...stages, { id: NO_STAGE_KEY, name: 'Без этапа', order: 999 }];
    }
    return stages;
  }, [stages, leadsByStage]);

  // ── Тренеры по виду спорта (для карточки) ─────────────────────────────
  const loadTrainers = useCallback(async (sportId) => {
    const id = sportId ? Number(sportId) : undefined;
    const res = await fetchTrainers({ sportId: id }, null);
    return Array.isArray(res) ? res : res?.items ?? res?.results ?? [];
  }, []);

  // ── Handlers: заявки ───────────────────────────────────────────────────
  const handleSaveLead = async (payload) => {
    setFormError(null);
    setFormSaving(true);
    try {
      if (formLead?.id) {
        await updateLead(formLead.id, payload, null);
        toast.success('Заявка обновлена');
      } else {
        await createLead(payload, null);
        toast.success('Заявка создана');
      }
      setFormLead(null);
      fetchSafe();
    } catch (e) {
      const d = e.response?.data;
      setFormError(d?.error?.message ?? d?.message ?? d?.detail ?? 'Ошибка сохранения');
    } finally {
      setFormSaving(false);
    }
  };

  const handleSetStatus = async (lead, status) => {
    setStatusSaving(lead.id);
    try {
      const stageList = stages.length > 0 ? stages : await fetchStages();
      const firstStage = stageList.length > 0 ? stageList[0] : null;
      const payload = { status };
      if (status === 'accepted' && firstStage) payload.stageId = firstStage.id;
      await updateLead(lead.id, payload, null);
      toast.success(status === 'accepted' ? 'Заявка принята и добавлена в воронку' : 'Заявка отклонена');
      fetchSafe();
      if (activeTab === TAB_FUNNEL) fetchFunnelLeads();
    } catch (e) {
      const d = e.response?.data;
      toast.error(d?.error?.message ?? d?.message ?? d?.detail ?? 'Ошибка');
    } finally {
      setStatusSaving(null);
    }
  };

  const handleDeleteLead = () => {
    if (!confirmDelete?.id) return;
    deleteLead(confirmDelete.id, null)
      .then(() => {
        setConfirmDelete(null);
        fetchSafe();
        toast.success('Заявка удалена');
      })
      .catch((e) => {
        const msg = e.response?.data?.error?.message ?? e.response?.data?.message ?? e.response?.data?.detail;
        toast.error(e.response?.status === 409 ? (msg || 'Нельзя удалить заявку со статусом') : (msg || 'Ошибка удаления'));
      });
  };

  const handleMoveLead = async (leadId, stageId) => {
    try {
      const payload = { stageId: stageId === NO_STAGE_KEY ? null : stageId };
      await updateLead(leadId, payload, null);
      toast.success('Лид перемещён');
      fetchFunnelLeads();
    } catch (e) {
      const d = e.response?.data;
      toast.error(d?.error?.message ?? d?.message ?? d?.detail ?? 'Ошибка перемещения');
    }
  };

  // ── Handlers: карточка лида (в воронке) ────────────────────────────────
  const handleSaveCard = async (payload) => {
    if (!cardLead?.id) return;
    setCardError(null);
    setCardSaving(true);
    try {
      await updateLead(cardLead.id, payload, null);
      toast.success('Карточка сохранена');
      setCardLead(null);
      fetchFunnelLeads();
    } catch (e) {
      const d = e.response?.data;
      setCardError(d?.error?.message ?? d?.message ?? d?.detail ?? 'Ошибка сохранения');
    } finally {
      setCardSaving(false);
    }
  };

  return (
    <div className="leads-page">
      

      {/* Табы */}
      <div className="ui-tabs">
        <button
          type="button"
          className={`ui-tabs__tab ${activeTab === TAB_LEADS ? 'ui-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab(TAB_LEADS)}
        >
          <Inbox size={15} /> Заявки
        </button>
        <button
          type="button"
          className={`ui-tabs__tab ${activeTab === TAB_TAPLINK ? 'ui-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab(TAB_TAPLINK)}
        >
          <Link2 size={15} /> С Таплинка
        </button>
        <button
          type="button"
          className={`ui-tabs__tab ${activeTab === TAB_FUNNEL ? 'ui-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab(TAB_FUNNEL)}
        >
          <Filter size={15} /> Воронка лидов
        </button>
      </div>

      {/* ══ Таб: Заявки ══ */}
      {activeTab === TAB_LEADS && (
        <>
          <FilterBar className="leads-page__filter-bar">
            <div className="ui-search leads-page__search">
              <Search size={15} className="ui-search__icon" />
              <input
                type="text"
                placeholder="Поиск"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="ui-search__input"
              />
            </div>
            <button type="button" className="leads-page__add filter-bar__action" onClick={() => (isAdmin ? setFormLead({}) : showAccessDenied())}>
              <Plus size={16} /> Новая заявка
            </button>
          </FilterBar>
          {error && <ErrorState message={error} onRetry={fetchSafe} />}
          <div className="ui-list__table-wrap leads-page__table-wrap">
            <table className="ui-list__table leads-page__table">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Телефон</th>
                  <th>Канал</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="ui-list__skeleton-cell leads-page__skeleton-cell">
                      <SkeletonTable rows={6} cols={5} />
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="ui-list__empty-cell leads-page__empty-cell">
                      <EmptyState compact tableCell message="Нет заявок" />
                    </td>
                  </tr>
                ) : (
                  items.map((lead) => (
                    <tr key={lead.id} role="row" aria-label={`Заявка: ${lead.name ?? '—'}, ${lead.phone ?? '—'}`}>
                      <td role="cell" data-label="Имя">
                        <div className="ui-list__name-cell">
                          <span className="ui-avatar">{getInitials(lead.name)}</span>
                          <span className="ui-list__title">{lead.name ?? '—'}</span>
                        </div>
                      </td>
                      <td role="cell" data-label="Телефон"><span className="ui-list__muted">{formatPhoneDisplay(lead.phone) || '—'}</span></td>
                      <td role="cell" data-label="Канал"><span className="ui-list__muted">{CHANNEL_LABELS[(lead.channel ?? '').toLowerCase()] ?? lead.channel ?? '—'}</span></td>
                      <td role="cell" data-label="Статус">
                        <span className="ui-list__muted">
                          {hasFinalStatus(lead) ? (
                            <span className={`ui-pill leads-page__status-badge leads-page__status-badge--${lead.status}`}>
                              {getStatusLabel(lead.status)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </span>
                      </td>
                      <td role="cell" className="leads-page__actions leads-page__actions-cell" data-label="">
                        {!hasFinalStatus(lead) ? (
                          <div className="leads-page__action-group">
                            <button
                              type="button"
                              className="ui-list-btn ui-list-btn--primary"
                              disabled={statusSaving === lead.id}
                              onClick={() => (isAdmin ? handleSetStatus(lead, 'accepted') : showAccessDenied())}
                              aria-label={`Принять заявку ${lead.name ?? ''}`}
                            >
                              <Check size={13} /> Принять
                            </button>
                            <button
                              type="button"
                              className="ui-list-btn ui-list-btn--danger"
                              disabled={statusSaving === lead.id}
                              onClick={() => (isAdmin ? handleSetStatus(lead, 'rejected') : showAccessDenied())}
                              aria-label={`Отказать в заявке ${lead.name ?? ''}`}
                            >
                              <XIcon size={13} /> Отказать
                            </button>
                            <button
                              type="button"
                              className="ui-list-btn ui-list-btn--edit"
                              onClick={() => (isAdmin ? setFormLead(lead) : showAccessDenied())}
                              aria-label={`Изменить заявку ${lead.name ?? ''}`}
                            >
                              <Pencil size={13} /> Изменить
                            </button>
                            <button
                              type="button"
                              className="ui-list-btn ui-list-btn--danger"
                              onClick={() => (isAdmin ? setConfirmDelete(lead) : showAccessDenied())}
                              aria-label={`Удалить заявку ${lead.name ?? ''}`}
                            >
                              <Trash2 size={13} /> Удалить
                            </button>
                          </div>
                        ) : (
                          <div className="leads-page__action-group">
                            <button
                              type="button"
                              className="ui-list-btn ui-list-btn--edit"
                              onClick={() => (isAdmin ? setFormLead(lead) : showAccessDenied())}
                              aria-label={`Изменить заявку ${lead.name ?? ''}`}
                            >
                              <Pencil size={13} /> Изменить
                            </button>
                            <button
                              type="button"
                              className="ui-list-btn ui-list-btn--danger"
                              onClick={() => (isAdmin ? setConfirmDelete(lead) : showAccessDenied())}
                              aria-label={`Удалить заявку ${lead.name ?? ''}`}
                            >
                              <Trash2 size={13} /> Удалить
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            meta={data?.meta}
            currentPage={queryState.page}
            onPage={(p) => setQueryState((q) => ({ ...q, page: p }))}
            loading={loading}
            entityLabel="заявок"
          />
        </>
      )}

      {/* ══ Таб: С Таплинка ══ */}
      {activeTab === TAB_TAPLINK && <TaplinkLeadsTab />}

      {/* ══ Таб: Воронка ══ */}
      {activeTab === TAB_FUNNEL && (
        <>
          <FilterBar className="leads-page__funnel-toolbar">
            <p className="leads-page__funnel-hint">Следите за движением клиентов от первого контакта до покупки</p>
            {stagesForBoard.length > 4 && (
              <span className="leads-page__scroll-hint">Прокрутите вправо →</span>
            )}
            <div className="ui-search leads-page__search leads-page__search--funnel">
              <Search size={15} className="ui-search__icon" />
              <input
                type="text"
                placeholder="Поиск"
                value={funnelSearch}
                onChange={(e) => setFunnelSearch(e.target.value)}
                className="ui-search__input"
              />
            </div>
            <button
              type="button"
              className="leads-page__refresh-btn filter-bar__action"
              onClick={() => { fetchStages(); fetchFunnelLeads(); }}
            >
              ↺ Обновить
            </button>
          </FilterBar>
          {stagesLoading ? (
            <div className="leads-page__loading-cell">
              <Spinner />
            </div>
          ) : (
            <FunnelBoard
              stages={stagesForBoard}
              leadsByStage={leadsByStage}
              onCardClick={(lead) => setCardLead(lead)}
              onMoveLead={handleMoveLead}
              loading={funnelLeadsLoading}
            />
          )}
        </>
      )}

      {/* ── Модалки заявок ── */}
      {formLead !== null && (
        <LeadFormModal
          lead={formLead?.id ? items.find((l) => l.id === formLead.id) ?? formLead : formLead}
          onSave={handleSaveLead}
          onClose={() => { setFormLead(null); setFormError(null); }}
          error={formError}
          saving={formSaving}
        />
      )}
      {confirmDelete !== null && (
        <ConfirmModal
          title="Удалить заявку?"
          message={`Удалить «${confirmDelete.name ?? 'заявку'}»?`}
          confirmText="Удалить"
          danger
          onConfirm={handleDeleteLead}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* ── Карточка лида (воронка) ── */}
      {cardLead !== null && (
        <LeadCardModal
          lead={cardLead}
          stages={stages}
          sports={sports}
          onLoadTrainers={loadTrainers}
          onSave={handleSaveCard}
          onClose={() => { setCardLead(null); setCardError(null); }}
          error={cardError}
          saving={cardSaving}
        />
      )}

    </div>
  );
};

export default LeadsPage;

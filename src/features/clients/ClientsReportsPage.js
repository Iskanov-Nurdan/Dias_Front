import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  fetchClientsNotRenewed,
  fetchClient,
  createClient,
  updateClient,
  deleteClient,
  extendClient,
  fetchClientsStats,
  fetchClientsScheduleStats,
  fetchClientsPaymentDayReport,
  uploadClientPhotos,
} from './api';
import { fetchSports, fetchTrainers } from '../sports-trainers/api';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { useAbortSafeFetch } from '../../shared/hooks/useAbortSafeFetch';
import { MONTHS, STATS_YEARS } from '../../shared/constants/common';
import { isPeriodClosedError, getApiErrorMessage } from '../../shared/lib/apiError';
import { prepareClientSavePayload } from './lib/prepareClientSavePayload';
import { Select, ConfirmModal, Pagination, FilterBar, EmptyState } from '../../shared/ui';
import {
  ClientsList,
  ClientCardModal,
  ClientFormModal,
  ExtendModal,
  TrainerDetailsModal,
  ClientsScheduleStatsBlock,
  ClientsPaymentDayReportBlock,
} from './components';
import './ClientsPage.scss';

const TAB_NOT_RENEWED = 'not_renewed';
const TAB_STATS = 'stats';
const TAB_PAYMENT_DAYS = 'payment_days';

const ClientsReportsPage = () => {
  const { user, isAdmin, showAccessDenied } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState(TAB_NOT_RENEWED);

  const [statsYear, setStatsYear] = useState(new Date().getFullYear().toString());
  const [statsMonth, setStatsMonth] = useState(String(new Date().getMonth() + 1));

  const [notRenewedData, setNotRenewedData] = useState(null);
  const [notRenewedLoading, setNotRenewedLoading] = useState(false);
  const [notRenewedError, setNotRenewedError] = useState(null);
  const [nrYear, setNrYear] = useState(() => {
    const y = new Date().getFullYear();
    return y === 2026 || y === 2027 ? String(y) : '2026';
  });
  const [nrMonth, setNrMonth] = useState(String(new Date().getMonth() + 1));
  const [nrPage, setNrPage] = useState(1);
  const { run: runNotRenewed } = useAbortSafeFetch();

  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const statsControllerRef = useRef(null);
  const [scheduleStatsRaw, setScheduleStatsRaw] = useState(null);
  const [scheduleStatsLoading, setScheduleStatsLoading] = useState(false);
  const [scheduleStatsEndpointMissing, setScheduleStatsEndpointMissing] = useState(false);
  const [scheduleStatsError, setScheduleStatsError] = useState(null);
  const scheduleStatsControllerRef = useRef(null);
  const scheduleStatsRequestSeq = useRef(0);

  const [paymentDayYear, setPaymentDayYear] = useState(new Date().getFullYear().toString());
  const [paymentDayMonth, setPaymentDayMonth] = useState(String(new Date().getMonth() + 1));
  const [paymentDayReportRaw, setPaymentDayReportRaw] = useState(null);
  const [paymentDayReportLoading, setPaymentDayReportLoading] = useState(false);
  const [paymentDayReportEndpointMissing, setPaymentDayReportEndpointMissing] = useState(false);
  const [paymentDayReportError, setPaymentDayReportError] = useState(null);
  const paymentDayReportControllerRef = useRef(null);
  const paymentDayReportRequestSeq = useRef(0);

  const [sports, setSports] = useState([]);
  const [formClient, setFormClient] = useState(null);
  const [cardClient, setCardClient] = useState(null);
  const [extendClientObj, setExtendClientObj] = useState(null);
  const [clientFormError, setClientFormError] = useState(null);
  const [clientFormSaving, setClientFormSaving] = useState(false);
  const [extendFormError, setExtendFormError] = useState(null);
  const [extendFormSaving, setExtendFormSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [trainerDetails, setTrainerDetails] = useState(null);

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

  useEffect(() => {
    setNrPage(1);
  }, [nrYear, nrMonth]);

  useEffect(() => {
    if (activeTab === TAB_NOT_RENEWED) {
      fetchNotRenewedSafe();
    }
  }, [activeTab, fetchNotRenewedSafe]);

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

  const fetchScheduleStats = useCallback(async () => {
    scheduleStatsControllerRef.current?.abort();
    scheduleStatsControllerRef.current = new AbortController();
    const { signal } = scheduleStatsControllerRef.current;
    const seq = ++scheduleStatsRequestSeq.current;
    setScheduleStatsLoading(true);
    setScheduleStatsRaw(null);
    setScheduleStatsEndpointMissing(false);
    setScheduleStatsError(null);
    const params = {};
    if (statsYear) params.year = statsYear;
    if (statsMonth) params.month = statsMonth;
    try {
      const raw = await fetchClientsScheduleStats(params, signal);
      if (scheduleStatsRequestSeq.current === seq) setScheduleStatsRaw(raw);
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      if (scheduleStatsRequestSeq.current !== seq) return;
      const st = err?.response?.status;
      if (st === 404) {
        setScheduleStatsEndpointMissing(true);
      } else {
        setScheduleStatsError(getApiErrorMessage(err));
      }
    } finally {
      if (scheduleStatsRequestSeq.current === seq) setScheduleStatsLoading(false);
    }
  }, [statsYear, statsMonth]);

  const fetchPaymentDayReport = useCallback(async () => {
    if (!paymentDayYear || !paymentDayMonth) {
      paymentDayReportControllerRef.current?.abort();
      setPaymentDayReportLoading(false);
      setPaymentDayReportRaw(null);
      setPaymentDayReportEndpointMissing(false);
      setPaymentDayReportError(null);
      return;
    }
    paymentDayReportControllerRef.current?.abort();
    paymentDayReportControllerRef.current = new AbortController();
    const { signal } = paymentDayReportControllerRef.current;
    const seq = ++paymentDayReportRequestSeq.current;
    setPaymentDayReportLoading(true);
    setPaymentDayReportRaw(null);
    setPaymentDayReportEndpointMissing(false);
    setPaymentDayReportError(null);
    const params = { year: paymentDayYear, month: paymentDayMonth };
    try {
      const raw = await fetchClientsPaymentDayReport(params, signal);
      if (paymentDayReportRequestSeq.current === seq) setPaymentDayReportRaw(raw);
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      if (paymentDayReportRequestSeq.current !== seq) return;
      const st = err?.response?.status;
      if (st === 404) {
        setPaymentDayReportEndpointMissing(true);
      } else {
        setPaymentDayReportError(getApiErrorMessage(err));
      }
    } finally {
      if (paymentDayReportRequestSeq.current === seq) setPaymentDayReportLoading(false);
    }
  }, [paymentDayYear, paymentDayMonth]);

  useEffect(() => {
    if (activeTab !== TAB_STATS) return undefined;
    fetchStats();
    fetchScheduleStats();
    return () => {
      statsControllerRef.current?.abort();
      scheduleStatsControllerRef.current?.abort();
    };
  }, [activeTab, fetchStats, fetchScheduleStats]);

  useEffect(() => {
    if (activeTab !== TAB_PAYMENT_DAYS) return undefined;
    fetchPaymentDayReport();
    return () => {
      paymentDayReportControllerRef.current?.abort();
    };
  }, [activeTab, fetchPaymentDayReport]);

  useEffect(() => {
    fetchSports(null)
      .then((d) => setSports(Array.isArray(d) ? d : d?.results ?? d?.items ?? []))
      .catch((e) => {
        toast.error(e?.userMessage ?? e?.response?.data?.message ?? 'Ошибка загрузки видов спорта');
      });
  }, [toast]);

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

  const refreshAfterSave = useCallback(() => {
    fetchNotRenewedSafe();
  }, [fetchNotRenewedSafe]);

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
      setFormClient(null);
      refreshAfterSave();
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
        refreshAfterSave();
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
      refreshAfterSave();
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
      

      <div className="clients-page__tabs">
        <button
          type="button"
          className={`clients-page__tab${activeTab === TAB_NOT_RENEWED ? ' clients-page__tab--active' : ''}`}
          onClick={() => setActiveTab(TAB_NOT_RENEWED)}
        >
          Не продлили
        </button>
        <button
          type="button"
          className={`clients-page__tab${activeTab === TAB_STATS ? ' clients-page__tab--active' : ''}`}
          onClick={() => setActiveTab(TAB_STATS)}
        >
          Статистика
        </button>
        <button
          type="button"
          className={`clients-page__tab${activeTab === TAB_PAYMENT_DAYS ? ' clients-page__tab--active' : ''}`}
          onClick={() => setActiveTab(TAB_PAYMENT_DAYS)}
        >
          Записи по дням
        </button>
      </div>

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
              <button
                type="button"
                className="clients-page__add clients-page__add--desktop filter-bar__action clients-page__not-renewed-add"
                onClick={() => setFormClient({})}
              >
                Добавить клиента
              </button>
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

              <ClientsScheduleStatsBlock
                raw={scheduleStatsRaw}
                loading={scheduleStatsLoading}
                errorMessage={scheduleStatsError}
                endpointMissing={scheduleStatsEndpointMissing}
                onTrainerRowClick={(trainerId, trainerName, slot) =>
                  setTrainerDetails({
                    trainerId,
                    trainerName,
                    ...(slot &&
                    slot.weekday != null &&
                    slot.timeFrom &&
                    slot.timeTo
                      ? {
                          trainingWeekday: slot.weekday,
                          trainingTimeFrom: slot.timeFrom,
                          trainingTimeTo: slot.timeTo,
                        }
                      : {}),
                  })
                }
              />
            </>
          ) : null}
        </div>
      )}

      {activeTab === TAB_PAYMENT_DAYS && (
        <div className="clients-page__stats-section">
          <FilterBar className="clients-page__stats-toolbar">
            <Select
              value={paymentDayYear}
              onChange={setPaymentDayYear}
              options={[{ value: '', label: 'Год — все' }, ...STATS_YEARS.map((y) => ({ value: y, label: y }))]}
              placeholder="Год"
              className="clients-page__stats-select"
            />
            <Select
              value={paymentDayMonth}
              onChange={setPaymentDayMonth}
              options={[
                { value: '', label: 'Месяц — все' },
                ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: MONTHS[i + 1] })),
              ]}
              placeholder="Месяц"
              className="clients-page__stats-select"
            />
          </FilterBar>
          {!paymentDayYear || !paymentDayMonth ? (
            <p className="clients-page__stats-info" role="status">
              Выберите <strong>год</strong> и <strong>месяц</strong>, чтобы построить отчёт по дням.
            </p>
          ) : (
            <>
              <p className="clients-page__stats-info">
                Период: <strong>{paymentDayYear}</strong>
                {` · ${MONTHS[Number(paymentDayMonth)]}`}
              </p>
              <ClientsPaymentDayReportBlock
                raw={paymentDayReportRaw}
                loading={paymentDayReportLoading}
                errorMessage={paymentDayReportError}
                endpointMissing={paymentDayReportEndpointMissing}
                year={paymentDayYear}
                month={paymentDayMonth}
                onOpenClient={handleOpenCard}
              />
            </>
          )}
        </div>
      )}

      {formClient && (
        <ClientFormModal
          key={formClient?.id != null ? String(formClient.id) : 'new-client'}
          client={formClient}
          sports={sports}
          fetchTrainers={fetchTrainers}
          currentUserFio={user?.fio || user?.login || ''}
          onSave={handleSaveClient}
          onClose={() => { setFormClient(null); setClientFormError(null); }}
          error={clientFormError}
          saving={clientFormSaving}
        />
      )}
      {cardClient && (
        <ClientCardModal
          client={cardClient}
          onEdit={(c) => (isAdmin ? setFormClient(c) : showAccessDenied())}
          onDelete={(c) => (isAdmin ? setConfirmDelete(c) : showAccessDenied())}
          onClose={() => setCardClient(null)}
        />
      )}
      {extendClientObj && (
        <ExtendModal client={extendClientObj} onSave={handleSaveExtend} onClose={() => { setExtendClientObj(null); setExtendFormError(null); }} error={extendFormError} saving={extendFormSaving} />
      )}
      {confirmDelete && (
        <ConfirmModal title="Удалить клиента?" message={confirmDelete.fio} confirmText="Удалить" onConfirm={handleDeleteClient} onCancel={() => setConfirmDelete(null)} danger />
      )}
      {trainerDetails && (
        <TrainerDetailsModal
          trainerId={trainerDetails.trainerId}
          trainerName={trainerDetails.trainerName}
          year={statsYear}
          month={statsMonth}
          trainingWeekday={trainerDetails.trainingWeekday}
          trainingTimeFrom={trainerDetails.trainingTimeFrom}
          trainingTimeTo={trainerDetails.trainingTimeTo}
          onDetails={(c) => { setTrainerDetails(null); handleOpenCard(c); }}
          onClose={() => setTrainerDetails(null)}
        />
      )}
    </div>
  );
};

export default ClientsReportsPage;

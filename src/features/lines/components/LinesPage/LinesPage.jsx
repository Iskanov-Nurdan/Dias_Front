import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useDiscardOnClose, useDirtyFromBaseline } from '../../../../shared/hooks';
import { useServerQuery, formatNumberForInput, parseLocaleNumber, getApiErrorMessage } from '../../../../shared/lib';
import {
  Loading,
  EmptyState,
  ErrorState,
  ConfirmModal,
  useToast,
  DecimalInput,
  Select,
  Pagination,
  Collapse,
  ActionMenu,
} from '../../../../shared/ui';
import {
  createLine,
  updateLine,
  deleteLine,
  openShift,
  closeShift,
  updateShiftParams,
  pauseLineShift,
  resumeLineShift,
  getLineHistory,
  fetchLinesHistoryPage,
  getLineHistorySessionDetail,
} from '../../api/linesApi';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useAuth } from '../../../auth';
import ProductionBatchModal from '../ProductionBatchModal';
import './LinesPage.scss';

const emptyParams = () => ({
  comment: '',
  height: '',
  width: '',
  angle_deg: '',
  session_title: '',
});

const lineIsActive = (line) => {
  if (line == null) return true;
  if (line.is_active === false) return false;
  if (line.active === false) return false;
  if (line.status === 'inactive' || line.status === 'disabled') return false;
  return true;
};

const shiftOpenerLabel = (line, snap) => {
  const s = snap || line?.shift_snapshot || {};
  return (
    s.opened_by_name
    || s.opened_by?.name
    || s.opened_by_display
    || line?.shift_opened_by_name
    || line?.shift_operator_name
    || '—'
  );
};

const eventToForm = (ev) => ({
  comment: ev?.comment ?? '',
  height: ev?.height != null && ev?.height !== '' ? formatNumberForInput(ev.height) : '',
  width: ev?.width != null && ev?.width !== '' ? formatNumberForInput(ev.width) : '',
  angle_deg: ev?.angle_deg != null && ev?.angle_deg !== '' ? formatNumberForInput(ev.angle_deg) : '',
});

const buildPayload = (form) => {
  const height = parseLocaleNumber(form.height);
  const width = parseLocaleNumber(form.width);
  const angle_deg = parseLocaleNumber(form.angle_deg);
  if (!Number.isFinite(height) || !Number.isFinite(width) || !Number.isFinite(angle_deg)) return null;
  return {
    height,
    width,
    angle_deg,
    comment: form.comment.trim() || undefined,
  };
};

/**
 * После PATCH shift-params бэкенд иногда отдаёт в GET /lines/ старый shift_snapshot.
 * Подмешиваем фактически сохранённые значения, чтобы таблица «Открытие» совпадала с формой.
 */
const applyShiftParamPatchToOpeningRow = (row, payload) => {
  if (!row?.isOpen || !payload) return row;
  const patch = {
    height: payload.height,
    width: payload.width,
    angle_deg: payload.angle_deg,
    comment: payload.comment,
  };
  const nextLastOpenEv = row.lastOpenEv ? { ...row.lastOpenEv, ...patch } : row.lastOpenEv;
  const nextShiftSnapshot = row.shiftSnapshot ? { ...row.shiftSnapshot, ...patch } : { ...patch };
  const nextShift_snapshot = row.shift_snapshot
    ? { ...row.shift_snapshot, ...patch }
    : row.shift_snapshot;

  return {
    ...row,
    shift_snapshot: nextShift_snapshot,
    lastOpenEv: nextLastOpenEv,
    shiftSnapshot: nextShiftSnapshot,
  };
};

const mergeOpeningRowsAfterShiftParamsSave = (rows, lineId, payload) => {
  if (lineId == null || !payload || !Array.isArray(rows)) return rows;
  const idKey = String(lineId);
  return rows.map((row) =>
    String(row.id) === idKey ? applyShiftParamPatchToOpeningRow(row, payload) : row
  );
};

/** Контракт API: shift_pause / shift_resume; старые значения — на случай миграций. */
const PAUSE_HISTORY_ACTIONS = new Set(['shift_pause', 'pause', 'paused']);
const RESUME_HISTORY_ACTIONS = new Set(['shift_resume', 'resume', 'resumed']);

const readShiftPausedFromApi = (line, snap) => {
  if (line?.shift_is_paused === true) return true;
  if (snap && (snap.is_paused === true || snap.paused === true)) return true;
  return false;
};

const readPauseReasonFromApi = (line, snap) => {
  const r = line?.shift_pause_reason ?? snap?.pause_reason ?? '';
  return String(r).trim();
};

const actionLabel = (action) => {
  if (action === 'open') return 'Открытие';
  if (action === 'close') return 'Закрытие';
  if (action === 'params_update') return 'Параметры';
  if (action === 'shift_pause') return 'Остановка';
  if (action === 'shift_resume') return 'Возобновление';
  if (PAUSE_HISTORY_ACTIONS.has(action)) return 'Остановка';
  if (RESUME_HISTORY_ACTIONS.has(action)) return 'Возобновление';
  return action || '—';
};

const historyEventSortKey = (h) => {
  const d = String(h?.date || '').trim();
  const timeRaw = String(h?.time ?? '00:00:00').trim();
  if (!d) return 0;
  const padded = timeRaw.length === 5 ? `${timeRaw}:00` : timeRaw;
  let ms = Date.parse(`${d}T${padded}`);
  if (!Number.isFinite(ms)) ms = Date.parse(`${d} ${timeRaw}`);
  return Number.isFinite(ms) ? ms : 0;
};

const lineHistoryGroupKey = (ev) =>
  String(ev.line_id ?? ev.line_name ?? ev.line ?? '').trim() || '_';

const sessionRowSortKey = (row) => {
  if (row.kind === 'single') return historyEventSortKey(row.event);
  const tClose = row.close ? historyEventSortKey(row.close) : 0;
  const tOpen = row.open ? historyEventSortKey(row.open) : 0;
  return Math.max(tClose, tOpen);
};

/**
 * Сшивает open → (params_update*, pause/resume*) → close по каждой линии;
 * в список истории выводится одна строка на смену.
 */
const buildLineHistorySessionRows = (items) => {
  if (!items?.length) return [];
  const byLine = new Map();
  for (const ev of items) {
    const k = lineHistoryGroupKey(ev);
    if (!byLine.has(k)) byLine.set(k, []);
    byLine.get(k).push(ev);
  }

  const out = [];
  for (const [lineKey, list] of byLine) {
    const sorted = [...list].sort((a, b) => {
      const ka = historyEventSortKey(a);
      const kb = historyEventSortKey(b);
      if (ka !== kb) return ka - kb;
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });

    let pendingOpen = null;
    let pendingParams = [];
    let pendingPauseResume = [];

    const flushOpenOnly = () => {
      if (pendingOpen) {
        out.push({
          kind: 'session',
          lineKey,
          open: pendingOpen,
          close: null,
          paramUpdates: pendingParams,
          pauseResume: pendingPauseResume,
        });
        pendingOpen = null;
        pendingParams = [];
        pendingPauseResume = [];
      }
    };

    for (const ev of sorted) {
      const a = ev.action;
      if (a === 'open') {
        flushOpenOnly();
        pendingOpen = ev;
        pendingParams = [];
        pendingPauseResume = [];
      } else if (a === 'params_update') {
        if (pendingOpen) pendingParams.push(ev);
        else out.push({ kind: 'single', lineKey, event: ev });
      } else if (PAUSE_HISTORY_ACTIONS.has(a) || RESUME_HISTORY_ACTIONS.has(a)) {
        if (pendingOpen) pendingPauseResume.push(ev);
      } else if (a === 'close') {
        if (pendingOpen) {
          out.push({
            kind: 'session',
            lineKey,
            open: pendingOpen,
            close: ev,
            paramUpdates: pendingParams,
            pauseResume: pendingPauseResume,
          });
          pendingOpen = null;
          pendingParams = [];
          pendingPauseResume = [];
        } else {
          out.push({ kind: 'single', lineKey, event: ev });
        }
      } else {
        out.push({ kind: 'single', lineKey, event: ev });
      }
    }
    flushOpenOnly();
  }

  out.sort((a, b) => sessionRowSortKey(b) - sessionRowSortKey(a));
  return out;
};

const formatEvComment = (ev) => {
  const c = ev?.comment != null && String(ev.comment).trim();
  if (c) return c;
  const r = ev?.pause_reason ?? ev?.reason;
  if (r != null && String(r).trim()) return String(r).trim();
  return '';
};

const sessionLineName = (openEv, closeEv) =>
  openEv?.line_name || closeEv?.line_name || openEv?.line || closeEv?.line || '—';

const sessionParams = (openEv, closeEv) => {
  const o = openEv || closeEv;
  const c = closeEv || openEv;
  return {
    height: o?.height != null && o?.height !== '' ? o.height : c?.height,
    width: o?.width != null && o?.width !== '' ? o.width : c?.width,
    angle_deg: o?.angle_deg != null && o?.angle_deg !== '' ? o.angle_deg : c?.angle_deg,
  };
};

const resolveHistoryLineId = (ev, linesList, filterLineId) => {
  if (ev?.line_id != null && ev.line_id !== '') return Number(ev.line_id);
  if (filterLineId != null) return filterLineId;
  const name = (ev?.line_name || ev?.line || '').trim();
  if (!name) return null;
  const hit = linesList.find((l) => l.name === name);
  return hit?.id ?? null;
};

const formatParamsTriple = (ev) => {
  if (!ev) return '—';
  const h = ev.height;
  const w = ev.width;
  const a = ev.angle_deg;
  if (
    (h == null || h === '')
    && (w == null || w === '')
    && (a == null || a === '')
  ) return '—';
  const deg = a != null && a !== '' ? `${a}°` : '—';
  return `${h ?? '—'} × ${w ?? '—'} × ${deg}`;
};

const historyActor = (ev) => {
  if (!ev) return '—';
  return (
    ev.opened_by_name
    || ev.opened_by?.name
    || ev.user_name
    || ev.actor_name
    || ev.created_by_name
    || '—'
  );
};

/** Нормализует ответ бэка к { open, close, updates, pauseResume }. */
const normalizeSessionDetailPayload = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const updates = raw.updates ?? raw.param_updates ?? raw.changes ?? [];
  const pauseResume = raw.pause_resume ?? raw.pauseResume ?? [];
  return {
    open: raw.open ?? null,
    close: raw.close ?? null,
    updates: Array.isArray(updates) ? updates : [],
    pauseResume: Array.isArray(pauseResume) ? pauseResume : [],
  };
};

const LinesPage = () => {
  const toast = useToast();
  const { user } = useAuth();
  const canCreateProductionBatch =
    Boolean(user?.is_superuser) || (Array.isArray(user?.accesses) && user.accesses.includes('production'));
  const [activeTab, setActiveTab] = useState('line');
  const [queryState, setQueryState] = useState({
    page: 1,
    page_size: 20,
    search: '',
    ordering: '',
  });
  const [lineModal, setLineModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  /** null — все линии; иначе фильтр по id */
  const [historyFilterLineId, setHistoryFilterLineId] = useState(null);
  const [historyFeedQuery, setHistoryFeedQuery] = useState({
    page: 1,
    page_size: 20,
  });
  const [historySessionModal, setHistorySessionModal] = useState(null);
  const [historySessionRemote, setHistorySessionRemote] = useState(null);
  const [historySessionRemoteLoading, setHistorySessionRemoteLoading] = useState(false);
  const [historySessionRemoteError, setHistorySessionRemoteError] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [shiftModal, setShiftModal] = useState(null);
  const [productionBatchLine, setProductionBatchLine] = useState(null);

  const { items: lines, meta, loading, error, refetch } = useServerQuery(
    'lines/',
    activeTab === 'line' ? queryState : { page_size: 100 },
    { enabled: activeTab === 'line' || activeTab === 'history' }
  );

  const {
    items: historyFeedItems,
    meta: historyFeedMeta,
    loading: historyFeedLoading,
    error: historyFeedError,
    refetch: refetchHistoryFeed,
  } = useServerQuery(null, historyFeedQuery, {
    enabled: activeTab === 'history' && historyFilterLineId == null,
    fetcher: fetchLinesHistoryPage,
  });

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const [linesWithStatus, setLinesWithStatus] = useState([]);
  const [linesWithStatusLoading, setLinesWithStatusLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    setHistoryFeedQuery((q) => ({ ...q, page: 1 }));
  }, [historyFilterLineId]);

  useEffect(() => {
    if (!historySessionModal || historySessionModal.kind !== 'session') {
      setHistorySessionRemote(null);
      setHistorySessionRemoteError(null);
      setHistorySessionRemoteLoading(false);
      return;
    }
    const o = historySessionModal.open;
    const lineId = resolveHistoryLineId(o, lines, historyFilterLineId);
    if (!lineId || o?.id == null) {
      setHistorySessionRemote(null);
      setHistorySessionRemoteLoading(false);
      return;
    }

    const ac = new AbortController();
    setHistorySessionRemote(null);
    setHistorySessionRemoteError(null);
    setHistorySessionRemoteLoading(true);

    getLineHistorySessionDetail(lineId, o.id, { signal: ac.signal })
      .then((res) => {
        const n = normalizeSessionDetailPayload(res.data);
        setHistorySessionRemote(n);
      })
      .catch((e) => {
        if (e.code === 'ERR_CANCELED' || e.name === 'CanceledError') return;
        setHistorySessionRemote(null);
        const st = e.response?.status;
        const d = e.response?.data;
        const apiMsg = (() => {
          if (!d || typeof d !== 'object') return null;
          if (typeof d.message === 'string' && d.message) return d.message;
          if (d.error && typeof d.error === 'object' && typeof d.error.message === 'string') {
            return d.error.message;
          }
          if (typeof d.error === 'string') return d.error;
          if (typeof d.detail === 'string') return d.detail;
          return null;
        })();
        if (st === 400 || st === 404) {
          setHistorySessionRemoteError(
            apiMsg || (st === 404 ? 'Событие открытия не найдено' : 'Некорректный запрос')
          );
          return;
        }
        if (st && st >= 500) {
          setHistorySessionRemoteError(apiMsg || 'Не удалось загрузить полную историю с сервера');
        }
      })
      .finally(() => {
        setHistorySessionRemoteLoading(false);
      });

    return () => ac.abort();
  }, [historySessionModal, lines, historyFilterLineId]);

  const loadOpeningLines = useCallback(async (syncShiftParams) => {
    setLinesWithStatusLoading(true);
    try {
      const res = await apiClient.get('lines/', { params: { page_size: 100 } });
      const list = res.data?.items || [];
      const hasEmbeddedShift = list.length > 0 && Object.prototype.hasOwnProperty.call(list[0], 'shift_is_open');

      let withStatus;

      if (hasEmbeddedShift) {
        withStatus = list.map((line) => {
          const isOpen = line.shift_is_open === true;
          const snap = line.shift_snapshot || null;
          const isPaused = isOpen && readShiftPausedFromApi(line, snap);
          const pauseReason = isPaused ? readPauseReasonFromApi(line, snap) : '';
          let lastOpenEv = null;
          if (snap?.opened_at) {
            const s = String(snap.opened_at);
            lastOpenEv = {
              action: 'open',
              date: s.length >= 10 ? s.slice(0, 10) : s,
              time: s.length >= 19 ? s.slice(11, 19) : '',
              height: snap.height,
              width: snap.width,
              angle_deg: snap.angle_deg,
              comment: snap.comment,
            };
          }
          return {
            ...line,
            historyItems: [],
            lastEvent: isOpen && lastOpenEv ? lastOpenEv : null,
            isOpen,
            isPaused,
            pauseReason,
            lastOpenEv,
            shiftOpener: shiftOpenerLabel(line, snap),
            lastCloseEv: line.shift_last_closed_at
              ? { action: 'close', date: String(line.shift_last_closed_at).slice(0, 10), time: '' }
              : null,
            shiftSnapshot: isOpen && snap ? { ...snap, ...lastOpenEv } : null,
          };
        });
      } else {
        withStatus = await Promise.all(
          list.map(async (line) => {
            try {
              const h = await apiClient.get(`lines/${line.id}/history/`);
              const items = h.data?.items || [];
              const latest = items[0] || null;
              const isOpen = !!(latest && latest.action !== 'close');
              const isPaused = isOpen && latest && PAUSE_HISTORY_ACTIONS.has(latest.action);
              const pauseReason = isPaused
                ? String(
                  latest.pause_reason ?? latest.reason ?? latest.comment ?? ''
                ).trim()
                : '';
              const paramSnap = items.find(
                (e) =>
                  e
                  && e.action !== 'close'
                  && !PAUSE_HISTORY_ACTIONS.has(e.action)
                  && !RESUME_HISTORY_ACTIONS.has(e.action)
                  && (e.action === 'open' || e.action === 'params_update')
              ) || null;
              const lastOpenEv = items.find((e) => e.action === 'open');
              const lastCloseEv = items.find((e) => e.action === 'close');
              const shiftSnapshot = isOpen
                ? (isPaused ? paramSnap : latest)
                : null;
              return {
                ...line,
                historyItems: items,
                lastEvent: latest,
                isOpen,
                isPaused,
                pauseReason,
                lastOpenEv,
                shiftOpener: shiftOpenerLabel(line, shiftSnapshot),
                lastCloseEv,
                shiftSnapshot,
              };
            } catch {
              return {
                ...line,
                historyItems: [],
                lastEvent: null,
                isOpen: false,
                isPaused: false,
                pauseReason: '',
                lastOpenEv: null,
                shiftOpener: '—',
                lastCloseEv: null,
                shiftSnapshot: null,
              };
            }
          })
        );
      }

      if (syncShiftParams?.lineId != null && syncShiftParams?.payload) {
        withStatus = mergeOpeningRowsAfterShiftParamsSave(
          withStatus,
          syncShiftParams.lineId,
          syncShiftParams.payload
        );
      }

      setLinesWithStatus(withStatus);
    } catch {
      setLinesWithStatus([]);
    } finally {
      setLinesWithStatusLoading(false);
    }
  }, []);

  const refetchLinesOperational = useCallback(() => {
    refetch();
    refetchHistoryFeed();
    if (activeTabRef.current === 'opening') {
      loadOpeningLines();
    }
  }, [refetch, refetchHistoryFeed, loadOpeningLines]);

  useOperationalRefetch(['line', 'line_history', 'shift'], refetchLinesOperational, true);

  useEffect(() => {
    if (activeTab !== 'opening') return;
    loadOpeningLines();
  }, [activeTab, loadOpeningLines]);

  useEffect(() => {
    if (activeTab !== 'history' || historyFilterLineId == null) {
      setHistoryItems([]);
      setHistoryLoading(false);
      return;
    }

    const ac = new AbortController();
    const { signal } = ac;

    const load = async () => {
      setHistoryLoading(true);
      try {
        const res = await getLineHistory(historyFilterLineId, { signal });
        if (!signal.aborted) setHistoryItems(res.data?.items || []);
      } catch (e) {
        if (e.code !== 'ERR_CANCELED' && e.name !== 'CanceledError' && !signal.aborted) {
          setHistoryItems([]);
        }
      } finally {
        if (!signal.aborted) setHistoryLoading(false);
      }
    };

    load();
    return () => ac.abort();
  }, [activeTab, historyFilterLineId]);

  const handleFilterChange = useCallback((patch) => {
    setQueryState((prev) => ({ ...prev, ...patch, page: 1 }));
  }, []);

  const handlePageChange = useCallback((page) => {
    setQueryState((prev) => ({ ...prev, page }));
  }, []);

  const handleHistoryFeedPageChange = useCallback((page) => {
    setHistoryFeedQuery((prev) => ({ ...prev, page }));
  }, []);

  const historySourceItems = historyFilterLineId != null ? historyItems : historyFeedItems;
  const historyViewRows = useMemo(
    () => buildLineHistorySessionRows(historySourceItems),
    [historySourceItems]
  );
  const historyBusy = historyFilterLineId != null ? historyLoading : historyFeedLoading;

  const handleLineSubmit = async (data) => {
    setSubmitError('');
    try {
      if (lineModal?.id) {
        await updateLine(lineModal.id, data);
      } else {
        await createLine(data);
      }
      setLineModal(null);
      refetch();
      refetchHistoryFeed();
      toast.success('Успешно сохранено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitError('');
    try {
      await deleteLine(deleteTarget.id);
      setDeleteTarget(null);
      refetch();
      refetchHistoryFeed();
      toast.success('Успешно удалено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка удаления');
    }
  };

  const handleShiftModalSubmit = async (form) => {
    if (!shiftModal) return;
    const { type, line } = shiftModal;
    setSubmitError('');

    if (type === 'open') {
      const payload = buildPayload(form);
      if (!payload) {
        setSubmitError('Укажите числа: высота, ширина, градус');
        return;
      }
      const sessionTitle = String(form?.session_title ?? '').trim();
      try {
        await openShift(line.id, {
          ...payload,
          ...(sessionTitle ? { session_title: sessionTitle } : {}),
        });
        setShiftModal(null);
        await loadOpeningLines();
        refetch();
        refetchHistoryFeed();
        toast.success('Смена открыта');
      } catch (err) {
        const msg = getApiErrorMessage(err, 'Ошибка открытия смены на линии');
        const st = err.response?.status;
        if (st === 409 || /открытая смена|уже есть открыта/i.test(String(msg))) {
          setSubmitError(
            `${msg} Обновите страницу. Личная смена («Моя смена») линию не блокирует; конфликт — только если на этой линии у вас уже открыта смена на линии.`,
          );
        } else {
          setSubmitError(msg);
        }
      }
      return;
    }

    if (type === 'close') {
      const payload = buildPayload(form);
      if (!payload) {
        setSubmitError('Укажите числа: высота, ширина, градус');
        return;
      }
      try {
        await closeShift(line.id, payload);
        setShiftModal(null);
        await loadOpeningLines();
        refetch();
        refetchHistoryFeed();
        toast.success('Смена закрыта');
      } catch (err) {
        setSubmitError(getApiErrorMessage(err, 'Ошибка закрытия смены на линии'));
      }
      return;
    }

    if (type === 'params') {
      const payload = buildPayload(form);
      if (!payload) {
        setSubmitError('Укажите числа: высота, ширина, градус');
        return;
      }
      try {
        await updateShiftParams(line.id, payload);
        setShiftModal(null);
        await loadOpeningLines({ lineId: line.id, payload });
        refetch();
        refetchHistoryFeed();
        toast.success('Параметры обновлены');
      } catch (err) {
        setSubmitError(getApiErrorMessage(err, 'Ошибка обновления параметров'));
      }
      return;
    }

    if (type === 'pause') {
      const reason = String(form?.reason ?? '').trim();
      if (!reason) {
        setSubmitError('Укажите причину остановки');
        return;
      }
      try {
        await pauseLineShift(line.id, { reason });
        setShiftModal(null);
        await loadOpeningLines();
        refetch();
        refetchHistoryFeed();
        toast.success('Смена остановлена');
      } catch (err) {
        setSubmitError(getApiErrorMessage(err, 'Ошибка паузы смены'));
      }
      return;
    }

    if (type === 'resume') {
      try {
        await resumeLineShift(line.id);
        setShiftModal(null);
        await loadOpeningLines();
        refetch();
        refetchHistoryFeed();
        toast.success('Смена возобновлена');
      } catch (err) {
        setSubmitError(getApiErrorMessage(err, 'Ошибка возобновления смены'));
      }
      return;
    }
  };

  const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr) return '—';
    const t = timeStr ? ` ${timeStr}` : '';
    return `${dateStr}${t}`;
  };

  const formatParamsShort = (ev) => {
    if (!ev || (ev.height == null && ev.width == null && ev.angle_deg == null)) return '—';
    const h = ev.height ?? '—';
    const w = ev.width ?? '—';
    const a = ev.angle_deg ?? '—';
    return `${h} × ${w} × ${a}°`;
  };

  const renderOpeningRowActions = (l) => {
    const pushShift = (type, more = {}) => {
      setSubmitError('');
      setShiftModal({
        type,
        line: l,
        modalKey: Date.now(),
        ...more,
      });
    };

    if (!l.isOpen) {
      return (
        <div className="lines-table__actions lines-table__actions--compact">
          <button
            type="button"
            className="btn btn--open btn--sm"
            disabled={!lineIsActive(l)}
            title={!lineIsActive(l) ? 'Сначала активируйте линию' : undefined}
            onClick={() => {
              if (!lineIsActive(l)) return;
              pushShift('open', { initial: emptyParams() });
            }}
          >
            Открыть
          </button>
        </div>
      );
    }

    const secondaryParams = (
      <button
        type="button"
        className="btn btn--secondary btn--sm"
        onClick={() => pushShift('params', { initial: eventToForm(l.shiftSnapshot) })}
      >
        Параметры
      </button>
    );

    if (l.isPaused) {
      const menuItems = [
        {
          label: 'Закрыть смену',
          onClick: () => pushShift('close', { initial: eventToForm(l.shiftSnapshot) }),
        },
      ];
      return (
        <div className="lines-table__actions lines-table__actions--compact">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => pushShift('resume')}
          >
            Возобновить
          </button>
          {secondaryParams}
          <ActionMenu items={menuItems} ariaLabel="Ещё" />
        </div>
      );
    }

    const menuItems = [
      {
        label: 'Остановить',
        onClick: () => pushShift('pause'),
      },
    ];
    if (canCreateProductionBatch) {
      menuItems.push({
        label: 'Закрыть смену',
        onClick: () => pushShift('close', { initial: eventToForm(l.shiftSnapshot) }),
      });
    }

    const primary = canCreateProductionBatch ? (
      <button
        type="button"
        className="btn btn--primary btn--sm"
        onClick={() => {
          setSubmitError('');
          setProductionBatchLine(l);
        }}
      >
        Партия
      </button>
    ) : (
      <button
        type="button"
        className="btn btn--primary btn--sm"
        onClick={() => pushShift('close', { initial: eventToForm(l.shiftSnapshot) })}
      >
        Закрыть
      </button>
    );

    return (
      <div className="lines-table__actions lines-table__actions--compact">
        {primary}
        {secondaryParams}
        <ActionMenu items={menuItems} ariaLabel="Ещё" />
      </div>
    );
  };

  return (
    <div className="page page--lines">
      <div className="lines-tabs">
        <button
          type="button"
          className={`lines-tabs__tab ${activeTab === 'line' ? 'lines-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('line')}
        >
          Линия
        </button>
        <button
          type="button"
          className={`lines-tabs__tab ${activeTab === 'opening' ? 'lines-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('opening')}
        >
          Открытие
        </button>
        <button
          type="button"
          className={`lines-tabs__tab ${activeTab === 'history' ? 'lines-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          История
        </button>
      </div>

      {activeTab === 'line' && (
        <div className="lines-card">
          <div className="lines-toolbar">
            <div className="lines-toolbar__left">
              <input
                type="text"
                className="lines-toolbar__search"
                placeholder="Поиск…"
                value={queryState.search || ''}
                onChange={(e) => handleFilterChange({ search: e.target.value })}
                aria-label="Поиск"
              />
            </div>
            <div className="lines-toolbar__right">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => { setSubmitError(''); setLineModal({}); }}
              >
                Создать
              </button>
            </div>
          </div>
          {loading && <Loading />}
          {error && <ErrorState error={error} onRetry={refetch} />}
          {!loading && !error && (
            <>
              {lines.length === 0 ? (
                <EmptyState title="Нет данных" />
              ) : (
                <div className="lines-table lines-table--lines">
                  <div className="lines-table__header">
                    <span className="lines-table__th">Название</span>
                    <span className="lines-table__th">Код</span>
                    <span className="lines-table__th">Статус</span>
                    <span className="lines-table__th lines-table__th--actions">Действия</span>
                  </div>
                  {lines.map((line) => (
                    <div key={line.id} className="lines-table__row">
                      <span className="lines-table__name">{line.name}</span>
                      <span className="lines-table__muted">{line.code ?? line.line_code ?? '—'}</span>
                      <span>
                        <span
                          className={`lines-table__badge lines-table__badge--compact ${lineIsActive(line) ? 'lines-table__badge--open' : 'lines-table__badge--closed'}`}
                        >
                          {lineIsActive(line) ? 'Активна' : 'Выкл'}
                        </span>
                      </span>
                      <div className="lines-table__actions lines-table__actions--compact">
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          onClick={() => { setSubmitError(''); setLineModal(line); }}
                        >
                          Редактировать
                        </button>
                        <ActionMenu
                          ariaLabel="Ещё"
                          items={[
                            {
                              label: 'Удалить',
                              danger: true,
                              onClick: () => setDeleteTarget({ id: line.id, name: line.name }),
                            },
                          ]}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {meta && meta.total_pages > 1 && (
                <div className="lines-card__pagination">
                  <button type="button" className="btn btn--sm" onClick={() => handlePageChange(meta.page - 1)} disabled={meta.page <= 1}>←</button>
                  <span>Страница {meta.page} из {meta.total_pages}</span>
                  <button type="button" className="btn btn--sm" onClick={() => handlePageChange(meta.page + 1)} disabled={meta.page >= meta.total_pages}>→</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'opening' && (
        <div className="lines-card">
          {linesWithStatusLoading && <Loading />}
          {!linesWithStatusLoading && (
            <>
              {linesWithStatus.length === 0 ? (
                <EmptyState title="Нет данных" />
              ) : (
                <div className="lines-table-scroll">
                  <div className="lines-table lines-table--opening">
                    <div className="lines-table__header">
                      <span className="lines-table__th">Линия</span>
                      <span className="lines-table__th">Статус</span>
                      <span className="lines-table__th">Смена</span>
                      <span className="lines-table__th">Параметры</span>
                      <span className="lines-table__th">Открыто</span>
                      <span className="lines-table__th lines-table__th--actions">Действия</span>
                    </div>
                    {linesWithStatus.map((l) => (
                      <div key={l.id} className="lines-table__row">
                        <span className="lines-table__name">{l.name}</span>
                        <span>
                          <span
                            className={`lines-table__badge lines-table__badge--compact ${lineIsActive(l) ? 'lines-table__badge--open' : 'lines-table__badge--closed'}`}
                          >
                            {lineIsActive(l) ? 'Активна' : 'Выкл'}
                          </span>
                        </span>
                        <span>
                          <span
                            className={`lines-table__badge lines-table__badge--compact ${
                              !l.isOpen
                                ? 'lines-table__badge--closed'
                                : l.isPaused
                                  ? 'lines-table__badge--paused'
                                  : 'lines-table__badge--open'
                            }`}
                            title={l.isPaused && l.pauseReason ? l.pauseReason : undefined}
                          >
                            {!l.isOpen ? 'Закрыта' : l.isPaused ? 'Пауза' : 'Открыта'}
                          </span>
                        </span>
                        <span className="lines-table__params lines-table__params--compact" title={l.isOpen ? l.shiftOpener : undefined}>
                          {l.isOpen ? formatParamsShort(l.shiftSnapshot) : '—'}
                        </span>
                        <span className="lines-table__date lines-table__date--compact">
                          {formatDateTime(l.lastOpenEv?.date, l.lastOpenEv?.time)}
                        </span>
                        {renderOpeningRowActions(l)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {submitError && activeTab === 'opening' && !shiftModal && (
            <p className="lines-card__error">{submitError}</p>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="lines-card">
          <div className="lines-toolbar">
            <div className="lines-toolbar__left">
              <Select
                className="lines-toolbar__select dias-select"
                value={historyFilterLineId != null ? String(historyFilterLineId) : ''}
                onChange={(v) => setHistoryFilterLineId(v ? Number(v) : null)}
                placeholder="Все линии"
                aria-label="Фильтр по линии"
                options={[
                  { value: '', label: 'Все линии' },
                  ...lines.map((l) => ({ value: String(l.id), label: l.name })),
                ]}
              />
            </div>
            <div className="lines-toolbar__right" aria-hidden="true" />
          </div>
          {error && <ErrorState error={error} onRetry={refetch} />}
          {historyFilterLineId == null && historyFeedError && (
            <ErrorState error={historyFeedError} onRetry={refetchHistoryFeed} />
          )}
          {historyBusy && <Loading />}
          {!historyBusy
            && (historyFilterLineId != null || !historyFeedError)
            && (historyFilterLineId != null || lines.length > 0 || historyFeedMeta != null) && (
            <>
              {historySourceItems.length === 0 ? (
                <EmptyState title="Нет данных" />
              ) : (
                <>
                  <div className="lines-table-scroll">
                    <div className="lines-table lines-table--history-compact">
                      <div className="lines-table__header">
                        <span className="lines-table__th">Дата</span>
                        <span className="lines-table__th">Линия</span>
                        <span className="lines-table__th">Событие</span>
                        <span className="lines-table__th">Параметры</span>
                        <span className="lines-table__th">Кто</span>
                      </div>
                      {historyViewRows.map((row) => {
                        if (row.kind === 'session') {
                          const { open: o, close: c, paramUpdates } = row;
                          const p = sessionParams(o, c);
                          return (
                            <div
                              key={`sess-${row.lineKey}-${o?.id}-${c?.id ?? 'open'}`}
                              role="button"
                              tabIndex={0}
                              className="lines-table__row lines-table__row--clickable"
                              onClick={() => setHistorySessionModal({
                                kind: 'session',
                                open: o,
                                close: c,
                                paramUpdates,
                              })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setHistorySessionModal({
                                    kind: 'session',
                                    open: o,
                                    close: c,
                                    paramUpdates,
                                  });
                                }
                              }}
                            >
                              <span className="lines-table__date lines-table__date--compact">
                                {formatDateTime(o?.date, o?.time)}
                              </span>
                              <span className="lines-table__name lines-table__name--clip">{sessionLineName(o, c)}</span>
                              <span>
                                <span className={`lines-table__badge lines-table__badge--compact ${c ? 'lines-table__badge--closed' : 'lines-table__badge--open'}`}>
                                  {c ? 'Смена' : 'Открыта'}
                                </span>
                              </span>
                              <span className="lines-table__params lines-table__params--compact">{formatParamsTriple(p)}</span>
                              <span className="lines-table__cell-clip" title={historyActor(o)}>{historyActor(o)}</span>
                            </div>
                          );
                        }
                        const h = row.event;
                        const badgeAction = h.action || 'x';
                        return (
                          <div
                            key={`one-${row.lineKey}-${h.id}`}
                            role="button"
                            tabIndex={0}
                            className="lines-table__row lines-table__row--clickable"
                            onClick={() => setHistorySessionModal({ kind: 'single', event: h })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setHistorySessionModal({ kind: 'single', event: h });
                              }
                            }}
                          >
                            <span className="lines-table__date lines-table__date--compact">
                              {formatDateTime(h.date, h.time)}
                            </span>
                            <span className="lines-table__name lines-table__name--clip">{h.line_name || h.line || '—'}</span>
                            <span>
                              <span className={`lines-table__badge lines-table__badge--compact lines-table__badge--action-${badgeAction}`}>
                                {actionLabel(h.action)}
                              </span>
                            </span>
                            <span className="lines-table__params lines-table__params--compact">{formatParamsTriple(h)}</span>
                            <span className="lines-table__cell-clip" title={historyActor(h)}>{historyActor(h)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {historyFilterLineId == null && (
                    <Pagination meta={historyFeedMeta} onPageChange={handleHistoryFeedPageChange} />
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {lineModal && (
        <LineFormModal
          line={lineModal?.id ? lineModal : null}
          onSubmit={handleLineSubmit}
          onClose={() => { setLineModal(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      {shiftModal && (shiftModal.type === 'open' || shiftModal.type === 'close' || shiftModal.type === 'params') && (
        <ShiftParamsModal
          key={shiftModal.modalKey}
          type={shiftModal.type}
          lineName={shiftModal.line.name}
          initial={shiftModal.initial}
          onSubmit={handleShiftModalSubmit}
          onClose={() => { setShiftModal(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      {shiftModal && shiftModal.type === 'pause' && (
        <ShiftPauseModal
          key={shiftModal.modalKey}
          lineName={shiftModal.line.name}
          onSubmit={handleShiftModalSubmit}
          onClose={() => { setShiftModal(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      {shiftModal && shiftModal.type === 'resume' && (
        <ShiftResumeModal
          key={shiftModal.modalKey}
          lineName={shiftModal.line.name}
          onSubmit={handleShiftModalSubmit}
          onClose={() => { setShiftModal(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      {productionBatchLine && (
        <ProductionBatchModal
          lineId={productionBatchLine.id}
          lineName={productionBatchLine.name}
          onClose={() => setProductionBatchLine(null)}
          onSuccess={() => {
            toast.success('Партия создана');
            loadOpeningLines();
            refetch();
          }}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить линию?"
        message={deleteTarget ? `Удалить "${deleteTarget.name}"?` : ''}
        confirmText="Удалить"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {historySessionModal && (
        <LineHistorySessionModal
          snapshot={historySessionModal}
          remote={historySessionRemote}
          remoteLoading={historySessionRemoteLoading}
          remoteError={historySessionRemoteError}
          formatDateTime={formatDateTime}
          onClose={() => {
            setHistorySessionModal(null);
            setHistorySessionRemote(null);
            setHistorySessionRemoteError(null);
          }}
        />
      )}
    </div>
  );
};

const LineHistorySessionModal = ({
  snapshot,
  remote,
  remoteLoading,
  remoteError,
  formatDateTime: fd,
  onClose,
}) => {
  if (!snapshot) return null;

  const block = (title, ev, extra) => {
    if (!ev) return null;
    return (
      <section className="lines-history-detail__block">
        <h4 className="lines-history-detail__block-title">{title}</h4>
        <p className="lines-history-detail__time">{fd(ev.date, ev.time)}</p>
        <dl className="lines-history-detail__params">
          <div><dt>Высота</dt><dd>{ev.height != null && ev.height !== '' ? ev.height : '—'}</dd></div>
          <div><dt>Ширина</dt><dd>{ev.width != null && ev.width !== '' ? ev.width : '—'}</dd></div>
          <div><dt>Градус</dt><dd>{ev.angle_deg != null && ev.angle_deg !== '' ? `${ev.angle_deg}°` : '—'}</dd></div>
        </dl>
        {ev.session_title ? (
          <p className="lines-history-detail__meta">Смена: {ev.session_title}</p>
        ) : null}
        {formatEvComment(ev) ? (
          <p className="lines-history-detail__comment">{formatEvComment(ev)}</p>
        ) : null}
        {extra}
      </section>
    );
  };

  if (snapshot.kind === 'single') {
    const ev = snapshot.event;
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal modal--wide lines-history-detail-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal__head">
            <h3>Событие: {actionLabel(ev.action)}</h3>
            <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
          </div>
          <div className="modal__body lines-history-detail">
            <p className="lines-history-detail__line">{ev.line_name || ev.line || '—'}</p>
            {block(actionLabel(ev.action), ev)}
          </div>
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Закрыть</button>
          </div>
        </div>
      </div>
    );
  }

  const hasRemote = remote != null;
  const displayOpen = hasRemote ? (remote.open ?? snapshot.open) : snapshot.open;
  const displayClose = hasRemote ? (remote.close ?? null) : snapshot.close;
  const displayUpdates = hasRemote ? (remote.updates ?? []) : (snapshot.paramUpdates ?? []);
  const displayPauseResume = hasRemote ? (remote.pauseResume ?? []) : (snapshot.pauseResume ?? []);
  const lineTitle = sessionLineName(displayOpen, displayClose);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal--wide lines-history-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h3>Параметры смены</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="modal__body lines-history-detail">
          {remoteLoading && (
            <p className="lines-history-detail__hint">Загрузка полной истории с сервера…</p>
          )}
          {remoteError && (
            <p className="lines-history-detail__warn">{remoteError}</p>
          )}
          {!hasRemote && !remoteLoading && !remoteError && (
            <p className="lines-history-detail__hint">Загружается полная история…</p>
          )}
          <p className="lines-history-detail__line">{lineTitle}</p>

          {block('Открытие', displayOpen)}

          {displayUpdates.length > 0 && (
            <section className="lines-history-detail__block">
              <h4 className="lines-history-detail__block-title">
                Изменения параметров во время работы ({displayUpdates.length})
              </h4>
              <ol className="lines-history-detail__updates">
                {displayUpdates.map((u) => (
                  <li key={u.id} className="lines-history-detail__update-item">
                    <span className="lines-history-detail__time">{fd(u.date, u.time)}</span>
                    <span className="lines-history-detail__param-line">{formatParamsTriple(u)}</span>
                    {formatEvComment(u) ? (
                      <span className="lines-history-detail__comment">{formatEvComment(u)}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {displayPauseResume.length > 0 && (
            <section className="lines-history-detail__block">
              <h4 className="lines-history-detail__block-title">
                Остановки и возобновления ({displayPauseResume.length})
              </h4>
              <ol className="lines-history-detail__updates">
                {displayPauseResume.map((ev, idx) => (
                  <li
                    key={ev.id != null ? ev.id : `pr-${idx}-${ev.date}-${ev.time}`}
                    className="lines-history-detail__update-item"
                  >
                    <span className="lines-history-detail__time">{fd(ev.date, ev.time)}</span>
                    <span className="lines-history-detail__param-line">{actionLabel(ev.action)}</span>
                    {formatEvComment(ev) ? (
                      <span className="lines-history-detail__comment">{formatEvComment(ev)}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {displayClose
            ? block('Закрытие', displayClose)
            : (
              <section className="lines-history-detail__block lines-history-detail__block--open">
                <h4 className="lines-history-detail__block-title">Закрытие</h4>
                <p className="lines-history-detail__session-open-label">Смена ещё открыта</p>
              </section>
            )}
        </div>
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
};

const LineFormModal = ({ line, onSubmit, onClose, error }) => {
  const [name, setName] = useState(line?.name ?? '');
  const [code, setCode] = useState(line?.code ?? line?.line_code ?? '');
  const [notes, setNotes] = useState(line?.notes ?? line?.comment ?? '');
  const [isActive, setIsActive] = useState(lineIsActive(line));

  useEffect(() => {
    setName(line?.name ?? '');
    setCode(line?.code ?? line?.line_code ?? '');
    setNotes(line?.notes ?? line?.comment ?? '');
    setIsActive(lineIsActive(line));
  }, [line?.id, line]);

  const isDirty = useDirtyFromBaseline(line?.id != null ? String(line.id) : 'new', false, {
    name: name.trim(),
    code: String(code ?? '').trim(),
    notes: String(notes ?? '').trim(),
    isActive,
  });
  const {
    requestClose,
    discardConfirmOpen,
    confirmDiscardAndClose,
    cancelDiscard,
  } = useDiscardOnClose(onClose, isDirty);

  return (
    <div className="modal-overlay" onClick={requestClose}>
      <ConfirmModal
        open={discardConfirmOpen}
        title="Закрыть без сохранения?"
        message="Введённые данные не будут сохранены."
        confirmText="Закрыть"
        onConfirm={confirmDiscardAndClose}
        onCancel={cancelDiscard}
      />
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{line ? 'Редактировать линию' : 'Добавить линию'}</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              name: name.trim(),
              code: String(code ?? '').trim() || undefined,
              comment: String(notes ?? '').trim() || undefined,
              is_active: isActive,
            });
          }}
        >
          <label>Название линии *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Например: Линия 1" />
          <label>Код / номер линии</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Внутренний код" autoComplete="off" />
          <label className="lines-form__check">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Линия активна (на неактивной нельзя открыть смену)
          </label>
          <Collapse title="Комментарий">
            <label>Комментарий</label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Заметки" />
          </Collapse>
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={requestClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ShiftPauseModal = ({ lineName, onSubmit, onClose, error }) => {
  const [reason, setReason] = useState('');

  const isDirty = useDirtyFromBaseline(`pause-${lineName}`, false, {
    reason: reason.trim(),
  });
  const {
    requestClose,
    discardConfirmOpen,
    confirmDiscardAndClose,
    cancelDiscard,
  } = useDiscardOnClose(onClose, isDirty);

  return (
    <div className="modal-overlay" onClick={requestClose}>
      <ConfirmModal
        open={discardConfirmOpen}
        title="Закрыть без сохранения?"
        message="Введённые данные не будут сохранены."
        confirmText="Закрыть"
        onConfirm={confirmDiscardAndClose}
        onCancel={cancelDiscard}
      />
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()} style={{ padding: 0 }}>
        <div className="modal__head">
          <h3>Остановить смену: {lineName}</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        <form
          className="lines-shift-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ reason });
          }}
        >
          <p className="lines-shift-form__hint">
            Укажите причину остановки — без неё остановить смену нельзя.
          </p>
          <label htmlFor="lines-shift-pause-reason">Причина остановки *</label>
          <textarea
            id="lines-shift-pause-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Например: поломка оборудования, переналадка…"
            rows={4}
            required
            aria-required="true"
          />
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={requestClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Остановить смену</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ShiftResumeModal = ({ lineName, onSubmit, onClose, error }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal modal--wide" onClick={(e) => e.stopPropagation()} style={{ padding: 0 }}>
      <div className="modal__head">
        <h3>Возобновить смену: {lineName}</h3>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
      </div>
      <div className="lines-shift-form">
        <p className="lines-shift-form__hint">
          Линия снова перейдёт в статус «Смена открыта».
        </p>
        {error && <p className="modal__error">{error}</p>}
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onSubmit({})}
          >
            Возобновить
          </button>
        </div>
      </div>
    </div>
  </div>
);

const ShiftParamsModal = ({
  type,
  lineName,
  initial,
  onSubmit,
  onClose,
  error,
}) => {
  const [form, setForm] = useState(() => ({ ...emptyParams(), ...initial }));

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const titles = {
    open: 'Открыть смену',
    close: 'Закрыть смену',
    params: 'Параметры линии',
  };

  const isDirty = useDirtyFromBaseline(`${type}-${lineName}`, false, {
    height: String(form.height ?? '').trim(),
    width: String(form.width ?? '').trim(),
    angle_deg: String(form.angle_deg ?? '').trim(),
    comment: String(form.comment ?? '').trim(),
    session_title: String(form.session_title ?? '').trim(),
  });
  const {
    requestClose,
    discardConfirmOpen,
    confirmDiscardAndClose,
    cancelDiscard,
  } = useDiscardOnClose(onClose, isDirty);

  return (
    <div className="modal-overlay" onClick={requestClose}>
      <ConfirmModal
        open={discardConfirmOpen}
        title="Закрыть без сохранения?"
        message="Введённые данные не будут сохранены."
        confirmText="Закрыть"
        onConfirm={confirmDiscardAndClose}
        onCancel={cancelDiscard}
      />
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()} style={{ padding: 0 }}>
        <div className="modal__head">
          <h3>{titles[type]}: {lineName}</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        <form
          className="lines-shift-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
        >
          {type === 'open' && (
            <>
              <label>Название смены / сессии</label>
              <input
                type="text"
                value={form.session_title ?? ''}
                onChange={(e) => setField('session_title', e.target.value)}
                placeholder="Необязательно"
                autoComplete="off"
              />
            </>
          )}
          <label>Высота *</label>
          <DecimalInput
            min={0}
            value={form.height}
            onChange={(v) => setField('height', v)}
            required
            placeholder="0"
          />
          <label>Ширина *</label>
          <DecimalInput
            min={0}
            value={form.width}
            onChange={(v) => setField('width', v)}
            required
            placeholder="0"
          />
          <label>Градус (°) *</label>
          <DecimalInput
            value={form.angle_deg}
            onChange={(v) => setField('angle_deg', v)}
            required
            placeholder="0"
          />
          <label>Комментарий</label>
          <textarea
            value={form.comment}
            onChange={(e) => setField('comment', e.target.value)}
            placeholder="Комментарий к событию"
            rows={3}
          />
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={requestClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">
              {type === 'open' ? 'Открыть' : type === 'close' ? 'Закрыть и сохранить' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LinesPage;

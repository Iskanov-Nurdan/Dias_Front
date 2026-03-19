import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../../auth';
import { useToast } from '../../../../shared/ui';
import {
  getMyShift, openShift, closeShift,
  addShiftNote, getMyShiftNotes,
  getMyShiftHistory, getMyActivity, getShiftDetails,
} from '../../api/shiftsApi';
import './MyShiftPage.scss';

const extractErrMsg = (err, fallback) => {
  const d = err?.response?.data;
  if (!d) return fallback;
  const raw = d.error ?? d.detail ?? d.message ?? d;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw !== null) return raw.message ?? raw.detail ?? fallback;
  return fallback;
};

const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0 ч 0 мин';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h} ч ${m} мин`;
  if (m > 0) return `${m} мин ${s} сек`;
  return `${s} сек`;
};

const formatDateTime = (dt) => {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dt; }
};

const formatTime = (dt) => {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch { return dt; }
};

const formatDate = (dt) => {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleDateString('ru-RU', {
      weekday: 'short', day: 'numeric', month: 'long',
    });
  } catch { return dt; }
};

const calcDuration = (start, end) => {
  if (!start) return 0;
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  return Math.floor((e - s) / 1000);
};

const ACTION_LABELS = {
  create: 'Создал',
  update: 'Изменил',
  delete: 'Удалил',
  view: 'Просмотрел',
};

const ACTION_COLORS = {
  create: 'var(--success)',
  update: 'var(--accent)',
  delete: 'var(--danger)',
  view: 'var(--text-muted)',
};

// ── Icons ─────────────────────────────────────────────────────
const NoteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);
const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
  </svg>
);
const StopIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6"/>
  </svg>
);
const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const ChevronUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
);
const ActivityIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const HistoryIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.68"/>
  </svg>
);

// ── MyShiftPage ───────────────────────────────────────────────
const MyShiftPage = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('current');

  // Tab 1 — current shift
  const [shift, setShift] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [closeNote, setCloseNote] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const timerRef = useRef(null);

  // Tab 2 — shift history
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [expandedShift, setExpandedShift] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState({});
  const [expandedNotesLoading, setExpandedNotesLoading] = useState({});

  // Per-shift activity modal
  const [shiftActivityModal, setShiftActivityModal] = useState(null);
  // shiftActivityModal = { shift, items: [], loading: false }

  // ── Load current shift ──────────────────────────────────────
  const loadShift = useCallback(async () => {
    try {
      const res = await getMyShift();
      const data = res.data;
      // Backend returns {"shift": {...}} or {"shift": null}
      const shift = Object.prototype.hasOwnProperty.call(data, 'shift') ? data.shift : (data || null);
      setShift(shift);
    } catch (err) {
      if (err.response?.status === 404) setShift(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNotes = useCallback(async () => {
    try {
      const res = await getMyShiftNotes();
      const data = res.data;
      setNotes(Array.isArray(data) ? data : (data.items || data.results || []));
    } catch {
      setNotes([]);
    }
  }, []);

  useEffect(() => {
    loadShift();
    loadNotes();
  }, [loadShift, loadNotes]);

  const shiftOpenedAt = shift?.opened_at || shift?.started_at;

  useEffect(() => {
    if (shift?.status === 'open' && shiftOpenedAt) {
      const updateElapsed = () => {
        setElapsed(Math.floor((Date.now() - new Date(shiftOpenedAt).getTime()) / 1000));
      };
      updateElapsed();
      timerRef.current = setInterval(updateElapsed, 1000);
    } else {
      setElapsed(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [shift, shiftOpenedAt]);

  // ── Load history ────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await getMyShiftHistory({ page_size: 50 });
      const data = res.data;
      setHistory(Array.isArray(data) ? data : (data.items || data.results || []));
      setHistoryLoaded(true);
    } catch {
      setHistory([]);
      setHistoryLoaded(true);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // ── Open per-shift activity modal ──────────────────────────
  const openShiftActivity = async (s) => {
    setShiftActivityModal({ shift: s, items: [], loading: true });
    try {
      const res = await getMyActivity({ shift_id: s.id, page_size: 100 });
      const data = res.data;
      const items = Array.isArray(data) ? data : (data.items || data.results || []);
      setShiftActivityModal({ shift: s, items, loading: false });
    } catch {
      setShiftActivityModal({ shift: s, items: [], loading: false });
    }
  };

  useEffect(() => {
    if (activeTab === 'history' && !historyLoaded) loadHistory();
  }, [activeTab, historyLoaded, loadHistory]);

  // ── Expand shift details with notes ────────────────────────
  const toggleShiftExpand = async (shiftId) => {
    if (expandedShift === shiftId) {
      setExpandedShift(null);
      return;
    }
    setExpandedShift(shiftId);
    if (expandedNotes[shiftId] !== undefined) return;
    setExpandedNotesLoading((prev) => ({ ...prev, [shiftId]: true }));
    try {
      const res = await getShiftDetails(shiftId);
      const d = res.data;
      const notes =
        d.notes ??
        d.items ??
        d.results ??
        d.shift?.notes ??
        [];
      setExpandedNotes((prev) => ({ ...prev, [shiftId]: Array.isArray(notes) ? notes : [] }));
    } catch {
      setExpandedNotes((prev) => ({ ...prev, [shiftId]: [] }));
    } finally {
      setExpandedNotesLoading((prev) => ({ ...prev, [shiftId]: false }));
    }
  };

  // ── Shift actions ───────────────────────────────────────────
  const handleOpenShift = async () => {
    setActionLoading(true);
    try {
      const res = await openShift();
      const data = res.data;
      const opened = Object.prototype.hasOwnProperty.call(data, 'shift') ? data.shift : (data || null);
      setShift(opened);
      await loadNotes();
      toast.show('Смена открыта');
    } catch (err) {
      toast.show(extractErrMsg(err, 'Ошибка открытия смены'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseShift = async () => {
    setActionLoading(true);
    try {
      const res = await closeShift(closeNote ? { comment: closeNote } : {});
      // Immediately mark shift as closed in UI
      const closedShift = res?.data?.shift ?? res?.data ?? null;
      if (closedShift) {
        setShift(closedShift);
      } else {
        setShift(null);
      }
      setNotes([]);
      setShowCloseModal(false);
      setCloseNote('');
      setHistoryLoaded(false);
      setHistory([]);
      toast.show('Смена закрыта');
      // Sync from server in background
      loadShift().catch(() => {});
    } catch (err) {
      toast.show(extractErrMsg(err, 'Ошибка закрытия смены'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    const text = noteText.trim();
    if (!text) return;
    setNoteLoading(true);
    try {
      await addShiftNote(text);
      setNoteText('');
      await loadNotes();
      toast.show('Заметка добавлена');
    } catch (err) {
      toast.show(extractErrMsg(err, 'Ошибка добавления заметки'), 'error');
    } finally {
      setNoteLoading(false);
    }
  };

  const isOpen = shift != null && (
    ['open', 'opened', 'active'].includes(shift?.status) ||
    (shift?.opened_at && !shift?.closed_at)
  );
  const displayName = user?.name || user?.username || 'Сотрудник';
  const roleName = user?.role_name || user?.role?.name || '';
  const today = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  if (loading) {
    return (
      <div className="page my-shift-page">
        <div className="my-shift__loading">
          <div className="my-shift__spinner" />
          <span>Загрузка...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page my-shift-page">
      {/* Header */}
      <div className="my-shift__header">
        <div>
          <h1 className="my-shift__greeting">Привет, {displayName}!</h1>
          {roleName && <p className="my-shift__role">{roleName}</p>}
          <p className="my-shift__date">{today}</p>
        </div>
        <div className={`my-shift__status-badge my-shift__status-badge--${isOpen ? 'open' : 'closed'}`}>
          <span className="my-shift__status-dot" />
          {isOpen ? 'Смена открыта' : 'Смена закрыта'}
        </div>
      </div>

      {/* Tabs */}
      <div className="my-shift__tabs">
        <button
          type="button"
          className={`my-shift__tab${activeTab === 'current' ? ' my-shift__tab--active' : ''}`}
          onClick={() => setActiveTab('current')}
        >
          <ClockIcon />
          Текущая смена
        </button>
        <button
          type="button"
          className={`my-shift__tab${activeTab === 'history' ? ' my-shift__tab--active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <HistoryIcon />
          История смен
        </button>
      </div>

      {/* ── TAB 1: Current shift ── */}
      {activeTab === 'current' && (
        <>
          {!isOpen ? (
            <div className="my-shift__start-card">
              <div className="my-shift__start-icon"><PlayIcon /></div>
              <h2 className="my-shift__start-title">Начать рабочий день</h2>
              <p className="my-shift__start-desc">
                Откройте смену, чтобы зафиксировать начало работы. Вы сможете добавлять заметки о выполненных задачах в течение смены.
              </p>
              <button
                type="button"
                className="btn btn--primary btn--lg my-shift__open-btn"
                onClick={handleOpenShift}
                disabled={actionLoading}
              >
                <PlayIcon />
                Открыть смену
              </button>
              {(shift?.last_closed_at || shift?.closed_at) && (
                <p className="my-shift__last-shift">
                  Последняя смена: {formatDateTime(shift.last_closed_at || shift.closed_at)}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="my-shift__active-card">
                <div className="my-shift__active-info">
                  <div className="my-shift__timer-block">
                    <ClockIcon />
                    <div>
                      <span className="my-shift__timer-label">Время смены</span>
                      <span className="my-shift__timer-value">{formatDuration(elapsed)}</span>
                    </div>
                  </div>
                  <div className="my-shift__start-time">
                    <span className="my-shift__start-time-label">Начало</span>
                    <span className="my-shift__start-time-value">{formatTime(shiftOpenedAt)}</span>
                  </div>
                  <div className="my-shift__notes-count">
                    <span className="my-shift__notes-count-label">Заметок</span>
                    <span className="my-shift__notes-count-value">{notes.length}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--danger my-shift__close-btn"
                  onClick={() => setShowCloseModal(true)}
                  disabled={actionLoading}
                >
                  <StopIcon />
                  Закрыть смену
                </button>
              </div>

              <div className="my-shift__notes-card">
                <h2 className="my-shift__notes-title">Заметки за смену</h2>
                <form className="my-shift__note-form" onSubmit={handleAddNote}>
                  <input
                    type="text"
                    className="my-shift__note-input"
                    placeholder="Что сделал? Добавь заметку..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    maxLength={500}
                  />
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={noteLoading || !noteText.trim()}
                  >
                    {noteLoading ? '...' : 'Добавить'}
                  </button>
                </form>
                <div className="my-shift__notes-list">
                  {notes.length === 0 ? (
                    <div className="my-shift__notes-empty">
                      <NoteIcon />
                      <span>Заметок пока нет. Добавь первую!</span>
                    </div>
                  ) : (
                    notes.map((n, i) => (
                      <div key={n.id || i} className="my-shift__note-item">
                        <NoteIcon />
                        <div className="my-shift__note-content">
                          <span className="my-shift__note-text">{n.note || n.text || n.content}</span>
                          <span className="my-shift__note-time">{formatTime(n.created_at || n.timestamp)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── TAB 2: Shift history ── */}
      {activeTab === 'history' && (
        <div className="my-shift__history">
          <div className="my-shift__history-top">
            <h2 className="my-shift__section-title">История смен</h2>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => { setHistoryLoaded(false); setHistory([]); loadHistory(); }}
            >
              Обновить
            </button>
          </div>

          {historyLoading ? (
            <div className="my-shift__loading">
              <div className="my-shift__spinner" />
              <span>Загрузка...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="my-shift__empty-state">
              <HistoryIcon />
              <p>История смен пуста</p>
              <span>Закрытые смены будут отображаться здесь</span>
            </div>
          ) : (
            <div className="my-shift__history-list">
              {history.map((s) => {
                const dur = calcDuration(s.opened_at || s.started_at, s.closed_at);
                const isExpanded = expandedShift === s.id;
                const shiftNotes = expandedNotes[s.id] || [];
                const notesLoading = expandedNotesLoading[s.id];
                const notesCount = s.notes_count ?? s.notes?.length ?? 0;

                return (
                  <div key={s.id} className={`my-shift__history-item${isExpanded ? ' my-shift__history-item--expanded' : ''}`}>
                    <button
                      type="button"
                      className="my-shift__history-header"
                      onClick={() => toggleShiftExpand(s.id)}
                    >
                      <div className="my-shift__history-main">
                        <span className="my-shift__history-date">{formatDate(s.opened_at || s.started_at)}</span>
                        <div className="my-shift__history-meta">
                          <span className="my-shift__history-time">
                            {formatTime(s.opened_at || s.started_at)} — {s.closed_at ? formatTime(s.closed_at) : '...'}
                          </span>
                          <span className="my-shift__history-duration">{formatDuration(dur)}</span>
                          {notesCount > 0 && (
                            <span className="my-shift__history-notes-badge">
                              <NoteIcon />
                              {notesCount} заметок
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="my-shift__history-right">
                        <span className={`my-shift__history-status my-shift__history-status--${s.status}`}>
                          {s.status === 'open' ? 'Открыта' : 'Закрыта'}
                        </span>
                        {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="my-shift__history-details">
                        <div className="my-shift__history-info-row">
                          <span>Начало:</span><strong>{formatDateTime(s.opened_at || s.started_at)}</strong>
                        </div>
                        <div className="my-shift__history-info-row">
                          <span>Конец:</span><strong>{formatDateTime(s.closed_at)}</strong>
                        </div>
                        <div className="my-shift__history-info-row">
                          <span>Длительность:</span><strong>{formatDuration(dur)}</strong>
                        </div>
                        {s.line_name && (
                          <div className="my-shift__history-info-row">
                            <span>Линия:</span><strong>{s.line_name}</strong>
                          </div>
                        )}
                        {(s.comment || s.closing_note) && (
                          <div className="my-shift__history-closing-note">
                            <span>Итоговый комментарий:</span>
                            <p>{s.comment || s.closing_note}</p>
                          </div>
                        )}

                        <div className="my-shift__history-notes-section">
                          <h4 className="my-shift__history-notes-title">
                            <NoteIcon /> Заметки за смену
                          </h4>
                          {notesLoading ? (
                            <div className="my-shift__loading">
                              <div className="my-shift__spinner" />
                              <span>Загрузка заметок...</span>
                            </div>
                          ) : shiftNotes.length === 0 ? (
                            <p className="my-shift__history-no-notes">Заметок не добавлено</p>
                          ) : (
                            <div className="my-shift__notes-list">
                              {shiftNotes.map((n, i) => (
                                <div key={n.id || i} className="my-shift__note-item">
                                  <NoteIcon />
                                  <div className="my-shift__note-content">
                                    <span className="my-shift__note-text">{n.note || n.text || n.content}</span>
                                    <span className="my-shift__note-time">{formatDateTime(n.created_at || n.timestamp)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="my-shift__history-actions-row">
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => openShiftActivity(s)}
                          >
                            <ActivityIcon /> Действия за смену
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* Shift activity modal */}
      {shiftActivityModal && (
        <div className="modal-overlay" onClick={() => setShiftActivityModal(null)}>
          <div className="modal my-shift__activity-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>
                Действия — {formatDate(shiftActivityModal.shift?.opened_at || shiftActivityModal.shift?.started_at)}
              </h3>
              <button type="button" className="modal__close" onClick={() => setShiftActivityModal(null)} aria-label="Закрыть">×</button>
            </div>
            <div className="modal__body">
              {shiftActivityModal.loading ? (
                <div className="my-shift__loading">
                  <div className="my-shift__spinner" />
                  <span>Загрузка...</span>
                </div>
              ) : shiftActivityModal.items.length === 0 ? (
                <div className="my-shift__empty-state" style={{ padding: '24px 0' }}>
                  <ActivityIcon />
                  <p>Действий не найдено</p>
                </div>
              ) : (
                <div className="my-shift__activity-list">
                  {shiftActivityModal.items.map((a, i) => {
                    const actionKey = a.action || a.action_type || 'view';
                    const actionLabel = a.action_display || ACTION_LABELS[actionKey] || actionKey;
                    const color = ACTION_COLORS[actionKey] || 'var(--text-muted)';
                    return (
                      <div key={a.id || i} className="my-shift__activity-item">
                        <div className="my-shift__activity-dot" style={{ background: color }} />
                        <div className="my-shift__activity-content">
                          <div className="my-shift__activity-top">
                            <span className="my-shift__activity-label" style={{ color }}>{actionLabel}</span>
                            {a.section && <span className="my-shift__activity-section">{a.section}</span>}
                          </div>
                          <span className="my-shift__activity-desc">
                            {a.description || a.object_repr || `${a.model || ''} #${a.object_id || ''}`}
                          </span>
                          <span className="my-shift__activity-time">{formatDateTime(a.created_at || a.timestamp)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Close shift modal */}
      {showCloseModal && (
        <div className="modal-overlay" onClick={() => setShowCloseModal(false)}>
          <div className="modal my-shift__close-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>Завершить смену</h3>
              <button type="button" className="modal__close" onClick={() => setShowCloseModal(false)} aria-label="Закрыть">×</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleCloseShift(); }}>
              <div className="my-shift__close-stats">
                <div className="my-shift__close-stat">
                  <span>Начало</span>
                  <strong>{formatTime(shiftOpenedAt)}</strong>
                </div>
                <div className="my-shift__close-stat">
                  <span>Длительность</span>
                  <strong>{formatDuration(elapsed)}</strong>
                </div>
                <div className="my-shift__close-stat">
                  <span>Заметок</span>
                  <strong>{notes.length}</strong>
                </div>
              </div>
              <label htmlFor="close-shift-note">
                Комментарий <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(необязательно)</span>
              </label>
              <textarea
                id="close-shift-note"
                placeholder="Что было сделано за смену?"
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
                rows={3}
              />
              <div className="modal__actions">
                <button type="button" className="btn btn--secondary" onClick={() => setShowCloseModal(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn btn--danger" disabled={actionLoading}>
                  <StopIcon />
                  {actionLoading ? 'Закрываем...' : 'Завершить смену'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyShiftPage;

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../../../shared/ui';
import { getAllShifts, getShiftDetails, getAllUsers, getUserActivity } from '../../api/shiftsApi';
import './ShiftsReportPage.scss';

const formatDateTime = (dt) => {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dt;
  }
};

const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
};

const calcDuration = (start, end) => {
  if (!start) return null;
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  return Math.floor((e - s) / 1000);
};

const todayDate = () => new Date().toISOString().slice(0, 10);

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const NoteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);
const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

const ShiftsReportPage = () => {
  const toast = useToast();

  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  const [filterDate, setFilterDate] = useState(todayDate());
  const [filterUser, setFilterUser] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [selectedShift, setSelectedShift] = useState(null);
  const [shiftDetails, setShiftDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [shiftActivityModal, setShiftActivityModal] = useState(null);

  const loadShifts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page_size: 100 };
      if (filterDate) params.date = filterDate;
      if (filterUser) params.user = filterUser;
      if (filterStatus) params.status = filterStatus;
      const res = await getAllShifts(params);
      const data = res.data;
      setShifts(Array.isArray(data) ? data : (data.items || data.results || []));
    } catch (err) {
      if (err.response?.status !== 404) {
        toast.show('Ошибка загрузки смен', 'error');
      }
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, [filterDate, filterUser, filterStatus, toast]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  useEffect(() => {
    getAllUsers({ page_size: 500 })
      .then((res) => {
        const data = res.data;
        setUsers(Array.isArray(data) ? data : (data.items || data.results || []));
      })
      .catch(() => setUsers([]));
  }, []);

  const openShiftActivity = async (shift) => {
    setShiftActivityModal({ shift, items: [], loading: true });
    try {
      const userId = shift.user_id || shift.user?.id;
      const res = await getUserActivity(userId, { shift_id: shift.id, page_size: 100 });
      const d = res.data;
      setShiftActivityModal({ shift, items: Array.isArray(d) ? d : (d.items || d.results || []), loading: false });
    } catch {
      setShiftActivityModal({ shift, items: [], loading: false });
    }
  };

  const openDetails = async (shift) => {
    setSelectedShift(shift);
    setShiftDetails(null);
    setDetailsLoading(true);
    try {
      const res = await getShiftDetails(shift.id);
      setShiftDetails(res.data);
    } catch {
      setShiftDetails({ ...shift, notes: shift.notes || [] });
    } finally {
      setDetailsLoading(false);
    }
  };

  const openShifts = shifts.filter((s) => s.status === 'open');
  const closedShifts = shifts.filter((s) => s.status === 'closed');
  const uniqueUsers = new Set(shifts.map((s) => s.user_id || s.user?.id));

  const userName = (s) => s.user_name || s.user?.name || s.user?.username || `#${s.user_id || s.user}`;

  return (
    <div className="page shifts-report-page">
      <div className="shifts-report__top">
        <h1 className="page__title">Отчёт по сменам</h1>
        <button type="button" className="btn btn--secondary" onClick={loadShifts}>
          Обновить
        </button>
      </div>

      <div className="shifts-report__stats">
        <div className="shifts-report__stat-card shifts-report__stat-card--blue">
          <UsersIcon />
          <div>
            <span className="shifts-report__stat-value">{uniqueUsers.size}</span>
            <span className="shifts-report__stat-label">Сотрудников</span>
          </div>
        </div>
        <div className="shifts-report__stat-card shifts-report__stat-card--green">
          <ClockIcon />
          <div>
            <span className="shifts-report__stat-value">{openShifts.length}</span>
            <span className="shifts-report__stat-label">Смен открыто</span>
          </div>
        </div>
        <div className="shifts-report__stat-card shifts-report__stat-card--gray">
          <CheckIcon />
          <div>
            <span className="shifts-report__stat-value">{closedShifts.length}</span>
            <span className="shifts-report__stat-label">Смен закрыто</span>
          </div>
        </div>
        <div className="shifts-report__stat-card shifts-report__stat-card--orange">
          <NoteIcon />
          <div>
            <span className="shifts-report__stat-value">
              {shifts.reduce((acc, s) => acc + (s.notes_count ?? s.notes?.length ?? 0), 0)}
            </span>
            <span className="shifts-report__stat-label">Заметок всего</span>
          </div>
        </div>
      </div>

      <div className="shifts-report__filters">
        <div className="shifts-report__filter-group">
          <label className="shifts-report__filter-label">Дата</label>
          <input
            type="date"
            className="shifts-report__filter-input"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>
        <div className="shifts-report__filter-group">
          <label className="shifts-report__filter-label">Сотрудник</label>
          <select
            className="shifts-report__filter-select"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
          >
            <option value="">Все сотрудники</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.username || u.email || u.id}
              </option>
            ))}
          </select>
        </div>
        <div className="shifts-report__filter-group">
          <label className="shifts-report__filter-label">Статус</label>
          <select
            className="shifts-report__filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Все</option>
            <option value="open">Открыта</option>
            <option value="closed">Закрыта</option>
          </select>
        </div>
        <button
          type="button"
          className="btn btn--ghost shifts-report__filter-clear"
          onClick={() => { setFilterDate(''); setFilterUser(''); setFilterStatus(''); }}
        >
          Сбросить
        </button>
      </div>

      <div className="shifts-report__table-wrap">
        {loading ? (
          <div className="shifts-report__loading">Загрузка...</div>
        ) : shifts.length === 0 ? (
          <div className="shifts-report__empty">
            <span>Смен не найдено</span>
            <p>Попробуйте изменить фильтры или выбрать другую дату.</p>
          </div>
        ) : (
          <table className="data-table shifts-report__table">
            <thead>
              <tr>
                <th>СОТРУДНИК</th>
                <th>НАЧАЛО</th>
                <th>КОНЕЦ</th>
                <th>ДЛИТЕЛЬНОСТЬ</th>
                <th>ЗАМЕТКИ</th>
                <th>СТАТУС</th>
                <th>ДЕЙСТВИЯ</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => {
                const openedAt = s.opened_at || s.started_at;
                const dur = calcDuration(openedAt, s.closed_at);
                const isOpen = s.status === 'open';
                return (
                  <tr key={s.id}>
                    <td className="shifts-report__user-cell">
                      <div className="shifts-report__user-avatar">
                        {(userName(s)[0] || '?').toUpperCase()}
                      </div>
                      <span>{userName(s)}</span>
                    </td>
                    <td>{formatDateTime(openedAt)}</td>
                    <td>{isOpen ? <span className="shifts-report__live">● сейчас</span> : formatDateTime(s.closed_at)}</td>
                    <td>{formatDuration(dur)}</td>
                    <td>
                      <span className="shifts-report__notes-badge">
                        <NoteIcon />
                        {s.notes_count ?? s.notes?.length ?? 0}
                      </span>
                    </td>
                    <td>
                      <span className={`shifts-report__status-chip shifts-report__status-chip--${isOpen ? 'open' : 'closed'}`}>
                        {isOpen ? 'Открыта' : 'Закрыта'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => openDetails(s)}
                      >
                        <EyeIcon />
                        Детали
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selectedShift && (
        <div className="modal-overlay" onClick={() => setSelectedShift(null)}>
          <div className="modal shifts-report__detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div>
                <h3 style={{ margin: 0 }}>Смена: {userName(selectedShift)}</h3>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                  {formatDateTime(selectedShift.opened_at || selectedShift.started_at)}
                </span>
              </div>
              <button type="button" className="modal__close" onClick={() => setSelectedShift(null)} aria-label="Закрыть">×</button>
            </div>

            <div className="modal__body">
              {/* Info stats row */}
              <div className="shifts-report__detail-stats">
                <div className="shifts-report__detail-stat">
                  <span>Начало</span>
                  <strong>{formatDateTime(selectedShift.opened_at || selectedShift.started_at)}</strong>
                </div>
                <div className="shifts-report__detail-stat">
                  <span>Конец</span>
                  <strong>
                    {selectedShift.status === 'open'
                      ? <span className="shifts-report__live">сейчас</span>
                      : formatDateTime(selectedShift.closed_at)}
                  </strong>
                </div>
                <div className="shifts-report__detail-stat">
                  <span>Длительность</span>
                  <strong>{formatDuration(calcDuration(selectedShift.opened_at || selectedShift.started_at, selectedShift.closed_at))}</strong>
                </div>
                <div className="shifts-report__detail-stat">
                  <span>Статус</span>
                  <span className={`shifts-report__status-chip shifts-report__status-chip--${selectedShift.status === 'open' ? 'open' : 'closed'}`}>
                    {selectedShift.status === 'open' ? 'Открыта' : 'Закрыта'}
                  </span>
                </div>
              </div>

              {(shiftDetails?.comment || shiftDetails?.closing_note || selectedShift.comment || selectedShift.closing_note) && (
                <div className="shifts-report__closing-note" style={{ marginBottom: 16 }}>
                  <span style={{ display: 'block', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>Итоговый комментарий</span>
                  {shiftDetails?.comment || shiftDetails?.closing_note || selectedShift.comment || selectedShift.closing_note}
                </div>
              )}

              {/* Notes */}
              <div className="shifts-report__detail-notes-header">
                <h4 className="shifts-report__detail-notes-title">Заметки за смену</h4>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => openShiftActivity(selectedShift)}
                >
                  Действия за смену
                </button>
              </div>

              {detailsLoading ? (
                <div className="shifts-report__loading">Загрузка заметок...</div>
              ) : (
                <div className="shifts-report__detail-notes">
                  {(shiftDetails?.notes || selectedShift.notes || []).length === 0 ? (
                    <div className="shifts-report__notes-empty">Заметок не добавлено</div>
                  ) : (
                    (shiftDetails?.notes || selectedShift.notes || []).map((n, i) => (
                      <div key={n.id || i} className="shifts-report__detail-note">
                        <NoteIcon />
                        <div className="shifts-report__detail-note-body">
                          <span className="shifts-report__detail-note-text">
                            {n.note || n.text || n.content}
                          </span>
                          <span className="shifts-report__detail-note-time">
                            {formatDateTime(n.created_at || n.timestamp)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Per-shift activity modal */}
      {shiftActivityModal && (
        <div className="modal-overlay" onClick={() => setShiftActivityModal(null)}>
          <div className="modal" style={{ minWidth: 360, maxWidth: 540, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>Действия — {userName(shiftActivityModal.shift)} — {formatDateTime(shiftActivityModal.shift?.opened_at || shiftActivityModal.shift?.started_at)}</h3>
              <button type="button" className="modal__close" onClick={() => setShiftActivityModal(null)} aria-label="Закрыть">×</button>
            </div>
            <div className="modal__body">
              {shiftActivityModal.loading ? (
                <div className="shifts-report__loading">Загрузка...</div>
              ) : shiftActivityModal.items.length === 0 ? (
                <div className="shifts-report__notes-empty">Действий не найдено</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {shiftActivityModal.items.map((a, i) => (
                    <div key={a.id || i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', marginTop: 5, flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                        <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {a.action_display || a.action || a.action_type}
                          {a.section && <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--text-muted)' }}>{a.section}</span>}
                        </span>
                        <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text)' }}>
                          {a.description || a.object_repr || `${a.model || ''} #${a.object_id || ''}`}
                        </span>
                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                          {formatDateTime(a.created_at || a.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftsReportPage;

import React, { useState, useEffect, useCallback } from 'react';
import { useToast, Select } from '../../../../shared/ui';
import { getAllShifts, getShiftDetails, getAllUsers, getUserActivity, getActivityDetail } from '../../api/shiftsApi';
import ShiftActivityListModal from '../ActivityAudit/ShiftActivityListModal';
import { fetchShiftActivityList } from '../../lib/fetchShiftActivityList';
import ComplaintModal from '../ComplaintModal/ComplaintModal';
import ComplaintsInbox from '../ComplaintsInbox/ComplaintsInbox';
import { useOperationalRefetch } from '../../../../shared/realtime';
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

  const [mainTab, setMainTab] = useState('shifts');
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [complaintsReloadToken, setComplaintsReloadToken] = useState(0);

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
      setShifts(Array.isArray(data) ? data : (data.items || []));
    } catch (err) {
      if (err.response?.status !== 404) {
        toast.show('Ошибка загрузки смен', 'error');
      }
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, [filterDate, filterUser, filterStatus, toast]);

  const refreshShiftsReportOperational = useCallback(() => {
    loadShifts();
    setComplaintsReloadToken((t) => t + 1);
  }, [loadShifts]);

  useOperationalRefetch(['shift', 'shift_complaint', 'activity'], refreshShiftsReportOperational, true);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  useEffect(() => {
    getAllUsers({ page_size: 500 })
      .then((res) => {
        const data = res.data;
        setUsers(Array.isArray(data) ? data : (data.items || []));
      })
      .catch(() => setUsers([]));
  }, []);

  const openShiftActivity = async (shift) => {
    setShiftActivityModal({ shift, items: [], loading: true, banner: null });
    try {
      const userId = shift.user_id || shift.user?.id;
      const { items, banner } = await fetchShiftActivityList(
        (params) => getUserActivity(userId, params),
        shift
      );
      setShiftActivityModal({ shift, items, loading: false, banner });
    } catch {
      toast.show('Не удалось загрузить журнал действий', 'error');
      setShiftActivityModal({ shift, items: [], loading: false, banner: null });
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
  const showEmployeeColumn = !filterUser;

  const userName = (s) => s.user_name || s.user?.name || s.user?.username || `#${s.user_id || s.user}`;

  return (
    <div className="page shifts-report-page">
      <div className="shifts-report__main-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'shifts'}
          className={`shifts-report__main-tab${mainTab === 'shifts' ? ' shifts-report__main-tab--active' : ''}`}
          onClick={() => setMainTab('shifts')}
        >
          Отчёт по сменам
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'complaints'}
          className={`shifts-report__main-tab${mainTab === 'complaints' ? ' shifts-report__main-tab--active' : ''}`}
          onClick={() => setMainTab('complaints')}
        >
          Жалобы
        </button>
      </div>

      <div className="ds-toolbar ds-toolbar--page-head shifts-report__toolbar">
        <div className="ds-toolbar__start">
          {mainTab === 'shifts' && (
            <button type="button" className="btn btn--secondary" onClick={loadShifts}>
              Обновить
            </button>
          )}
        </div>
        <div className="ds-toolbar__end">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setComplaintModalOpen(true)}
          >
            Добавить жалобу
          </button>
        </div>
      </div>

      {mainTab === 'complaints' && (
        <ComplaintsInbox reloadToken={complaintsReloadToken} className="shifts-report__complaints-block" />
      )}

      {mainTab === 'shifts' && (
        <>
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
          <Select
            className="shifts-report__filter-select"
            value={filterUser === '' || filterUser == null ? '' : String(filterUser)}
            onChange={setFilterUser}
            placeholder="Все сотрудники"
            options={[
              { value: '', label: 'Все сотрудники' },
              ...users.map((u) => ({
                value: String(u.id),
                label: u.name || u.username || u.email || String(u.id),
              })),
            ]}
          />
        </div>
        <div className="shifts-report__filter-group">
          <label className="shifts-report__filter-label">Статус</label>
          <Select
            className="shifts-report__filter-select"
            value={filterStatus}
            onChange={setFilterStatus}
            placeholder="Все"
            options={[
              { value: '', label: 'Все' },
              { value: 'open', label: 'Открыта' },
              { value: 'closed', label: 'Закрыта' },
            ]}
          />
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
                {showEmployeeColumn ? <th>Сотрудник</th> : null}
                <th>Начало</th>
                <th>Конец</th>
                <th>Длительность</th>
                <th>Заметки</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => {
                const openedAt = s.opened_at || s.started_at;
                const dur = calcDuration(openedAt, s.closed_at);
                const isOpen = s.status === 'open';
                return (
                  <tr key={s.id}>
                    {showEmployeeColumn ? (
                      <td className="shifts-report__user-cell">
                        <div className="shifts-report__user-avatar">
                          {(userName(s)[0] || '?').toUpperCase()}
                        </div>
                        <span>{userName(s)}</span>
                      </td>
                    ) : null}
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
                        Подробнее
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
        </>
      )}

      <ComplaintModal
        open={complaintModalOpen}
        onClose={() => setComplaintModalOpen(false)}
        employees={users}
        onSuccess={() => {
          setComplaintsReloadToken((t) => t + 1);
          toast.show('Жалоба отправлена');
        }}
      />

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

      <ShiftActivityListModal
        open={Boolean(shiftActivityModal)}
        onClose={() => setShiftActivityModal(null)}
        title={
          shiftActivityModal
            ? `Действия — ${userName(shiftActivityModal.shift)} — ${formatDateTime(shiftActivityModal.shift?.opened_at || shiftActivityModal.shift?.started_at)}`
            : ''
        }
        items={shiftActivityModal?.items ?? []}
        loading={Boolean(shiftActivityModal?.loading)}
        banner={shiftActivityModal?.banner}
        fetchActivityDetail={(id) => getActivityDetail(id)}
      />
    </div>
  );
};

export default ShiftsReportPage;

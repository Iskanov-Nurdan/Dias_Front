import React, { useState, useCallback, useEffect } from 'react';
import { useServerQuery } from '../../../../shared/lib';
import { ServerList, FilterBar, ConfirmModal, useToast } from '../../../../shared/ui';
import { useAuth } from '../../../auth/model';
import { createUser, updateUser, deleteUser, updateUserAccess } from '../../api/usersApi';
import { createRole, updateRole, deleteRole } from '../../api/rolesApi';
import { ACCESS_KEYS, ACCESS_LABELS } from '../../../../shared/config/constants';
import { getUserShifts, getUserActivity, getShiftDetails } from '../../../shifts/api/shiftsApi';
import './UsersPage.scss';

const USERS_FILTERS = (roleOptions) => [
  { key: 'search', type: 'search', placeholder: 'Поиск по имени' },
  { key: 'role', type: 'select', placeholder: 'Роль', options: roleOptions },
  { key: 'is_active', type: 'select', placeholder: 'Статус', options: [
    { value: 'true', label: 'Активные' },
    { value: 'false', label: 'Неактивные' },
  ]},
  { key: 'ordering', type: 'ordering', placeholder: 'Сортировка', options: [
    { value: 'id', label: 'По ID' },
    { value: '-id', label: 'По ID (убыв.)' },
    { value: 'name', label: 'По имени' },
    { value: '-name', label: 'По имени (убыв.)' },
  ]},
];

const cleanQuery = (q) => {
  const copy = { ...q };
  Object.keys(copy).forEach((k) => {
    if (copy[k] === '' || copy[k] == null) delete copy[k];
  });
  return copy;
};

const UsersPage = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('users');
  const [queryState, setQueryState] = useState({
    page: 1,
    page_size: 20,
    search: '',
    role: '',
    is_active: '',
    ordering: '',
  });
  const [userModal, setUserModal] = useState(null);
  const [roleModal, setRoleModal] = useState(null);
  const [accessModal, setAccessModal] = useState(null);
  const [reportModal, setReportModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');

  const { refetch: refetchAuth } = useAuth();
  const { items: users, meta, loading, error, refetch } = useServerQuery(
    'users/',
    queryState,
    { enabled: activeTab === 'users' }
  );
  const { items: roles, loading: rolesLoading, error: rolesError, refetch: refetchRoles } = useServerQuery(
    'roles/',
    { page_size: 100 },
    { enabled: true }
  );

  const roleOptions = [{ value: '', label: 'Все' }, ...roles.map((r) => ({ value: String(r.id), label: r.name }))];

  const handleFilterChange = useCallback((patch) => {
    setQueryState((prev) => ({ ...prev, ...patch, page: 1 }));
  }, []);

  const handlePageChange = useCallback((page) => {
    setQueryState((prev) => ({ ...prev, page }));
  }, []);

  const handleUserSubmit = async (data) => {
    setSubmitError('');
    try {
      if (userModal?.id) {
        await updateUser(userModal.id, data);
      } else {
        await createUser(data);
      }
      setUserModal(null);
      refetch();
      refetchRoles();
      toast.show('Успешно сохранено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || err.response?.data?.details || 'Ошибка');
    }
  };

  const handleRoleSubmit = async (data) => {
    setSubmitError('');
    try {
      if (roleModal?.id) {
        await updateRole(roleModal.id, data);
      } else {
        await createRole(data);
      }
      setRoleModal(null);
      refetch();
      refetchRoles();
      toast.show('Успешно сохранено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || JSON.stringify(err.response?.data?.details || {}) || 'Ошибка');
    }
  };

  const handleAccessSave = async (userId, accessKeys) => {
    setSubmitError('');
    try {
      await updateUserAccess(userId, accessKeys);
      setAccessModal(null);
      refetch();
      refetchRoles();
      refetchAuth();
      toast.show('Успешно сохранено');
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.error
        || (data?.access_keys ? data.access_keys.join(', ') : null)
        || (typeof data?.details === 'object' ? JSON.stringify(data.details) : data?.details)
        || err.message
        || 'Ошибка сохранения доступов';
      setSubmitError(msg);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitError('');
    try {
      if (deleteTarget.type === 'user') {
        await deleteUser(deleteTarget.id);
      } else {
        await deleteRole(deleteTarget.id);
      }
      setDeleteTarget(null);
      refetch();
      refetchRoles();
      toast.show('Успешно удалено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка удаления');
    }
  };

  return (
    <div className="page page--users">
      <div className="page__header">
        <div className="page__tabs">
          <button
            type="button"
            className={`page__tab ${activeTab === 'users' ? 'page__tab--active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Список
          </button>
          <button
            type="button"
            className={`page__tab ${activeTab === 'roles' ? 'page__tab--active' : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            Роли
          </button>
        </div>
        <div className="page__actions">
          {activeTab === 'roles' && (
            <button type="button" className="btn btn--primary" onClick={() => setRoleModal({})}>
              + Создать
            </button>
          )}
          {activeTab === 'users' && (
            <button type="button" className="btn btn--primary" onClick={() => setUserModal({})}>
              + Добавить
            </button>
          )}
        </div>
      </div>

      {activeTab === 'roles' && (
        <ServerList
          loading={rolesLoading}
          error={rolesError}
          items={roles}
          meta={{ page: 1, total_pages: 1 }}
          onRetry={refetchRoles}
          renderTable={(listItems) => (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {listItems.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => setRoleModal(r)}
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm btn--danger"
                        onClick={() => setDeleteTarget({ type: 'role', id: r.id, name: r.name })}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        />
      )}

      {activeTab === 'users' && (
        <ServerList
          loading={loading}
          error={error}
          items={users}
          meta={meta}
          onRetry={refetch}
          renderFilters={() => (
            <FilterBar
              filters={USERS_FILTERS(roleOptions)}
              queryState={cleanQuery(queryState)}
              onChange={handleFilterChange}
            />
          )}
          renderTable={(listItems) => (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Роль</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {listItems.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.role_name ?? (roles.find((r) => r.id === u.role)?.name) ?? '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => setAccessModal(u)}
                      >
                        Доступы
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm btn--secondary"
                        onClick={() => setReportModal(u)}
                      >
                        Отчёт
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => setUserModal(u)}
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm btn--danger"
                        onClick={() => setDeleteTarget({ type: 'user', id: u.id, name: u.name })}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          renderPagination={(m) => (
            <>
              {m.page > 1 && (
                <button onClick={() => handlePageChange(m.page - 1)}>← Назад</button>
              )}
              <span>Страница {m.page} из {m.total_pages}</span>
              {m.page < m.total_pages && (
                <button onClick={() => handlePageChange(m.page + 1)}>Вперёд →</button>
              )}
            </>
          )}
        />
      )}

      {userModal && (
        <UserFormModal
          user={userModal?.id ? userModal : null}
          roles={roles}
          onSubmit={handleUserSubmit}
          onClose={() => { setUserModal(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      {accessModal && (
        <AccessModal
          user={accessModal}
          accessKeys={ACCESS_KEYS}
          accessLabels={ACCESS_LABELS}
          roles={roles}
          onSave={handleAccessSave}
          onClose={() => { setAccessModal(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      {reportModal && (
        <UserReportModal
          user={reportModal}
          onClose={() => setReportModal(null)}
        />
      )}

      {roleModal && (
        <RoleFormModal
          role={roleModal?.id ? roleModal : null}
          onSubmit={handleRoleSubmit}
          onClose={() => { setRoleModal(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить?"
        message={deleteTarget ? `Вы уверены, что хотите удалить "${deleteTarget.name}"?` : ''}
        confirmText="Удалить"
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setSubmitError(''); }}
      />
    </div>
  );
};

const AccessModal = ({ user, accessKeys, accessLabels, roles, onSave, onClose, error }) => {
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const { apiClient } = await import('../../../../shared/api');
        const res = await apiClient.get(`/users/${user.id}/`);
        const acc = res.data?.accesses || [];
        const keys = acc.map((a) => a.access_key ?? a);
        setSelected(new Set(keys));
      } catch {
        setSelected(new Set());
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Доступы: {user?.name}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        {loading ? (
          <p>Загрузка...</p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (saving) return;
              setSaving(true);
              try {
                await onSave(user.id, Array.from(selected));
              } finally {
                setSaving(false);
              }
            }}
          >
            <label className="modal__access-label">Доступы к разделам</label>
            <div className="access-keys">
              {accessKeys.map((key) => (
                <label key={key} className="access-keys__item">
                  <input
                    type="checkbox"
                    checked={selected.has(key)}
                    onChange={() => toggle(key)}
                  />
                  {accessLabels[key] || key}
                </label>
              ))}
            </div>
            {error && <p className="modal__error">{error}</p>}
            <div className="modal__actions">
              <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>Отмена</button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const UserFormModal = ({ user, roles, onSubmit, onClose, error }) => {
  const [name, setName] = useState(user?.name ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user?.role != null ? String(user.role) : '');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{user ? 'Редактировать сотрудника' : 'Добавить сотрудника'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = { name, role: role ? Number(role) : null };
            if (password) data.password = password;
            if (!user && !password) return;
            onSubmit(data);
          }}
        >
          <label>Имя *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          <label>Пароль {user ? '(оставьте пустым, чтобы не менять)' : '*'}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!user}
          />
          <label>Роль *</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} required>
            <option value="">—</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Helpers for UserReportModal ───────────────────────────────

const formatDT = (dt) => {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dt; }
};

const formatDur = (seconds) => {
  if (!seconds || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
};

const calcDur = (start, end) => {
  if (!start) return 0;
  return Math.floor((new Date(end || Date.now()).getTime() - new Date(start).getTime()) / 1000);
};

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const ACT_LABELS = { create: 'Создал', update: 'Изменил', delete: 'Удалил', view: 'Просмотрел' };
const ACT_COLORS = { create: 'var(--success)', update: 'var(--accent)', delete: 'var(--danger)', view: 'var(--text-muted)' };

const UserReportModal = ({ user, onClose }) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay] = useState('');

  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedShift, setExpandedShift] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState({});
  const [expandedNotesLoading, setExpandedNotesLoading] = useState({});
  const [shiftActivityModal, setShiftActivityModal] = useState(null);

  const yearOptions = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) yearOptions.push(y);

  const daysInMonth = new Date(year, month, 0).getDate();
  const dayOptions = [];
  for (let d = 1; d <= daysInMonth; d++) dayOptions.push(d);

  const buildParams = useCallback(() => {
    const pad = (n) => String(n).padStart(2, '0');
    if (day) {
      const d = `${year}-${pad(month)}-${pad(day)}`;
      return { date_from: d, date_to: d, page_size: 100 };
    }
    const lastDay = new Date(year, month, 0).getDate();
    return {
      date_from: `${year}-${pad(month)}-01`,
      date_to: `${year}-${pad(month)}-${lastDay}`,
      page_size: 100,
    };
  }, [year, month, day]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = buildParams();
    try {
      const res = await getUserShifts(user.id, params);
      const d = res.data;
      setShifts(Array.isArray(d) ? d : (d.items || d.results || []));
    } catch {
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, [user.id, buildParams]);

  const openShiftActivity = async (s) => {
    setShiftActivityModal({ shift: s, items: [], loading: true });
    try {
      const res = await getUserActivity(user.id, { shift_id: s.id, page_size: 100 });
      const d = res.data;
      setShiftActivityModal({ shift: s, items: Array.isArray(d) ? d : (d.items || d.results || []), loading: false });
    } catch {
      setShiftActivityModal({ shift: s, items: [], loading: false });
    }
  };

  useEffect(() => { load(); }, [load]);

  const toggleShift = async (shiftId) => {
    if (expandedShift === shiftId) { setExpandedShift(null); return; }
    setExpandedShift(shiftId);
    if (expandedNotes[shiftId] !== undefined) return;
    setExpandedNotesLoading((p) => ({ ...p, [shiftId]: true }));
    try {
      const res = await getShiftDetails(shiftId);
      setExpandedNotes((p) => ({ ...p, [shiftId]: res.data.notes || [] }));
    } catch {
      setExpandedNotes((p) => ({ ...p, [shiftId]: [] }));
    } finally {
      setExpandedNotesLoading((p) => ({ ...p, [shiftId]: false }));
    }
  };

  const totalHours = shifts
    .filter((s) => s.status === 'closed')
    .reduce((acc, s) => acc + calcDur(s.opened_at || s.started_at, s.closed_at), 0);

  return (
      <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--fullscreen" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3 style={{ margin: 0 }}>Отчёт: {user.name}</h3>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
              {user.role_name || ''}
            </span>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>

        {/* Toolbar: filters + stats in one row */}
        <div className="report-modal__toolbar">
          <div className="report-modal__toolbar-filters">
            <div className="report-modal__filter-group">
              <label className="report-modal__filter-label">Год</label>
              <select
                className="report-modal__filter-select"
                value={year}
                onChange={(e) => { setYear(Number(e.target.value)); setDay(''); }}
              >
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="report-modal__filter-group">
              <label className="report-modal__filter-label">Месяц</label>
              <select
                className="report-modal__filter-select"
                value={month}
                onChange={(e) => { setMonth(Number(e.target.value)); setDay(''); }}
              >
                {MONTHS_RU.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="report-modal__filter-group">
              <label className="report-modal__filter-label">День</label>
              <select
                className="report-modal__filter-select"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              >
                <option value="">Весь месяц</option>
                {dayOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          {!loading && (
            <div className="report-modal__toolbar-stats">
              <div className="report-modal__stat-pill">
                <span className="report-modal__stat-value">{shifts.length}</span>
                <span className="report-modal__stat-label">смен</span>
              </div>
              <div className="report-modal__stat-pill">
                <span className="report-modal__stat-value">{formatDur(totalHours)}</span>
                <span className="report-modal__stat-label">отработано</span>
              </div>
              <div className="report-modal__stat-pill">
                <span className="report-modal__stat-value">
                  {shifts.reduce((acc, s) => acc + (s.notes_count ?? s.notes?.length ?? 0), 0)}
                </span>
                <span className="report-modal__stat-label">заметок</span>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="report-modal__body">
          {loading ? (
            <div className="report-modal__loading">
              <div className="my-shift__spinner" />
              <span>Загрузка...</span>
            </div>
          ) : shifts.length === 0 ? (
            <div className="report-modal__empty">Смен за выбранный период нет</div>
          ) : (
              <div className="report-modal__shifts">
                {shifts.map((s) => {
                  const dur = calcDur(s.opened_at || s.started_at, s.closed_at);
                  const isExpanded = expandedShift === s.id;
                  const shiftNotes = expandedNotes[s.id] || [];
                  const notesLoading = expandedNotesLoading[s.id];
                  const notesCount = s.notes_count ?? s.notes?.length ?? 0;
                  const openedAt = s.opened_at || s.started_at;
                  return (
                    <div key={s.id} className={`report-modal__shift-item${isExpanded ? ' report-modal__shift-item--expanded' : ''}`}>
                      <button
                        type="button"
                        className="report-modal__shift-header"
                        onClick={() => toggleShift(s.id)}
                      >
                        <div className="report-modal__shift-main">
                          <span className="report-modal__shift-date">{formatDT(openedAt)}</span>
                          <div className="report-modal__shift-meta">
                            <span>{formatDur(dur)}</span>
                            {notesCount > 0 && <span className="report-modal__notes-badge">{notesCount} заметок</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span className={`report-modal__status report-modal__status--${s.status}`}>
                            {s.status === 'open' ? 'Открыта' : 'Закрыта'}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="report-modal__shift-details">
                          <div className="report-modal__detail-row">
                            <span>Начало:</span><strong>{formatDT(openedAt)}</strong>
                          </div>
                          <div className="report-modal__detail-row">
                            <span>Конец:</span><strong>{formatDT(s.closed_at)}</strong>
                          </div>
                          <div className="report-modal__detail-row">
                            <span>Длительность:</span><strong>{formatDur(dur)}</strong>
                          </div>
                          {s.line_name && (
                            <div className="report-modal__detail-row">
                              <span>Линия:</span><strong>{s.line_name}</strong>
                            </div>
                          )}
                          {(s.comment || s.closing_note) && (
                            <div className="report-modal__closing-note">
                              <span>Итоговый комментарий:</span>
                              <p>{s.comment || s.closing_note}</p>
                            </div>
                          )}
                          <div className="report-modal__notes-section">
                            <strong style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Заметки
                            </strong>
                            {notesLoading ? (
                              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>Загрузка...</p>
                            ) : shiftNotes.length === 0 ? (
                              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', margin: 0 }}>Заметок нет</p>
                            ) : (
                              <div className="report-modal__notes-list">
                                {shiftNotes.map((n, i) => (
                                  <div key={n.id || i} className="report-modal__note-item">
                                    <span className="report-modal__note-text">{n.note || n.text || n.content}</span>
                                    <span className="report-modal__note-time">{formatDT(n.created_at)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="report-modal__shift-actions-row">
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm"
                              onClick={() => openShiftActivity(s)}
                            >
                              Действия за смену
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

      {/* Per-shift activity modal */}
      {shiftActivityModal && (
        <div className="modal-overlay" onClick={() => setShiftActivityModal(null)}>
          <div className="modal" style={{ minWidth: 360, maxWidth: 540, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>Действия — {formatDT(shiftActivityModal.shift?.opened_at || shiftActivityModal.shift?.started_at)}</h3>
              <button type="button" className="modal__close" onClick={() => setShiftActivityModal(null)} aria-label="Закрыть">×</button>
            </div>
            <div className="modal__body">
              {shiftActivityModal.loading ? (
                <div className="report-modal__loading"><div className="my-shift__spinner" /><span>Загрузка...</span></div>
              ) : shiftActivityModal.items.length === 0 ? (
                <div className="report-modal__empty">Действий не найдено</div>
              ) : (
                <div className="report-modal__activity">
                  {shiftActivityModal.items.map((a, i) => {
                    const actionKey = a.action || a.action_type || 'view';
                    const actionLabel = a.action_display || ACT_LABELS[actionKey] || actionKey;
                    return (
                      <div key={a.id || i} className="report-modal__activity-item">
                        <div className="report-modal__activity-dot" style={{ background: ACT_COLORS[actionKey] || 'var(--text-muted)' }} />
                        <div className="report-modal__activity-content">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: ACT_COLORS[actionKey], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {actionLabel}
                            </span>
                            {a.section && <span className="report-modal__activity-section">{a.section}</span>}
                          </div>
                          <span className="report-modal__activity-desc">
                            {a.description || a.object_repr || `${a.model || ''} #${a.object_id || ''}`}
                          </span>
                          <span className="report-modal__activity-time">{formatDT(a.created_at || a.timestamp)}</span>
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
      </div>
    </div>
  );
};

const RoleFormModal = ({ role, onSubmit, onClose, error }) => {
  const [name, setName] = useState(role?.name ?? '');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{role ? 'Редактировать роль' : 'Создать роль'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ name });
          }}
        >
          <label>Название *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UsersPage;

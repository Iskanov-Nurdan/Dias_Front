import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDiscardOnClose, useDirtyFromBaseline, useIsMobile } from '../../../../shared/hooks';
import { useServerQuery, getApiErrorMessage } from '../../../../shared/lib';
import {
  ServerList,
  FilterBar,
  Collapse,
  ConfirmModal,
  Pagination,
  ActionMenu,
  useToast,
  Select,
} from '../../../../shared/ui';
import { useAuth } from '../../../auth/model';
import { createUser, updateUser, deleteUser, updateUserAccess, getUser } from '../../api/usersApi';
import { createRole, updateRole, deleteRole } from '../../api/rolesApi';
import {
  ACCESS_LABELS,
  ACCESS_GROUPS,
  ACCESS_BUNDLES,
  getAccessModalApiKeys,
} from '../../../../shared/config/constants';
import { ACCESS_NAV_ICONS } from '../../../../shared/config/navPageIcons';
import { getUserShifts, getUserActivity, getShiftDetails, getActivityDetail } from '../../../shifts/api/shiftsApi';
import { fetchShiftActivityList } from '../../../shifts/lib/fetchShiftActivityList';
import { shiftLineLabel } from '../../../shifts/lib/shiftDisplayUtils';
import ShiftActivityListModal from '../../../shifts/components/ActivityAudit/ShiftActivityListModal';
import './UsersPage.scss';

const USERS_FILTERS_PRIMARY = (roleOptions) => [
  { key: 'search', type: 'search', placeholder: 'Поиск' },
  { key: 'role', type: 'select', placeholder: 'Роль', options: roleOptions },
];

const USERS_FILTERS_EXTRA = () => [
  { key: 'is_active', type: 'select', placeholder: 'Статус', options: [
    { value: 'true', label: 'Активные' },
    { value: 'false', label: 'Неактивные' },
  ]},
  { key: 'ordering', type: 'ordering', placeholder: 'Сортировка', options: [
    { value: 'id', label: 'Сначала старые записи' },
    { value: '-id', label: 'Сначала новые записи' },
    { value: 'name', label: 'Имя А–Я' },
    { value: '-name', label: 'Имя Я–А' },
  ]},
];

const USERS_FILTERS_ALL = (roleOptions) => [...USERS_FILTERS_PRIMARY(roleOptions), ...USERS_FILTERS_EXTRA()];

const ADMINISTRATOR_ROLE_NAME_LC = 'администратор';

const isProtectedRole = (r) =>
  Boolean(r) && String(r.name || '').trim().toLowerCase() === ADMINISTRATOR_ROLE_NAME_LC;

const sortRolesForDisplay = (list) => {
  const copy = [...(list || [])];
  copy.sort((a, b) => {
    const pa = isProtectedRole(a);
    const pb = isProtectedRole(b);
    if (pa && !pb) return -1;
    if (!pa && pb) return 1;
    return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
  });
  return copy;
};

const cleanQuery = (q) => {
  const copy = { ...q };
  Object.keys(copy).forEach((k) => {
    if (copy[k] === '' || copy[k] == null) delete copy[k];
  });
  return copy;
};

const UsersPage = () => {
  const toast = useToast();
  const isMobile = useIsMobile();
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
  const [userDetail, setUserDetail] = useState(null);
  const [roleModal, setRoleModal] = useState(null);
  const [roleDetail, setRoleDetail] = useState(null);
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

  const sortedRoles = useMemo(() => sortRolesForDisplay(roles), [roles]);

  const roleOptions = useMemo(
    () => [{ value: '', label: 'Все' }, ...sortedRoles.map((r) => ({ value: String(r.id), label: r.name }))],
    [sortedRoles],
  );

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
      toast.success('Успешно сохранено');
    } catch (err) {
      setSubmitError(getApiErrorMessage(err) ?? 'Ошибка');
    }
  };

  const handleRoleSubmit = async (data) => {
    setSubmitError('');
    try {
      if (roleModal?.id) {
        const existing = roles.find((x) => x.id === roleModal.id) || roleModal;
        if (isProtectedRole(existing)) return;
        await updateRole(roleModal.id, data);
      } else {
        await createRole(data);
      }
      setRoleModal(null);
      refetch();
      refetchRoles();
      toast.success('Успешно сохранено');
    } catch (err) {
      setSubmitError(getApiErrorMessage(err) ?? 'Ошибка');
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
      toast.success('Успешно сохранено');
    } catch (err) {
      setSubmitError(getApiErrorMessage(err) ?? 'Ошибка сохранения доступов');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitError('');
    try {
      if (deleteTarget.type === 'user') {
        await deleteUser(deleteTarget.id);
      } else {
        if (isProtectedRole({ name: deleteTarget.name })) {
          setDeleteTarget(null);
          return;
        }
        await deleteRole(deleteTarget.id);
      }
      setDeleteTarget(null);
      refetch();
      refetchRoles();
      toast.success('Успешно удалено');
    } catch (err) {
      setSubmitError(getApiErrorMessage(err) ?? 'Ошибка удаления');
    }
  };

  return (
    <div className="page page--users">
      <div className="users-page__head">
        <div className="users-page__tabs-wrap">
          <div className="page__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'users'}
              className={`page__tab ${activeTab === 'users' ? 'page__tab--active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              Список
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'roles'}
              className={`page__tab ${activeTab === 'roles' ? 'page__tab--active' : ''}`}
              onClick={() => setActiveTab('roles')}
            >
              Роли
            </button>
          </div>
        </div>
      </div>

      <div className="ds-sticky-mobile-actions">
        {activeTab === 'roles' && (
          <button type="button" className="btn btn--primary" onClick={() => setRoleModal({})}>
            Создать роль
          </button>
        )}
        {activeTab === 'users' && (
          <button type="button" className="btn btn--primary" onClick={() => setUserModal({})}>
            Добавить
          </button>
        )}
      </div>

      {activeTab === 'roles' && (
        <div className="ds-list-card">
        <ServerList
          loading={rolesLoading}
          error={rolesError}
          items={sortedRoles}
          meta={{ page: 1, total_pages: 1 }}
          onRetry={refetchRoles}
          renderFilters={() => (
            <div className="users-page__filters users-page__filters--row users-page__filters--action-only">
              <h2 className="ds-list-card__title">Роли</h2>
              <div className="users-page__filters-action ds-hide-mobile">
                <button type="button" className="btn btn--primary" onClick={() => setRoleModal({})}>
                  Создать роль
                </button>
              </div>
            </div>
          )}
          filtersClassName="server-list__filters--tight"
          renderTable={(listItems) => (
            <table className="data-table data-table--fixed data-table--roles data-table--row-actions data-table--clickable">
              <thead>
                <tr>
                  <th>Роль</th>
                  <th aria-hidden />
                </tr>
              </thead>
              <tbody>
                {listItems.map((r) => {
                  const locked = isProtectedRole(r);
                  return (
                  <tr
                    key={r.id}
                    tabIndex={locked ? undefined : 0}
                    role={locked ? undefined : 'button'}
                    className={locked ? 'data-table__row--no-actions' : undefined}
                    onClick={locked ? undefined : () => setRoleDetail(r)}
                    onKeyDown={locked ? undefined : (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setRoleDetail(r);
                      }
                    }}
                  >
                    <td className="data-table__cell--lead">{r.name}</td>
                    <td className="users-page__role-actions">
                      {!locked && (
                      <ActionMenu
                        ariaLabel="Действия"
                        items={[
                          { label: 'Открыть', onClick: () => setRoleDetail(r) },
                          { label: 'Редактировать', onClick: () => setRoleModal(r) },
                          { label: 'Удалить', danger: true, onClick: () => setDeleteTarget({ type: 'role', id: r.id, name: r.name }) },
                        ]}
                      />
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        />
        </div>
      )}

      {activeTab === 'users' && (
        <div className="ds-list-card">
        <ServerList
          loading={loading}
          error={error}
          items={users}
          meta={meta}
          onRetry={refetch}
          renderFilters={() => (
            <div className={`users-page__filters users-page__filters--row${isMobile ? ' users-page__filters--mobile' : ''}`}>
              <h2 className="ds-list-card__title">Сотрудники</h2>
              <div className="users-page__filters-fields">
                <FilterBar
                  variant="row"
                  filters={USERS_FILTERS_ALL(roleOptions)}
                  queryState={cleanQuery(queryState)}
                  onChange={handleFilterChange}
                />
              </div>
              <div className="users-page__filters-action ds-hide-mobile">
                <button type="button" className="btn btn--primary" onClick={() => setUserModal({})}>
                  Добавить
                </button>
              </div>
            </div>
          )}
          filtersClassName="server-list__filters--tight"
          renderTable={(listItems) => (
            <table className="data-table data-table--fixed data-table--users data-table--row-actions data-table--clickable">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Роль</th>
                  <th>Статус</th>
                  <th aria-hidden />
                </tr>
              </thead>
              <tbody>
                {listItems.map((u) => (
                  <tr
                    key={u.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => setUserDetail(u)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setUserDetail(u);
                      }
                    }}
                  >
                    <td className="data-table__cell--lead">{u.name}</td>
                    <td className="users-page__muted data-table__cell--muted">{u.role_name ?? (roles.find((r) => r.id === u.role)?.name) ?? '—'}</td>
                    <td>
                      <span className={`users-page__pill${u.is_active === false ? ' users-page__pill--off' : ''}`}>
                        {u.is_active === false ? 'Выкл' : 'Активен'}
                      </span>
                    </td>
                    <td className="users-page__employee-actions">
                      <button
                        type="button"
                        className="btn btn--secondary users-page__details-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUserDetail(u);
                        }}
                      >
                        Подробнее
                      </button>
                      <ActionMenu
                        ariaLabel="Действия"
                        items={[
                          { label: 'Редактировать', onClick: () => setUserModal(u) },
                          { label: 'Доступы', onClick: () => setAccessModal(u) },
                          { label: 'Удалить', danger: true, onClick: () => setDeleteTarget({ type: 'user', id: u.id, name: u.name }) },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          renderPagination={(m) => (
            <Pagination
              meta={{
                page: m.page,
                pages: m.total_pages ?? m.pages,
                total: m.total ?? m.count,
              }}
              onPageChange={handlePageChange}
            />
          )}
        />
        </div>
      )}

      {userDetail && (
        <UserDetailModal
          user={userDetail}
          roleName={userDetail.role_name ?? (roles.find((r) => r.id === userDetail.role)?.name) ?? '—'}
          onClose={() => setUserDetail(null)}
          onEdit={(u) => {
            setUserDetail(null);
            setUserModal(u);
          }}
          onAccess={(u) => {
            setUserDetail(null);
            setAccessModal(u);
          }}
          onReport={(u) => {
            setUserDetail(null);
            setReportModal(u);
          }}
          onDelete={(u) => {
            setUserDetail(null);
            setDeleteTarget({ type: 'user', id: u.id, name: u.name });
          }}
        />
      )}

      {userModal && (
        <UserFormModal
          user={userModal?.id ? userModal : null}
          roles={sortedRoles}
          onSubmit={handleUserSubmit}
          onClose={() => { setUserModal(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      {accessModal && (
        <AccessModal
          user={accessModal}
          accessGroups={ACCESS_GROUPS}
          accessLabels={ACCESS_LABELS}
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

      {roleDetail && (
        <RoleDetailModal
          role={roleDetail}
          onClose={() => setRoleDetail(null)}
          onEdit={(r) => {
            setRoleDetail(null);
            setRoleModal(r);
          }}
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

const UserDetailModal = ({ user, roleName, onClose, onEdit, onAccess, onReport, onDelete }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal users-page__detail-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal__head">
        <h3>Карточка сотрудника</h3>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
      </div>
      <div className="users-page__detail-body">
        <div className="users-page__detail-row">
          <span>Имя:</span>
          <strong>{user?.name || '—'}</strong>
        </div>
        <div className="users-page__detail-row">
          <span>Роль:</span>
          <strong>{roleName}</strong>
        </div>
        <div className="users-page__detail-row">
          <span>Статус:</span>
          <strong>{user?.is_active === false ? 'Неактивен' : 'Активен'}</strong>
        </div>
      </div>
      <div className="modal__actions users-page__detail-actions">
        <button type="button" className="btn btn--primary" onClick={() => onEdit(user)}>Редактировать</button>
        <button type="button" className="btn btn--secondary" onClick={() => onReport(user)}>Отчёт</button>
        <button type="button" className="btn btn--secondary" onClick={() => onAccess(user)}>Доступы</button>
        <button type="button" className="btn btn--danger users-page__detail-danger" onClick={() => onDelete(user)}>Удалить</button>
      </div>
    </div>
  </div>
);

const RoleDetailModal = ({ role, onClose, onEdit }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal__head">
        <h3>Карточка роли</h3>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
      </div>
      <div style={{ padding: '1.5rem' }}>
        <p><strong>Название:</strong> {role?.name || '—'}</p>
      </div>
      <div className="modal__actions">
        <button type="button" className="btn btn--primary" onClick={() => onEdit(role)}>Редактировать</button>
      </div>
    </div>
  </div>
);

const AccessModal = ({ user, accessGroups, accessLabels, onSave, onClose, error }) => {
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const allKeys = React.useMemo(() => getAccessModalApiKeys(accessGroups), [accessGroups]);

  React.useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const res = await getUser(user.id);
        const d = res.data;
        const acc = d?.accesses || [];
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

  const isBundleChecked = (bundleId) => {
    const bundle = ACCESS_BUNDLES[bundleId];
    if (!bundle?.keys?.length) return false;
    return bundle.keys.some((k) => selected.has(k));
  };

  const toggleBundle = (bundleId) => {
    const bundle = ACCESS_BUNDLES[bundleId];
    if (!bundle?.keys?.length) return;
    setSelected((prev) => {
      const next = new Set(prev);
      const on = bundle.keys.some((k) => next.has(k));
      if (on) bundle.keys.forEach((k) => next.delete(k));
      else bundle.keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const selectAllKeys = () => setSelected(new Set(allKeys));
  const clearAllKeys = () => setSelected(new Set());

  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));

  const isDirty = useDirtyFromBaseline(String(user?.id ?? ''), loading, {
    access: [...selected].sort().join('|'),
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
      <div className="modal modal--access" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head access-modal__head">
          <div className="access-modal__title-block">
            <h3>Доступы к разделам</h3>
            <p className="access-modal__subtitle">Только для сотрудника «{user?.name}»</p>
          </div>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        {loading ? (
          <div className="access-modal__loading" role="status">Загрузка…</div>
        ) : (
          <form
            className="access-modal__form"
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
            <div className="access-modal__toolbar">
              <span className="access-modal__toolbar-label">Все разделы</span>
              <div className="access-modal__toolbar-btns">
                <button
                  type="button"
                  className="access-modal__link-btn"
                  onClick={selectAllKeys}
                  disabled={saving || allSelected}
                >
                  Выбрать всё
                </button>
                <button
                  type="button"
                  className="access-modal__link-btn"
                  onClick={clearAllKeys}
                  disabled={saving || selected.size === 0}
                >
                  Снять всё
                </button>
              </div>
            </div>

            <div className="access-modal__body">
              {accessGroups.map((group, gi) => {
                const groupKeys = group.keys || [];
                const groupBundles = group.bundles || [];
                const hasTitle = Boolean(String(group.title || '').trim());
                return (
                <section
                  key={group.id}
                  className="access-modal__group"
                  aria-labelledby={hasTitle ? `access-gr-${group.id}` : undefined}
                >
                  {gi > 0 && <div className="access-modal__divider" aria-hidden />}
                  {hasTitle ? (
                    <div className="access-modal__group-head">
                      <h4 id={`access-gr-${group.id}`} className="access-modal__group-title">
                        {group.title}
                      </h4>
                    </div>
                  ) : null}
                  <div className="access-modal__grid">
                    {groupKeys.map((key) => {
                      const IconComp = ACCESS_NAV_ICONS[key];
                      return (
                        <label key={key} className="access-modal__row">
                          <span className="access-modal__row-leading">
                            {IconComp ? (
                              <span className="access-modal__row-icon" aria-hidden>
                                <IconComp />
                              </span>
                            ) : null}
                            <span className="access-modal__row-label">{accessLabels[key] || key}</span>
                          </span>
                          <input
                            type="checkbox"
                            className="access-modal__checkbox"
                            checked={selected.has(key)}
                            onChange={() => toggle(key)}
                          />
                        </label>
                      );
                    })}
                    {groupBundles.map((bundleId) => {
                      const bundle = ACCESS_BUNDLES[bundleId];
                      if (!bundle) return null;
                      const iconKey = bundle.iconKey || bundleId;
                      const IconComp = ACCESS_NAV_ICONS[iconKey];
                      return (
                        <label key={`bundle-${bundleId}`} className="access-modal__row">
                          <span className="access-modal__row-leading">
                            {IconComp ? (
                              <span className="access-modal__row-icon" aria-hidden>
                                <IconComp />
                              </span>
                            ) : null}
                            <span className="access-modal__row-label">{bundle.label}</span>
                          </span>
                          <input
                            type="checkbox"
                            className="access-modal__checkbox"
                            checked={isBundleChecked(bundleId)}
                            onChange={() => toggleBundle(bundleId)}
                          />
                        </label>
                      );
                    })}
                  </div>
                </section>
                );
              })}
            </div>

            {error && <p className="modal__error access-modal__error">{error}</p>}

            <div className="modal__actions access-modal__footer">
              <button type="button" className="btn btn--secondary" onClick={requestClose} disabled={saving}>
                Отмена
              </button>
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

  const isDirty = useDirtyFromBaseline(user?.id != null ? String(user.id) : 'new', false, {
    name: name.trim(),
    password,
    role: String(role ?? ''),
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
      <div className="modal users-page__form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{user ? 'Редактировать сотрудника' : 'Добавить сотрудника'}</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        <form
          className="users-page__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!role) return;
            const data = { name, role: role ? Number(role) : null };
            if (password) data.password = password;
            if (!user && !password) return;
            onSubmit(data);
          }}
        >
          <label>Имя *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          {!user ? (
            <>
              <label>Пароль *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </>
          ) : (
            <Collapse title="Смена пароля">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Новый пароль"
              />
            </Collapse>
          )}
          <label>Роль *</label>
          <Select
            value={role}
            onChange={setRole}
            placeholder="Выберите роль"
            options={roles.map((r) => ({ value: String(r.id), label: r.name }))}
          />
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

const UserReportModal = ({ user, onClose }) => {
  const toast = useToast();
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
      setShifts(Array.isArray(d) ? d : (d.items || []));
    } catch {
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, [user.id, buildParams]);

  const openShiftActivity = async (s) => {
    setShiftActivityModal({ shift: s, items: [], loading: true, banner: null });
    try {
      const { items, banner } = await fetchShiftActivityList(
        (params) => getUserActivity(user.id, params),
        s
      );
      setShiftActivityModal({ shift: s, items, loading: false, banner });
    } catch {
      toast.error('Не удалось загрузить журнал действий');
      setShiftActivityModal({ shift: s, items: [], loading: false, banner: null });
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

  const filtersDirty = useDirtyFromBaseline(`report-${user.id}`, false, {
    year,
    month,
    day: day === '' || day == null ? '' : String(day),
  });
  const {
    requestClose: requestReportClose,
    discardConfirmOpen: reportDiscardOpen,
    confirmDiscardAndClose: confirmReportDiscard,
    cancelDiscard: cancelReportDiscard,
  } = useDiscardOnClose(onClose, filtersDirty);

  return (
      <div className="modal-overlay" onClick={requestReportClose}>
      <ConfirmModal
        open={reportDiscardOpen}
        title="Закрыть без сохранения?"
        message="Вы изменили период отчёта — при закрытии фильтр сбросится."
        confirmText="Закрыть"
        onConfirm={confirmReportDiscard}
        onCancel={cancelReportDiscard}
      />
      <div className="modal modal--fullscreen" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3 style={{ margin: 0 }}>Отчёт: {user.name}</h3>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
              {user.role_name || ''}
            </span>
          </div>
          <button type="button" className="modal__close" onClick={requestReportClose} aria-label="Закрыть">×</button>
        </div>

        {/* Toolbar: filters + stats in one row */}
        <div className="report-modal__toolbar">
          <div className="report-modal__toolbar-filters">
            <div className="report-modal__filter-group">
              <label className="report-modal__filter-label">Год</label>
              <Select
                className="report-modal__filter-select"
                value={String(year)}
                onChange={(v) => { setYear(Number(v)); setDay(''); }}
                options={yearOptions.map((y) => ({ value: String(y), label: String(y) }))}
              />
            </div>
            <div className="report-modal__filter-group">
              <label className="report-modal__filter-label">Месяц</label>
              <Select
                className="report-modal__filter-select"
                value={String(month)}
                onChange={(v) => { setMonth(Number(v)); setDay(''); }}
                options={MONTHS_RU.map((m, i) => ({ value: String(i + 1), label: m }))}
              />
            </div>
            <div className="report-modal__filter-group">
              <label className="report-modal__filter-label">День</label>
              <Select
                className="report-modal__filter-select"
                value={day === '' || day == null ? '' : String(day)}
                onChange={(v) => setDay(v)}
                placeholder="Весь месяц"
                options={[
                  { value: '', label: 'Весь месяц' },
                  ...dayOptions.map((d) => ({ value: String(d), label: String(d) })),
                ]}
              />
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
                  const lineLbl = shiftLineLabel(s);
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
                          {lineLbl ? (
                            <div className="report-modal__detail-row">
                              <span>Линия:</span><strong>{lineLbl}</strong>
                            </div>
                          ) : null}
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

      <ShiftActivityListModal
        open={Boolean(shiftActivityModal)}
        onClose={() => setShiftActivityModal(null)}
        title={`Действия — ${formatDT(shiftActivityModal?.shift?.opened_at || shiftActivityModal?.shift?.started_at)}`}
        items={shiftActivityModal?.items ?? []}
        loading={Boolean(shiftActivityModal?.loading)}
        banner={shiftActivityModal?.banner}
        fetchActivityDetail={(id) => getActivityDetail(id)}
      />
      </div>
    </div>
  );
};

const RoleFormModal = ({ role, onSubmit, onClose, error }) => {
  const [name, setName] = useState(role?.name ?? '');

  const isDirty = useDirtyFromBaseline(role?.id != null ? String(role.id) : 'new', false, {
    name: name.trim(),
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
      <div className="modal users-page__form-modal users-page__form-modal--role" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{role ? 'Редактировать роль' : 'Создать роль'}</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        <form
          className="users-page__form"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ name });
          }}
        >
          <label>Название *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
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

export default UsersPage;

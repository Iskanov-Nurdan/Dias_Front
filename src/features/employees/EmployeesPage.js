import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchEmployees,
  fetchRoles,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  updateEmployeeAccess,
  createRole,
  updateRole,
  deleteRole,
} from './api';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { useDebounce } from '../../shared/hooks/useDebounce';
import {
  Users, ShieldCheck, Search, Plus, SlidersHorizontal,
} from 'lucide-react';
import { Select, Pagination, FilterBar, FiltersModal, Fab, PrimaryTabs } from '../../shared/ui';
import { EmployeesList, RolesList, EmployeeFormModal, RoleFormModal, AccessModal } from './components';
import './EmployeesPage.scss';

const TAB_EMPLOYEES = 'employees';
const TAB_ROLES = 'roles';

const TABS = [
  { id: TAB_EMPLOYEES, label: 'Сотрудники', icon: Users },
  { id: TAB_ROLES, label: 'Роли', icon: ShieldCheck },
];

const EmployeesPage = () => {
  const { isAdmin, showAccessDenied } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(TAB_EMPLOYEES);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput);
  const [queryState, setQueryState] = useState({ search: '', roleId: '', page: 1, perPage: 20 });
  const [roleSearch, setRoleSearch] = useState('');
  const [employeesData, setEmployeesData] = useState(null);
  const [rolesData, setRolesData] = useState(null);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState(null);
  const [rolesError, setRolesError] = useState(null);
  const [formEmployee, setFormEmployee] = useState(null);
  const [formRole, setFormRole] = useState(null);
  const [rolesFormError, setRolesFormError] = useState(null);
  const [rolesFormSaving, setRolesFormSaving] = useState(false);
  const [accessEmployee, setAccessEmployee] = useState(null);
  const [accessData, setAccessData] = useState(null);
  const [accessFormError, setAccessFormError] = useState(null);
  const [accessFormSaving, setAccessFormSaving] = useState(false);
  const [employeeFiltersOpen, setEmployeeFiltersOpen] = useState(false);
  const [confirmDeleteEmployee, setConfirmDeleteEmployee] = useState(null);
  const [confirmDeleteRole, setConfirmDeleteRole] = useState(null);
  const [employeesFormError, setEmployeesFormError] = useState(null);
  const [employeesFormSaving, setEmployeesFormSaving] = useState(false);
  const employeesControllerRef = useRef(null);
  const rolesControllerRef = useRef(null);
  const lastEmployeesRequestId = useRef(0);
  const lastRolesRequestId = useRef(0);

  const fetchEmployeesSafe = useCallback(async () => {
    if (employeesControllerRef.current) employeesControllerRef.current.abort();
    employeesControllerRef.current = new AbortController();
    const requestId = ++lastEmployeesRequestId.current;
    setEmployeesLoading(true);
    setEmployeesError(null);
    try {
      const data = await fetchEmployees(queryState, employeesControllerRef.current.signal);
      if (requestId !== lastEmployeesRequestId.current) return;
      setEmployeesData(data);
    } catch (err) {
      if (requestId !== lastEmployeesRequestId.current || err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setEmployeesError(err.response?.data?.message || err.response?.data?.detail || err.message || 'Ошибка загрузки');
    } finally {
      if (requestId === lastEmployeesRequestId.current) setEmployeesLoading(false);
    }
  }, [queryState]);

  const fetchRolesSafe = useCallback(async () => {
    if (rolesControllerRef.current) rolesControllerRef.current.abort();
    rolesControllerRef.current = new AbortController();
    const requestId = ++lastRolesRequestId.current;
    setRolesLoading(true);
    setRolesError(null);
    try {
      const data = await fetchRoles({ search: roleSearch || undefined }, rolesControllerRef.current.signal);
      if (requestId !== lastRolesRequestId.current) return;
      setRolesData(Array.isArray(data) ? data : data?.results ?? data?.items ?? data?.data ?? []);
    } catch (err) {
      if (requestId !== lastRolesRequestId.current || err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setRolesError(err.response?.data?.message || err.response?.data?.detail || err.message || 'Ошибка загрузки');
    } finally {
      if (requestId === lastRolesRequestId.current) setRolesLoading(false);
    }
  }, [roleSearch]);

  useEffect(() => {
    setQueryState((q) => ({ ...q, search: debouncedSearch, page: 1 }));
  }, [debouncedSearch]);

  useEffect(() => {
    if (activeTab === TAB_EMPLOYEES) fetchEmployeesSafe();
    return () => { if (employeesControllerRef.current) employeesControllerRef.current.abort(); };
  }, [activeTab, fetchEmployeesSafe]);

  useEffect(() => {
    if (activeTab === TAB_ROLES) fetchRolesSafe();
    return () => { if (rolesControllerRef.current) rolesControllerRef.current.abort(); };
  }, [activeTab, fetchRolesSafe]);

  useEffect(() => {
    fetchRolesSafe();
  }, [fetchRolesSafe]);

  const rolesList = Array.isArray(rolesData) ? rolesData : rolesData?.results ?? rolesData?.items ?? [];
  const employeesItems = employeesData?.items ?? employeesData?.results ?? employeesData?.data ?? employeesData ?? [];

  const roleOptions = [{ value: '', label: 'Все роли' }, ...rolesList.map((r) => ({ value: String(r.id), label: r.name || '' }))];

  const handleRoleFilter = (v) => setQueryState((q) => ({ ...q, roleId: v, page: 1 }));

  const resetEmployeeRoleFilter = useCallback(() => {
    setQueryState((q) => ({ ...q, roleId: '', page: 1 }));
  }, []);

  const handleSaveEmployee = async (payload) => {
    setEmployeesFormError(null);
    setEmployeesFormSaving(true);
    try {
      if (formEmployee?.id) {
        await updateEmployee(formEmployee.id, { ...payload, roleId: payload.roleId || undefined }, null);
      } else {
        await createEmployee(payload, null);
      }
      setFormEmployee(null);
      fetchEmployeesSafe();
      toast.success(formEmployee?.id ? 'Сотрудник обновлён' : 'Сотрудник добавлен');
    } catch (e) {
      const data = e.response?.data;
      const err = data?.error;
      const msg = err?.message ?? (typeof data === 'string' ? data : data?.message ?? data?.detail);
      const fields = data && typeof data === 'object' && !Array.isArray(data) && !data.error && !data.message && !data.detail
        ? data
        : null;
      const text = msg || (fields ? Object.entries(fields).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ') : 'Ошибка сохранения');
      setEmployeesFormError(text);
      toast.error(text);
    } finally {
      setEmployeesFormSaving(false);
    }
  };

  const handleSaveRole = async (payload) => {
    setRolesFormError(null);
    setRolesFormSaving(true);
    try {
      if (formRole?.id) {
        await updateRole(formRole.id, payload, null);
      } else {
        await createRole(payload, null);
      }
      setFormRole(null);
      fetchRolesSafe();
    } catch (e) {
      const data = e.response?.data;
      const msg = data?.error?.message ?? data?.message ?? data?.detail ?? e.message ?? 'Ошибка сохранения';
      setRolesFormError(msg);
    } finally {
      setRolesFormSaving(false);
    }
  };

  const handleDeleteEmployee = () => {
    if (!confirmDeleteEmployee) return;
    deleteEmployee(confirmDeleteEmployee.id, null)
      .then(() => {
        setConfirmDeleteEmployee(null);
        fetchEmployeesSafe();
        toast.success('Сотрудник удалён');
      })
      .catch((e) => {
        toast.error(e.response?.data?.message || e.message || 'Ошибка удаления');
        console.error(e);
      });
  };

  const handleDeleteRole = () => {
    if (!confirmDeleteRole) return;
    setRolesError(null);
    deleteRole(confirmDeleteRole.id, null)
      .then(() => {
        setConfirmDeleteRole(null);
        fetchRolesSafe();
        toast.success('Роль удалена');
      })
      .catch((e) => {
        const msg = e.response?.data?.error?.message || e.response?.data?.message || e.response?.data?.detail || e.message || 'Ошибка удаления';
        setRolesError(msg);
        toast.error(msg);
      });
  };

  // Доступы сотрудника (accesses) уже приходят в самом объекте из списка
  // /api/users/ — отдельного эндпоинта на чтение доступов у DIAS_ERP нет,
  // поэтому здесь просто читаем то, что уже загружено, без сетевого запроса.
  const handleOpenAccess = (emp) => {
    setAccessEmployee(emp);
    setAccessData(emp.accesses ?? []);
  };

  const handleSaveAccess = async (accessKeys) => {
    if (!accessEmployee) return;
    setAccessFormError(null);
    setAccessFormSaving(true);
    try {
      await updateEmployeeAccess(accessEmployee.id, accessKeys, null);
      setAccessEmployee(null);
      setAccessData(null);
      fetchEmployeesSafe();
    } catch (e) {
      const d = e.response?.data;
      setAccessFormError(d?.detail ?? d?.error ?? d?.message ?? 'Ошибка сохранения');
    } finally {
      setAccessFormSaving(false);
    }
  };

  return (
    <div className="employees-page">
      <PrimaryTabs items={TABS} activeId={activeTab} onChange={setActiveTab} />

      {activeTab === TAB_EMPLOYEES && (
        <>
          <FilterBar className="employees-page__filter-bar">
            <div className="employees-page__search-row">
              <div className="ui-search employees-page__search employees-page__search--full">
                <Search size={15} className="ui-search__icon" />
                <input
                  type="text"
                  placeholder="Поиск"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="ui-search__input"
                />
              </div>
              <button
                type="button"
                className="employees-page__filter-icon-btn"
                onClick={() => setEmployeeFiltersOpen(true)}
                aria-label="Фильтры"
              >
                <SlidersHorizontal size={18} />
                {!!queryState.roleId && <span className="employees-page__filter-dot" aria-hidden />}
              </button>
            </div>
            <div className="employees-page__filters-desktop">
              <Select
                value={queryState.roleId}
                onChange={(v) => handleRoleFilter(v)}
                options={roleOptions}
                placeholder="Роли"
                className="employees-page__select-wrap"
                icon={<ShieldCheck size={15} />}
              />
              <button type="button" className="employees-page__add filter-bar__action" onClick={() => setFormEmployee({})}>
                <Plus size={16} /> Добавить
              </button>
            </div>
          </FilterBar>
          <FiltersModal
            open={employeeFiltersOpen}
            onClose={() => setEmployeeFiltersOpen(false)}
            title="Фильтры"
            footer={(
              <>
                <button type="button" className="filters-modal__reset-btn" onClick={resetEmployeeRoleFilter}>Сброс</button>
                <button type="button" className="filters-modal__apply-btn" onClick={() => setEmployeeFiltersOpen(false)}>Применить</button>
              </>
            )}
          >
            <div className="employees-page__filters-modal-content">
              <label className="employees-page__filter-label">
                <span>Роль</span>
                <Select
                  value={queryState.roleId}
                  onChange={(v) => handleRoleFilter(v)}
                  options={roleOptions}
                  placeholder="Все роли"
                  className="employees-page__select-wrap employees-page__select-wrap--modal"
                  icon={<ShieldCheck size={15} />}
                />
              </label>
            </div>
          </FiltersModal>
        </>
      )}

      {activeTab === TAB_EMPLOYEES && (
        <>
          <EmployeesList
            items={employeesItems}
            roles={rolesList}
            loading={employeesLoading}
            error={employeesError}
            onRetry={fetchEmployeesSafe}
            onEdit={(emp) => (isAdmin ? setFormEmployee(emp) : showAccessDenied())}
            onDelete={(emp) => (isAdmin ? setConfirmDeleteEmployee(emp) : showAccessDenied())}
            onAccess={handleOpenAccess}
            confirmDelete={confirmDeleteEmployee}
            onConfirmDelete={handleDeleteEmployee}
            onCancelDelete={() => setConfirmDeleteEmployee(null)}
            emptyStateActionLabel="Добавить сотрудника"
            emptyStateOnAction={() => setFormEmployee({})}
          />
          <Pagination
            meta={employeesData?.meta}
            currentPage={queryState.page}
            onPage={(p) => setQueryState((q) => ({ ...q, page: p }))}
            loading={employeesLoading}
            entityLabel="сотрудников"
          />
        </>
      )}

      {activeTab === TAB_ROLES && (
        <>
          <FilterBar className="employees-page__filter-bar">
            <div className="ui-search employees-page__search">
              <Search size={15} className="ui-search__icon" />
              <input
                type="text"
                placeholder="Поиск"
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                className="ui-search__input"
              />
            </div>
            <button type="button" className="employees-page__add employees-page__add--desktop-only filter-bar__action" onClick={() => setFormRole({})}>
              <Plus size={16} /> Добавить роль
            </button>
          </FilterBar>
          <RolesList
            items={rolesList}
            loading={rolesLoading}
            error={rolesError}
            onRetry={fetchRolesSafe}
            onEdit={setFormRole}
            onDelete={setConfirmDeleteRole}
            confirmDelete={confirmDeleteRole}
            onConfirmDelete={handleDeleteRole}
            onCancelDelete={() => setConfirmDeleteRole(null)}
            canManageRoles={isAdmin}
            onAccessDenied={showAccessDenied}
          />
        </>
      )}

      {formEmployee && (
        <EmployeeFormModal
          employee={formEmployee}
          roles={rolesList}
          onSave={handleSaveEmployee}
          onClose={() => { setFormEmployee(null); setEmployeesFormError(null); }}
          error={employeesFormError}
          saving={employeesFormSaving}
        />
      )}
      {formRole && (
        <RoleFormModal
          role={formRole}
          onSave={handleSaveRole}
          onClose={() => { setFormRole(null); setRolesFormError(null); }}
          error={rolesFormError}
          saving={rolesFormSaving}
        />
      )}
      {accessEmployee && (
        <AccessModal
          employee={accessEmployee}
          roleName={rolesList.find((r) => r.id === accessEmployee.role)?.name}
          currentAccess={accessData}
          onSave={handleSaveAccess}
          onClose={() => { setAccessEmployee(null); setAccessData(null); setAccessFormError(null); }}
          error={accessFormError}
          saving={accessFormSaving}
        />
      )}
      <Fab
        onClick={() => (activeTab === TAB_EMPLOYEES ? setFormEmployee({}) : setFormRole({}))}
        label={activeTab === TAB_EMPLOYEES ? 'Добавить сотрудника' : 'Добавить роль'}
      />
    </div>
  );
};

export default EmployeesPage;

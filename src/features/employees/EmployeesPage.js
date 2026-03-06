import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchEmployees,
  fetchRoles,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  fetchEmployeeAccess,
  updateEmployeeAccess,
  createRole,
  updateRole,
  deleteRole,
} from './api';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { useDebounce } from '../../shared/hooks/useDebounce';
import { Select, Pagination, FilterBar } from '../../shared/ui';
import { EmployeesList, RolesList, EmployeeFormModal, RoleFormModal, AccessModal } from './components';
import './EmployeesPage.scss';

const TAB_EMPLOYEES = 'employees';
const TAB_ROLES = 'roles';

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

  const handleOpenAccess = (emp) => {
    setAccessEmployee(emp);
    fetchEmployeeAccess(emp.id, null)
      .then((data) => setAccessData(data?.access ?? data ?? {}))
      .catch((e) => console.error(e));
  };

  const handleSaveAccess = async (access) => {
    if (!accessEmployee) return;
    setAccessFormError(null);
    setAccessFormSaving(true);
    try {
      await updateEmployeeAccess(accessEmployee.id, access, null);
      setAccessEmployee(null);
      setAccessData(null);
    } catch (e) {
      const d = e.response?.data;
      setAccessFormError(d?.error?.message ?? d?.message ?? d?.detail ?? 'Ошибка сохранения');
    } finally {
      setAccessFormSaving(false);
    }
  };

  return (
    <div className="employees-page">
      <h1 className="employees-page__title">Сотрудники</h1>
      <div className="employees-page__tabs">
        <button
          type="button"
          className={`employees-page__tab ${activeTab === TAB_EMPLOYEES ? 'employees-page__tab--active' : ''}`}
          onClick={() => setActiveTab(TAB_EMPLOYEES)}
        >
          Сотрудники
        </button>
        <button
          type="button"
          className={`employees-page__tab ${activeTab === TAB_ROLES ? 'employees-page__tab--active' : ''}`}
          onClick={() => setActiveTab(TAB_ROLES)}
        >
          Роли
        </button>
      </div>

      {activeTab === TAB_EMPLOYEES && (
        <FilterBar className="employees-page__filter-bar">
          <input
            type="text"
            placeholder="Поиск (ФИО, логин, телефон)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="employees-page__search"
          />
          <Select
            value={queryState.roleId}
            onChange={(v) => handleRoleFilter(v)}
            options={roleOptions}
            placeholder="Все роли"
            className="employees-page__select-wrap"
          />
          <button type="button" className="employees-page__add filter-bar__action" onClick={() => setFormEmployee({})}>
            Добавить
          </button>
        </FilterBar>
      )}

      {activeTab === TAB_EMPLOYEES && (
        <>
          <EmployeesList
            items={employeesItems}
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
            <input
              type="text"
              placeholder="Поиск по названию роли"
              value={roleSearch}
              onChange={(e) => setRoleSearch(e.target.value)}
              className="employees-page__search"
            />
            <button type="button" className="employees-page__add filter-bar__action" onClick={() => setFormRole({})}>
              Добавить роль
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
          currentAccess={accessData}
          onSave={handleSaveAccess}
          onClose={() => { setAccessEmployee(null); setAccessData(null); setAccessFormError(null); }}
          error={accessFormError}
          saving={accessFormSaving}
        />
      )}
    </div>
  );
};

export default EmployeesPage;

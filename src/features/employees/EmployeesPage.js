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
import { Select } from '../../shared/ui';
import { EmployeesList, RolesList, EmployeeFormModal, RoleFormModal, AccessModal } from './components';
import './EmployeesPage.scss';

const TAB_EMPLOYEES = 'employees';
const TAB_ROLES = 'roles';

const EmployeesPage = () => {
  const [activeTab, setActiveTab] = useState(TAB_EMPLOYEES);
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
  const [accessEmployee, setAccessEmployee] = useState(null);
  const [accessData, setAccessData] = useState(null);
  const [confirmDeleteEmployee, setConfirmDeleteEmployee] = useState(null);
  const [confirmDeleteRole, setConfirmDeleteRole] = useState(null);
  const controllerRef = useRef(null);
  const lastRequestId = useRef(0);

  const fetchEmployeesSafe = useCallback(async () => {
    if (controllerRef.current) controllerRef.current.abort();
    controllerRef.current = new AbortController();
    const requestId = ++lastRequestId.current;
    setEmployeesLoading(true);
    setEmployeesError(null);
    try {
      const data = await fetchEmployees(queryState, controllerRef.current.signal);
      if (requestId !== lastRequestId.current) return;
      setEmployeesData(data);
    } catch (err) {
      if (requestId !== lastRequestId.current || err.name === 'AbortError') return;
      setEmployeesError(err.response?.data?.message || err.response?.data?.detail || err.message || 'Ошибка загрузки');
    } finally {
      if (requestId === lastRequestId.current) setEmployeesLoading(false);
    }
  }, [queryState]);

  const fetchRolesSafe = useCallback(async () => {
    if (controllerRef.current) controllerRef.current.abort();
    controllerRef.current = new AbortController();
    const requestId = ++lastRequestId.current;
    setRolesLoading(true);
    setRolesError(null);
    try {
      const data = await fetchRoles(controllerRef.current.signal);
      if (requestId !== lastRequestId.current) return;
      setRolesData(Array.isArray(data) ? data : data?.results ?? data?.items ?? data?.data ?? []);
    } catch (err) {
      if (requestId !== lastRequestId.current || err.name === 'AbortError') return;
      setRolesError(err.response?.data?.message || err.response?.data?.detail || err.message || 'Ошибка загрузки');
    } finally {
      if (requestId === lastRequestId.current) setRolesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === TAB_EMPLOYEES) fetchEmployeesSafe();
    return () => { if (controllerRef.current) controllerRef.current.abort(); };
  }, [activeTab, fetchEmployeesSafe]);

  useEffect(() => {
    if (activeTab === TAB_ROLES) fetchRolesSafe();
    return () => { if (controllerRef.current) controllerRef.current.abort(); };
  }, [activeTab, fetchRolesSafe]);

  const rolesList = Array.isArray(rolesData) ? rolesData : rolesData?.results ?? rolesData?.items ?? [];
  const rolesFiltered = roleSearch.trim()
    ? rolesList.filter((r) => (r.name || '').toLowerCase().includes(roleSearch.trim().toLowerCase()))
    : rolesList;
  const employeesItems = employeesData?.items ?? employeesData?.results ?? employeesData?.data ?? employeesData;

  const roleOptions = [{ value: '', label: 'Все роли' }, ...rolesList.map((r) => ({ value: String(r.id), label: r.name || '' }))];

  const handleSearch = (v) => setQueryState((q) => ({ ...q, search: v, page: 1 }));
  const handleRoleFilter = (v) => setQueryState((q) => ({ ...q, roleId: v, page: 1 }));

  const handleSaveEmployee = async (payload) => {
    try {
      if (formEmployee?.id) {
        await updateEmployee(formEmployee.id, { ...payload, roleId: payload.roleId || undefined }, null);
      } else {
        await createEmployee(payload, null);
      }
      setFormEmployee(null);
      fetchEmployeesSafe();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveRole = async (payload) => {
    try {
      if (formRole?.id) {
        await updateRole(formRole.id, payload, null);
      } else {
        await createRole(payload, null);
      }
      setFormRole(null);
      fetchRolesSafe();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteEmployee = () => {
    if (!confirmDeleteEmployee) return;
    deleteEmployee(confirmDeleteEmployee.id, null)
      .then(() => {
        setConfirmDeleteEmployee(null);
        fetchEmployeesSafe();
      })
      .catch((e) => console.error(e));
  };

  const handleDeleteRole = () => {
    if (!confirmDeleteRole) return;
    deleteRole(confirmDeleteRole.id, null)
      .then(() => {
        setConfirmDeleteRole(null);
        fetchRolesSafe();
      })
      .catch((e) => console.error(e));
  };

  const handleOpenAccess = (emp) => {
    setAccessEmployee(emp);
    fetchEmployeeAccess(emp.id, null)
      .then((data) => setAccessData(data?.access ?? data ?? {}))
      .catch((e) => console.error(e));
  };

  const handleSaveAccess = (access) => {
    if (!accessEmployee) return;
    updateEmployeeAccess(accessEmployee.id, access, null)
      .then(() => {
        setAccessEmployee(null);
        setAccessData(null);
      })
      .catch((e) => console.error(e));
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
        <div className="employees-page__toolbar">
          <div className="employees-page__filters">
            <input
              type="text"
              placeholder="Поиск (ФИО, логин, телефон)"
              value={queryState.search}
              onChange={(e) => handleSearch(e.target.value)}
              className="employees-page__search"
            />
            <Select
              value={queryState.roleId}
              onChange={(v) => handleRoleFilter(v)}
              options={roleOptions}
              placeholder="Все роли"
              className="employees-page__select-wrap"
            />
          </div>
          <button type="button" className="employees-page__add" onClick={() => setFormEmployee({})}>
            Добавить
          </button>
        </div>
      )}

      {activeTab === TAB_EMPLOYEES && (
        <EmployeesList
          items={employeesItems}
          loading={employeesLoading}
          error={employeesError}
          onRetry={fetchEmployeesSafe}
          onEdit={setFormEmployee}
          onDelete={setConfirmDeleteEmployee}
          onAccess={handleOpenAccess}
          confirmDelete={confirmDeleteEmployee}
          onConfirmDelete={handleDeleteEmployee}
          onCancelDelete={() => setConfirmDeleteEmployee(null)}
        />
      )}

      {activeTab === TAB_ROLES && (
        <>
          <div className="employees-page__toolbar">
            <div className="employees-page__filters">
              <input
                type="text"
                placeholder="Поиск по названию роли"
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                className="employees-page__search"
              />
            </div>
            <button type="button" className="employees-page__add" onClick={() => setFormRole({})}>
              Добавить роль
            </button>
          </div>
          <RolesList
            items={rolesFiltered}
            loading={rolesLoading}
            error={rolesError}
            onRetry={fetchRolesSafe}
            onEdit={setFormRole}
            onDelete={setConfirmDeleteRole}
            confirmDelete={confirmDeleteRole}
            onConfirmDelete={handleDeleteRole}
            onCancelDelete={() => setConfirmDeleteRole(null)}
          />
        </>
      )}

      {formEmployee && (
        <EmployeeFormModal
          employee={formEmployee}
          roles={rolesList}
          onSave={handleSaveEmployee}
          onClose={() => setFormEmployee(null)}
        />
      )}
      {formRole && <RoleFormModal role={formRole} onSave={handleSaveRole} onClose={() => setFormRole(null)} />}
      {accessEmployee && (
        <AccessModal
          employee={accessEmployee}
          currentAccess={accessData}
          onSave={handleSaveAccess}
          onClose={() => { setAccessEmployee(null); setAccessData(null); }}
        />
      )}
    </div>
  );
};

export default EmployeesPage;

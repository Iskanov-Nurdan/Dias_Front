import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider';
import MainLayout from './layouts/MainLayout';
import NoAccessPage from './components/NoAccessPage';
import { PAGE_IDS } from '../shared/constants/pages';

const LoginPage = React.lazy(() => import('../features/auth/LoginPage'));
const TaplinkPage = React.lazy(() => import('../features/taplink/TaplinkPage'));
const TaplinkEditorPage = React.lazy(() => import('../features/taplink/TaplinkEditor'));
const EmployeesPage = React.lazy(() => import('../features/employees/EmployeesPage'));
const SportsTrainersPage = React.lazy(() => import('../features/sports-trainers/SportsTrainersPage'));
const ClientsPage = React.lazy(() => import('../features/clients/ClientsPage'));
const ClientsReportsPage = React.lazy(() => import('../features/clients/ClientsReportsPage'));
const WarehousePage = React.lazy(() => import('../features/warehouse/WarehousePage'));
const SalesPage = React.lazy(() => import('../features/sales/SalesPage'));
const ExpensesPage = React.lazy(() => import('../features/expenses/ExpensesPage'));
const SalaryPage = React.lazy(() => import('../features/salary/SalaryPage'));
const LeadsPage = React.lazy(() => import('../features/leads/LeadsPage'));
const AnalyticsPage = React.lazy(() => import('../features/analytics/AnalyticsPage'));
const NotFoundPage = React.lazy(() => import('../features/not-found/NotFoundPage'));

const ProtectedRoute = ({ children, pageId }) => {
  const { user, hasAccess, getFirstAvailableRoute } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (pageId && !hasAccess(pageId)) {
    const hasAnyAccess = PAGE_IDS.some((id) => hasAccess(id));
    if (!hasAnyAccess) return <NoAccessPage />;
    return <Navigate to={getFirstAvailableRoute()} replace />;
  }
  return children;
};

const IndexRedirect = () => {
  const { getFirstAvailableRoute } = useAuth();
  return <Navigate to={getFirstAvailableRoute()} replace />;
};

const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/taplink" element={<TaplinkPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<IndexRedirect />} />
        <Route
          path="employees"
          element={
            <ProtectedRoute pageId="employees">
              <EmployeesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="sports-trainers"
          element={
            <ProtectedRoute pageId="sports-trainers">
              <SportsTrainersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="clients"
          element={
            <ProtectedRoute pageId="clients">
              <ClientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute pageId="reports">
              <ClientsReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="warehouse"
          element={
            <ProtectedRoute pageId="warehouse">
              <WarehousePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="sales"
          element={
            <ProtectedRoute pageId="sales">
              <SalesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="expenses"
          element={
            <ProtectedRoute pageId="expenses">
              <ExpensesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="salary"
          element={
            <ProtectedRoute pageId="salary">
              <SalaryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="leads"
          element={
            <ProtectedRoute pageId="leads">
              <LeadsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="analytics"
          element={
            <ProtectedRoute pageId="analytics">
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route path="taplink-editor" element={<TaplinkEditorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default AppRouter;

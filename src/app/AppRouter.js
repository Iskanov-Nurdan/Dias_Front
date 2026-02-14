import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider';
import MainLayout from './layouts/MainLayout';
import { PAGE_ROUTES, PAGE_IDS } from '../shared/constants/pages';

const LoginPage = React.lazy(() => import('../features/auth/LoginPage'));
const EmployeesPage = React.lazy(() => import('../features/employees/EmployeesPage'));
const SportsTrainersPage = React.lazy(() => import('../features/sports-trainers/SportsTrainersPage'));
const ClientsPage = React.lazy(() => import('../features/clients/ClientsPage'));
const WarehousePage = React.lazy(() => import('../features/warehouse/WarehousePage'));
const SalesPage = React.lazy(() => import('../features/sales/SalesPage'));
const ExpensesPage = React.lazy(() => import('../features/expenses/ExpensesPage'));
const SalaryPage = React.lazy(() => import('../features/salary/SalaryPage'));
const AnalyticsPage = React.lazy(() => import('../features/analytics/AnalyticsPage'));
const NotFoundPage = React.lazy(() => import('../features/not-found/NotFoundPage'));

const ProtectedRoute = ({ children, pageId }) => {
  const { user, hasAccess } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (pageId && !hasAccess(pageId)) {
    const firstRoute = PAGE_IDS.map((id) => PAGE_ROUTES[id]).find((_, i) => hasAccess(PAGE_IDS[i]));
    return <Navigate to={firstRoute || '/employees'} replace />;
  }
  return children;
};

const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/employees" replace />} />
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
          path="analytics"
          element={
            <ProtectedRoute pageId="analytics">
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default AppRouter;

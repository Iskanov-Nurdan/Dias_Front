import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
const ActivityLogPage = React.lazy(() => import('../features/activity/ActivityLogPage'));
const ExpensesPage = React.lazy(() => import('../features/expenses/ExpensesPage'));
const SalaryPage = React.lazy(() => import('../features/salary/SalaryPage'));
const LeadsPage = React.lazy(() => import('../features/leads/LeadsPage'));
const AnalyticsPage = React.lazy(() => import('../features/analytics/AnalyticsPage'));
const ShiftsPage = React.lazy(() => import('../features/shifts/ShiftsPage'));
const SpreadsheetPage = React.lazy(() => import('../features/spreadsheet/SpreadsheetPage'));
const TrainerReportPage = React.lazy(() => import('../features/trainer-report/TrainerReportPage'));
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

/**
 * Корень домена (rahmanata.kg) — это визитка клуба, а не вход в CRM.
 * Раньше "/" без сессии сразу редиректил на /login: посетитель из поиска
 * или из ссылки в соцсетях упирался в форму входа сотрудника вместо страницы клуба.
 *
 * Особый случай — ровно "/" и только он: анонимный посетитель видит публичную
 * страницу (ту же, что и по /taplink). Любой другой путь внутри CRM ведёт себя
 * как раньше — истекшая сессия на /clients уводит на /login, а не молча
 * подменяется маркетинговой страницей, иначе сотрудник не поймёт, куда логиниться.
 */
const RootGate = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    if (location.pathname === '/') return <TaplinkPage />;
    return <Navigate to="/login" replace />;
  }
  return children;
};

const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      {/* /taplink оставлен как алиас — старые ссылки и QR-коды на него не сломаются */}
      <Route path="/taplink" element={<TaplinkPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootGate><MainLayout /></RootGate>}>
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
          path="activity-log"
          element={
            <ProtectedRoute pageId="activity-log">
              <ActivityLogPage />
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
        <Route
          path="shifts"
          element={
            <ProtectedRoute pageId="shifts">
              <ShiftsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="taplink-editor"
          element={
            <ProtectedRoute pageId="taplink">
              <TaplinkEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="spreadsheet"
          element={
            <ProtectedRoute pageId="spreadsheet">
              <SpreadsheetPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="my-report"
          element={
            <ProtectedRoute pageId="trainer-report">
              <TrainerReportPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default AppRouter;

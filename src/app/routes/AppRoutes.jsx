import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import MainLayout from '../components/MainLayout';
import { LoginPage } from '../../features/auth';
import { useAuth } from '../../features/auth';
import { UsersPage } from '../../features/users';
import { AnalyticsPage } from '../../features/analytics';
import { MaterialsPage } from '../../features/materials';
import { ChemistryPage, EmployeePrepareBlanksPage, EmployeeBlankDetailPage } from '../../features/chemistry';
import { ProductionPage } from '../../features/production';
import { OTKPage } from '../../features/otk';
import { WarehousePage } from '../../features/warehouse';
import { SalesPage } from '../../features/sales';
import { ClientsPage } from '../../features/clients';
import { OrdersPage } from '../../features/orders';
import { PaymentsPage } from '../../features/payments';
import { MyShiftPage, ShiftsReportPage } from '../../features/shifts';
import CashPage from '../../features/cash/components/CashPage/CashPage';
import { getDefaultHomePath } from '../../shared/config/navigation';
import { STAGE2_TABS_ENABLED } from '../../shared/config/constants';

const PlaceholderPage = ({ title }) => (
  <div className="page">
    <h1 className="page__title">{title}</h1>
    <p>Нет доступа.</p>
  </div>
);

const DefaultHomeRedirect = () => {
  const { user } = useAuth();
  const path = getDefaultHomePath(user?.accesses);
  if (path) return <Navigate to={path} replace />;
  return <Navigate to="/forbidden" replace />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route
      path="/prepare-blanks/view/:blankId"
      element={(
        <ProtectedRoute requiredAccess="chemistry">
          <EmployeeBlankDetailPage />
        </ProtectedRoute>
      )}
    />
    <Route
      path="/"
      element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<DefaultHomeRedirect />} />
      <Route path="users" element={<ProtectedRoute requiredAccess="users"><UsersPage /></ProtectedRoute>} />
      <Route path="production" element={<ProtectedRoute requiredAccess="production"><ProductionPage /></ProtectedRoute>} />
      <Route path="materials" element={<ProtectedRoute requiredAccess="materials"><MaterialsPage /></ProtectedRoute>} />
      <Route path="chemistry" element={<ProtectedRoute requiredAccess="chemistry"><ChemistryPage /></ProtectedRoute>} />
      <Route path="prepare-blanks" element={<ProtectedRoute requiredAccess="chemistry"><EmployeePrepareBlanksPage /></ProtectedRoute>} />
      <Route path="otk" element={<ProtectedRoute requiredAccess="otk"><OTKPage /></ProtectedRoute>} />
      <Route path="warehouse" element={<ProtectedRoute requiredAccess="warehouse"><WarehousePage /></ProtectedRoute>} />
      <Route path="analytics" element={<ProtectedRoute requiredAccess="analytics"><AnalyticsPage /></ProtectedRoute>} />
      <Route path="my-shift" element={<ProtectedRoute requiredAccess="my_shift"><MyShiftPage /></ProtectedRoute>} />
      <Route path="shifts" element={<ProtectedRoute requiredAccess="shifts"><ShiftsReportPage /></ProtectedRoute>} />
      {STAGE2_TABS_ENABLED && (
        <>
          <Route path="cash" element={<CashPage />}>
            <Route path="clients" element={<ProtectedRoute requiredAccess="clients"><ClientsPage /></ProtectedRoute>} />
            <Route path="orders" element={<ProtectedRoute requiredAccess="client_orders"><OrdersPage /></ProtectedRoute>} />
            <Route path="sales" element={<ProtectedRoute requiredAccess="sales"><SalesPage /></ProtectedRoute>} />
          </Route>
          <Route path="clients" element={<Navigate to="/cash/clients" replace />} />
          <Route path="orders" element={<Navigate to="/cash/orders" replace />} />
          <Route path="sales" element={<Navigate to="/cash/sales" replace />} />
          <Route path="payments" element={<ProtectedRoute requiredAccess="payments"><PaymentsPage /></ProtectedRoute>} />
          <Route path="lines" element={<Navigate to="/production" replace />} />
          <Route path="returns" element={<Navigate to="/cash/sales" replace />} />
          <Route path="defects" element={<Navigate to="/cash/sales" replace />} />
          <Route path="defects-rework" element={<Navigate to="/cash/sales" replace />} />
          <Route path="defects-rework/rework" element={<Navigate to="/cash/sales" replace />} />
          <Route path="rework-requests" element={<Navigate to="/cash/sales" replace />} />
          <Route path="directories" element={<Navigate to="/chemistry" replace />} />
          <Route path="directories/recipes" element={<Navigate to="/chemistry" replace />} />
          <Route path="recipes" element={<Navigate to="/chemistry" replace />} />
          <Route path="profiles" element={<Navigate to="/chemistry" replace />} />
        </>
      )}
      <Route path="forbidden" element={<PlaceholderPage title="Нет доступа" />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default AppRoutes;

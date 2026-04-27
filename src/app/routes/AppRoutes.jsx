import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import MainLayout from '../components/MainLayout';
import { LoginPage } from '../../features/auth';
import { useAuth } from '../../features/auth';
import { LinesPage } from '../../features/lines';
import { UsersPage } from '../../features/users';
import { AnalyticsPage } from '../../features/analytics';
import { MaterialsPage } from '../../features/materials';
import { ChemistryPage } from '../../features/chemistry';
import { ProductionPage } from '../../features/production';
import { OTKPage } from '../../features/otk';
import { WarehousePage } from '../../features/warehouse';
import { SalesPage } from '../../features/sales';
import { ClientsPage } from '../../features/clients';
import { OrdersPage } from '../../features/orders';
import { PaymentsPage } from '../../features/payments';
import { ReturnsPage } from '../../features/returns';
import { MyShiftPage, ShiftsReportPage } from '../../features/shifts';
import DefectsReworkPage from '../../features/defects/components/DefectsReworkPage/DefectsReworkPage';
import ReferenceBooksPage from '../../features/recipes/components/ReferenceBooksPage/ReferenceBooksPage';
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
      path="/"
      element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<DefaultHomeRedirect />} />
      <Route path="users" element={<ProtectedRoute requiredAccess="users"><UsersPage /></ProtectedRoute>} />
      <Route path="lines" element={<ProtectedRoute requiredAccess="lines"><LinesPage /></ProtectedRoute>} />
      <Route path="production" element={<ProtectedRoute requiredAccess="production"><ProductionPage /></ProtectedRoute>} />
      <Route path="materials" element={<ProtectedRoute requiredAccess="materials"><MaterialsPage /></ProtectedRoute>} />
      <Route path="chemistry" element={<ProtectedRoute requiredAccess="chemistry"><ChemistryPage /></ProtectedRoute>} />
      <Route path="directories" element={<ProtectedRoute requiredAccess="recipes"><ReferenceBooksPage /></ProtectedRoute>} />
      <Route path="directories/recipes" element={<ProtectedRoute requiredAccess="recipes"><ReferenceBooksPage /></ProtectedRoute>} />
      <Route path="recipes" element={<Navigate to="/directories/recipes" replace />} />
      <Route path="profiles" element={<Navigate to="/directories" replace />} />
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
            <Route path="returns" element={<ProtectedRoute requiredAccess="returns"><ReturnsPage /></ProtectedRoute>} />
            <Route path="defects" element={<ProtectedRoute requiredAccess="defects"><DefectsReworkPage /></ProtectedRoute>} />
            <Route path="defects/rework" element={<ProtectedRoute requiredAccess="defects"><DefectsReworkPage /></ProtectedRoute>} />
          </Route>
          <Route path="clients" element={<Navigate to="/cash/clients" replace />} />
          <Route path="orders" element={<Navigate to="/cash/orders" replace />} />
          <Route path="sales" element={<Navigate to="/cash/sales" replace />} />
          <Route path="payments" element={<ProtectedRoute requiredAccess="payments"><PaymentsPage /></ProtectedRoute>} />
          <Route path="returns" element={<Navigate to="/cash/returns" replace />} />
          <Route path="defects-rework" element={<Navigate to="/cash/defects" replace />} />
          <Route path="defects-rework/rework" element={<Navigate to="/cash/defects/rework" replace />} />
          <Route path="defects" element={<Navigate to="/cash/defects" replace />} />
          <Route path="rework-requests" element={<Navigate to="/cash/defects/rework" replace />} />
        </>
      )}
      <Route path="forbidden" element={<PlaceholderPage title="Нет доступа" />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default AppRoutes;

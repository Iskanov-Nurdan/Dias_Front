import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../features/auth';
import { ToastProvider } from '../../shared/ui';
import { OperationalRealtimeProvider } from '../../shared/realtime';

function RealtimeWithAuth({ children }) {
  const { user, loading } = useAuth();
  const active = !loading && Boolean(user) && Boolean(localStorage.getItem('token'));
  return (
    <OperationalRealtimeProvider active={active} sessionKey={user?.id != null ? String(user.id) : ''}>
      {children}
    </OperationalRealtimeProvider>
  );
}

const AppProviders = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>
      <RealtimeWithAuth>
        <ToastProvider>{children}</ToastProvider>
      </RealtimeWithAuth>
    </AuthProvider>
  </BrowserRouter>
);

export default AppProviders;

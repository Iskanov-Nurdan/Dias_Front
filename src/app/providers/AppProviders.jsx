import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../features/auth';
import { ToastProvider } from '../../shared/ui';

const AppProviders = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default AppProviders;

import React, { Suspense } from 'react';
import ErrorBoundary from './app/components/ErrorBoundary';
import { AuthProvider } from './app/providers/AuthProvider';
import { ToastProvider } from './app/providers/ToastProvider';
import AppRouter from './app/AppRouter';
import { Loading } from './shared/ui';
import './shared/styles/index.scss';

const App = () => (
  <ErrorBoundary>
    <AuthProvider>
      <ToastProvider>
        <Suspense fallback={<Loading />}>
          <AppRouter />
        </Suspense>
      </ToastProvider>
    </AuthProvider>
  </ErrorBoundary>
);

export default App;

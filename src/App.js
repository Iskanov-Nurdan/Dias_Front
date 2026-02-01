import React, { Suspense } from 'react';
import { AuthProvider } from './app/providers/AuthProvider';
import AppRouter from './app/AppRouter';
import { Loading } from './shared/ui';
import './shared/styles/index.scss';

const App = () => (
  <AuthProvider>
    <Suspense fallback={<Loading />}>
      <AppRouter />
    </Suspense>
  </AuthProvider>
);

export default App;

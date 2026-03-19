import React from 'react';
import AppProviders from './app/providers';
import AppRoutes from './app/routes/AppRoutes';
import './app/index.scss';

const App = () => (
  <AppProviders>
    <AppRoutes />
  </AppProviders>
);

export default App;

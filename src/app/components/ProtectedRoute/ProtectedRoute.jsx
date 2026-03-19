import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../features/auth';

const ACCESS_ROUTE_MAP = {
  analytics: '/analytics',
  users: '/users',
  lines: '/lines',
  materials: '/materials',
  chemistry: '/chemistry',
  recipes: '/recipes',
  orders: '/orders',
  production: '/production',
  otk: '/otk',
  warehouse: '/warehouse',
  clients: '/clients',
  sales: '/sales',
  shipments: '/shipments',
};

const getFirstAccessiblePath = (user) => {
  const accesses = user?.accesses;
  if (!Array.isArray(accesses) || accesses.length === 0) return '/users';
  for (const key of accesses) {
    const path = ACCESS_ROUTE_MAP[key];
    if (path) return path;
  }
  return '/forbidden';
};

const ProtectedRoute = ({ children, requiredAccess }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (requiredAccess) {
    const accesses = user.accesses;
    if (!Array.isArray(accesses) || accesses.length === 0) {
      return <Navigate to="/forbidden" replace />;
    }
    if (!accesses.includes(requiredAccess)) {
      return <Navigate to={getFirstAccessiblePath(user)} replace />;
    }
  }
  return children;
};

export default ProtectedRoute;

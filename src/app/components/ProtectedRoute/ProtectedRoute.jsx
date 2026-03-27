import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../features/auth';
import { getDefaultHomePath } from '../../../shared/config/navigation';

const getFirstAccessiblePath = (user) => getDefaultHomePath(user?.accesses) || '/forbidden';

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

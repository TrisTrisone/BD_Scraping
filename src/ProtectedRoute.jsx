import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, requiredRole }) => {
  const userStr = localStorage.getItem('user');
  
  if (!userStr) {
    return <Navigate to="/" replace />;
  }

  const user = JSON.parse(userStr);

  if (requiredRole && user.role !== requiredRole) {
    // Redirect based on actual role
    if (user.role === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/app" replace />;
  }

  return children;
};

export default ProtectedRoute;


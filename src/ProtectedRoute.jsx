import React from "react";
import { Navigate } from "react-router-dom";
import {jwtDecode} from "jwt-decode"; // you’ll need to install: npm install jwt-decode

const ProtectedRoute = ({ children, requiredRole }) => {
  const userStr = localStorage.getItem("user");

  if (!userStr) {
    return <Navigate to="/" replace />;
  }

  const user = JSON.parse(userStr);

  // ✅ Ensure a token exists
  if (!user.token) {
    return <Navigate to="/" replace />;
  }

  // ✅ Decode and check expiry
  try {
    const decoded = jwtDecode(user.token);
    const now = Date.now() / 1000; // seconds
    if (decoded.exp && decoded.exp < now) {
      // Token expired
      localStorage.removeItem("user");
      return <Navigate to="/" replace />;
    }
  } catch (err) {
    console.error("Invalid JWT:", err);
    localStorage.removeItem("user");
    return <Navigate to="/" replace />;
  }

  // ✅ Role-based protection (only if required)
  if (requiredRole && user.role !== requiredRole) {
    if (user.role === "admin") {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/app" replace />;
  }

  // ✅ All good
  return children;
};

export default ProtectedRoute;

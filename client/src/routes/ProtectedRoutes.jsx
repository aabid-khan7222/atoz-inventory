import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// Basic protected route - requires authentication
export const AuthRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

// Admin route - requires role_id >= 2 (Admin or Super Admin)
export const AdminRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role_id < 2) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

// Super Admin route - requires role_id === 1
export const SuperAdminRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role_id !== 1) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

// Customer route - requires role_id >= 3
export const CustomerRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role_id < 3) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};


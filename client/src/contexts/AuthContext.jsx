// client/src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { login as apiLogin, setAuthToken } from "../api";

const AuthContext = createContext(null);

// hook
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};

// helper: user ko normalize karo (role_id number, role_name safe)
function normalizeUser(rawUser) {
  if (!rawUser) return null;

  const roleId = rawUser.role_id != null ? Number(rawUser.role_id) : null;

  return {
    ...rawUser,
    role_id: roleId,
    // agar backend ne role_name bheja hai to use hi use karo
    role_name: rawUser.role_name || (roleId === 1
      ? "Super Admin"
      : roleId === 2
      ? "Admin"
      : roleId === 3
      ? "Customer"
      : "User"),
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    // Clear state
    setUser(null);
    setToken(null);

    // Clear localStorage
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_api_base");

    // Clear token in api.js
    setAuthToken(null);

    // Dispatch event to notify theme context about user logout
    window.dispatchEvent(new CustomEvent('azb-auth-changed'));
  }, []);

  useEffect(() => {
    // On initial mount, try to load from localStorage
    try {
      const storedToken = localStorage.getItem("auth_token");
      const storedUser = localStorage.getItem("auth_user");
      const currentApiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
      const storedApiBase = localStorage.getItem("auth_api_base");

      // Check if token was created for a different environment (localhost vs production)
      if (storedToken && storedApiBase && storedApiBase !== currentApiBase) {
        console.warn('[AuthContext] Token from different environment detected, clearing auth');
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        localStorage.removeItem("auth_api_base");
        setLoading(false);
        return;
      }

      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser);
        const normalized = normalizeUser(parsedUser);

        setToken(storedToken);
        setUser(normalized);
        setAuthToken(storedToken);

        // Store current API base to detect environment changes
        localStorage.setItem("auth_api_base", currentApiBase);

        // ensure normalized user dubara save ho jaye
        localStorage.setItem("auth_user", JSON.stringify(normalized));

        // Dispatch event to notify theme context about user
        window.dispatchEvent(new CustomEvent('azb-auth-changed'));
      }
    } catch (err) {
      console.error("Error loading auth from localStorage", err);
      // Clear corrupted data
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      localStorage.removeItem("auth_api_base");
    } finally {
      setLoading(false);
    }

    // Listen for invalid auth events (401 errors from API)
    const handleInvalidAuth = () => {
      console.warn('[AuthContext] Token invalidated, clearing auth state');
      logout();
    };

    window.addEventListener('azb-auth-invalid', handleInvalidAuth);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('azb-auth-invalid', handleInvalidAuth);
    };
  }, [logout]);

  const login = async (email, password) => {
    try {
      const response = await apiLogin(email, password);

      if (!response || !response.user || !response.token) {
        throw new Error("Invalid response from server");
      }

      const { user: userData, token: authToken } = response;

      const normalizedUser = normalizeUser(userData);

      // Update state
      setUser(normalizedUser);
      setToken(authToken);

      // Save to localStorage
      const currentApiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
      localStorage.setItem("auth_token", authToken);
      localStorage.setItem("auth_user", JSON.stringify(normalizedUser));
      localStorage.setItem("auth_api_base", currentApiBase); // Store API base to detect environment changes

      // Set token in api.js for future requests
      setAuthToken(authToken);

      // Dispatch event to notify theme context about user change
      window.dispatchEvent(new CustomEvent('azb-auth-changed'));

      // Return user object so caller can redirect by role
      return normalizedUser;
    } catch (err) {
      console.error("Login error", err);
      throw err;
    }
  };


  const updateUser = (partialUser = {}) => {
    setUser((prevUser) => {
      // if no previous user, just store the partial as the full user object
      const merged = prevUser
        ? { ...prevUser, ...partialUser }
        : { ...partialUser };

      const normalized = normalizeUser(merged);
      localStorage.setItem("auth_user", JSON.stringify(normalized));
      return normalized;
    });
  };

  const updateUserProfile = (updatedFields = {}) => {
    updateUser(updatedFields);
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    // Backward compatibility
    isAuthenticated: !!user,
    updateUser,
    updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

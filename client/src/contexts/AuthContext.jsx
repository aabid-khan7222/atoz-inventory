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
    shop_id: rawUser.shop_id != null ? Number(rawUser.shop_id) : 1,
    shop_name: rawUser.shop_name || 'A To Z Battery',
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

  // Helper function to check if JWT token is expired
  const isTokenExpired = (token) => {
    if (!token) return true;
    
    try {
      // JWT tokens have 3 parts separated by dots: header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      
      // Decode the payload (second part)
      const payload = JSON.parse(atob(parts[1]));
      
      // Check if token has expiration claim
      if (!payload.exp) return false; // No expiration claim, assume valid
      
      // Check if token is expired (exp is in seconds, Date.now() is in milliseconds)
      const expirationTime = payload.exp * 1000;
      const currentTime = Date.now();
      
      // Add 5 minute buffer to account for clock skew and network delays
      return currentTime >= (expirationTime - 5 * 60 * 1000);
    } catch (error) {
      console.warn('[AuthContext] Error checking token expiry:', error);
      // If we can't parse the token, assume it's invalid
      return true;
    }
  };

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

      // Check if token is expired BEFORE using it
      if (storedToken && isTokenExpired(storedToken)) {
        console.warn('[AuthContext] Stored token is expired, clearing auth');
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
      console.log('[AuthContext] Starting login for:', email);
      const response = await apiLogin(email, password);
      console.log('[AuthContext] Login API response received:', {
        hasResponse: !!response,
        hasUser: !!response?.user,
        hasToken: !!response?.token,
        responseKeys: response ? Object.keys(response) : [],
        userKeys: response?.user ? Object.keys(response.user) : [],
        tokenLength: response?.token ? response.token.length : 0
      });

      // Check response structure - handle both direct response and nested data
      let userData, authToken;
      
      if (response && response.user && response.token) {
        // Direct structure: { user: {...}, token: "..." }
        userData = response.user;
        authToken = response.token;
        console.log('[AuthContext] Using direct response structure');
      } else if (response && response.data && response.data.user && response.data.token) {
        // Nested structure: { data: { user: {...}, token: "..." } }
        userData = response.data.user;
        authToken = response.data.token;
        console.log('[AuthContext] Using nested response.data structure');
      } else {
        console.error('[AuthContext] Invalid response structure:', response);
        throw new Error("Invalid response from server: missing user or token");
      }

      if (!userData || !authToken) {
        console.error('[AuthContext] Missing user or token after extraction:', { userData, authToken });
        throw new Error("Invalid response from server: missing user or token");
      }

      const normalizedUser = normalizeUser(userData);
      console.log('[AuthContext] User normalized:', { id: normalizedUser?.id, role_id: normalizedUser?.role_id });

      // Update state
      setUser(normalizedUser);
      setToken(authToken);
      console.log('[AuthContext] State updated');

      // Save to localStorage with error handling
      try {
        const currentApiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
        localStorage.setItem("auth_token", authToken);
        localStorage.setItem("auth_user", JSON.stringify(normalizedUser));
        localStorage.setItem("auth_api_base", currentApiBase);
        console.log('[AuthContext] localStorage saved successfully');
        
        // Verify localStorage was saved
        const savedToken = localStorage.getItem("auth_token");
        const savedUser = localStorage.getItem("auth_user");
        if (!savedToken || !savedUser) {
          console.error('[AuthContext] localStorage verification failed:', { savedToken: !!savedToken, savedUser: !!savedUser });
          throw new Error("Failed to save authentication data to localStorage");
        }
        console.log('[AuthContext] localStorage verified');
      } catch (storageError) {
        console.error('[AuthContext] localStorage error:', storageError);
        throw new Error("Failed to save authentication data: " + storageError.message);
      }

      // Set token in api.js for future requests
      setAuthToken(authToken);
      console.log('[AuthContext] Token set in api.js');

      // Dispatch event to notify theme context about user change
      window.dispatchEvent(new CustomEvent('azb-auth-changed'));
      console.log('[AuthContext] Auth changed event dispatched');

      // Return user object so caller can redirect by role
      return normalizedUser;
    } catch (err) {
      console.error("[AuthContext] Login error:", err);
      console.error("[AuthContext] Error details:", {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
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

// client/src/contexts/ThemeContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Helper function to get user-specific theme key
const getThemeKey = (userId) => {
  if (userId) {
    return `azb_theme_${userId}`;
  }
  // Fallback for non-authenticated users (login page)
  return 'azb_theme_guest';
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');
  const [currentUserId, setCurrentUserId] = useState(null);

  // Helper to get current user ID from localStorage
  const getCurrentUserId = () => {
    try {
      const storedUser = localStorage.getItem('auth_user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        return user?.id || user?.user_id || null;
      }
    } catch (err) {
      console.error('Error parsing user from localStorage:', err);
    }
    return null;
  };

  // Load and apply theme for current user
  const loadUserTheme = () => {
    const userId = getCurrentUserId();
    setCurrentUserId(userId);
    
    const themeKey = getThemeKey(userId);
    const savedTheme = localStorage.getItem(themeKey) || 'light';
    setTheme(savedTheme);
    applyTheme(savedTheme, userId);
  };

  // Listen for user changes from localStorage
  useEffect(() => {
    // Check on mount
    loadUserTheme();

    // Listen for storage changes (when user logs in/out in another tab)
    const handleStorageChange = (e) => {
      if (e.key === 'auth_user' || e.key === null) {
        loadUserTheme();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events (when user logs in/out in same tab)
    const handleAuthChange = () => {
      loadUserTheme();
    };
    
    window.addEventListener('azb-auth-changed', handleAuthChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('azb-auth-changed', handleAuthChange);
    };
  }, []);

  // Listen for theme changes from settings
  useEffect(() => {
    const handleThemeChange = (event) => {
      const newTheme = event.detail;
      setTheme(newTheme);
      applyTheme(newTheme);
    };

    window.addEventListener('azb-theme-changed', handleThemeChange);
    return () => {
      window.removeEventListener('azb-theme-changed', handleThemeChange);
    };
  }, [currentUserId]);

  // Apply theme to document
  const applyTheme = (themeValue, userId = null) => {
    const targetUserId = userId !== null ? userId : currentUserId;
    document.documentElement.setAttribute('data-theme', themeValue);
    const themeKey = getThemeKey(targetUserId);
    localStorage.setItem(themeKey, themeValue);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    const userId = getCurrentUserId();
    setTheme(newTheme);
    applyTheme(newTheme, userId);
    window.dispatchEvent(
      new CustomEvent('azb-theme-changed', { detail: newTheme })
    );
  };

  const changeTheme = (newTheme) => {
    const userId = getCurrentUserId();
    setTheme(newTheme);
    applyTheme(newTheme, userId);
    window.dispatchEvent(
      new CustomEvent('azb-theme-changed', { detail: newTheme })
    );
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};


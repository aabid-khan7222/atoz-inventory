import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import './DashboardHeader.css';
import { useNavigate } from "react-router-dom";
import NotificationPanel from './notifications/NotificationPanel';
import api from '../api';


const DashboardHeader = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const previousUnreadCountRef = useRef(0);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // Check if user is a customer (role_id >= 3)
  const isCustomer = user && Number(user.role_id) >= 3;
  // Check if user is admin or super admin
  const isAdminOrSuperAdmin = user && (Number(user.role_id) === 1 || Number(user.role_id) === 2);
  // Show notifications for all authenticated users
  const showNotificationIcon = user && (isCustomer || isAdminOrSuperAdmin);

  // Play notification sound (like WhatsApp/Instagram)
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create a pleasant notification sound pattern (short double beep)
      const playBeep = (frequency, startTime, duration) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = audioContext.currentTime;
      // First beep
      playBeep(800, now, 0.15);
      // Second beep (after a short pause)
      playBeep(800, now + 0.2, 0.15);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
      // Fallback: try using HTML5 Audio API if Web Audio API fails
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUhAKS6Ph8sBlIAUwgM/z1YE1Bh1');
        audio.volume = 0.3;
        audio.play().catch(() => {
          // Ignore audio play errors (user may not have interacted with page)
        });
      } catch (fallbackError) {
        // Silently fail if audio can't be played
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch unread notification count for all users (customers, admin, super admin)
  useEffect(() => {
    if (showNotificationIcon) {
      fetchUnreadCount(false); // Initial load, no sound
      // Poll for updates every 30 seconds
      const interval = setInterval(() => {
        fetchUnreadCount(true); // Check for new notifications and play sound
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [showNotificationIcon]);

  const fetchUnreadCount = async (checkForNewNotifications = false) => {
    try {
      const data = await api.getUnreadNotificationCount();
      const newCount = data.count || 0;
      const previousCount = previousUnreadCountRef.current;
      
      // Play sound if there are new notifications (count increased) and we're checking
      if (checkForNewNotifications && newCount > previousCount && previousCount >= 0) {
        playNotificationSound();
      }
      
      // Update the ref before setting state to avoid stale closure
      previousUnreadCountRef.current = newCount;
      setUnreadCount(newCount);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const handleLogout = () => {
    logout();
    setShowMenu(false);
  };

  const getRoleDisplayName = (roleName) => {
    if (!roleName) return 'User';
    return roleName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Get base path based on user role
  const getBasePath = () => {
    if (!user) return '/admin';
    if (user.role_id === 1) return '/super-admin';
    if (user.role_id === 2) return '/admin';
    if (user.role_id >= 3) return '/customer';
    return '/admin';
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  const initials = getInitials(user?.full_name);

  const profileImageUrl =
    user &&
    (user.avatar_url ||
      user.profileImage ||
      user.profile_image_url);

  return (
    <header className="dashboard-header">
      <div className="dashboard-header-left">
        <div className="dashboard-logo-wrapper">
          <img 
            src="/exide-care.png" 
            alt="Exide Care Logo" 
            className="dashboard-logo"
          />
        </div>
        <h1 className="dashboard-title">A TO Z BATTERY</h1>
      </div>

      <div className="dashboard-header-right" ref={menuRef}>
        {showNotificationIcon && (
          <div className="notification-icon-wrapper">
            <button
              type="button"
              className="notification-icon-button"
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label="Notifications"
              title="Notifications"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M13.73 21a2 2 0 0 1-3.46 0"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>
          </div>
        )}
        <button
          type="button"
          className="theme-toggle-button"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="theme-icon theme-icon-sun"
            >
              <circle
                cx="12"
                cy="12"
                r="4"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 2V3M12 21V22M22 12H21M3 12H2M19.0711 4.92893L18.364 5.63604M5.63604 18.364L4.92893 19.0711M19.0711 19.0711L18.364 18.364M5.63604 5.63604L4.92893 4.92893"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="theme-icon theme-icon-moon"
            >
              <path
                d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="currentColor"
                fillOpacity="0.1"
              />
            </svg>
          )}
        </button>
        <div className="user-info" onClick={() => setShowMenu(!showMenu)}>
          <div className="user-avatar">
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt={user?.full_name || "User avatar"}
                className="dashboard-avatar-img"
              />
            ) : (
              <div className="dashboard-avatar-initials">
                {initials}
              </div>
            )}
          </div>
          <div className="user-details">
            <span className="user-name">{user?.full_name || user?.email || 'User'}</span>
            <span className="user-role">{getRoleDisplayName(user?.role_name)}</span>
          </div>
          <svg
            className={`dropdown-arrow ${showMenu ? 'open' : ''}`}
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 4L6 8L10 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {showMenu && (
  <div className="dropdown-menu">
    <div
      className="dropdown-item"
      onClick={() => {
        navigate(`${getBasePath()}/profile`);
        setShowMenu(false);
      }}
    >
              <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
                <path
                  d="M8 8C9.10457 8 10 7.10457 10 6C10 4.89543 9.10457 4 8 4C6.89543 4 6 4.89543 6 6C6 7.10457 6.89543 8 8 8Z"
                  fill="currentColor"
                />
                <path   
                  d="M8 9C6.34315 9 4 9.89543 4 11V12H12V11C12 9.89543 9.65685 9 8 9Z"
                  fill="currentColor"
                />
              </svg>
              <span>Profile</span>
            </div>
            <div
                      className="dropdown-item"
                      onClick={() => {
                      setShowMenu(false);
                      navigate(`${getBasePath()}/settings`);
             }}
           >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 1L1 4V7C1 10.866 4.134 14 8 14C11.866 14 15 10.866 15 7V4L8 1Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 10V6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M8 6H8.01"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span>Settings</span>
            </div>
            <div className="dropdown-divider"></div>
            <div className="dropdown-item logout" onClick={handleLogout}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 14H3C2.44772 14 2 13.5523 2 13V3C2 2.44772 2.44772 2 3 2H6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 11L14 8L10 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M14 8H6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span>Sign Out</span>
            </div>
          </div>
        )}
      </div>
      {showNotificationIcon && (
        <NotificationPanel
          isOpen={showNotifications}
          onClose={() => {
            setShowNotifications(false);
            fetchUnreadCount(); // Refresh count when closing
          }}
        />
      )}
    </header>
  );
};

export default DashboardHeader;


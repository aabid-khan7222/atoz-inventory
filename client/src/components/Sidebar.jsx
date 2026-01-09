import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = ({ menuItems, basePath }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Helper function to get the route path for a menu item
  const getMenuItemPath = (itemId) => {
    // Map menu item IDs to URL paths
    const pathMap = {
      'dashboard': '',
      'products': '/products',
      'inventory': '/inventory',
      'sales': '/sales',
      'charging': '/charging',
      'services': '/services',
      'guarantee-warranty': '/guarantee-warranty',
      'company-returns': '/company-returns',
      'users': '/user-management',
      'user-management': '/user-management',
      'employees': '/employees',
      'employee-management': '/employees',
      'reports': '/reports',
      'pending-orders': '/pending-orders',
      'orders': '/orders',
      'settings': '/settings',
    };
    
    const path = pathMap[itemId] || '';
    return `${basePath}${path}`;
  };

  // Check if a menu item is active based on current URL
  const isActive = (itemId) => {
    const itemPath = getMenuItemPath(itemId);
    if (itemId === 'dashboard') {
      // Dashboard is active if we're exactly at the base path
      return location.pathname === basePath;
    }
    return location.pathname === itemPath;
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="sidebar-mobile-toggle"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Toggle sidebar"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 6H21M3 12H21M3 18H21"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <button
            className="sidebar-toggle"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label="Toggle sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M3 5H17M3 10H17M3 15H17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            className="sidebar-close-mobile"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M15 5L5 15M5 5L15 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          <ul className="sidebar-menu">
            {menuItems.map((item) => {
              const itemPath = getMenuItemPath(item.id);
              return (
                <li key={item.id}>
                  <Link
                    to={itemPath}
                    className={`menu-item ${isActive(item.id) ? 'active' : ''}`}
                    title={isCollapsed ? item.label : ''}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    {item.icon && <span className="menu-icon">{item.icon}</span>}
                    {!isCollapsed && <span className="menu-label">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;


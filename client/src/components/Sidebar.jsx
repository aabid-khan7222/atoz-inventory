import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = ({ menuItems, basePath, isOpen = true, onClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();

  // Check if mobile/tablet
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && isMobile) {
        const sidebar = document.querySelector('.sidebar');
        const menuToggle = document.querySelector('.mobile-menu-toggle');
        if (sidebar && !sidebar.contains(event.target) && 
            menuToggle && !menuToggle.contains(event.target)) {
          onClose && onClose();
        }
      }
    };

    if (isOpen && isMobile) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, isMobile, onClose]);
  
  // Determine if this is a customer menu (fewer items) or admin menu (more items)
  const isCustomerMenu = menuItems.length <= 8;

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
      {/* Overlay for mobile */}
      {isOpen && isMobile && (
        <div className="sidebar-overlay" onClick={onClose}></div>
      )}
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isOpen ? 'open' : 'closed'}`}>
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
          {/* Close button for mobile */}
          {isMobile && (
            <button
              className="sidebar-close"
              onClick={onClose}
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
          )}
        </div>

        <nav className="sidebar-nav">
          <ul className={`sidebar-menu ${isCustomerMenu ? 'menu-customer' : 'menu-admin'}`}>
            {menuItems.map((item) => {
              const itemPath = getMenuItemPath(item.id);
              return (
                <li key={item.id}>
                  <Link
                    to={itemPath}
                    className={`menu-item ${isActive(item.id) ? 'active' : ''}`}
                    title={isCollapsed ? item.label : ''}
                    onClick={() => {
                      // Close sidebar on mobile when menu item is clicked
                      if (isMobile && onClose) {
                        onClose();
                      }
                    }}
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


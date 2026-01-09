import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import DashboardHeader from '../components/DashboardHeader';
import Sidebar from '../components/Sidebar';
import AdminDashboard from '../components/dashboards/AdminDashboard';
import '../components/Dashboard.css';

const AdminDashboardPage = () => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Check if desktop - sidebar should be open by default on desktop
  useEffect(() => {
    const checkDesktop = () => {
      if (window.innerWidth > 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);
  
  // Extract the active menu from URL path
  const getActiveMenuFromPath = () => {
    const path = location.pathname;
    if (path === '/admin' || path === '/admin/') {
      return 'dashboard';
    }
    // Extract the last part of the path
    const pathParts = path.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      const section = pathParts[1];
      const pathToMenuMap = {
        'settings': 'settings',
        'user-management': 'user-management',
        'inventory': 'inventory',
        'products': 'products',
        'sales': 'sales',
        'charging': 'charging',
        'services': 'services',
        'guarantee-warranty': 'guarantee-warranty',
        'company-returns': 'company-returns',
        'reports': 'reports',
        'employees': 'employees',
        'employee-management': 'employees',
        'pending-orders': 'pending-orders',
        'profile': 'profile'
      };
      return pathToMenuMap[section] || 'dashboard';
    }
    return 'dashboard';
  };

  const activeMenu = getActiveMenuFromPath();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'products', label: 'Products', icon: '📦' },
    { id: 'inventory', label: 'Inventory', icon: '📋' },
    { id: 'sales', label: 'Sales', icon: '💰' },
    { id: 'pending-orders', label: 'Pending Orders', icon: '⏳' },
    { id: 'charging', label: 'Charging Services', icon: '⚡' },
    { id: 'services', label: 'Services', icon: '🧰' },
    { id: 'guarantee-warranty', label: 'Guarantee & Warranty', icon: '🛡️' },
    { id: 'company-returns', label: 'Company Returns', icon: '📤' },
    { id: 'user-management', label: 'User Management', icon: '👥' },
    { id: 'employees', label: 'Employee Management', icon: '👨‍💼' },
    { id: 'reports', label: 'Reports', icon: '📈' },
  ];

  return (
    <div className="dashboard-container">
      <DashboardHeader 
        onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        isSidebarOpen={isSidebarOpen}
      />
      <Sidebar
        menuItems={menuItems}
        basePath="/admin"
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <main className="dashboard-main">
        <AdminDashboard activeMenu={activeMenu} />
      </main>
    </div>
  );
};

export default AdminDashboardPage;


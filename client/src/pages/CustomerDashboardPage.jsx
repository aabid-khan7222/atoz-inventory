import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import DashboardHeader from '../components/DashboardHeader';
import Sidebar from '../components/Sidebar';
import CustomerDashboard from '../components/dashboards/CustomerDashboard';
import { useLanguage } from '../contexts/LanguageContext';
import '../components/Dashboard.css';

const CustomerDashboardPage = () => {
  const { t } = useLanguage();
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
    if (path === '/customer' || path === '/customer/') {
      return 'dashboard';
    }
    // Extract the last part of the path
    const pathParts = path.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      const section = pathParts[1];
      const pathToMenuMap = {
        'settings': 'settings',
        'products': 'products',
        'checkout': 'checkout',
        'orders': 'orders',
        'charging': 'charging',
        'services': 'services',
        'guarantee-warranty': 'guarantee-warranty',
        'reports': 'reports',
        'profile': 'profile'
      };
      return pathToMenuMap[section] || 'dashboard';
    }
    return 'dashboard';
  };

  const activeMenu = getActiveMenuFromPath();

  const menuItems = [
    { id: 'dashboard', label: t('dashboard.title'), icon: '📊' },
    { id: 'products', label: t('dashboard.browseProducts'), icon: '📦' },
    { id: 'orders', label: t('dashboard.myOrders'), icon: '🛒' },
    { id: 'charging', label: t('dashboard.chargingServices'), icon: '⚡' },
    { id: 'services', label: 'Services', icon: '🧰' },
    { id: 'guarantee-warranty', label: 'Guarantee & Warranty', icon: '🛡️' },
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
        basePath="/customer"
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <main className="dashboard-main">
        <CustomerDashboard activeMenu={activeMenu} />
      </main>
    </div>
  );
};

export default CustomerDashboardPage;


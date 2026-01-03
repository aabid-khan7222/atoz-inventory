import React, { useState, useEffect } from 'react';
import './InventoryManagement.css';
import AddStock from './inventory/AddStock';
import SaleStock from './inventory/SellStock';
import CurrentStock from './inventory/CurrentStock';
import PurchaseSection from './inventory/PurchaseSection';
import SoldBatteries from './inventory/SoldBatteries';
import CustomerHistory from './inventory/CustomerHistory';
import api from '../../api';

const InventoryManagement = () => {
  // Check sessionStorage for active section (persist across navigation)
  const savedSection = sessionStorage.getItem('inventoryActiveSection');
  const [activeSection, setActiveSection] = useState(savedSection || null);
  const [metrics, setMetrics] = useState({ stock: 0, series: 0, products: 0 });
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState('');
  
  // Save activeSection to sessionStorage whenever it changes
  useEffect(() => {
    if (activeSection) {
      sessionStorage.setItem('inventoryActiveSection', activeSection);
    } else {
      // Only clear if explicitly set to null (not on initial mount)
      sessionStorage.removeItem('inventoryActiveSection');
    }
  }, [activeSection]);

  const sections = [
    {
      id: 'add-stock',
      title: 'Add Stock',
      description: 'Add new inventory items to your stock',
      icon: '📦',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      component: AddStock
    },
    {
      id: 'sell-stock',
      title: 'Sell Stock',
      description: 'Record sales and reduce inventory',
      icon: '💰',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      component: SaleStock
    },
    {
      id: 'current-stock',
      title: 'Current Stock',
      description: 'View current inventory levels',
      icon: '📊',
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      component: CurrentStock
    },
    {
      id: 'purchase-section',
      title: 'Purchase Section',
      description: 'View all purchase records and details',
      icon: '🛒',
      gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      component: PurchaseSection
    },
    {
      id: 'sold-batteries',
      title: 'Sold Batteries',
      description: 'View all sold batteries with customer details',
      icon: '✅',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      component: SoldBatteries
    },
    {
      id: 'customer-history',
      title: 'Customer History',
      description: 'View complete history for any customer',
      icon: '👤',
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      component: CustomerHistory
    }
  ];

  const handleSectionClick = (sectionId) => {
    setActiveSection(sectionId);
  };

  const handleBack = () => {
    setActiveSection(null);
    // Clear the saved section when going back
    sessionStorage.removeItem('inventoryActiveSection');
  };

  useEffect(() => {
    const fetchMetrics = async () => {
      setMetricsLoading(true);
      setMetricsError('');
      try {
        const categories = ['car-truck-tractor', 'bike', 'ups-inverter'];
        const promises = categories.map(cat => api.getInventory(cat).catch(() => null));
        const results = await Promise.all(promises);

        let totalStock = 0;
        let totalSeries = 0;
        let totalProducts = 0;
        const seriesSet = new Set(); // To avoid counting duplicate series names across categories

        results.forEach((data) => {
          if (!data) return;
          
          // Add total stock
          totalStock += data?.totalStock || 0;
          
          // Count series and products
          if (Array.isArray(data?.series)) {
            data.series.forEach((series) => {
              // Use series name as unique identifier to avoid duplicates
              if (series?.seriesName && !seriesSet.has(series.seriesName)) {
                seriesSet.add(series.seriesName);
                totalSeries++;
              }
              
              // Count products in this series
              if (Array.isArray(series?.products)) {
                totalProducts += series.products.length;
              }
            });
          }
        });

        setMetrics({ stock: totalStock, series: totalSeries, products: totalProducts });
      } catch (err) {
        console.error('Failed to fetch inventory metrics:', err);
        setMetricsError(err.message || 'Failed to load metrics');
      } finally {
        setMetricsLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  const ActiveComponent = activeSection 
    ? sections.find(s => s.id === activeSection)?.component 
    : null;

  return (
    <div className="inventory-management">
      {!activeSection ? (
        <>
          <div className="inventory-header">
            <h2>Inventory Management</h2>
            <p className="inventory-subtitle">
              Manage your inventory with ease
            </p>
          </div>

          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-icon">📦</div>
              <div>
                <p className="metric-label">Total Stock</p>
                <p className="metric-value">
                  {metricsLoading ? '…' : `${metrics.stock || 0} units`}
                </p>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">📊</div>
              <div>
                <p className="metric-label">Series Count</p>
                <p className="metric-value">
                  {metricsLoading ? '…' : `${metrics.series || 0} series`}
                </p>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">🔋</div>
              <div>
                <p className="metric-label">Total Products</p>
                <p className="metric-value">
                  {metricsLoading ? '…' : `${metrics.products || 0} products`}
                </p>
              </div>
            </div>
          </div>

          {metricsError && (
            <div className="inventory-error" style={{ marginTop: '-0.5rem' }}>
              {metricsError}
            </div>
          )}

          <div className="inventory-sections-grid">
            {sections.map((section) => (
              <div
                key={section.id}
                className="inventory-section-card"
                onClick={() => handleSectionClick(section.id)}
                style={{ '--section-gradient': section.gradient }}
              >
                <div className="section-card-cover" style={{ background: section.gradient }}>
                  <div className="section-card-icon">{section.icon}</div>
                </div>
                <div className="section-card-content">
                  <h3>{section.title}</h3>
                  <p>{section.description}</p>
                  <div className="section-card-arrow">→</div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="inventory-section-view">
          <button className="back-button" onClick={handleBack}>
            ← Back to Inventory
          </button>
          {ActiveComponent && <ActiveComponent onBack={handleBack} />}
        </div>
      )}
    </div>
  );
};

export default InventoryManagement; 
import React, { useEffect, useState, useMemo, useLayoutEffect } from 'react';
import './DashboardContent.css';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import CustomerProductListing from './CustomerProductListing.jsx';
import Checkout from './Checkout.jsx';
import CustomerOrders from './CustomerOrders.jsx';
import CustomerGuaranteeWarranty from './CustomerGuaranteeWarranty.jsx';
import CustomerChargingServices from './CustomerChargingServices.jsx';
import CustomerServices from './CustomerServices.jsx';
import CustomerReports from './CustomerReports.jsx';
import { useLanguage } from '../../contexts/LanguageContext';
import api from '../../api';
import { getFormState, saveFormState } from '../../utils/formStateManager';

const STORAGE_KEY = 'customerDashboardState';

const CustomerDashboard = ({ activeMenu }) => {
  const { t } = useLanguage();
  const [ordersCount, setOrdersCount] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [chargingServicesCount, setChargingServicesCount] = useState(0);
  const [chargingServicesLoading, setChargingServicesLoading] = useState(false);

  // Load saved state using utility (automatically handles refresh detection)
  const savedState = getFormState(STORAGE_KEY);
  
  // New states for enhanced dashboard
  const [totalPurchase, setTotalPurchase] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [monthlyData, setMonthlyData] = useState([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(() => savedState?.selectedPeriod || 'last6Months');
  const [selectedCategory, setSelectedCategory] = useState(() => savedState?.selectedCategory || 'all');
  
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Save state to sessionStorage
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    
    const stateToSave = {
      selectedPeriod,
      selectedCategory
    };
    saveFormState(STORAGE_KEY, stateToSave);
  }, [selectedPeriod, selectedCategory, isInitialMount]);

  // Prevent body scroll when modal is open
  useLayoutEffect(() => {
    if (showOrdersModal) {
      // Store original body styles
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalTop = document.body.style.top;
      const originalWidth = document.body.style.width;
      
      // Get current scroll position
      const scrollY = window.scrollY;
      
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      // Prevent scroll on overlay
      const preventScroll = (e) => {
        // Allow scrolling inside modal content
        const modalContent = e.target.closest('.dashboard-modal');
        if (!modalContent) {
          e.preventDefault();
        }
      };
      
      // Prevent touchmove on overlay (mobile)
      const preventTouchMove = (e) => {
        const modalContent = e.target.closest('.dashboard-modal');
        if (!modalContent) {
          e.preventDefault();
        }
      };
      
      document.addEventListener('wheel', preventScroll, { passive: false });
      document.addEventListener('touchmove', preventTouchMove, { passive: false });
      
      return () => {
        // Restore original body styles
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.width = originalWidth;
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
        
        // Remove event listeners
        document.removeEventListener('wheel', preventScroll);
        document.removeEventListener('touchmove', preventTouchMove);
      };
    }
  }, [showOrdersModal]);

  useEffect(() => {
    // Only load when customer is on the dashboard view
    if (activeMenu !== 'dashboard') return;

    let isMounted = true;

    const fetchDashboardData = async () => {
      setOrdersLoading(true);
      setMetricsLoading(true);
      try {
        // Determine how many records to fetch based on period
        const fetchLimit = selectedPeriod === 'allTime' ? 500 : 100;
        const response = await api.getSales(1, fetchLimit);
        if (!isMounted) return;
        
        const sales = Array.isArray(response) ? response : (response?.items || []);
        setOrdersCount(sales.length);

        // Fetch details for each sale
        const detailLimit = selectedPeriod === 'allTime' ? 100 : 50;
        const recentSales = sales.slice(0, detailLimit);
        const detailedSales = await Promise.all(
          recentSales.map(s => api.getSaleById(s.invoice_number || s.id).catch(() => null))
        );

        if (!isMounted) return;

        let total = 0;
        let pending = 0;
        const monthMap = {};

        // Calculate date range based on selectedPeriod
        const now = new Date();
        let monthsToShow = 6;
        let startFrom = new Date(now.getFullYear(), now.getMonth(), 1);

        if (selectedPeriod === 'currentMonth') {
          monthsToShow = 1;
        } else if (selectedPeriod === 'lastMonth') {
          monthsToShow = 1;
          startFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        } else if (selectedPeriod === 'last2Months') {
          monthsToShow = 2;
        } else if (selectedPeriod === 'last6Months') {
          monthsToShow = 6;
        } else if (selectedPeriod === 'last1Year') {
          monthsToShow = 12;
        } else if (selectedPeriod === 'last2Years') {
          monthsToShow = 24;
        } else if (selectedPeriod === 'allTime') {
          monthsToShow = 0; // Will be calculated from data
        }

        // Initialize monthMap
        if (selectedPeriod !== 'allTime') {
          for (let i = monthsToShow - 1; i >= 0; i--) {
            const d = new Date(startFrom.getFullYear(), startFrom.getMonth() - i, 1);
            const monthKey = d.toLocaleString('default', { month: 'short', year: '2-digit' });
            monthMap[monthKey] = 0;
          }
        }

        detailedSales.forEach(sale => {
          if (!sale) return;

          const items = Array.isArray(sale.items) ? sale.items : [];
          
          // Filter items by category if selected
          const filteredItems = selectedCategory === 'all' 
            ? items 
            : items.filter(item => {
                const itemCat = (item.CATEGORY || item.category || '').toLowerCase();
                // Handle sub-categories or variations if needed
                if (selectedCategory === 'ups-inverter') {
                  return itemCat.includes('ups') || itemCat.includes('inverter');
                }
                return itemCat === selectedCategory;
              });

          if (filteredItems.length === 0) return;

          const saleTotal = filteredItems.reduce((sum, item) => sum + Number(item.final_amount || 0), 0);
          
          total += saleTotal;

          const status = (sale.payment_status || '').toLowerCase();
          if (status === 'pending' || status === 'partial') {
            pending += saleTotal;
          }

          const date = new Date(sale.created_at || sale.purchase_date);
          const monthKey = date.toLocaleString('default', { month: 'short', year: '2-digit' });
          
          if (selectedPeriod === 'allTime') {
            if (!monthMap[monthKey]) monthMap[monthKey] = 0;
            monthMap[monthKey] += saleTotal;
          } else {
            if (monthMap[monthKey] !== undefined) {
              monthMap[monthKey] += saleTotal;
            }
          }
        });

        setTotalPurchase(total);
        setPendingAmount(pending);
        
        // Convert monthMap to array for recharts
        const chartData = Object.keys(monthMap).map(key => {
          const parts = key.split(' ');
          const monthName = parts[0];
          const yearShort = parts[1];
          const year = yearShort ? 2000 + parseInt(yearShort) : now.getFullYear();
          const monthIndex = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(monthName);
          return {
            month: key,
            amount: monthMap[key],
            timestamp: new Date(year, monthIndex).getTime()
          };
        });

        chartData.sort((a, b) => a.timestamp - b.timestamp);

        setMonthlyData(chartData);

      } catch (err) {
        console.error('Error fetching dashboard metrics:', err);
      } finally {
        if (isMounted) {
          setOrdersLoading(false);
          setMetricsLoading(false);
        }
      }
    };

    const fetchChargingServicesCount = async () => {
      setChargingServicesLoading(true);
      try {
        const response = await api.getMyChargingServices({});
        if (!isMounted) return;
        
        // Handle both direct array and paginated object responses
        const data = Array.isArray(response) ? response : (response?.items || []);
        setChargingServicesCount(data.length);
      } catch (err) {
        console.error('Error fetching charging services count:', err);
        if (!isMounted) return;
        setChargingServicesCount(0);
      } finally {
        if (isMounted) {
          setChargingServicesLoading(false);
        }
      }
    };

    fetchDashboardData();
    fetchChargingServicesCount();

    return () => {
      isMounted = false;
    };
  }, [activeMenu, selectedPeriod, selectedCategory]);

  const renderContent = () => {
    switch (activeMenu) {
      case 'dashboard':
        return (
          <div className="dashboard-content">
            <div className="dashboard-header">
              <h2>{t('dashboard.welcomeTo')}</h2>
            </div>
            
            <div className="stats-grid">
              <button
                type="button"
                className="stat-card stat-card-clickable metric-card-revenue"
                onClick={() => setShowOrdersModal(true)}
              >
                <div className="stat-icon">🛒</div>
                <div className="stat-info">
                  <h3>{t('dashboard.myOrders')}</h3>
                  <p className="stat-value">
                    {ordersLoading ? '…' : ordersCount}
                  </p>
                </div>
              </button>
              
              <button
                type="button"
                className="stat-card stat-card-clickable metric-card-products"
                onClick={() => {
                  window.location.hash = '#charging';
                }}
              >
                <div className="stat-icon">⚡</div>
                <div className="stat-info">
                  <h3>{t('dashboard.chargingServices')}</h3>
                  <p className="stat-value">
                    {chargingServicesLoading ? '…' : chargingServicesCount}
                  </p>
                </div>
              </button>

              {/* Enhanced Dashboard Cards */}
              <div className="stat-card metric-card-revenue">
                <div className="stat-icon">💰</div>
                <div className="stat-info">
                  <h3>{t('dashboard.totalPurchase')}</h3>
                  <p className="stat-value">
                    {metricsLoading ? '…' : `₹${totalPurchase.toLocaleString('en-IN')}`}
                  </p>
                </div>
              </div>

              <div className="stat-card metric-card-inventory">
                <div className="stat-icon">📄</div>
                <div className="stat-info">
                  <h3>{t('dashboard.totalInvoices')}</h3>
                  <p className="stat-value">
                    {metricsLoading ? '…' : ordersCount}
                  </p>
                </div>
              </div>

              <div className="stat-card metric-card-alerts">
                <div className="stat-icon">⏳</div>
                <div className="stat-info">
                  <h3>{t('dashboard.pendingAmount')}</h3>
                  <p className="stat-value">
                    {metricsLoading ? '…' : `₹${pendingAmount.toLocaleString('en-IN')}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Monthly Purchase Graph */}
            <div className="chart-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ margin: 0 }}>{t('dashboard.monthlyPurchaseOverview')}</h3>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <select 
                    className="period-selector"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="all">{t('dashboard.allCategories')}</option>
                    <option value="car-truck-tractor">{t('products.category.carTruckTractor')}</option>
                    <option value="bike">{t('products.category.bike')}</option>
                    <option value="ups-inverter">{t('products.category.upsInverter')}</option>
                  </select>
                  <select 
                    className="period-selector"
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                  >
                    <option value="currentMonth">{t('dashboard.periods.currentMonth')}</option>
                    <option value="lastMonth">{t('dashboard.periods.lastMonth')}</option>
                    <option value="last2Months">{t('dashboard.periods.last2Months')}</option>
                    <option value="last6Months">{t('dashboard.periods.last6Months')}</option>
                    <option value="last1Year">{t('dashboard.periods.last1Year')}</option>
                    <option value="last2Years">{t('dashboard.periods.last2Years')}</option>
                    <option value="allTime">{t('dashboard.periods.allTime')}</option>
                  </select>
                </div>
              </div>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--corp-border)" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'var(--corp-text-muted)', fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'var(--corp-text-muted)', fontSize: 12 }}
                      tickFormatter={(value) => `₹${value}`}
                    />
                    <Tooltip 
                      cursor={{ fill: 'var(--corp-bg-hover)' }}
                      contentStyle={{ 
                        borderRadius: '8px', 
                        border: '1px solid var(--corp-border)',
                        boxShadow: 'var(--corp-shadow-md)',
                        backgroundColor: 'var(--corp-bg-card)'
                      }}
                      formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, t('dashboard.totalPurchase')]}
                    />
                    <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]}>
                      {monthlyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === monthlyData.length - 1 ? '#2563eb' : '#94a3b8'} opacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Offers & Updates Section */}
            <div className="content-section">
              <h3>{t('dashboard.offersAndUpdates')}</h3>
              
              {/* Exide Mileage ISS New Series Launch Alert Banner */}
              <div className="series-launch-alert">
                <div className="alert-top-bar">
                  <div className="alert-top-left">INDIA'S No. 1 AUTOMOTIVE BATTERY</div>
                  <div className="alert-top-right">INDIA MOVES ON <span className="exide-red">EXIDE</span></div>
                </div>
                
                <div className="alert-badge">🔋 NEW SERIES LAUNCH</div>
                
                <div className="alert-content">
                  <div className="alert-header-section">
                    <div className="alert-title-group">
                      <span className="alert-presenting">PRESENTING</span>
                      <h2 className="alert-brand">EXIDE</h2>
                      <div className="alert-product-name">
                        <span className="alert-mileage">Mileage</span>
                        <span className="alert-iss">ISS</span>
                      </div>
                    </div>
                    <div className="alert-warranty-badge">
                      <div className="alert-warranty-number">60</div>
                      <div className="alert-warranty-text">MONTH WARRANTY</div>
                    </div>
                  </div>
                  
                  <div className="alert-tagline">
                    NOW GET MORE FOR YOUR <span className="alert-hybrid">HYBRID CARS</span>
                  </div>
                  
                  <div className="alert-features">
                    <div className="alert-feature-item">
                      <div className="alert-feature-icon">⚡</div>
                      <div className="alert-feature-content">
                        <div className="alert-feature-title">MORE PERFORMANCE</div>
                        <div className="alert-feature-bars">
                          <div className="alert-bar alert-bar-1"></div>
                          <div className="alert-bar alert-bar-2"></div>
                          <div className="alert-bar alert-bar-3"></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="alert-feature-item">
                      <div className="alert-feature-icon">⛽</div>
                      <div className="alert-feature-content">
                        <div className="alert-feature-title">MORE EFFICIENT</div>
                        <div className="alert-feature-bars">
                          <div className="alert-bar alert-bar-1"></div>
                          <div className="alert-bar alert-bar-2"></div>
                          <div className="alert-bar alert-bar-3"></div>
                          <div className="alert-bar alert-bar-4"></div>
                          <div className="alert-bar alert-bar-5"></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="alert-feature-item">
                      <div className="alert-feature-icon">🔋</div>
                      <div className="alert-feature-content">
                        <div className="alert-feature-title">MORE ADVANCED</div>
                        <div className="alert-feature-tech">
                          <div className="alert-tech-line"></div>
                          <div className="alert-tech-line"></div>
                          <div className="alert-tech-line"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="alert-types">
                    <div className="alert-types-header">TYPES</div>
                    <div className="alert-types-list">
                      <div className="alert-type-item">MLM42(ISS)</div>
                      <div className="alert-type-item">MLN55(ISS)</div>
                      <div className="alert-type-item">MLDIN47RMFISS</div>
                      <div className="alert-type-item">MLDIN70(ISS)</div>
                    </div>
                  </div>
                  
                  <div className="alert-footer">
                    <div className="alert-conditions">*Conditions Apply</div>
                    <button 
                      className="alert-cta-button"
                      onClick={() => {
                        window.location.href = '/customer/products?category=car-truck-tractor&series=' + encodeURIComponent('EXIDE MILEAGE ISS');
                      }}
                    >
                      Explore Products →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {showOrdersModal && (
              <div
                className="dashboard-modal-overlay"
                onClick={() => setShowOrdersModal(false)}
                onWheel={(e) => {
                  // Prevent scroll on overlay, allow on modal content
                  if (e.target === e.currentTarget) {
                    e.preventDefault();
                  }
                }}
                onTouchMove={(e) => {
                  // Prevent touch scroll on overlay, allow on modal content
                  if (e.target === e.currentTarget) {
                    e.preventDefault();
                  }
                }}
                style={{
                  overflow: 'hidden',
                  overscrollBehavior: 'none',
                  touchAction: 'none'
                }}
              >
                <div
                  className="dashboard-modal"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="dashboard-modal-header">
                    <h3>{t('dashboard.myOrders')}</h3>
                    <button
                      type="button"
                      className="dashboard-modal-close"
                      onClick={() => setShowOrdersModal(false)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="dashboard-modal-body">
                    <CustomerOrders />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case 'products':
        return <CustomerProductListing />;
      case 'checkout':
        return <Checkout />;
      case 'orders':
        return <CustomerOrders />;
      case 'charging':
        return <CustomerChargingServices />;
      case 'services':
        return <CustomerServices />;
      case 'guarantee-warranty':
        return <CustomerGuaranteeWarranty />;
      case 'reports':
        return <CustomerReports />;
      default:
        return (
          <div className="dashboard-content">
            <h2>{t('dashboard.welcomeMessage')}</h2>
            <p>{t('dashboard.selectMenuItem')}</p>
          </div>
        );
    }
  };

  return renderContent();
};

export default CustomerDashboard;


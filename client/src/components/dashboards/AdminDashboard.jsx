import { useState, useEffect } from 'react';
import './DashboardContent.css';
import InventoryManagement from './InventoryManagement.jsx';
import ProductManagement from './ProductManagement.jsx';
import GuaranteeWarranty from './GuaranteeWarranty.jsx';
import UserManagement from './UserManagement.jsx';
import ChargingServices from './ChargingServices.jsx';
import CompanyReturns from './CompanyReturns.jsx';
import ServiceManagement from './ServiceManagement.jsx';
import Reports from './Reports.jsx';
import EmployeeManagement from './EmployeeManagement.jsx';
import PendingOrders from './PendingOrders.jsx';
import { 
  getDashboardOverview, 
  getSalesAnalytics, 
  getInventoryInsights, 
  getServiceManagement, 
  getRecentTransactions,
  getSalesDetail,
} from '../../api';
import { 
  SalesTrendChart, 
  SalesByTypeChart, 
  CategoryPerformanceChart,
  ServiceStatusChart,
  ServicesByTypeChart,
  PaymentMethodsChart,
  StockByCategoryChart
} from './DashboardCharts';
import { getFormState, saveFormState } from '../../utils/formStateManager';

const STORAGE_KEY = 'adminDashboardState';

const AdminDashboard = ({ activeMenu }) => {
  // Load saved state using utility (automatically handles refresh detection)
  const savedState = getFormState(STORAGE_KEY);
  const [dashboardData, setDashboardData] = useState({
    overview: null,
    salesAnalytics: null,
    inventoryInsights: null,
    services: null,
    recentTransactions: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(() => savedState?.period || 'all');
  const [salesDetail, setSalesDetail] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState(null);
  const [seriesSearchTerm, setSeriesSearchTerm] = useState(() => savedState?.seriesSearchTerm || '');
  const [seriesSortConfig, setSeriesSortConfig] = useState(() => savedState?.seriesSortConfig || { field: 'revenue', direction: 'desc' });
  const [seriesFilterCategory, setSeriesFilterCategory] = useState(() => savedState?.seriesFilterCategory || 'all');

  const [productSearchTerm, setProductSearchTerm] = useState(() => savedState?.productSearchTerm || '');
  const [productSortConfig, setProductSortConfig] = useState(() => savedState?.productSortConfig || { field: 'revenue', direction: 'desc' });
  const [productFilterCategory, setProductFilterCategory] = useState(() => savedState?.productFilterCategory || 'all');
  const [productFilterSeries, setProductFilterSeries] = useState(() => savedState?.productFilterSeries || 'all');
  const [detailSearchTerm, setDetailSearchTerm] = useState(() => savedState?.detailSearchTerm || '');
  const [detailFilterCategory, setDetailFilterCategory] = useState(() => savedState?.detailFilterCategory || 'all');
  const [detailFilterSeries, setDetailFilterSeries] = useState(() => savedState?.detailFilterSeries || 'all');
  const [detailSortConfig, setDetailSortConfig] = useState(() => savedState?.detailSortConfig || { field: 'date', direction: 'desc' });
  const [transactionSearchTerm, setTransactionSearchTerm] = useState(() => savedState?.transactionSearchTerm || '');
  const [transactionSortConfig, setTransactionSortConfig] = useState(() => savedState?.transactionSortConfig || { field: 'date', direction: 'desc' });
  const [openSalesSections, setOpenSalesSections] = useState(() => savedState?.openSalesSections || {
    series: false,
    product: false,
    details: false,
  });
  
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Save state to sessionStorage
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    
    const stateToSave = {
      period,
      seriesSearchTerm,
      seriesSortConfig,
      seriesFilterCategory,
      productSearchTerm,
      productSortConfig,
      productFilterCategory,
      productFilterSeries,
      detailSearchTerm,
      detailFilterCategory,
      detailFilterSeries,
      detailSortConfig,
      transactionSearchTerm,
      transactionSortConfig,
      openSalesSections
    };
    saveFormState(STORAGE_KEY, stateToSave);
  }, [period, seriesSearchTerm, seriesSortConfig, seriesFilterCategory, productSearchTerm, productSortConfig, productFilterCategory, productFilterSeries, detailSearchTerm, detailFilterCategory, detailFilterSeries, detailSortConfig, transactionSearchTerm, transactionSortConfig, openSalesSections, isInitialMount]);

  useEffect(() => {
    if (activeMenu === 'dashboard') {
      loadDashboardData();
    }
    if (activeMenu === 'sales') {
      loadSalesDetail();
    }
  }, [activeMenu, period]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overview, salesAnalytics, inventoryInsights, services, transactions] = await Promise.all([
        getDashboardOverview('today'),
        getSalesAnalytics(period),
        getInventoryInsights(),
        getServiceManagement(),
        getRecentTransactions(10)
      ]);

      setDashboardData({
        overview,
        salesAnalytics,
        inventoryInsights,
        services,
        recentTransactions: transactions
      });
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadSalesDetail = async () => {
    setSalesLoading(true);
    setSalesError(null);
    try {
      const response = await getSalesDetail(period);
      setSalesDetail(Array.isArray(response.items) ? response.items : []);
    } catch (err) {
      console.error('Error loading sales detail:', err);
      setSalesError(err.message || 'Failed to load sales data');
    } finally {
      setSalesLoading(false);
    }
  };

  const getTxnSortIcon = (field) => {
    if (transactionSortConfig.field !== field) return '↕️';
    return transactionSortConfig.direction === 'asc' ? '▲' : '▼';
  };

  // Normalize category values to match filter dropdown values
  const normalizeCategory = (category) => {
    if (!category) return 'Other';
    const cat = category.toLowerCase().trim();
    // Match any form that mentions car/truck/tractor, including with slashes or dashes
    if (
      cat === 'car-truck-tractor' ||
      cat.includes('car') ||
      cat.includes('truck') ||
      cat.includes('tractor')
    ) {
      return 'car-truck-tractor';
    }
    if (cat === 'bike' || cat.includes('bike')) {
      return 'bike';
    }
    if (
      cat === 'ups-inverter' ||
      cat.includes('ups') ||
      cat.includes('inverter')
    ) {
      return 'ups-inverter';
    }
    return 'Other';
  };

  const groupSalesBySeries = (items) => {
    const map = new Map();
    items.forEach((item) => {
      // Only include confirmed items (with serial numbers)
      const serialNumber = item.serialNumber || item.serial_number || item.SERIAL_NUMBER || '';
      const isConfirmed = serialNumber.trim() !== '';
      if (!isConfirmed) return; // Skip pending items
      
      const series = (item.series || item.product_series || 'Other').trim();
      const category = normalizeCategory(item.category || item.product_category);
      const quantity = Number(item.quantity || 0);
      const revenue = Number(item.totalPrice ?? item.total_price ?? 0);

      const key = series;
      if (!map.has(key)) {
        map.set(key, {
          series,
          quantity: 0,
          revenue: 0,
          categorySet: new Set(),
        });
      }
      const entry = map.get(key);
      entry.quantity += quantity;
      entry.revenue += revenue;
      if (category) entry.categorySet.add(category);
    });
    return Array.from(map.values()).map((row) => ({
      ...row,
      category:
        row.categorySet.size === 1
          ? Array.from(row.categorySet)[0]
          : 'mixed',
    }));
  };

  const groupSalesByProduct = (items) => {
    const map = new Map();
    items.forEach((item) => {
      // Only include confirmed items (with serial numbers)
      const serialNumber = item.serialNumber || item.serial_number || item.SERIAL_NUMBER || '';
      const isConfirmed = serialNumber.trim() !== '';
      if (!isConfirmed) return; // Skip pending items
      
      const series = (item.series || item.product_series || 'Other').trim();
      const productName = item.productName || item.product_name || item.name || '';
      const sku = item.sku || item.productSku || item.product_sku || '';
      const category = normalizeCategory(item.category || item.product_category);
      const customer = item.customerName || item.customer_name || '';
      const quantity = Number(item.quantity || 0);
      const revenue = Number(item.totalPrice ?? item.total_price ?? 0);

      const key = `${series}|${productName}|${sku}`;
      if (!map.has(key)) {
        map.set(key, {
          series,
          productName,
          sku,
          quantity: 0,
          revenue: 0,
          categorySet: new Set(),
          customerSet: new Set(),
        });
      }
      const entry = map.get(key);
      entry.quantity += quantity;
      entry.revenue += revenue;
      if (category) entry.categorySet.add(category);
      if (customer) entry.customerSet.add(customer);
    });
    return Array.from(map.values()).map((row) => ({
      ...row,
      customersText: Array.from(row.customerSet).join(' ').toLowerCase(),
      category:
        row.categorySet.size === 1
          ? Array.from(row.categorySet)[0]
          : 'mixed',
    }));
  };

  // --- Independent table helpers ---
  const handleSeriesSort = (field) => {
    setSeriesSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleProductSort = (field) => {
    setProductSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleDetailSort = (field) => {
    setDetailSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSeriesSortIcon = (field) => {
    if (seriesSortConfig.field !== field) return '↕️';
    return seriesSortConfig.direction === 'asc' ? '▲' : '▼';
  };

  const getProductSortIcon = (field) => {
    if (productSortConfig.field !== field) return '↕️';
    return productSortConfig.direction === 'asc' ? '▲' : '▼';
  };

  const getDetailSortIcon = () => '';

  const renderSalesSectionHeader = (id, title) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1rem',
        background: 'var(--corp-bg-tertiary, #eef2ff)',
        border: '1px solid var(--corp-border, #cbd5e1)',
        borderRadius: '0.5rem',
        cursor: 'pointer',
        marginBottom: '0.75rem',
      }}
      onClick={() =>
        setOpenSalesSections((prev) => ({
          ...prev,
          [id]: !prev[id],
        }))
      }
    >
      <strong style={{ color: 'var(--corp-text-primary, #0f172a)' }}>{title}</strong>
      <span style={{ fontSize: '0.9rem', color: 'var(--corp-text-secondary, #475569)' }}>
        {openSalesSections[id] ? 'Hide ▲' : 'Show ▼'}
      </span>
    </div>
  );

  const getSeriesTableData = () => {
    // Filter by category BEFORE grouping to avoid 'mixed' category issues
    let filteredItems = salesDetail;
    if (seriesFilterCategory !== 'all') {
      filteredItems = salesDetail.filter((item) => {
        const category = normalizeCategory(item.category || item.product_category);
        return category === seriesFilterCategory;
      });
    }
    
    let rows = groupSalesBySeries(filteredItems);
    
    // Apply search filter
    const term = seriesSearchTerm.trim().toLowerCase();
    if (term) {
      rows = rows.filter((row) => 
        (row.series || '').toLowerCase().includes(term)
      );
    }
    
    // Apply sorting
    const sorted = [...rows];
    const dir = seriesSortConfig.direction === 'asc' ? 1 : -1;
    switch (seriesSortConfig.field) {
      case 'series':
        sorted.sort((a, b) => (a.series || '').localeCompare(b.series || '') * dir);
        break;
      case 'quantity':
        sorted.sort((a, b) => (a.quantity - b.quantity) * dir);
        break;
      case 'revenue':
      default:
        sorted.sort((a, b) => (a.revenue - b.revenue) * dir);
        break;
    }
    return sorted;
  };

  const getProductTableData = () => {
    // Filter by category and series BEFORE grouping
    let filteredItems = salesDetail;
    if (productFilterCategory !== 'all') {
      filteredItems = filteredItems.filter((item) => {
        const category = normalizeCategory(item.category || item.product_category);
        return category === productFilterCategory;
      });
    }
    if (productFilterSeries !== 'all') {
      filteredItems = filteredItems.filter((item) => {
        const series = (item.series || item.product_series || 'Other').trim();
        return series === productFilterSeries.trim();
      });
    }
    
    let rows = groupSalesByProduct(filteredItems);
    
    // Apply search filter
    const term = productSearchTerm.trim().toLowerCase();
    if (term) {
      rows = rows.filter(
        (row) =>
          (row.productName || '').toLowerCase().includes(term) ||
          (row.sku || '').toLowerCase().includes(term) ||
          (row.series || '').toLowerCase().includes(term) ||
          (row.category || '').toLowerCase().includes(term)
      );
    }
    
    // Apply sorting
    const sorted = [...rows];
    const dir = productSortConfig.direction === 'asc' ? 1 : -1;
    switch (productSortConfig.field) {
      case 'series':
        sorted.sort((a, b) => (a.series || '').localeCompare(b.series || '') * dir);
        break;
      case 'product':
        sorted.sort((a, b) => (a.productName || '').localeCompare(b.productName || '') * dir);
        break;
      case 'sku':
        sorted.sort((a, b) => (a.sku || '').localeCompare(b.sku || '') * dir);
        break;
      case 'quantity':
        sorted.sort((a, b) => (a.quantity - b.quantity) * dir);
        break;
      case 'revenue':
      default:
        sorted.sort((a, b) => (a.revenue - b.revenue) * dir);
        break;
    }
    return sorted;
  };

  const normalizeDetailItem = (item) => {
    const customerName =
      item.customerName ||
      item.customer_name ||
      item.customer_full_name ||
      item.customer ||
      '';
    const productName =
      item.productName ||
      item.product_name ||
      item.name ||
      '';
    const sku =
      item.sku ||
      item.productSku ||
      item.product_sku ||
      item.SKU ||
      '';
    const series =
      (item.series ||
      item.product_series ||
      item.SERIES ||
      'Other').trim();
    const category = normalizeCategory(
      item.category ||
      item.product_category ||
      item.CATEGORY
    );
    return {
      raw: item,
      date: item.date || item.created_at,
      invoiceNumber: item.invoiceNumber || item.invoice_number || item.id,
      customerName,
      customerPhone:
        item.customerPhone ||
        item.customer_phone ||
        item.customer_mobile_number ||
        '',
      customerId:
        item.customerId ||
        item.customer_id ||
        item.customerID ||
        item.customerid ||
        item.customerIdRef ||
        item.raw?.customerId ||
        item.raw?.customer_id ||
        null,
      vehicleNumber:
        item.vehicleNumber ||
        item.vehicle_number ||
        item.customer_vehicle_number ||
        '',
      category,
      series,
      productName,
      sku,
      serialNumber:
        item.serialNumber ||
        item.serial_number ||
        item.SERIAL_NUMBER ||
        '',
      quantity: Number(item.quantity || item.QUANTITY || 0),
      unitPrice: Number(item.unitPrice || item.unit_price || item.final_amount || item.amount || 0),
      totalPrice: Number(item.totalPrice ?? item.total_price ?? item.final_amount ?? item.amount ?? 0),
      isConfirmed: (item.serialNumber || item.serial_number || item.SERIAL_NUMBER || '').trim() !== '',
      hasCommission: item.hasCommission || item.has_commission || false,
      commissionAmount: Number(item.commissionAmount || item.commission_amount || 0),
      commissionAgentName: item.commissionAgentName || item.commission_agent_name || null,
      commissionAgentMobile: item.commissionAgentMobile || item.commission_agent_mobile || null,
      oldBatteryBrand: item.oldBatteryBrand || item.old_battery_brand || null,
      oldBatteryName: item.oldBatteryName || item.old_battery_name || null,
      oldBatterySerialNumber: item.oldBatterySerialNumber || item.old_battery_serial_number || null,
      oldBatteryAhVa: item.oldBatteryAhVa || item.old_battery_ah_va || null,
      oldBatteryTradeInValue: Number(item.oldBatteryTradeInValue || item.old_battery_trade_in_value || 0),
    };
  };

  const getDetailTableData = () => {
    let rows = salesDetail.map(normalizeDetailItem);
    
    // Filter out pending items (items without serial numbers) from sales details
    rows = rows.filter((item) => item.isConfirmed);
    
    // Apply category filter
    if (detailFilterCategory !== 'all') {
      rows = rows.filter((item) => {
        return item.category === detailFilterCategory;
      });
    }
    
    // Apply series filter (case-insensitive, trimmed)
    if (detailFilterSeries !== 'all') {
      rows = rows.filter((item) => {
        const series = (item.series || 'Other').trim();
        return series === detailFilterSeries.trim();
      });
    }
    
    // Apply search filter
    const term = detailSearchTerm.trim().toLowerCase();
    if (term) {
      rows = rows.filter((item) =>
        (item.customerName || '').toLowerCase().includes(term) ||
        (item.productName || '').toLowerCase().includes(term) ||
        (item.sku || '').toLowerCase().includes(term) ||
        (item.series || '').toLowerCase().includes(term) ||
        (item.invoiceNumber || '').toLowerCase().includes(term) ||
        (item.category || '').toLowerCase().includes(term)
      );
    }

    // Apply sorting
    const sorted = [...rows];
    const dir = detailSortConfig.direction === 'asc' ? 1 : -1;
    switch (detailSortConfig.field) {
      case 'date':
        sorted.sort((a, b) => (new Date(a.date || 0) - new Date(b.date || 0)) * dir);
        break;
      case 'customer':
        sorted.sort((a, b) => (a.customerName || '').localeCompare(b.customerName || '') * dir);
        break;
      case 'series':
        sorted.sort((a, b) => (a.series || 'Other').localeCompare(b.series || 'Other') * dir);
        break;
      case 'product':
        sorted.sort((a, b) => (a.productName || '').localeCompare(b.productName || '') * dir);
        break;
      case 'sku':
        sorted.sort((a, b) => (a.sku || '').localeCompare(b.sku || '') * dir);
        break;
      case 'quantity':
        sorted.sort((a, b) => (a.quantity - b.quantity) * dir);
        break;
      case 'total':
        sorted.sort((a, b) => (a.totalPrice - b.totalPrice) * dir);
        break;
      default:
        break;
    }
    return sorted;
  };

  // Get unique series for filter dropdown
  const getUniqueSeries = (items) => {
    const seriesSet = new Set();
    items.forEach(item => {
      // Check multiple possible field names for series
      const series = item.series || item.product_series || item.SERIES;
      if (series && series.trim()) {
        seriesSet.add(series.trim());
      }
    });
    return Array.from(seriesSet).sort();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';
    const d = new Date(value);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
  };

  const handleTransactionSort = (field) => {
    setTransactionSortConfig((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
  };

  const getFilteredTransactions = () => {
    const txns = dashboardData.recentTransactions || [];
    let data = txns;

    if (transactionSearchTerm) {
      const term = transactionSearchTerm.toLowerCase();
      data = data.filter((txn) => {
        return (
          (txn.invoiceNumber || '').toLowerCase().includes(term) ||
          (txn.customerName || '').toLowerCase().includes(term) ||
          (txn.transactionType || '').toLowerCase().includes(term) ||
          (txn.type || '').toLowerCase().includes(term) ||
          (txn.paymentStatus || txn.status || '').toLowerCase().includes(term)
        );
      });
    }

    const sorted = [...data];
    const dir = transactionSortConfig.direction === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      switch (transactionSortConfig.field) {
        case 'invoice':
          return (a.invoiceNumber || '').localeCompare(b.invoiceNumber || '') * dir;
        case 'customer':
          return (a.customerName || '').localeCompare(b.customerName || '') * dir;
        case 'type':
          return (a.type || '').localeCompare(b.type || '') * dir;
        case 'amount':
          return ((a.amount || 0) - (b.amount || 0)) * dir;
        case 'status':
          return (a.paymentStatus || a.status || '').localeCompare(b.paymentStatus || b.status || '') * dir;
        case 'date':
          return (new Date(a.createdAt) - new Date(b.createdAt)) * dir;
        default:
          return 0;
      }
    });

    return sorted;
  };

  const renderContent = () => {
    switch (activeMenu) {
      case 'dashboard':
        if (loading) {
          return (
            <div className="dashboard-content">
              <div style={{ textAlign: 'center', padding: '2rem' }}>Loading dashboard...</div>
            </div>
          );
        }

        if (error) {
          return (
            <div className="dashboard-content">
              <div style={{ textAlign: 'center', padding: '2rem', color: 'red' }}>
                Error: {error}
              </div>
            </div>
          );
        }

        const { overview, salesAnalytics, inventoryInsights, services, recentTransactions } = dashboardData;

        return (
          <div className="dashboard-content">
            <div className="dashboard-header">
              <h2>Admin Dashboard</h2>
              <select 
                value={period} 
                onChange={(e) => setPeriod(e.target.value)}
                className="period-selector"
              >
                <option value="all">All Time</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>

            {/* Key Metrics Cards */}
            <div className="stats-grid">
              <div className="stat-card metric-card-revenue">
                <div className="stat-info">
                  <h3>Today's Revenue</h3>
                  <p className="stat-value">{formatCurrency(overview?.todayRevenue || 0)}</p>
                </div>
              </div>
              <div className="stat-card metric-card-profit">
                <div className="stat-info">
                  <h3>Today's Profit</h3>
                  <p className="stat-value">{formatCurrency(overview?.todayProfit || 0)}</p>
                </div>
              </div>
              <div className="stat-card metric-card-products">
                <div className="stat-info">
                  <h3>Total Products</h3>
                  <p className="stat-value">{overview?.totalProducts || 0}</p>
                </div>
              </div>
              <div className="stat-card metric-card-services">
                <div className="stat-info">
                  <h3>Pending Services</h3>
                  <p className="stat-value">{overview?.pendingServices || 0}</p>
                </div>
              </div>
              <div className="stat-card metric-card-alerts">
                <div className="stat-info">
                  <h3>Low Stock Alerts</h3>
                  <p className="stat-value">{overview?.lowStockCount || 0}</p>
                </div>
              </div>
              <div className="stat-card metric-card-revenue">
                <div className="stat-info">
                  <h3>Monthly Revenue</h3>
                  <p className="stat-value">{formatCurrency(overview?.monthlyRevenue || 0)}</p>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="charts-grid">
              <div className="chart-container">
                <h3>Sales Trend (Last 30 Days)</h3>
                <SalesTrendChart data={salesAnalytics?.salesTrend || []} />
              </div>

              <div className="chart-container">
                <h3>Sales by Type</h3>
                <SalesByTypeChart data={salesAnalytics?.salesByType || []} />
              </div>

              <div className="chart-container">
                <h3>Category Performance</h3>
                <CategoryPerformanceChart data={salesAnalytics?.categoryPerformance || []} />
              </div>

              <div className="chart-container">
                <h3>Payment Methods</h3>
                <PaymentMethodsChart data={salesAnalytics?.paymentMethods || []} />
              </div>

              <div className="chart-container">
                <h3>Service Status</h3>
                <ServiceStatusChart data={services?.statusBreakdown || []} />
              </div>

              <div className="chart-container">
                <h3>Services by Type</h3>
                <ServicesByTypeChart data={services?.servicesByType || []} />
              </div>

              <div className="chart-container">
                <h3>Stock by Category</h3>
                <StockByCategoryChart data={inventoryInsights?.stockByCategory || []} />
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="content-section" style={{ marginTop: '2rem' }}>
              <h3>Recent Transactions</h3>
              <div style={{ margin: '0.75rem 0', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search invoice, customer, type, status..."
                  value={transactionSearchTerm}
                  onChange={(e) => setTransactionSearchTerm(e.target.value)}
                  style={{ flex: 1, minWidth: '250px', padding: '0.5rem 0.75rem', border: '1px solid var(--corp-border, #cbd5e1)', borderRadius: '0.375rem', background: 'var(--corp-bg-card, #ffffff)', color: 'var(--corp-text-primary, #0f172a)' }}
                />
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="transaction-table">
                  <thead>
                    <tr>
                      <th className="sortable" onClick={() => handleTransactionSort('invoice')}>
                        Invoice/Service #
                      </th>
                      <th className="sortable" onClick={() => handleTransactionSort('customer')}>
                        Customer
                      </th>
                      <th className="sortable" onClick={() => handleTransactionSort('type')}>
                        Type
                      </th>
                      <th className="sortable" onClick={() => handleTransactionSort('amount')} style={{ textAlign: 'right' }}>
                        Amount
                      </th>
                      <th className="sortable" onClick={() => handleTransactionSort('status')}>
                        Status
                      </th>
                      <th className="sortable" onClick={() => handleTransactionSort('date')}>
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredTransactions().length > 0 ? (
                      getFilteredTransactions().map((txn) => (
                        <tr key={txn.id}>
                          <td>{txn.invoiceNumber}</td>
                          <td>{txn.customerName || 'N/A'}</td>
                          <td>
                            <span className={`status-badge ${txn.transactionType === 'sale' ? 'status-in-progress' : 'status-pending'}`}>
                              {txn.transactionType === 'sale' ? txn.type : txn.type}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>
                            {formatCurrency(txn.amount)}
                          </td>
                          <td>
                            <span className={`status-badge ${txn.paymentStatus === 'paid' ? 'status-paid' : 'status-pending'}`}>
                              {txn.paymentStatus || txn.status}
                            </span>
                          </td>
                          <td>
                            {new Date(txn.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                          No recent transactions
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case 'products':
        return <ProductManagement />;
      case 'inventory':
        return <InventoryManagement />;
      case 'sales':
        return (
          <div className="dashboard-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'nowrap' }}>
              <h2 style={{ margin: 0, whiteSpace: 'nowrap', flexShrink: 0 }}>Sales</h2>
              <select 
                value={period} 
                onChange={(e) => setPeriod(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #ddd', width: '140px', flexShrink: 0, fontSize: '0.875rem' }}
              >
                <option value="all">All Time</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>

            {salesLoading && (
              <div style={{ textAlign: 'center', padding: '1rem' }}>Loading sales...</div>
            )}
            {salesError && (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'red' }}>{salesError}</div>
            )}

            {!salesLoading && !salesError && (
              <>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <button
                    onClick={() =>
                      setOpenSalesSections((prev) => ({ ...prev, series: !prev.series }))
                    }
                    style={{ 
                      padding: '0.5rem 0.85rem', 
                      borderRadius: '0.4rem', 
                      border: '1px solid var(--corp-border, #cbd5e1)', 
                      background: openSalesSections.series ? 'rgba(59, 130, 246, 0.15)' : 'var(--corp-bg-card, #ffffff)', 
                      color: 'var(--corp-text-primary, #0f172a)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {openSalesSections.series ? 'Hide Series' : 'Show Series'}
                  </button>
                  <button
                    onClick={() =>
                      setOpenSalesSections((prev) => ({ ...prev, product: !prev.product }))
                    }
                    style={{ 
                      padding: '0.5rem 0.85rem', 
                      borderRadius: '0.4rem', 
                      border: '1px solid var(--corp-border, #cbd5e1)', 
                      background: openSalesSections.product ? 'rgba(59, 130, 246, 0.15)' : 'var(--corp-bg-card, #ffffff)', 
                      color: 'var(--corp-text-primary, #0f172a)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {openSalesSections.product ? 'Hide Product' : 'Show Product'}
                  </button>
                  <button
                    onClick={() =>
                      setOpenSalesSections((prev) => ({ ...prev, details: !prev.details }))
                    }
                    style={{ 
                      padding: '0.5rem 0.85rem', 
                      borderRadius: '0.4rem', 
                      border: '1px solid var(--corp-border, #cbd5e1)', 
                      background: openSalesSections.details ? 'rgba(59, 130, 246, 0.15)' : 'var(--corp-bg-card, #ffffff)', 
                      color: 'var(--corp-text-primary, #0f172a)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {openSalesSections.details ? 'Hide Details' : 'Show Details'}
                  </button>
                </div>

                {openSalesSections.series && (
                  <>
                {/* Sales by Series Controls */}
                <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--corp-bg-tertiary, #f8fafc)', borderRadius: '0.5rem', border: '1px solid var(--corp-border, #e2e8f0)' }}>
                  <strong style={{ color: 'var(--corp-text-primary, #0f172a)', display: 'block', marginBottom: '0.75rem' }}>Sales by Series</strong>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'nowrap' }}>
                    {/* Search Bar */}
                    <div style={{ position: 'relative', flex: '1 1 auto', maxWidth: '400px' }}>
                      <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--corp-text-muted, #64748b)', fontSize: '1rem', pointerEvents: 'none' }}>🔍</span>
                      <input
                        type="text"
                        placeholder="Search series..."
                        value={seriesSearchTerm}
                        onChange={(e) => setSeriesSearchTerm(e.target.value)}
                        style={{ 
                          width: '100%', 
                          padding: '0.6rem 0.75rem 0.6rem 2.5rem', 
                          border: '1px solid var(--corp-border, #cbd5e1)', 
                          borderRadius: '0.5rem', 
                          background: 'var(--corp-bg-card, #ffffff)', 
                          color: 'var(--corp-text-primary, #0f172a)', 
                          fontSize: '0.875rem',
                          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                          transition: 'all 0.2s ease'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--corp-primary, #2563eb)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--corp-border, #cbd5e1)'}
                      />
                    </div>
                    {/* Category Filter */}
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--corp-text-muted, #64748b)', fontSize: '0.875rem', pointerEvents: 'none', zIndex: 1 }}>📁</span>
                      <select
                        value={seriesFilterCategory}
                        onChange={(e) => setSeriesFilterCategory(e.target.value)}
                        style={{ 
                          padding: '0.6rem 2rem 0.6rem 2.25rem', 
                          border: '1px solid var(--corp-border, #cbd5e1)', 
                          borderRadius: '0.5rem', 
                          width: '160px', 
                          background: 'var(--corp-bg-card, #ffffff)', 
                          color: 'var(--corp-text-primary, #0f172a)', 
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          appearance: 'none',
                          backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2364748b\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 0.75rem center',
                          backgroundSize: '12px',
                          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                          transition: 'all 0.2s ease'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--corp-primary, #2563eb)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--corp-border, #cbd5e1)'}
                      >
                        <option value="all">All Categories</option>
                        <option value="car-truck-tractor">Car/Truck/Tractor</option>
                        <option value="bike">Bike</option>
                        <option value="ups-inverter">Inverter & Battery</option>
                      </select>
                    </div>
                  </div>
                </div>
                    <div style={{ marginBottom: '2rem', background: 'var(--corp-bg-card, #f9f9f9)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--corp-border, #e2e8f0)' }}>
                      <h3 style={{ marginBottom: '1rem', color: 'var(--corp-text-primary, #333)' }}>Sales by Series</h3>
                      {getSeriesTableData().length === 0 ? (
                        <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--corp-text-muted, #777)' }}>No sales data available</div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid var(--corp-border, #ddd)' }}>
                                <th 
                                  style={{ padding: '0.75rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }}
                                  onClick={() => handleSeriesSort('series')}
                                >
                                  Series {getSeriesSortIcon('series')}
                                </th>
                                <th 
                                  style={{ padding: '0.75rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }}
                                  onClick={() => handleSeriesSort('quantity')}
                                >
                                  Quantity Sold {getSeriesSortIcon('quantity')}
                                </th>
                                <th 
                                  style={{ padding: '0.75rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }}
                                  onClick={() => handleSeriesSort('revenue')}
                                >
                                  Revenue {getSeriesSortIcon('revenue')}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {getSeriesTableData().map((row) => (
                                <tr key={row.series} style={{ borderBottom: '1px solid var(--corp-border-light, #eee)' }}>
                                  <td style={{ padding: '0.75rem', color: 'var(--corp-text-primary, #0f172a)' }}>{row.series}</td>
                                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--corp-text-primary, #0f172a)' }}>{row.quantity}</td>
                                  <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: 'var(--corp-text-primary, #0f172a)' }}>
                                    {formatCurrency(row.revenue)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {openSalesSections.product && (
                  <>
                {/* Sales by Product Controls */}
                <div className="sales-product-controls" style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--corp-bg-tertiary, #f8fafc)', borderRadius: '0.5rem', border: '1px solid var(--corp-border, #e2e8f0)' }}>
                  <strong style={{ color: 'var(--corp-text-primary, #0f172a)', display: 'block', marginBottom: '0.75rem' }}>Sales by Product</strong>
                  <div className="sales-product-filters-container">
                    {/* Row 1: Search Bar */}
                    <div className="sales-product-search-row">
                      <div style={{ position: 'relative', width: '100%' }}>
                        <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--corp-text-muted, #64748b)', fontSize: '1rem', pointerEvents: 'none' }}>🔍</span>
                        <input
                          type="text"
                          placeholder="Search product, SKU, series..."
                          value={productSearchTerm}
                          onChange={(e) => setProductSearchTerm(e.target.value)}
                          className="sales-product-search-input"
                          style={{ 
                            width: '100%', 
                            padding: '0.6rem 0.75rem 0.6rem 2.5rem', 
                            border: '1px solid var(--corp-border, #cbd5e1)', 
                            borderRadius: '0.5rem', 
                            background: 'var(--corp-bg-card, #ffffff)', 
                            color: 'var(--corp-text-primary, #0f172a)', 
                            fontSize: '0.875rem',
                            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                            transition: 'all 0.2s ease'
                          }}
                          onFocus={(e) => e.target.style.borderColor = 'var(--corp-primary, #2563eb)'}
                          onBlur={(e) => e.target.style.borderColor = 'var(--corp-border, #cbd5e1)'}
                        />
                      </div>
                    </div>
                    {/* Row 2: Category and Series Filters */}
                    <div className="sales-product-filters-row">
                      {/* Category Filter */}
                      <div style={{ position: 'relative', flex: '1' }}>
                        <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--corp-text-muted, #64748b)', fontSize: '0.875rem', pointerEvents: 'none', zIndex: 1 }}>📁</span>
                        <select
                          value={productFilterCategory}
                          onChange={(e) => setProductFilterCategory(e.target.value)}
                          className="sales-product-filter-select"
                          style={{ 
                            padding: '0.6rem 2rem 0.6rem 2.25rem', 
                            border: '1px solid var(--corp-border, #cbd5e1)', 
                            borderRadius: '0.5rem', 
                            width: '100%', 
                            background: 'var(--corp-bg-card, #ffffff)', 
                            color: 'var(--corp-text-primary, #0f172a)', 
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            appearance: 'none',
                            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2364748b\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 0.75rem center',
                            backgroundSize: '12px',
                            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                            transition: 'all 0.2s ease'
                          }}
                          onFocus={(e) => e.target.style.borderColor = 'var(--corp-primary, #2563eb)'}
                          onBlur={(e) => e.target.style.borderColor = 'var(--corp-border, #cbd5e1)'}
                        >
                          <option value="all">All Categories</option>
                          <option value="car-truck-tractor">Car/Truck/Tractor</option>
                          <option value="bike">Bike</option>
                          <option value="ups-inverter">Inverter & Battery</option>
                        </select>
                      </div>
                      {/* Series Filter */}
                      <div style={{ position: 'relative', flex: '1' }}>
                        <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--corp-text-muted, #64748b)', fontSize: '0.875rem', pointerEvents: 'none', zIndex: 1 }}>📋</span>
                        <select
                          value={productFilterSeries}
                          onChange={(e) => setProductFilterSeries(e.target.value)}
                          className="sales-product-filter-select"
                          style={{ 
                            padding: '0.6rem 2rem 0.6rem 2.25rem', 
                            border: '1px solid var(--corp-border, #cbd5e1)', 
                            borderRadius: '0.5rem', 
                            width: '100%', 
                            background: 'var(--corp-bg-card, #ffffff)', 
                            color: 'var(--corp-text-primary, #0f172a)', 
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            appearance: 'none',
                            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2364748b\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 0.75rem center',
                            backgroundSize: '12px',
                            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                            transition: 'all 0.2s ease'
                          }}
                          onFocus={(e) => e.target.style.borderColor = 'var(--corp-primary, #2563eb)'}
                          onBlur={(e) => e.target.style.borderColor = 'var(--corp-border, #cbd5e1)'}
                        >
                          <option value="all">All Series</option>
                          {getUniqueSeries(salesDetail).map(series => (
                            <option key={series} value={series}>{series}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                    <div style={{ marginBottom: '2rem', background: 'var(--corp-bg-card, #f9f9f9)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--corp-border, #e2e8f0)' }}>
                      <h3 style={{ marginBottom: '1rem', color: 'var(--corp-text-primary, #333)' }}>Sales by Product</h3>
                      {getProductTableData().length === 0 ? (
                        <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--corp-text-muted, #777)' }}>No sales data available</div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid var(--corp-border, #ddd)' }}>
                                <th style={{ padding: '0.75rem', textAlign: 'left', cursor: 'pointer', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }} onClick={() => handleProductSort('series')}>
                                  Series {getProductSortIcon('series')}
                                </th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', cursor: 'pointer', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }} onClick={() => handleProductSort('product')}>
                                  Product {getProductSortIcon('product')}
                                </th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', cursor: 'pointer', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }} onClick={() => handleProductSort('sku')}>
                                  SKU {getProductSortIcon('sku')}
                                </th>
                                <th style={{ padding: '0.75rem', textAlign: 'right', cursor: 'pointer', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }} onClick={() => handleProductSort('quantity')}>
                                  Quantity Sold {getProductSortIcon('quantity')}
                                </th>
                                <th style={{ padding: '0.75rem', textAlign: 'right', cursor: 'pointer', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }} onClick={() => handleProductSort('revenue')}>
                                  Revenue {getProductSortIcon('revenue')}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {getProductTableData().map((row) => (
                                <tr key={`${row.series}-${row.productName}-${row.sku}`} style={{ borderBottom: '1px solid var(--corp-border-light, #eee)' }}>
                                  <td style={{ padding: '0.75rem', color: 'var(--corp-text-primary, #0f172a)' }}>{row.series}</td>
                                  <td style={{ padding: '0.75rem', color: 'var(--corp-text-primary, #0f172a)' }}>{row.productName}</td>
                                  <td style={{ padding: '0.75rem', color: 'var(--corp-text-primary, #0f172a)' }}>{row.sku || 'N/A'}</td>
                                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--corp-text-primary, #0f172a)' }}>{row.quantity}</td>
                                  <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: 'var(--corp-text-primary, #0f172a)' }}>
                                    {formatCurrency(row.revenue)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {openSalesSections.details && (
                  <>
                {/* Sales Details Controls */}
                <div className="sales-details-controls" style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--corp-bg-tertiary, #f8fafc)', borderRadius: '0.5rem', border: '1px solid var(--corp-border, #e2e8f0)' }}>
                  <strong style={{ color: 'var(--corp-text-primary, #0f172a)', display: 'block', marginBottom: '0.75rem' }}>Sales Details</strong>
                  <div className="sales-details-filters-container">
                    {/* Row 1: Search Bar */}
                    <div className="sales-details-search-row">
                      <div style={{ position: 'relative', width: '100%' }}>
                        <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--corp-text-muted, #64748b)', fontSize: '1rem', pointerEvents: 'none' }}>🔍</span>
                        <input
                          type="text"
                          placeholder="Search customer, product, SKU, invoice..."
                          value={detailSearchTerm}
                          onChange={(e) => setDetailSearchTerm(e.target.value)}
                          className="sales-details-search-input"
                          style={{ 
                            width: '100%', 
                            padding: '0.6rem 0.75rem 0.6rem 2.5rem', 
                            border: '1px solid var(--corp-border, #cbd5e1)', 
                            borderRadius: '0.5rem', 
                            background: 'var(--corp-bg-card, #ffffff)', 
                            color: 'var(--corp-text-primary, #0f172a)', 
                            fontSize: '0.875rem',
                            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                            transition: 'all 0.2s ease'
                          }}
                          onFocus={(e) => e.target.style.borderColor = 'var(--corp-primary, #2563eb)'}
                          onBlur={(e) => e.target.style.borderColor = 'var(--corp-border, #cbd5e1)'}
                        />
                      </div>
                    </div>
                    {/* Row 2: Category and Series Filters */}
                    <div className="sales-details-filters-row">
                      {/* Category Filter */}
                      <div style={{ position: 'relative', flex: '1' }}>
                        <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--corp-text-muted, #64748b)', fontSize: '0.875rem', pointerEvents: 'none', zIndex: 1 }}>📁</span>
                        <select
                          value={detailFilterCategory}
                          onChange={(e) => setDetailFilterCategory(e.target.value)}
                          className="sales-details-filter-select"
                          style={{ 
                            padding: '0.6rem 2rem 0.6rem 2.25rem', 
                            border: '1px solid var(--corp-border, #cbd5e1)', 
                            borderRadius: '0.5rem', 
                            width: '100%', 
                            background: 'var(--corp-bg-card, #ffffff)', 
                            color: 'var(--corp-text-primary, #0f172a)', 
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            appearance: 'none',
                            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2364748b\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 0.75rem center',
                            backgroundSize: '12px',
                            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                            transition: 'all 0.2s ease'
                          }}
                          onFocus={(e) => e.target.style.borderColor = 'var(--corp-primary, #2563eb)'}
                          onBlur={(e) => e.target.style.borderColor = 'var(--corp-border, #cbd5e1)'}
                        >
                          <option value="all">All Categories</option>
                          <option value="car-truck-tractor">Car/Truck/Tractor</option>
                          <option value="bike">Bike</option>
                          <option value="ups-inverter">Inverter & Battery</option>
                        </select>
                      </div>
                      {/* Series Filter */}
                      <div style={{ position: 'relative', flex: '1' }}>
                        <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--corp-text-muted, #64748b)', fontSize: '0.875rem', pointerEvents: 'none', zIndex: 1 }}>📋</span>
                        <select
                          value={detailFilterSeries}
                          onChange={(e) => setDetailFilterSeries(e.target.value)}
                          className="sales-details-filter-select"
                          style={{ 
                            padding: '0.6rem 2rem 0.6rem 2.25rem', 
                            border: '1px solid var(--corp-border, #cbd5e1)', 
                            borderRadius: '0.5rem', 
                            width: '100%', 
                            background: 'var(--corp-bg-card, #ffffff)', 
                            color: 'var(--corp-text-primary, #0f172a)', 
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            appearance: 'none',
                            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2364748b\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 0.75rem center',
                            backgroundSize: '12px',
                            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                            transition: 'all 0.2s ease'
                          }}
                          onFocus={(e) => e.target.style.borderColor = 'var(--corp-primary, #2563eb)'}
                          onBlur={(e) => e.target.style.borderColor = 'var(--corp-border, #cbd5e1)'}
                        >
                          <option value="all">All Series</option>
                          {getUniqueSeries(salesDetail).map(series => (
                            <option key={series} value={series}>{series}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                    <div style={{ background: 'var(--corp-bg-card, #f9f9f9)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--corp-border, #e2e8f0)' }}>
                      <h3 style={{ marginBottom: '1rem', color: 'var(--corp-text-primary, #333)' }}>Sales Details (Battery ↔ Customer)</h3>
                      {getDetailTableData().length === 0 ? (
                        <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--corp-text-muted, #777)' }}>No sales data available</div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid var(--corp-border, #ddd)' }}>
                                <th 
                                  style={{ padding: '0.75rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }}
                                  onClick={() => handleDetailSort('date')}
                                >
                                  Date {getDetailSortIcon('date')}
                                </th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }}>Invoice</th>
                                <th 
                                  style={{ padding: '0.75rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }}
                                  onClick={() => handleDetailSort('customer')}
                                >
                                  Customer {getDetailSortIcon('customer')}
                                </th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }}>Phone</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }}>Vehicle Number</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }}>Category</th>
                                <th 
                                  style={{ padding: '0.75rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }}
                                  onClick={() => handleDetailSort('series')}
                                >
                                  Series {getDetailSortIcon('series')}
                                </th>
                                <th 
                                  style={{ padding: '0.75rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }}
                                  onClick={() => handleDetailSort('product')}
                                >
                                  Product {getDetailSortIcon('product')}
                                </th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }}>SKU</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }}>Serial Number</th>
                                <th 
                                  style={{ padding: '0.75rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }}
                                  onClick={() => handleDetailSort('quantity')}
                                >
                                  Qty {getDetailSortIcon('quantity')}
                                </th>
                                <th style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }}>Unit Price</th>
                                <th 
                                  style={{ padding: '0.75rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }}
                                  onClick={() => handleDetailSort('total')}
                                >
                                  Total {getDetailSortIcon('total')}
                                </th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }}>Commission</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--corp-text-primary, #0f172a)', background: 'var(--corp-bg-tertiary, #f8fafc)' }}>Old Battery Trade-In</th>
                              </tr>
                            </thead>
                            <tbody>
                              {getDetailTableData().map((item, idx) => (
                                <tr key={`${item.invoiceNumber}-${item.sku}-${item.date}-${idx}`} style={{ borderBottom: '1px solid var(--corp-border-light, #eee)' }}>
                                  <td style={{ padding: '0.75rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                                    {item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}
                                  </td>
                                  <td style={{ padding: '0.75rem', color: 'var(--corp-text-primary, #0f172a)' }}>{item.invoiceNumber || 'N/A'}</td>
                                  <td style={{ padding: '0.75rem', color: 'var(--corp-text-primary, #0f172a)' }}>{item.customerName || 'N/A'}</td>
                                  <td style={{ padding: '0.75rem', color: 'var(--corp-text-primary, #0f172a)' }}>{item.customerPhone || 'N/A'}</td>
                                  <td style={{ padding: '0.75rem', color: 'var(--corp-text-primary, #0f172a)' }}>{item.vehicleNumber || 'N/A'}</td>
                                  <td style={{ padding: '0.75rem', color: 'var(--corp-text-primary, #0f172a)' }}>{item.category || 'N/A'}</td>
                                  <td style={{ padding: '0.75rem', color: 'var(--corp-text-primary, #0f172a)' }}>{item.series || 'N/A'}</td>
                                  <td style={{ padding: '0.75rem', color: 'var(--corp-text-primary, #0f172a)' }}>{item.productName || 'N/A'}</td>
                                  <td style={{ padding: '0.75rem', color: 'var(--corp-text-primary, #0f172a)' }}>{item.sku || 'N/A'}</td>
                                  <td style={{ padding: '0.75rem', color: 'var(--corp-text-primary, #0f172a)' }}>{item.serialNumber || 'N/A'}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--corp-text-primary, #0f172a)' }}>{item.quantity}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--corp-text-primary, #0f172a)' }}>
                                {item.isConfirmed ? (
                                  formatCurrency(item.unitPrice)
                                ) : (
                                  <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Pending</span>
                                )}
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: 'var(--corp-text-primary, #0f172a)' }}>
                                {item.isConfirmed ? (
                                  formatCurrency(item.totalPrice)
                                ) : (
                                  <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Pending</span>
                                )}
                              </td>
                                  <td style={{ padding: '0.75rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                                    {item.hasCommission ? (
                                      <div style={{ fontSize: '0.875rem' }}>
                                        <div style={{ fontWeight: '600', color: '#059669' }}>
                                          {formatCurrency(item.commissionAmount)}
                                        </div>
                                        {item.commissionAgentName && (
                                          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                            {item.commissionAgentName}
                                            {item.commissionAgentMobile && ` (${item.commissionAgentMobile})`}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        );
      case 'charging':
        return <ChargingServices />;
      case 'services':
        return <ServiceManagement />;
      case 'user-management':
      case 'users':
        return <UserManagement />;
      case 'guarantee-warranty':
        return <GuaranteeWarranty />;
      case 'company-returns':
        return <CompanyReturns />;
      case 'reports':
        return <Reports />;
      case 'employees':
      case 'employee-management':
        return <EmployeeManagement />;
      case 'pending-orders':
        return <PendingOrders />;
      default:
        return (
          <div className="dashboard-content">
            <h2>Welcome, Admin!</h2>
            <p>Select a menu item to get started.</p>
          </div>
        );
    }
  };

  return renderContent();
};

export default AdminDashboard;

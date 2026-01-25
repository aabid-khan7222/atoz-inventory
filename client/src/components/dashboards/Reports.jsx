import { useState, useEffect, useRef } from 'react';
import './DashboardContent.css';

// Summary Card Component with auto-resizing text
const SummaryCard = ({ title, value, color, details, isDetails = false }) => {
  const textRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const resizeText = () => {
      if (!textRef.current || !containerRef.current) return;
      
      const container = containerRef.current;
      const text = textRef.current;
      const containerWidth = container.offsetWidth;
      
      // Reset to max size
      text.style.fontSize = '1.35rem';
      
      // Check if text fits at max size
      const fitsAtMaxSize = text.scrollWidth <= containerWidth;
      
      // If text fits, keep it centered; if not, align left and resize
      if (fitsAtMaxSize) {
        container.style.justifyContent = 'center';
        container.style.textAlign = 'center';
      } else {
        container.style.justifyContent = 'flex-start';
        container.style.textAlign = 'left';
        
        // Binary search for optimal font size
        let minSize = 0.65;
        let maxSize = 1.35;
        let optimalSize = maxSize;
        
        for (let i = 0; i < 20; i++) {
          const testSize = (minSize + maxSize) / 2;
          text.style.fontSize = `${testSize}rem`;
          
          if (text.scrollWidth <= containerWidth) {
            optimalSize = testSize;
            minSize = testSize;
          } else {
            maxSize = testSize;
          }
        }
        
        text.style.fontSize = `${optimalSize}rem`;
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(resizeText, 100);
    window.addEventListener('resize', resizeText);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', resizeText);
    };
  }, [value]);

  return (
    <div className="summary-card" style={{ background: 'var(--corp-bg-card)', padding: '0.75rem', borderRadius: 'var(--corp-radius)', boxShadow: 'var(--corp-shadow)' }}>
      <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--corp-text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: '1.2' }}>{title}</h3>
      <div className="summary-value-container" ref={containerRef} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', overflow: 'hidden', minHeight: '1.5rem' }}>
        <div className="summary-value" ref={textRef} style={{ fontWeight: 'bold', color: color, lineHeight: '1.1', whiteSpace: 'nowrap', fontSize: '1.35rem', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
          {value}
        </div>
      </div>
      <div className={isDetails ? "summary-details" : ""} style={{ marginTop: '0.375rem', color: 'var(--corp-text-muted)', fontSize: '0.7rem', whiteSpace: isDetails ? 'normal' : 'nowrap', wordBreak: isDetails ? 'break-word' : 'normal', lineHeight: '1.3' }}>
        {details}
      </div>
    </div>
  );
};
import SearchableSelect from '../common/SearchableSelect';
import {
  getCategorySalesReport,
  getProductSalesReport,
  getSeriesSalesReport,
  getCustomerSalesReport,
  getB2BCustomerSalesReport,
  getB2CCustomerSalesReport,
  getProfitReport,
  getAgentCommissionReport,
  getCommissionDetailsReport,
  getChargingServicesReport,
  getChargingCustomerReport,
  getSummaryReport,
  getServicesTypeReport,
  getEmployeeReport,
  getWaterReport,
  getCommissionAgents,
  fetchProducts
} from '../../api';
import {
  generateReportPDF,
  generateSummaryReportPDF,
  generateProfitReportPDF,
  generateChargingServicesReportPDF
} from '../../utils/reportPdf';
import { getFormState, saveFormState } from '../../utils/formStateManager';

const STORAGE_KEY = 'reportsState';

const Reports = () => {
  // Load saved state using utility (automatically handles refresh detection)
  const savedState = getFormState(STORAGE_KEY);
  
  const [activeTab, setActiveTab] = useState(() => savedState?.activeTab || 'summary');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const printRef = useRef();
  
  // Filter states
  const [period, setPeriod] = useState(() => savedState?.period || 'all');
  const [dateFrom, setDateFrom] = useState(() => savedState?.dateFrom || '');
  const [dateTo, setDateTo] = useState(() => savedState?.dateTo || '');
  const [categoryFilter, setCategoryFilter] = useState(() => savedState?.categoryFilter || 'all');
  const [seriesFilter, setSeriesFilter] = useState(() => savedState?.seriesFilter || 'all');
  const [agentFilter, setAgentFilter] = useState(() => savedState?.agentFilter || 'all');
  
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Save state to sessionStorage
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    
    const stateToSave = {
      activeTab,
      period,
      dateFrom,
      dateTo,
      categoryFilter,
      seriesFilter,
      agentFilter
    };
    saveFormState(STORAGE_KEY, stateToSave);
  }, [activeTab, period, dateFrom, dateTo, categoryFilter, seriesFilter, agentFilter, isInitialMount]);
  
  // Report data states
  const [summaryData, setSummaryData] = useState(null);
  const [categoryReport, setCategoryReport] = useState([]);
  const [categoryTotals, setCategoryTotals] = useState(null);
  const [productReport, setProductReport] = useState([]);
  const [productTotals, setProductTotals] = useState(null);
  const [seriesReport, setSeriesReport] = useState([]);
  const [seriesTotals, setSeriesTotals] = useState(null);
  const [customerReport, setCustomerReport] = useState([]);
  const [customerTotals, setCustomerTotals] = useState(null);
  const [b2bReport, setB2bReport] = useState([]);
  const [b2bTotals, setB2bTotals] = useState(null);
  const [b2cReport, setB2cReport] = useState([]);
  const [b2cTotals, setB2cTotals] = useState(null);
  const [profitReport, setProfitReport] = useState(null);
  const [agentCommissionReport, setAgentCommissionReport] = useState([]);
  const [agentCommissionTotals, setAgentCommissionTotals] = useState(null);
  const [commissionDetailsReport, setCommissionDetailsReport] = useState([]);
  const [commissionDetailsTotals, setCommissionDetailsTotals] = useState(null);
  const [chargingServicesReport, setChargingServicesReport] = useState(null);
  const [chargingCustomerReport, setChargingCustomerReport] = useState([]);
  const [chargingCustomerTotals, setChargingCustomerTotals] = useState(null);
  const [servicesTypeReport, setServicesTypeReport] = useState([]);
  const [servicesTypeTotals, setServicesTypeTotals] = useState(null);
  const [employeeReport, setEmployeeReport] = useState([]);
  const [employeeTotals, setEmployeeTotals] = useState(null);
  const [waterReport, setWaterReport] = useState([]);
  const [waterTotals, setWaterTotals] = useState(null);
  
  // Supporting data
  const [agents, setAgents] = useState([]);
  const [products, setProducts] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  useEffect(() => {
    loadProducts();
    // Load agents only when needed (when agent/commission-details tab is active)
    if (activeTab === 'agent' || activeTab === 'commission-details') {
      // Load initial set of agents (first 100 or so for better performance)
      loadAgents('');
    }
  }, [activeTab]);

  useEffect(() => {
    loadReportData();
  }, [activeTab, period, dateFrom, dateTo, categoryFilter, seriesFilter, agentFilter]);

  const loadAgents = async (searchTerm = '') => {
    // Don't block if already loading and it's a search (not initial load)
    if (agentsLoading && searchTerm) return;
    setAgentsLoading(true);
    try {
      const data = await getCommissionAgents(searchTerm);
      if (Array.isArray(data)) {
        // Only update agents if we got valid data
        setAgents(data);
      } else {
        console.warn('Unexpected agents data format:', data);
        // Don't clear agents on error, keep existing ones
        // setAgents([]);
      }
    } catch (err) {
      console.error('Failed to load agents:', err);
      // Don't clear agents on error, keep existing ones
      // setAgents([]);
    } finally {
      setAgentsLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await fetchProducts();
      setProducts(data || []);
      
      // Extract unique series
      const uniqueSeries = [...new Set(data.map(p => p.series).filter(Boolean))];
      setAvailableSeries(uniqueSeries);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const [availableSeries, setAvailableSeries] = useState([]);

  const loadReportData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const filters = {
        period: period !== 'all' ? period : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        series: seriesFilter !== 'all' ? seriesFilter : undefined,
        agentId: agentFilter !== 'all' ? agentFilter : undefined,
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

      switch (activeTab) {
        case 'summary':
          const summary = await getSummaryReport(filters);
          setSummaryData(summary);
          break;
        case 'category':
          const category = await getCategorySalesReport(filters);
          // Handle new format with data and totals
          if (category && category.data) {
            setCategoryReport(category.data);
            setCategoryTotals(category.totals);
          } else {
            // Backward compatibility with old format
            setCategoryReport(category || []);
            setCategoryTotals(null);
          }
          break;
        case 'product':
          const product = await getProductSalesReport(filters);
          if (product && product.data) {
            setProductReport(product.data);
            setProductTotals(product.totals);
          } else {
            setProductReport(product || []);
            setProductTotals(null);
          }
          break;
        case 'series':
          const series = await getSeriesSalesReport(filters);
          if (series && series.data) {
            setSeriesReport(series.data);
            setSeriesTotals(series.totals);
          } else {
            setSeriesReport(series || []);
            setSeriesTotals(null);
          }
          break;
        case 'customer':
          const customer = await getCustomerSalesReport(filters);
          if (customer && customer.data) {
            setCustomerReport(customer.data);
            setCustomerTotals(customer.totals);
          } else {
            setCustomerReport(customer || []);
            setCustomerTotals(null);
          }
          break;
        case 'b2b':
          const b2b = await getB2BCustomerSalesReport(filters);
          if (b2b && b2b.data) {
            setB2bReport(b2b.data);
            setB2bTotals(b2b.totals);
          } else {
            setB2bReport(b2b || []);
            setB2bTotals(null);
          }
          break;
        case 'b2c':
          const b2c = await getB2CCustomerSalesReport(filters);
          if (b2c && b2c.data) {
            setB2cReport(b2c.data);
            setB2cTotals(b2c.totals);
          } else {
            setB2cReport(b2c || []);
            setB2cTotals(null);
          }
          break;
        case 'profit':
          const profit = await getProfitReport(filters);
          setProfitReport(profit);
          break;
        case 'agent':
          const agent = await getAgentCommissionReport(filters);
          if (agent && agent.data) {
            setAgentCommissionReport(agent.data);
            setAgentCommissionTotals(agent.totals);
          } else {
            setAgentCommissionReport(agent || []);
            setAgentCommissionTotals(null);
          }
          break;
        case 'commission-details':
          const commissionDetails = await getCommissionDetailsReport(filters);
          if (commissionDetails && commissionDetails.data) {
            setCommissionDetailsReport(commissionDetails.data);
            setCommissionDetailsTotals(commissionDetails.totals);
          } else {
            setCommissionDetailsReport(commissionDetails || []);
            setCommissionDetailsTotals(null);
          }
          break;
        case 'charging':
          const charging = await getChargingServicesReport(filters);
          setChargingServicesReport(charging);
          break;
        case 'charging-customer':
          const chargingCustomer = await getChargingCustomerReport(filters);
          if (chargingCustomer && chargingCustomer.data) {
            setChargingCustomerReport(chargingCustomer.data);
            setChargingCustomerTotals(chargingCustomer.totals);
          } else {
            setChargingCustomerReport(chargingCustomer || []);
            setChargingCustomerTotals(null);
          }
          break;
        case 'services-type':
          const servicesType = await getServicesTypeReport(filters);
          if (servicesType && servicesType.data) {
            setServicesTypeReport(servicesType.data);
            setServicesTypeTotals(servicesType.totals);
          } else {
            setServicesTypeReport(servicesType || []);
            setServicesTypeTotals(null);
          }
          break;
        case 'employee':
          const employee = await getEmployeeReport(filters);
          if (employee && employee.data) {
            setEmployeeReport(employee.data);
            setEmployeeTotals(employee.totals);
          } else {
            setEmployeeReport(employee || []);
            setEmployeeTotals(null);
          }
          break;
        case 'water':
          const water = await getWaterReport(filters);
          if (water && water.products) {
            setWaterReport(water.products);
            setWaterTotals(water.totals);
          } else {
            setWaterReport([]);
            setWaterTotals(null);
          }
          break;
        default:
          break;
      }
    } catch (err) {
      setError(err.message || 'Failed to load report data');
      console.error('Error loading report:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateDDMMYYYY = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getDateRangeText = () => {
    if (dateFrom && dateTo) {
      return `Report from ${formatDateDDMMYYYY(dateFrom)} to ${formatDateDDMMYYYY(dateTo)}`;
    } else if (period && period !== 'all') {
      const now = new Date();
      let startDate = new Date();
      
      switch (period) {
        case 'today':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          return `Report from ${formatDateDDMMYYYY(startDate.toISOString())} to ${formatDateDDMMYYYY(now.toISOString())}`;
        case 'this_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          return `Report from ${formatDateDDMMYYYY(startDate.toISOString())} to ${formatDateDDMMYYYY(now.toISOString())}`;
        case 'last_month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
          return `Report from ${formatDateDDMMYYYY(startDate.toISOString())} to ${formatDateDDMMYYYY(lastMonthEnd.toISOString())}`;
        case 'last_3_months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          return `Report from ${formatDateDDMMYYYY(startDate.toISOString())} to ${formatDateDDMMYYYY(now.toISOString())}`;
        case 'last_year':
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
          return `Report from ${formatDateDDMMYYYY(startDate.toISOString())} to ${formatDateDDMMYYYY(now.toISOString())}`;
        default:
          return 'Report Period: All Time';
      }
    }
    return 'Report Period: All Time';
  };

  const tabs = [
    { id: 'summary', label: 'Summary', icon: '📊' },
    { id: 'category', label: 'Category-wise', icon: '📦' },
    { id: 'product', label: 'Product-wise', icon: '🔧' },
    { id: 'series', label: 'Series-wise', icon: '📋' },
    { id: 'customer', label: 'Customer-wise', icon: '👥' },
    { id: 'b2b', label: 'B2B Customers', icon: '🏢' },
    { id: 'b2c', label: 'B2C Customers', icon: '🛒' },
    { id: 'profit', label: 'Profit Reports', icon: '💰' },
    { id: 'agent', label: 'Agent Commission', icon: '🤝' },
    { id: 'commission-details', label: 'Commission Details', icon: '📝' },
    { id: 'charging', label: 'Charging Services', icon: '⚡' },
    { id: 'charging-customer', label: 'Charging by Customer', icon: '🔌' },
    { id: 'services-type', label: 'Services Type', icon: '🔧' },
    { id: 'employee', label: 'Employee-wise', icon: '👤' },
    { id: 'water', label: 'Water Wise', icon: '💧' }
  ];

  // Print functionality - using iframe approach (no new tab)
  const handlePrintClick = () => {
    console.log('Print button clicked');
    try {
      if (!printRef.current) {
        console.error('Print ref is not available');
        alert('Unable to print: Report content not found');
        return;
      }
      
      // Clone the content and remove print-only elements
      const contentClone = printRef.current.cloneNode(true);
      const printOnlyElements = contentClone.querySelectorAll('.print-only');
      printOnlyElements.forEach(el => el.remove());
      
      // Fix CSS variables for print - replace with actual colors
      // Fix status badges
      const statusSpans = contentClone.querySelectorAll('td span[style*="background"]');
      statusSpans.forEach(span => {
        const style = span.getAttribute('style') || '';
        let newStyle = style.replace(/var\(--corp-success\)/g, '#4caf50');
        newStyle = newStyle.replace(/var\(--corp-danger\)/g, '#f44336');
        newStyle = newStyle.replace(/var\(--corp-text-secondary\)/g, '#666');
        span.setAttribute('style', newStyle);
      });
      
      // Fix totals row background color (blue container)
      const totalsRows = contentClone.querySelectorAll('tr[style*="background"]');
      totalsRows.forEach(row => {
        const style = row.getAttribute('style') || '';
        let newStyle = style.replace(/var\(--corp-primary\)/g, '#4285f4');
        newStyle = newStyle.replace(/var\(--corp-border\)/g, '#ddd');
        row.setAttribute('style', newStyle);
      });
      
      // Fix all elements with CSS variables in style attribute
      const allElements = contentClone.querySelectorAll('[style*="var(--"]');
      allElements.forEach(el => {
        const style = el.getAttribute('style') || '';
        let newStyle = style;
        // Replace common CSS variables
        newStyle = newStyle.replace(/var\(--corp-primary\)/g, '#4285f4');
        newStyle = newStyle.replace(/var\(--corp-success\)/g, '#4caf50');
        newStyle = newStyle.replace(/var\(--corp-danger\)/g, '#f44336');
        newStyle = newStyle.replace(/var\(--corp-text-primary\)/g, '#333');
        newStyle = newStyle.replace(/var\(--corp-text-secondary\)/g, '#666');
        newStyle = newStyle.replace(/var\(--corp-border\)/g, '#ddd');
        newStyle = newStyle.replace(/var\(--corp-bg-card\)/g, '#fff');
        newStyle = newStyle.replace(/var\(--corp-bg-tertiary\)/g, '#f5f5f5');
        el.setAttribute('style', newStyle);
      });
      
      // Get the content to print (without print-only header)
      const content = contentClone.innerHTML;
      const reportTitle = tabs.find(t => t.id === activeTab)?.label || 'Report';
      const dateStr = new Date().toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Format date range for print
      const formatDateForPrint = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      };
      
      let dateRangeText = '';
      if (dateFrom && dateTo) {
        dateRangeText = `Report from ${formatDateForPrint(dateFrom)} to ${formatDateForPrint(dateTo)}`;
      } else if (period && period !== 'all') {
        const periodLabels = {
          'today': 'Today',
          'this_month': 'This Month',
          'last_month': 'Last Month',
          'last_3_months': 'Last 3 Months',
          'last_year': 'Last Year'
        };
        dateRangeText = `Report Period: ${periodLabels[period] || period.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
      } else {
        dateRangeText = 'Report Period: All Time';
      }
      
      // Create a hidden iframe for printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      
      // Build the print HTML
      const printHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${reportTitle}</title>
            <style>
              @page {
                size: A4 landscape;
                margin: 1cm;
              }
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                max-width: 100%;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .print-header {
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 2px solid #000;
                padding-bottom: 10px;
              }
              .print-header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: bold;
              }
              .print-header p {
                margin: 5px 0 0 0;
                font-size: 14px;
                color: #666;
              }
              .print-report-body {
                width: 100%;
                max-width: 100%;
                overflow-x: visible;
              }
              .print-report-body table,
              table {
                table-layout: fixed !important;
                width: 100% !important;
                max-width: 100% !important;
                border-collapse: collapse;
                page-break-inside: auto;
                margin-top: 20px;
                font-size: 9px !important;
              }
              .print-report-body th,
              .print-report-body td,
              th, td {
                border: 1px solid #ddd;
                padding: 6px 4px;
                text-align: left;
                word-break: break-word !important;
                overflow-wrap: break-word !important;
                font-size: 8px !important;
              }
              th {
                background-color: #4285f4;
                color: white;
                font-weight: bold;
              }
              tr {
                page-break-inside: avoid;
                page-break-after: auto;
              }
              thead {
                display: table-header-group;
              }
              tfoot {
                display: table-footer-group;
              }
              .no-print {
                display: none !important;
              }
              span {
                display: inline-block !important;
                visibility: visible !important;
              }
              td span[style*="background"] {
                display: inline-block !important;
                padding: 0.25rem 0.5rem !important;
                border-radius: 4px !important;
                font-size: 0.7rem !important;
                color: white !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              tr[style*="background"],
              tr[style*="var(--corp-primary)"],
              tr[key="totals-row"] {
                background-color: #4285f4 !important;
                color: white !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                display: table-row !important;
                visibility: visible !important;
              }
              tr[style*="background"] td,
              tr[style*="var(--corp-primary)"] td,
              tr[key="totals-row"] td {
                background-color: #4285f4 !important;
                color: white !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                border: 1px solid #ddd !important;
              }
              tr[style*="background"] span,
              tr[style*="var(--corp-primary)"] span,
              tr[key="totals-row"] span {
                color: white !important;
                display: inline-block !important;
                visibility: visible !important;
              }
              tr[style*="background"] strong,
              tr[style*="var(--corp-primary)"] strong,
              tr[key="totals-row"] strong {
                color: white !important;
              }
            </style>
          </head>
          <body>
            <div class="print-header">
              <h1>${reportTitle}</h1>
              <p>Generated on: ${dateStr}</p>
              <p style="font-size: 14px; color: #333; font-weight: 500; margin-top: 8px;">
                ${dateRangeText}
              </p>
            </div>
            <div class="print-report-body">${content}</div>
          </body>
        </html>
      `;
      
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(printHTML);
      iframeDoc.close();
      
      // Wait for content to load, then print
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          // Remove iframe after printing
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        }, 250);
      };
      
    } catch (error) {
      console.error('Error printing report:', error);
      alert('An error occurred while printing. Please try again.');
    }
  };

  // PDF Download functionality
  const handleDownloadPDF = () => {
    console.log('PDF download button clicked');
    try {
      const filters = {
        period: period !== 'all' ? period : null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        category: categoryFilter !== 'all' ? categoryFilter : null,
        series: seriesFilter !== 'all' ? seriesFilter : null,
        agentId: agentFilter !== 'all' ? agentFilter : null,
      };

      const reportTitle = tabs.find(t => t.id === activeTab)?.label || 'Report';
      const filename = `${reportTitle.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;

      switch (activeTab) {
        case 'summary':
          if (!summaryData) {
            alert('No data available to generate PDF. Please wait for the report to load.');
            return;
          }
          generateSummaryReportPDF({
            title: reportTitle,
            summaryData,
            filters,
            filename
          });
          break;
      
      case 'category':
        if (!categoryReport || categoryReport.length === 0) {
          alert('No data available to generate PDF. Please wait for the report to load.');
          return;
        }
        generateReportPDF({
          title: reportTitle,
          columns: [
            { header: 'Category', field: 'category' },
            { header: 'Total Sales', field: 'total_sales' },
            { header: 'Unique Customers', field: 'unique_customers' },
            { header: 'Total Quantity', field: 'total_quantity' },
            { header: 'Total Revenue', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
            { header: 'Total MRP', field: 'total_mrp', render: (row) => formatCurrency(row.total_mrp) },
            { header: 'Total Discount', field: 'total_discount', render: (row) => formatCurrency(row.total_discount) },
            { header: 'Total Commission', field: 'total_commission', render: (row) => formatCurrency(row.total_commission || 0) },
            { header: 'Avg Sale Amount', field: 'avg_sale_amount', render: (row) => formatCurrency(row.avg_sale_amount) }
          ],
          data: categoryReport,
          totals: categoryTotals,
          filters,
          filename
        });
        break;
      
      case 'product':
        generateReportPDF({
          title: reportTitle,
          columns: [
            { header: 'Product Name', field: 'name' },
            { header: 'SKU', field: 'sku' },
            { header: 'Category', field: 'category' },
            { header: 'Series', field: 'series' },
            { header: 'Total Sales', field: 'total_sales' },
            { header: 'Total Quantity', field: 'total_quantity' },
            { header: 'Total Revenue', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
            { header: 'Total Discount', field: 'total_discount', render: (row) => formatCurrency(row.total_discount || 0) },
            { header: 'Total Commission', field: 'total_commission', render: (row) => formatCurrency(row.total_commission || 0) },
            { header: 'Avg Sale Amount', field: 'avg_sale_amount', render: (row) => formatCurrency(row.avg_sale_amount) }
          ],
          data: productReport,
          totals: productTotals,
          filters,
          filename
        });
        break;
      
      case 'series':
        generateReportPDF({
          title: reportTitle,
          columns: [
            { header: 'Series', field: 'series' },
            { header: 'Category', field: 'category' },
            { header: 'Total Sales', field: 'total_sales' },
            { header: 'Unique Products', field: 'unique_products' },
            { header: 'Total Quantity', field: 'total_quantity' },
            { header: 'Total Revenue', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
            { header: 'Total Discount', field: 'total_discount', render: (row) => formatCurrency(row.total_discount || 0) },
            { header: 'Total Commission', field: 'total_commission', render: (row) => formatCurrency(row.total_commission || 0) },
            { header: 'Avg Sale Amount', field: 'avg_sale_amount', render: (row) => formatCurrency(row.avg_sale_amount) }
          ],
          data: seriesReport,
          totals: seriesTotals,
          filters,
          filename
        });
        break;
      
      case 'customer':
        generateReportPDF({
          title: reportTitle,
          columns: [
            { header: 'Customer Name', field: 'customer_name' },
            { header: 'Mobile', field: 'customer_mobile_number' },
            { header: 'Business Name', field: 'customer_business_name' },
            { header: 'GST Number', field: 'customer_gst_number' },
            { header: 'Sales Type', field: 'sales_type' },
            { header: 'Total Sales', field: 'total_sales' },
            { header: 'Total Revenue', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
            { header: 'Total Discount', field: 'total_discount', render: (row) => formatCurrency(row.total_discount || 0) },
            { header: 'Total Commission', field: 'total_commission', render: (row) => formatCurrency(row.total_commission || 0) },
            { header: 'First Purchase', field: 'first_purchase_date', render: (row) => formatDate(row.first_purchase_date) },
            { header: 'Last Purchase', field: 'last_purchase_date', render: (row) => formatDate(row.last_purchase_date) }
          ],
          data: customerReport,
          totals: customerTotals,
          filters,
          filename
        });
        break;
      
      case 'b2b':
        generateReportPDF({
          title: reportTitle,
          columns: [
            { header: 'Customer Name', field: 'customer_name' },
            { header: 'Business Name', field: 'customer_business_name' },
            { header: 'Mobile', field: 'customer_mobile_number' },
            { header: 'GST Number', field: 'customer_gst_number' },
            { header: 'Total Sales', field: 'total_sales' },
            { header: 'Total Revenue', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
            { header: 'Total Discount', field: 'total_discount', render: (row) => formatCurrency(row.total_discount || 0) },
            { header: 'Total Commission', field: 'total_commission', render: (row) => formatCurrency(row.total_commission || 0) },
            { header: 'First Purchase', field: 'first_purchase_date', render: (row) => formatDate(row.first_purchase_date) },
            { header: 'Last Purchase', field: 'last_purchase_date', render: (row) => formatDate(row.last_purchase_date) }
          ],
          data: b2bReport,
          totals: b2bTotals,
          filters,
          filename
        });
        break;
      
      case 'b2c':
        generateReportPDF({
          title: reportTitle,
          columns: [
            { header: 'Customer Name', field: 'customer_name' },
            { header: 'Mobile', field: 'customer_mobile_number' },
            { header: 'Vehicle Number', field: 'customer_vehicle_number' },
            { header: 'Total Sales', field: 'total_sales' },
            { header: 'Total Revenue', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
            { header: 'Total Discount', field: 'total_discount', render: (row) => formatCurrency(row.total_discount || 0) },
            { header: 'Total Commission', field: 'total_commission', render: (row) => formatCurrency(row.total_commission || 0) },
            { header: 'First Purchase', field: 'first_purchase_date', render: (row) => formatDate(row.first_purchase_date) },
            { header: 'Last Purchase', field: 'last_purchase_date', render: (row) => formatDate(row.last_purchase_date) }
          ],
          data: b2cReport,
          totals: b2cTotals,
          filters,
          filename
        });
        break;
      
      case 'profit':
        if (!profitReport) {
          alert('No data available to generate PDF. Please wait for the report to load.');
          return;
        }
        generateProfitReportPDF({
          profitReport,
          filters,
          filename
        });
        break;
      
      case 'agent':
        generateReportPDF({
          title: reportTitle,
          columns: [
            { header: 'Agent Name', field: 'agent_name' },
            { header: 'Mobile', field: 'agent_mobile' },
            { header: 'Email', field: 'agent_email' },
            { header: 'Commission Sales', field: 'total_commission_sales' },
            { header: 'Total Commission Paid', field: 'total_commission_paid', render: (row) => formatCurrency(row.total_commission_paid) },
            { header: 'Total Sales Amount', field: 'total_sales_amount', render: (row) => formatCurrency(row.total_sales_amount) },
            { header: 'First Commission', field: 'first_commission_date', render: (row) => formatDate(row.first_commission_date) },
            { header: 'Last Commission', field: 'last_commission_date', render: (row) => formatDate(row.last_commission_date) }
          ],
          data: agentCommissionReport,
          totals: agentCommissionTotals,
          filters,
          filename
        });
        break;
      
      case 'commission-details':
        generateReportPDF({
          title: reportTitle,
          columns: [
            { header: 'Invoice Number', field: 'invoice_number' },
            { header: 'Customer Name', field: 'customer_name' },
            { header: 'Product Name', field: 'product_name' },
            { header: 'SKU', field: 'sku' },
            { header: 'Serial Number', field: 'serial_number' },
            { header: 'Sale Amount', field: 'sale_amount', render: (row) => formatCurrency(row.sale_amount) },
            { header: 'Commission Amount', field: 'commission_amount', render: (row) => formatCurrency(row.commission_amount) },
            { header: 'Agent Name', field: 'agent_name' },
            { header: 'Date', field: 'purchase_date', render: (row) => formatDate(row.purchase_date) }
          ],
          data: commissionDetailsReport,
          totals: commissionDetailsTotals,
          filters,
          filename
        });
        break;
      
      case 'charging':
        if (!chargingServicesReport) {
          alert('No data available to generate PDF. Please wait for the report to load.');
          return;
        }
        generateChargingServicesReportPDF({
          chargingReport: chargingServicesReport,
          filters,
          filename
        });
        break;
      
      case 'charging-customer':
        generateReportPDF({
          title: reportTitle,
          columns: [
            { header: 'Customer Name', field: 'customer_name' },
            { header: 'Mobile', field: 'customer_mobile_number' },
            { header: 'Email', field: 'customer_email' },
            { header: 'Total Services', field: 'total_services' },
            { header: 'Total Spent', field: 'total_spent', render: (row) => formatCurrency(row.total_spent) },
            { header: 'First Service', field: 'first_service_date', render: (row) => formatDate(row.first_service_date) },
            { header: 'Last Service', field: 'last_service_date', render: (row) => formatDate(row.last_service_date) }
          ],
          data: chargingCustomerReport,
          totals: chargingCustomerTotals,
          filters,
          filename
        });
        break;
      
      case 'services-type':
        if (!servicesTypeReport || servicesTypeReport.length === 0) {
          alert('No data available to generate PDF. Please wait for the report to load.');
          return;
        }
        generateReportPDF({
          title: reportTitle,
          columns: [
            { header: 'Service Type', field: 'service_type_label' },
            { header: 'Total Requests', field: 'total_requests' },
            { header: 'Completed', field: 'completed_requests' },
            { header: 'Pending', field: 'pending_requests' },
            { header: 'In Progress', field: 'in_progress_requests' },
            { header: 'Cancelled', field: 'cancelled_requests' },
            { header: 'Unique Customers', field: 'unique_customers' },
            { header: 'Total Revenue', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
            { header: 'Avg Service Amount', field: 'avg_service_amount', render: (row) => formatCurrency(row.avg_service_amount) },
            { header: 'First Request', field: 'first_request_date', render: (row) => formatDate(row.first_request_date) },
            { header: 'Last Request', field: 'last_request_date', render: (row) => formatDate(row.last_request_date) }
          ],
          data: servicesTypeReport,
          totals: servicesTypeTotals,
          filters,
          filename
        });
        break;
      
      case 'employee':
        if (!employeeReport || employeeReport.length === 0) {
          alert('No data available to generate PDF. Please wait for the report to load.');
          return;
        }
        generateReportPDF({
          title: reportTitle,
          columns: [
            { header: 'Employee Name', field: 'employee_name' },
            { header: 'Phone', field: 'phone' },
            { header: 'Email', field: 'email' },
            { header: 'Designation', field: 'designation' },
            { header: 'Status', field: 'is_active', render: (row) => row.is_active ? 'Active' : 'Inactive' },
            { header: 'Present Days', field: 'attendance.total_present_days' },
            { header: 'Total Paid', field: 'payments.total_paid', render: (row) => formatCurrency(row.payments.total_paid) },
            { header: 'Joining Date', field: 'joining_date', render: (row) => formatDate(row.joining_date) }
          ],
          data: employeeReport,
          totals: employeeTotals,
          filters,
          filename
        });
        break;
      
      case 'water':
        if (!waterReport || waterReport.length === 0) {
          alert('No data available to generate PDF. Please wait for the report to load.');
          return;
        }
        generateReportPDF({
          title: reportTitle,
          columns: [
            { header: 'Product Name', field: 'name' },
            { header: 'SKU', field: 'sku' },
            { header: 'Series', field: 'series' },
            { header: 'Quantity', field: 'quantity' },
            { header: 'Total MRP', field: 'total_mrp', render: (row) => formatCurrency(row.total_mrp) },
            { header: 'Total Discount', field: 'total_discount', render: (row) => formatCurrency(row.total_discount) },
            { header: 'Total Revenue', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
            { header: 'Purchase Cost', field: 'total_purchase_cost', render: (row) => formatCurrency(row.total_purchase_cost) },
            { header: 'Profit', field: 'total_profit', render: (row) => formatCurrency(row.total_profit) },
            { header: 'Profit %', field: 'profit_margin_percent', render: (row) => `${row.profit_margin_percent}%` },
            { header: 'B2B Qty', field: 'b2b_quantity' },
            { header: 'B2B Revenue', field: 'b2b_revenue', render: (row) => formatCurrency(row.b2b_revenue) },
            { header: 'B2C Qty', field: 'b2c_quantity' },
            { header: 'B2C Revenue', field: 'b2c_revenue', render: (row) => formatCurrency(row.b2c_revenue) }
          ],
          data: waterReport,
          totals: waterTotals,
          filters,
          filename
        });
        break;
      
      default:
        break;
    }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('An error occurred while generating PDF. Please try again.');
    }
  };

  const categories = [
    { id: 'car-truck-tractor', name: 'Car/Truck/Tractor' },
    { id: 'bike', name: 'Bike' },
    { id: 'ups-inverter', name: 'UPS/Inverter' }
  ];

  const renderSummary = () => {
    if (!summaryData) return <div>No data available</div>;

    return (
      <div className="reports-summary">
        {/* Date Range Display */}
        <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--corp-text-secondary)' }}>
          {getDateRangeText()}
        </div>
        
        <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <SummaryCard 
            title="Total Sales"
            value={summaryData.sales?.total_sales || 0}
            color="var(--corp-text-primary)"
            details={`${summaryData.sales?.total_invoices || 0} invoices`}
          />
          <SummaryCard 
            title="Total Revenue"
            value={formatCurrency(summaryData.sales?.total_revenue || 0)}
            color="var(--corp-primary)"
            details={`${summaryData.sales?.total_quantity_sold || 0} units sold`}
          />
          <SummaryCard 
            title="Total Commission Paid"
            value={formatCurrency(summaryData.commission?.total_commission_paid || 0)}
            color="var(--corp-warning)"
            details={`${summaryData.commission?.total_commission_sales || 0} sales`}
          />
          <SummaryCard 
            title="Charging Revenue"
            value={formatCurrency(summaryData.charging?.total_revenue || 0)}
            color="var(--corp-accent)"
            details={`${summaryData.charging?.total_services || 0} services`}
          />
          <SummaryCard 
            title="Total Profit"
            value={formatCurrency(summaryData.profit?.total_profit || 0)}
            color="var(--corp-success)"
            details={`Sales: ${formatCurrency(summaryData.profit?.sales_profit || 0)} | Charging: ${formatCurrency(summaryData.profit?.charging_profit || 0)} | Services: ${formatCurrency(summaryData.profit?.services_profit || 0)}`}
            isDetails={true}
          />
          <SummaryCard 
            title="Balance"
            value={formatCurrency(summaryData.balance?.balance || 0)}
            color={summaryData.balance?.balance >= 0 ? "var(--corp-success)" : "var(--corp-danger)"}
            details={`Profit: ${formatCurrency(summaryData.balance?.total_profit || 0)} - Payments: ${formatCurrency(summaryData.balance?.total_employee_payments || 0)}`}
            isDetails={true}
          />
        </div>

        <div style={{ background: 'var(--corp-bg-card)', padding: '1.5rem', borderRadius: 'var(--corp-radius)', boxShadow: 'var(--corp-shadow)' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--corp-text-primary)' }}>Additional Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <strong>Unique Customers:</strong> {summaryData.sales?.unique_customers || 0}
            </div>
            <div>
              <strong>Total Discount:</strong> {formatCurrency(summaryData.sales?.total_discount || 0)}
            </div>
            <div>
              <strong>Total Tax:</strong> {formatCurrency(summaryData.sales?.total_tax || 0)}
            </div>
            <div>
              <strong>Total MRP:</strong> {formatCurrency(summaryData.sales?.total_mrp || 0)}
            </div>
            <div>
              <strong>Commission Agents:</strong> {summaryData.commission?.unique_agents || 0}
            </div>
            <div>
              <strong>Employee Payments:</strong> {formatCurrency(summaryData.balance?.total_employee_payments || 0)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTable = (columns, data, keyExtractor = (item, index) => index, totals = null) => {
    if (!data || data.length === 0) {
      return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--corp-text-muted)' }}>No data available</div>;
    }

    return (
      <div>
        {/* Date Range Display */}
        <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--corp-text-secondary)' }}>
          {getDateRangeText()}
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--corp-bg-card)', borderRadius: 'var(--corp-radius)', overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: 'var(--corp-bg-tertiary)' }}>
              {columns.map((col, idx) => (
                <th key={idx} style={{ padding: '1rem', textAlign: col.align || 'left', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={keyExtractor(row, rowIndex)} style={{ borderBottom: '1px solid var(--corp-border)' }}>
                {columns.map((col, colIndex) => (
                  <td key={colIndex} style={{ padding: '1rem', color: 'var(--corp-text-secondary)' }}>
                    {col.render ? col.render(row) : row[col.field]}
                  </td>
                ))}
              </tr>
            ))}
            {totals && (
              <tr key="totals-row" style={{ background: 'var(--corp-primary)', color: 'white', borderTop: '3px solid var(--corp-border)', fontWeight: 'bold' }}>
                <td colSpan={columns.length} style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: '1rem', overflow: 'hidden' }}>
                    <strong style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>TOTAL SUMMARY</strong>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'nowrap', alignItems: 'center', overflow: 'hidden', flex: '1', justifyContent: 'flex-end' }}>
                      {totals.total_quantity !== undefined && totals.total_quantity !== 0 && (
                        <span style={{ whiteSpace: 'nowrap', fontSize: '0.875rem' }}><strong>Total Quantity:</strong> {totals.total_quantity}</span>
                      )}
                      {(totals.total_revenue !== undefined || totals.total_sales_amount !== undefined) && (
                        <span style={{ whiteSpace: 'nowrap', fontSize: '0.875rem' }}><strong>Total Revenue:</strong> {formatCurrency(totals.total_revenue || totals.total_sales_amount || 0)}</span>
                      )}
                      {totals.total_profit !== undefined && (
                        <span style={{ color: 'var(--corp-success)', fontWeight: 'bold', whiteSpace: 'nowrap', fontSize: '0.875rem' }}><strong>Total Profit:</strong> {formatCurrency(totals.total_profit || 0)}</span>
                      )}
                      {summaryData.balance?.balance !== undefined && (
                        <span style={{ color: summaryData.balance.balance >= 0 ? 'var(--corp-success)' : 'var(--corp-danger)', fontWeight: 'bold', whiteSpace: 'nowrap', fontSize: '0.875rem' }}><strong>Balance:</strong> {formatCurrency(summaryData.balance.balance || 0)}</span>
                      )}
                      {totals.total_commission_paid !== undefined && (
                        <span style={{ whiteSpace: 'nowrap', fontSize: '0.875rem' }}><strong>Total Commission:</strong> {formatCurrency(totals.total_commission_paid)}</span>
                      )}
                      {/* Services-specific totals */}
                      {totals.total_completed !== undefined && (
                        <span style={{ whiteSpace: 'nowrap', fontSize: '0.875rem' }}><strong>Total Completed:</strong> {totals.total_completed}</span>
                      )}
                      {totals.total_pending !== undefined && (
                        <span style={{ whiteSpace: 'nowrap', fontSize: '0.875rem' }}><strong>Total Pending:</strong> {totals.total_pending}</span>
                      )}
                      {totals.total_in_progress !== undefined && (
                        <span style={{ whiteSpace: 'nowrap', fontSize: '0.875rem' }}><strong>Total In Progress:</strong> {totals.total_in_progress}</span>
                      )}
                      {totals.total_cancelled !== undefined && (
                        <span style={{ whiteSpace: 'nowrap', fontSize: '0.875rem' }}><strong>Total Cancelled:</strong> {totals.total_cancelled}</span>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    );
  };

  const renderReportContent = () => {
    if (loading) {
      return <div style={{ padding: '3rem', textAlign: 'center' }}>Loading report data...</div>;
    }

    if (error) {
      return <div style={{ padding: '2rem', background: 'var(--corp-danger)', color: 'white', borderRadius: 'var(--corp-radius)', marginBottom: '1rem' }}>Error: {error}</div>;
    }

    switch (activeTab) {
      case 'summary':
        return renderSummary();
      
      case 'category':
        return renderTable([
          { header: 'Category', field: 'category' },
          { header: 'Total Sales', field: 'total_sales' },
          { header: 'Unique Customers', field: 'unique_customers' },
          { header: 'Total Quantity', field: 'total_quantity' },
          { header: 'Total Revenue', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
          { header: 'Total Profit', field: 'total_profit', render: (row) => <span style={{ color: 'var(--corp-success)', fontWeight: '600' }}>{formatCurrency(row.total_profit || 0)}</span> },
          { header: 'Total MRP', field: 'total_mrp', render: (row) => formatCurrency(row.total_mrp) },
          { header: 'Total Discount', field: 'total_discount', render: (row) => formatCurrency(row.total_discount) },
          { header: 'Total Commission', field: 'total_commission', render: (row) => formatCurrency(row.total_commission || 0) },
          { header: 'Avg Sale Amount', field: 'avg_sale_amount', render: (row) => formatCurrency(row.avg_sale_amount) }
        ], categoryReport, (item, index) => `category-${item.category}-${index}`, categoryTotals);
      
      case 'product':
        return renderTable([
          { header: 'Product Name', field: 'name' },
          { header: 'SKU', field: 'sku' },
          { header: 'Category', field: 'category' },
          { header: 'Series', field: 'series' },
          { header: 'Total Sales', field: 'total_sales' },
          { header: 'Total Quantity', field: 'total_quantity' },
          { header: 'Total Revenue', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
          { header: 'Total Profit', field: 'total_profit', render: (row) => <span style={{ color: 'var(--corp-success)', fontWeight: '600' }}>{formatCurrency(row.total_profit || 0)}</span> },
          { header: 'Total Discount', field: 'total_discount', render: (row) => formatCurrency(row.total_discount || 0) },
          { header: 'Total Commission', field: 'total_commission', render: (row) => formatCurrency(row.total_commission || 0) },
          { header: 'Avg Sale Amount', field: 'avg_sale_amount', render: (row) => formatCurrency(row.avg_sale_amount) }
        ], productReport, (item) => `${item.name}-${item.sku}`, productTotals);
      
      case 'series':
        return renderTable([
          { header: 'Series', field: 'series' },
          { header: 'Category', field: 'category' },
          { header: 'Total Sales', field: 'total_sales' },
          { header: 'Unique Products', field: 'unique_products' },
          { header: 'Total Quantity', field: 'total_quantity' },
          { header: 'Total Revenue', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
          { header: 'Total Profit', field: 'total_profit', render: (row) => <span style={{ color: 'var(--corp-success)', fontWeight: '600' }}>{formatCurrency(row.total_profit || 0)}</span> },
          { header: 'Total Discount', field: 'total_discount', render: (row) => formatCurrency(row.total_discount || 0) },
          { header: 'Total Commission', field: 'total_commission', render: (row) => formatCurrency(row.total_commission || 0) },
          { header: 'Avg Sale Amount', field: 'avg_sale_amount', render: (row) => formatCurrency(row.avg_sale_amount) }
        ], seriesReport, (item, index) => `${item.series}-${item.category}-${index}`, seriesTotals);
      
      case 'customer':
        return renderTable([
          { header: 'Customer Name', field: 'customer_name' },
          { header: 'Mobile', field: 'customer_mobile_number' },
          { header: 'Business Name', field: 'customer_business_name' },
          { header: 'GST Number', field: 'customer_gst_number' },
          { header: 'Sales Type', field: 'sales_type' },
          { header: 'Total Sales', field: 'total_sales' },
          { header: 'Total Revenue', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
          { header: 'Total Profit', field: 'total_profit', render: (row) => <span style={{ color: 'var(--corp-success)', fontWeight: '600' }}>{formatCurrency(row.total_profit || 0)}</span> },
          { header: 'Total Discount', field: 'total_discount', render: (row) => formatCurrency(row.total_discount || 0) },
          { header: 'Total Commission', field: 'total_commission', render: (row) => formatCurrency(row.total_commission || 0) },
          { header: 'First Purchase', field: 'first_purchase_date', render: (row) => formatDate(row.first_purchase_date) },
          { header: 'Last Purchase', field: 'last_purchase_date', render: (row) => formatDate(row.last_purchase_date) }
        ], customerReport, (item, index) => `customer-${item.customer_id || item.customer_mobile_number}-${index}`, customerTotals);
      
      case 'b2b':
        return renderTable([
          { header: 'Customer Name', field: 'customer_name' },
          { header: 'Business Name', field: 'customer_business_name' },
          { header: 'Mobile', field: 'customer_mobile_number' },
          { header: 'GST Number', field: 'customer_gst_number' },
          { header: 'Total Sales', field: 'total_sales' },
          { header: 'Total Revenue', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
          { header: 'Total Profit', field: 'total_profit', render: (row) => <span style={{ color: 'var(--corp-success)', fontWeight: '600' }}>{formatCurrency(row.total_profit || 0)}</span> },
          { header: 'Total Discount', field: 'total_discount', render: (row) => formatCurrency(row.total_discount || 0) },
          { header: 'Total Commission', field: 'total_commission', render: (row) => formatCurrency(row.total_commission || 0) },
          { header: 'First Purchase', field: 'first_purchase_date', render: (row) => formatDate(row.first_purchase_date) },
          { header: 'Last Purchase', field: 'last_purchase_date', render: (row) => formatDate(row.last_purchase_date) }
        ], b2bReport, (item, index) => `b2b-${item.customer_id || item.customer_mobile_number}-${index}`, b2bTotals);
      
      case 'b2c':
        return renderTable([
          { header: 'Customer Name', field: 'customer_name' },
          { header: 'Mobile', field: 'customer_mobile_number' },
          { header: 'Vehicle Number', field: 'customer_vehicle_number' },
          { header: 'Total Sales', field: 'total_sales' },
          { header: 'Total Revenue', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
          { header: 'Total Profit', field: 'total_profit', render: (row) => <span style={{ color: 'var(--corp-success)', fontWeight: '600' }}>{formatCurrency(row.total_profit || 0)}</span> },
          { header: 'Total Discount', field: 'total_discount', render: (row) => formatCurrency(row.total_discount || 0) },
          { header: 'Total Commission', field: 'total_commission', render: (row) => formatCurrency(row.total_commission || 0) },
          { header: 'First Purchase', field: 'first_purchase_date', render: (row) => formatDate(row.first_purchase_date) },
          { header: 'Last Purchase', field: 'last_purchase_date', render: (row) => formatDate(row.last_purchase_date) }
        ], b2cReport, (item, index) => `b2c-${item.customer_id || item.customer_mobile_number}-${index}`, b2cTotals);
      
      case 'profit':
        if (!profitReport) return <div>No data available</div>;
        
        return (
          <div>
            {/* Date Range Display */}
            <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--corp-text-secondary)' }}>
              {getDateRangeText()}
            </div>
            
            <div style={{ background: 'var(--corp-bg-card)', padding: '1.5rem', borderRadius: 'var(--corp-radius)', marginBottom: '2rem', boxShadow: 'var(--corp-shadow)' }}>
              <h3 style={{ marginTop: 0 }}>Overall Profit</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <strong>Total Revenue:</strong> {formatCurrency(profitReport.overall?.total_revenue || 0)}
                </div>
                <div>
                  <strong>Purchase Cost:</strong> {formatCurrency(profitReport.overall?.total_purchase_cost || 0)}
                </div>
                <div>
                  <strong>Total Profit:</strong> <span style={{ color: 'var(--corp-accent)', fontWeight: 'bold' }}>{formatCurrency(profitReport.overall?.total_profit || 0)}</span>
                </div>
                <div>
                  <strong>Profit Margin:</strong> {profitReport.overall?.profit_margin_percent || 0}%
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h3>Profit by Category</h3>
              {renderTable([
                { header: 'Category', field: 'category' },
                { header: 'Revenue', field: 'revenue', render: (row) => formatCurrency(row.revenue) },
                { header: 'Purchase Cost', field: 'purchase_cost', render: (row) => formatCurrency(row.purchase_cost) },
                { header: 'Profit', field: 'profit', render: (row) => <span style={{ color: 'var(--corp-accent)', fontWeight: 'bold' }}>{formatCurrency(row.profit)}</span> },
                { header: 'Profit Margin %', field: 'profit_margin_percent', render: (row) => `${row.profit_margin_percent}%` }
              ], profitReport.by_category, (item) => item.category)}
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h3>Profit by Series</h3>
              {renderTable([
                { header: 'Series', field: 'series' },
                { header: 'Revenue', field: 'revenue', render: (row) => formatCurrency(row.revenue) },
                { header: 'Purchase Cost', field: 'purchase_cost', render: (row) => formatCurrency(row.purchase_cost) },
                { header: 'Profit', field: 'profit', render: (row) => <span style={{ color: 'var(--corp-accent)', fontWeight: 'bold' }}>{formatCurrency(row.profit)}</span> },
                { header: 'Profit Margin %', field: 'profit_margin_percent', render: (row) => `${row.profit_margin_percent}%` }
              ], profitReport.by_series, (item) => item.series)}
            </div>

            <div>
              <h3>Profit by Product</h3>
              {renderTable([
                { header: 'Product Name', field: 'name' },
                { header: 'SKU', field: 'sku' },
                { header: 'Category', field: 'category' },
                { header: 'Series', field: 'series' },
                { header: 'Revenue', field: 'revenue', render: (row) => formatCurrency(row.revenue) },
                { header: 'Purchase Cost', field: 'purchase_cost', render: (row) => formatCurrency(row.purchase_cost) },
                { header: 'Profit', field: 'profit', render: (row) => <span style={{ color: 'var(--corp-accent)', fontWeight: 'bold' }}>{formatCurrency(row.profit)}</span> },
                { header: 'Profit Margin %', field: 'profit_margin_percent', render: (row) => `${row.profit_margin_percent}%` }
              ], profitReport.by_product, (item) => `${item.name}-${item.sku}`)}
            </div>
          </div>
        );
      
      case 'agent':
        return renderTable([
          { header: 'Agent Name', field: 'agent_name' },
          { header: 'Mobile', field: 'agent_mobile' },
          { header: 'Email', field: 'agent_email' },
          { header: 'Commission Sales', field: 'total_commission_sales' },
          { header: 'Total Commission Paid', field: 'total_commission_paid', render: (row) => formatCurrency(row.total_commission_paid) },
          { header: 'Total Sales Amount', field: 'total_sales_amount', render: (row) => formatCurrency(row.total_sales_amount) },
          { header: 'First Commission', field: 'first_commission_date', render: (row) => formatDate(row.first_commission_date) },
          { header: 'Last Commission', field: 'last_commission_date', render: (row) => formatDate(row.last_commission_date) }
        ], agentCommissionReport, (item) => item.agent_id, agentCommissionTotals);
      
      case 'commission-details':
        return renderTable([
          { header: 'Invoice Number', field: 'invoice_number' },
          { header: 'Customer Name', field: 'customer_name' },
          { header: 'Product Name', field: 'product_name' },
          { header: 'SKU', field: 'sku' },
          { header: 'Serial Number', field: 'serial_number' },
          { header: 'Sale Amount', field: 'sale_amount', render: (row) => formatCurrency(row.sale_amount) },
          { header: 'Commission Amount', field: 'commission_amount', render: (row) => formatCurrency(row.commission_amount) },
          { header: 'Agent Name', field: 'agent_name' },
          { header: 'Date', field: 'purchase_date', render: (row) => formatDate(row.purchase_date) }
        ], commissionDetailsReport, (item) => item.id, commissionDetailsTotals);
      
      case 'charging':
        if (!chargingServicesReport) return <div>No data available</div>;
        
        return (
          <div>
            {/* Date Range Display */}
            <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--corp-text-secondary)' }}>
              {getDateRangeText()}
            </div>
            
            <div style={{ background: 'var(--corp-bg-card)', padding: '1.5rem', borderRadius: 'var(--corp-radius)', marginBottom: '2rem', boxShadow: 'var(--corp-shadow)' }}>
              <h3 style={{ marginTop: 0 }}>Charging Services Overview</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <strong>Total Services:</strong> {chargingServicesReport.total_services || 0}
                </div>
                <div>
                  <strong>Completed:</strong> {chargingServicesReport.completed_services || 0}
                </div>
                <div>
                  <strong>Collected:</strong> {chargingServicesReport.collected_services || 0}
                </div>
                <div>
                  <strong>Total Revenue:</strong> {formatCurrency(chargingServicesReport.total_revenue || 0)}
                </div>
                <div>
                  <strong>Estimated Profit:</strong> <span style={{ color: 'var(--corp-accent)', fontWeight: 'bold' }}>{formatCurrency(chargingServicesReport.estimated_profit || 0)}</span>
                </div>
                <div>
                  <strong>Profit Margin:</strong> {chargingServicesReport.profit_margin_percent || 0}%
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'charging-customer':
        return renderTable([
          { header: 'Customer Name', field: 'customer_name' },
          { header: 'Mobile', field: 'customer_mobile_number' },
          { header: 'Email', field: 'customer_email' },
          { header: 'Total Services', field: 'total_services' },
          { header: 'Total Spent', field: 'total_spent', render: (row) => formatCurrency(row.total_spent) },
          { header: 'First Service', field: 'first_service_date', render: (row) => formatDate(row.first_service_date) },
          { header: 'Last Service', field: 'last_service_date', render: (row) => formatDate(row.last_service_date) }
        ], chargingCustomerReport, (item, index) => `charging-${item.customer_mobile_number}-${index}`, chargingCustomerTotals);
      
      case 'services-type':
        return renderTable([
          { header: 'Service Type', field: 'service_type_label' },
          { header: 'Total Requests', field: 'total_requests' },
          { header: 'Completed', field: 'completed_requests' },
          { header: 'Pending', field: 'pending_requests' },
          { header: 'In Progress', field: 'in_progress_requests' },
          { header: 'Cancelled', field: 'cancelled_requests' },
          { header: 'Unique Customers', field: 'unique_customers' },
          { header: 'Total Revenue', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
          { header: 'Avg Service Amount', field: 'avg_service_amount', render: (row) => formatCurrency(row.avg_service_amount) },
          { header: 'First Request', field: 'first_request_date', render: (row) => formatDate(row.first_request_date) },
          { header: 'Last Request', field: 'last_request_date', render: (row) => formatDate(row.last_request_date) }
        ], servicesTypeReport, (item, index) => `services-${item.service_type}-${index}`, servicesTypeTotals);
      
      case 'employee':
        if (!employeeReport || employeeReport.length === 0) {
          return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--corp-text-muted)' }}>No employee data available</div>;
        }
        
        return (
          <div>
            {/* Date Range Display */}
            <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--corp-text-secondary)' }}>
              {getDateRangeText()}
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--corp-bg-card)', borderRadius: 'var(--corp-radius)', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: 'var(--corp-bg-tertiary)' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>Employee Name</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>Phone</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>Email</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>Designation</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>Status</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>Present Days</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>Total Paid</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>Joining Date</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeReport.map((emp, index) => (
                    <tr key={`employee-${emp.employee_id}-${index}`} style={{ borderBottom: '1px solid var(--corp-border)' }}>
                      <td style={{ padding: '1rem', color: 'var(--corp-text-secondary)' }}>{emp.employee_name}</td>
                      <td style={{ padding: '1rem', color: 'var(--corp-text-secondary)' }}>{emp.phone || '-'}</td>
                      <td style={{ padding: '1rem', color: 'var(--corp-text-secondary)' }}>{emp.email || '-'}</td>
                      <td style={{ padding: '1rem', color: 'var(--corp-text-secondary)' }}>{emp.designation || '-'}</td>
                      <td style={{ padding: '1rem', color: 'var(--corp-text-secondary)' }}>
                        <span style={{ 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '4px', 
                          fontSize: '0.75rem',
                          background: emp.is_active ? 'var(--corp-success)' : 'var(--corp-danger)',
                          color: 'white'
                        }}>
                          {emp.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--corp-text-secondary)' }}>{emp.attendance.total_present_days}</td>
                      <td style={{ padding: '1rem', color: 'var(--corp-text-secondary)' }}>{formatCurrency(emp.payments.total_paid)}</td>
                      <td style={{ padding: '1rem', color: 'var(--corp-text-secondary)' }}>{formatDate(emp.joining_date)}</td>
                    </tr>
                  ))}
                  {employeeTotals && (
                    <tr key="totals-row" style={{ background: 'var(--corp-primary)', color: 'white', borderTop: '3px solid var(--corp-border)', fontWeight: 'bold' }}>
                      <td colSpan={8} style={{ padding: '1.25rem', fontSize: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
                          <strong style={{ fontSize: '1.1rem' }}>TOTAL SUMMARY</strong>
                          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                            <span><strong>Total Employees:</strong> {employeeTotals.total_employees}</span>
                            <span><strong>Active Employees:</strong> {employeeTotals.active_employees}</span>
                            <span><strong>Total Paid:</strong> {formatCurrency(employeeTotals.total_paid || 0)}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      
      case 'water':
        if (!waterReport || waterReport.length === 0) {
          return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--corp-text-muted)' }}>No water product data available</div>;
        }
        
        return (
          <div>
            {/* Date Range Display */}
            <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--corp-text-secondary)' }}>
              {getDateRangeText()}
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--corp-bg-card)', borderRadius: 'var(--corp-radius)', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: 'var(--corp-bg-tertiary)' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>Product Name</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>SKU</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>Series</th>
                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>Quantity</th>
                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>Total MRP</th>
                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>Discount</th>
                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>Revenue</th>
                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>Purchase Cost</th>
                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>Profit</th>
                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>Profit %</th>
                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>B2B Qty</th>
                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>B2B Revenue</th>
                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>B2C Qty</th>
                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: 'var(--corp-text-primary)', borderBottom: '2px solid var(--corp-border)' }}>B2C Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {waterReport.map((product, index) => (
                    <tr key={`water-${product.sku}-${index}`} style={{ borderBottom: '1px solid var(--corp-border)' }}>
                      <td style={{ padding: '1rem', color: 'var(--corp-text-secondary)' }}>{product.name}</td>
                      <td style={{ padding: '1rem', color: 'var(--corp-text-secondary)' }}>{product.sku}</td>
                      <td style={{ padding: '1rem', color: 'var(--corp-text-secondary)' }}>{product.series}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--corp-text-secondary)' }}>{product.quantity}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--corp-text-secondary)' }}>{formatCurrency(product.total_mrp)}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--corp-text-secondary)' }}>{formatCurrency(product.total_discount)}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--corp-text-secondary)', fontWeight: '600' }}>{formatCurrency(product.total_revenue)}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--corp-text-secondary)' }}>{formatCurrency(product.total_purchase_cost)}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: product.total_profit >= 0 ? 'var(--corp-success)' : 'var(--corp-danger)', fontWeight: '600' }}>
                        {formatCurrency(product.total_profit)}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: product.profit_margin_percent >= 0 ? 'var(--corp-success)' : 'var(--corp-danger)' }}>
                        {product.profit_margin_percent.toFixed(2)}%
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--corp-text-secondary)' }}>{product.b2b_quantity}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--corp-text-secondary)' }}>{formatCurrency(product.b2b_revenue)}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--corp-text-secondary)' }}>{product.b2c_quantity}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--corp-text-secondary)' }}>{formatCurrency(product.b2c_revenue)}</td>
                    </tr>
                  ))}
                  {waterTotals && (
                    <tr key="totals-row" style={{ background: 'var(--corp-primary)', color: 'white', borderTop: '3px solid var(--corp-border)', fontWeight: 'bold' }}>
                      <td colSpan={3} style={{ padding: '1.25rem', fontSize: '1rem' }}>
                        <strong>TOTAL SUMMARY</strong>
                      </td>
                      <td style={{ padding: '1.25rem', textAlign: 'right', fontSize: '1rem' }}>{waterTotals.total_quantity}</td>
                      <td style={{ padding: '1.25rem', textAlign: 'right', fontSize: '1rem' }}>{formatCurrency(waterTotals.total_mrp)}</td>
                      <td style={{ padding: '1.25rem', textAlign: 'right', fontSize: '1rem' }}>{formatCurrency(waterTotals.total_discount)}</td>
                      <td style={{ padding: '1.25rem', textAlign: 'right', fontSize: '1rem' }}>{formatCurrency(waterTotals.total_revenue)}</td>
                      <td style={{ padding: '1.25rem', textAlign: 'right', fontSize: '1rem' }}>{formatCurrency(waterTotals.total_purchase_cost)}</td>
                      <td style={{ padding: '1.25rem', textAlign: 'right', fontSize: '1rem' }}>{formatCurrency(waterTotals.total_profit)}</td>
                      <td style={{ padding: '1.25rem', textAlign: 'right', fontSize: '1rem' }}>{waterTotals.profit_margin_percent.toFixed(2)}%</td>
                      <td colSpan={4} style={{ padding: '1.25rem', fontSize: '1rem' }}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      
      default:
        return <div>Select a report type</div>;
    }
  };

  return (
    <div className="dashboard-content">
      <div className="dashboard-header">
        <h2>Reports</h2>
      </div>

      {/* Filters */}
      <div style={{ background: 'var(--corp-bg-card)', padding: '1.5rem', borderRadius: 'var(--corp-radius)', marginBottom: '2rem', boxShadow: 'var(--corp-shadow)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--corp-text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--corp-border)', borderRadius: 'var(--corp-radius-sm)', background: 'var(--corp-bg-primary)', color: 'var(--corp-text-primary)' }}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="last_3_months">Last 3 Months</option>
              <option value="last_year">Last Year</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--corp-text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--corp-border)', borderRadius: 'var(--corp-radius-sm)', background: 'var(--corp-bg-primary)', color: 'var(--corp-text-primary)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--corp-text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--corp-border)', borderRadius: 'var(--corp-radius-sm)', background: 'var(--corp-bg-primary)', color: 'var(--corp-text-primary)' }}
            />
          </div>

          {(activeTab === 'product' || activeTab === 'series' || activeTab === 'category') && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--corp-text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--corp-border)', borderRadius: 'var(--corp-radius-sm)', background: 'var(--corp-bg-primary)', color: 'var(--corp-text-primary)' }}
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}

          {(activeTab === 'product') && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--corp-text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>Series</label>
              <select
                value={seriesFilter}
                onChange={(e) => setSeriesFilter(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--corp-border)', borderRadius: 'var(--corp-radius-sm)', background: 'var(--corp-bg-primary)', color: 'var(--corp-text-primary)' }}
              >
                <option value="all">All Series</option>
                {availableSeries.map(series => (
                  <option key={series} value={series}>{series}</option>
                ))}
              </select>
            </div>
          )}

          {(activeTab === 'agent' || activeTab === 'commission-details') && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--corp-text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>Agent</label>
              <SearchableSelect
                value={agentFilter}
                onChange={(value) => setAgentFilter(value)}
                options={[
                  { value: 'all', label: 'All Agents', name: '', mobile_number: '', email: '' },
                  ...agents.map(agent => ({
                    value: agent.id,
                    label: `${agent.name || 'Unknown'} (${agent.mobile_number || 'N/A'})`,
                    name: agent.name || '',
                    mobile_number: agent.mobile_number || '',
                    email: agent.email || ''
                  }))
                ]}
                placeholder="All Agents"
                displayKey="label"
                valueKey="value"
                searchKeys={['name', 'mobile_number', 'email']}
                onSearch={(searchTerm) => {
                  // Server-side search for better performance with large lists
                  loadAgents(searchTerm);
                }}
                loading={agentsLoading}
              />
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setDateFrom('');
            setDateTo('');
            setPeriod('all');
            setCategoryFilter('all');
            setSeriesFilter('all');
            setAgentFilter('all');
          }}
          style={{ padding: '0.5rem 1rem', background: 'var(--corp-bg-tertiary)', border: '1px solid var(--corp-border)', borderRadius: 'var(--corp-radius-sm)', color: 'var(--corp-text-primary)', cursor: 'pointer' }}
        >
          Clear Filters
        </button>
      </div>

      {/* Report Type Selector */}
      <div style={{ marginBottom: '2rem', background: 'var(--corp-bg-card)', padding: '1.5rem', borderRadius: 'var(--corp-radius)', boxShadow: 'var(--corp-shadow)' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--corp-text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>
          Select Report Type
        </label>
        <SearchableSelect
          value={activeTab}
          onChange={(value) => setActiveTab(value)}
          options={tabs.map(tab => ({
            value: tab.id,
            label: `${tab.icon} ${tab.label}`,
            icon: tab.icon,
            name: tab.label
          }))}
          placeholder="Select a report type..."
          displayKey="label"
          valueKey="value"
          searchKeys={['name', 'label']}
          style={{ width: '100%', maxWidth: '500px' }}
        />
      </div>

      {/* Print and PDF Download Buttons */}
      <div className="no-print" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
        <button
          onClick={handlePrintClick}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'var(--corp-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--corp-radius-sm)',
            cursor: 'pointer',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.target.style.opacity = '0.9'}
          onMouseOut={(e) => e.target.style.opacity = '1'}
        >
          🖨️ Print Report
        </button>
        <button
          onClick={handleDownloadPDF}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'var(--corp-danger)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--corp-radius-sm)',
            cursor: 'pointer',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.target.style.opacity = '0.9'}
          onMouseOut={(e) => e.target.style.opacity = '1'}
        >
          📥 Download PDF
        </button>
      </div>

      {/* Report Content */}
      <div ref={printRef} style={{ background: 'var(--corp-bg-card)', padding: '2rem', borderRadius: 'var(--corp-radius)', boxShadow: 'var(--corp-shadow)' }}>
        {/* Print Header */}
        <div style={{ display: 'none' }} className="print-only">
          <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px solid #000', paddingBottom: '1rem' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
              {tabs.find(t => t.id === activeTab)?.label || 'Report'}
            </h1>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '14px', color: '#666' }}>
              Generated on: {new Date().toLocaleDateString('en-IN', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
            {(period !== 'all' || dateFrom || dateTo) && (
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '12px', color: '#666' }}>
                {period !== 'all' && `Period: ${period.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
                {dateFrom && dateTo && ` | Date Range: ${dateFrom} to ${dateTo}`}
              </p>
            )}
          </div>
        </div>
        {renderReportContent()}
      </div>
    </div>
  );
};

export default Reports;

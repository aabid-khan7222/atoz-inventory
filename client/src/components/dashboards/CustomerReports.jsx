import { useState, useEffect, useRef } from 'react';
import './DashboardContent.css';
import {
  getCustomerCategorySalesReport,
  getCustomerProductSalesReport,
  getCustomerSeriesSalesReport,
  getCustomerChargingServicesReport,
  getCustomerServiceRequestsReport,
  getCustomerSummaryReport,
  fetchProducts
} from '../../api';
import {
  generateReportPDF,
  generateSummaryReportPDF,
  generateChargingServicesReportPDF
} from '../../utils/reportPdf';
import SearchableSelect from '../common/SearchableSelect';
import { getFormState, saveFormState } from '../../utils/formStateManager';

const STORAGE_KEY = 'customerReportsState';

const CustomerReports = () => {
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
  const [serviceTypeFilter, setServiceTypeFilter] = useState(() => savedState?.serviceTypeFilter || 'all');
  
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
      serviceTypeFilter
    };
    saveFormState(STORAGE_KEY, stateToSave);
  }, [activeTab, period, dateFrom, dateTo, categoryFilter, seriesFilter, serviceTypeFilter, isInitialMount]);
  
  // Report data states
  const [summaryData, setSummaryData] = useState(null);
  const [categoryReport, setCategoryReport] = useState([]);
  const [categoryTotals, setCategoryTotals] = useState(null);
  const [productReport, setProductReport] = useState([]);
  const [productTotals, setProductTotals] = useState(null);
  const [seriesReport, setSeriesReport] = useState([]);
  const [seriesTotals, setSeriesTotals] = useState(null);
  const [chargingServicesReport, setChargingServicesReport] = useState(null);
  const [serviceRequestsReport, setServiceRequestsReport] = useState(null);
  
  // Supporting data
  const [products, setProducts] = useState([]);
  const [availableSeries, setAvailableSeries] = useState([]);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    loadReportData();
  }, [activeTab, period, dateFrom, dateTo, categoryFilter, seriesFilter, serviceTypeFilter]);

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
        serviceType: serviceTypeFilter !== 'all' ? serviceTypeFilter : undefined,
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

      switch (activeTab) {
        case 'summary':
          const summary = await getCustomerSummaryReport(filters);
          setSummaryData(summary);
          break;
        case 'category':
          const category = await getCustomerCategorySalesReport(filters);
          if (category && category.data) {
            setCategoryReport(category.data);
            setCategoryTotals(category.totals);
          } else {
            setCategoryReport(category || []);
            setCategoryTotals(null);
          }
          break;
        case 'product':
          const product = await getCustomerProductSalesReport(filters);
          if (product && product.data) {
            setProductReport(product.data);
            setProductTotals(product.totals);
          } else {
            setProductReport(product || []);
            setProductTotals(null);
          }
          break;
        case 'series':
          const series = await getCustomerSeriesSalesReport(filters);
          if (series && series.data) {
            setSeriesReport(series.data);
            setSeriesTotals(series.totals);
          } else {
            setSeriesReport(series || []);
            setSeriesTotals(null);
          }
          break;
        case 'charging':
          const charging = await getCustomerChargingServicesReport(filters);
          setChargingServicesReport(charging);
          break;
        case 'services':
          const services = await getCustomerServiceRequestsReport(filters);
          setServiceRequestsReport(services);
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

  // Calculate date range from period
  const getDateRangeFromPeriod = (periodType) => {
    const now = new Date();
    let startDate = new Date();
    let endDate = now;

    switch (periodType) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'last_3_months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case 'last_year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        break;
      default:
        return null;
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  };

  // Format time period for display
  const getTimePeriodDisplay = () => {
    if (dateFrom && dateTo) {
      return `Date Range: ${formatDate(dateFrom)} to ${formatDate(dateTo)}`;
    } else if (period && period !== 'all') {
      const periodLabels = {
        'today': 'Today',
        'this_month': 'This Month',
        'last_month': 'Last Month',
        'last_3_months': 'Last 3 Months',
        'last_year': 'Last Year'
      };
      
      const dateRange = getDateRangeFromPeriod(period);
      const periodLabel = periodLabels[period] || period.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      if (dateRange) {
        return `${periodLabel}: ${formatDate(dateRange.startDate)} to ${formatDate(dateRange.endDate)}`;
      }
      
      return `Period: ${periodLabel}`;
    }
    return 'All Time';
  };

  const categories = [
    { id: 'car-truck-tractor', name: 'Car/Truck/Tractor' },
    { id: 'bike', name: 'Bike' },
    { id: 'ups-inverter', name: 'UPS/Inverter' }
  ];

  const serviceTypes = [
    { id: 'all', name: 'All Services' },
    { id: 'battery_testing', name: 'Battery Testing Service' },
    { id: 'jump_start', name: 'Jump Start Service' },
    { id: 'inverter_repair', name: 'Inverter Repairing Service' },
    { id: 'inverter_battery', name: 'Inverter Battery Service' }
  ];

  const getServiceTypeName = (serviceType) => {
    const service = serviceTypes.find(s => s.id === serviceType);
    return service ? service.name : serviceType;
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      'pending': { bg: '#fef3c7', color: '#92400e', text: 'Pending' },
      'in_progress': { bg: '#dbeafe', color: '#1e40af', text: 'In Progress' },
      'completed': { bg: '#d1fae5', color: '#065f46', text: 'Completed' },
      'cancelled': { bg: '#fee2e2', color: '#991b1b', text: 'Cancelled' }
    };
    const style = statusColors[status] || statusColors['pending'];
    return (
      <span style={{
        padding: '0.25rem 0.75rem',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        fontWeight: '500',
        backgroundColor: style.bg,
        color: style.color
      }}>
        {style.text}
      </span>
    );
  };

  const tabs = [
    { id: 'summary', label: '📊 Summary', icon: '📊' },
    { id: 'category', label: '📦 Category-wise', icon: '📦' },
    { id: 'product', label: '🔧 Product-wise', icon: '🔧' },
    { id: 'series', label: '📋 Series-wise', icon: '📋' },
    { id: 'charging', label: '⚡ Charging Services', icon: '⚡' },
    { id: 'services', label: '🧰 Services', icon: '🧰' }
  ];

  // Format tabs for SearchableSelect
  const reportOptions = tabs.map(tab => ({
    value: tab.id,
    label: tab.label
  }));

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
      
      // Replace CSS variables with actual color values for print
      const allElements = contentClone.querySelectorAll('*');
      allElements.forEach(el => {
        // Replace CSS variables in style attribute
        if (el.getAttribute('style')) {
          let style = el.getAttribute('style');
          style = style.replace(/var\(--corp-primary\)/g, '#1e3a8a');
          style = style.replace(/var\(--corp-border\)/g, '#e2e8f0');
          el.setAttribute('style', style);
        }
        // Also replace in computed styles
        if (el.style.background && el.style.background.includes('var(--corp-primary)')) {
          el.style.background = '#1e3a8a';
        }
        if (el.style.backgroundColor && el.style.backgroundColor.includes('var(--corp-primary)')) {
          el.style.backgroundColor = '#1e3a8a';
        }
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
              table {
                width: 100%;
                border-collapse: collapse;
                page-break-inside: auto;
                margin-top: 20px;
              }
              th, td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
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
              /* Ensure totals row (blue summary row) shows in print */
              tr[style*="var(--corp-primary)"],
              tr[style*="background: var(--corp-primary)"],
              tr[style*="background-color: var(--corp-primary)"],
              .totals-summary-row,
              tr.totals-summary-row {
                background-color: #1e3a8a !important;
                color: white !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              /* Ensure all text in totals row is white */
              .totals-summary-row td,
              .totals-summary-row span,
              .totals-summary-row strong,
              .totals-summary-row div,
              tr.totals-summary-row td,
              tr.totals-summary-row span,
              tr.totals-summary-row strong,
              tr.totals-summary-row div {
                color: white !important;
                background-color: transparent !important;
              }
            </style>
          </head>
          <body>
            <div class="print-header">
              <h1>${reportTitle}</h1>
              <p>Generated on: ${dateStr}</p>
              ${(period !== 'all' || dateFrom || dateTo) ? `
                <p style="font-size: 12px; color: #666;">
                  ${period !== 'all' ? `Period: ${period.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}` : ''}
                  ${dateFrom && dateTo ? ` | Date Range: ${dateFrom} to ${dateTo}` : ''}
                </p>
              ` : ''}
            </div>
            ${content}
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
        serviceType: serviceTypeFilter !== 'all' ? serviceTypeFilter : null,
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
        generateReportPDF({
          title: reportTitle,
          columns: [
            { header: 'Category', field: 'category' },
            { header: 'Total Purchases (Invoices)', field: 'total_sales', render: (row) => `${row.total_sales} invoice${row.total_sales !== 1 ? 's' : ''}` },
            { header: 'Total Quantity (Items)', field: 'total_quantity', render: (row) => `${row.total_quantity} item${row.total_quantity !== 1 ? 's' : ''}` },
            { header: 'Total Spent', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
            { header: 'Total MRP', field: 'total_mrp', render: (row) => formatCurrency(row.total_mrp) },
            { header: 'Total Discount', field: 'total_discount', render: (row) => formatCurrency(row.total_discount) },
            { header: 'Avg Purchase Amount', field: 'avg_sale_amount', render: (row) => formatCurrency(row.avg_sale_amount) }
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
            { header: 'Total Purchases (Invoices)', field: 'total_sales', render: (row) => `${row.total_sales} invoice${row.total_sales !== 1 ? 's' : ''}` },
            { header: 'Total Quantity (Items)', field: 'total_quantity', render: (row) => `${row.total_quantity} item${row.total_quantity !== 1 ? 's' : ''}` },
            { header: 'Total Spent', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
            { header: 'Avg Purchase Amount', field: 'avg_sale_amount', render: (row) => formatCurrency(row.avg_sale_amount) }
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
            { header: 'Total Purchases (Invoices)', field: 'total_sales', render: (row) => `${row.total_sales} invoice${row.total_sales !== 1 ? 's' : ''}` },
            { header: 'Unique Products', field: 'unique_products' },
            { header: 'Total Quantity (Items)', field: 'total_quantity', render: (row) => `${row.total_quantity} item${row.total_quantity !== 1 ? 's' : ''}` },
            { header: 'Total Spent', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
            { header: 'Avg Purchase Amount', field: 'avg_sale_amount', render: (row) => formatCurrency(row.avg_sale_amount) }
          ],
          data: seriesReport,
          totals: seriesTotals,
          filters,
          filename
        });
        break;
      
      case 'charging':
        generateChargingServicesReportPDF({
          chargingReport: chargingServicesReport,
          filters,
          filename
        });
        break;
      
      case 'services':
        if (serviceRequestsReport && serviceRequestsReport.summary) {
          generateReportPDF({
            title: `${reportTitle} - Summary`,
            columns: [
              { header: 'Service Type', field: 'service_type', render: (row) => getServiceTypeName(row.service_type) },
              { header: 'Total Requests', field: 'total_requests' },
              { header: 'Completed', field: 'completed_requests' },
              { header: 'Pending', field: 'pending_requests' },
              { header: 'In Progress', field: 'in_progress_requests' },
              { header: 'Cancelled', field: 'cancelled_requests' },
              { header: 'First Request', field: 'first_request_date', render: (row) => formatDate(row.first_request_date) },
              { header: 'Last Request', field: 'last_request_date', render: (row) => formatDate(row.last_request_date) }
            ],
            data: serviceRequestsReport.summary,
            totals: null,
            filters,
            filename: `service-summary-${new Date().toISOString().split('T')[0]}.pdf`
          });
        }
        if (serviceRequestsReport && serviceRequestsReport.details) {
          generateReportPDF({
            title: `${reportTitle} - Details`,
            columns: [
              { header: 'Service Type', field: 'service_type', render: (row) => getServiceTypeName(row.service_type) },
              { header: 'Status', field: 'status', render: (row) => row.status },
              { header: 'Vehicle Name', field: 'vehicle_name', render: (row) => row.vehicle_name || '-' },
              { header: 'Vehicle Number', field: 'vehicle_number', render: (row) => row.vehicle_number || '-' },
              { header: 'Request Date', field: 'created_at', render: (row) => formatDate(row.created_at) }
            ],
            data: serviceRequestsReport.details,
            totals: null,
            filters,
            filename: `service-details-${new Date().toISOString().split('T')[0]}.pdf`
          });
        }
        break;
      
      default:
        break;
    }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('An error occurred while generating PDF. Please try again.');
    }
  };

  const renderSummary = () => {
    if (!summaryData) return <div>No data available</div>;

    return (
      <div className="reports-summary">
        <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="summary-card" style={{ background: 'var(--corp-bg-card)', padding: '1.5rem', borderRadius: 'var(--corp-radius)', boxShadow: 'var(--corp-shadow)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--corp-text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Purchases</h3>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--corp-text-primary)' }}>
              {summaryData.sales?.total_sales || 0}
            </div>
            <div style={{ marginTop: '0.5rem', color: 'var(--corp-text-muted)', fontSize: '0.875rem' }}>
              {summaryData.sales?.total_invoices || 0} invoices
            </div>
          </div>

          <div className="summary-card" style={{ background: 'var(--corp-bg-card)', padding: '1.5rem', borderRadius: 'var(--corp-radius)', boxShadow: 'var(--corp-shadow)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--corp-text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Spent</h3>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--corp-primary)' }}>
              {formatCurrency(summaryData.sales?.total_revenue || 0)}
            </div>
            <div style={{ marginTop: '0.5rem', color: 'var(--corp-text-muted)', fontSize: '0.875rem' }}>
              {summaryData.sales?.total_quantity_sold || 0} items purchased
            </div>
          </div>

          <div className="summary-card" style={{ background: 'var(--corp-bg-card)', padding: '1.5rem', borderRadius: 'var(--corp-radius)', boxShadow: 'var(--corp-shadow)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--corp-text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Charging Services</h3>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--corp-accent)' }}>
              {summaryData.charging?.total_services || 0}
            </div>
            <div style={{ marginTop: '0.5rem', color: 'var(--corp-text-muted)', fontSize: '0.875rem' }}>
              {formatCurrency(summaryData.charging?.total_revenue || 0)} spent
            </div>
          </div>

          <div className="summary-card" style={{ background: 'var(--corp-bg-card)', padding: '1.5rem', borderRadius: 'var(--corp-radius)', boxShadow: 'var(--corp-shadow)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--corp-text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Discount</h3>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--corp-success)' }}>
              {formatCurrency(summaryData.sales?.total_discount || 0)}
            </div>
            <div style={{ marginTop: '0.5rem', color: 'var(--corp-text-muted)', fontSize: '0.875rem' }}>
              Total savings
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--corp-bg-card)', padding: '1.5rem', borderRadius: 'var(--corp-radius)', boxShadow: 'var(--corp-shadow)' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--corp-text-primary)' }}>Additional Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <strong>Total MRP:</strong> {formatCurrency(summaryData.sales?.total_mrp || 0)}
            </div>
            <div>
              <strong>Total Tax:</strong> {formatCurrency(summaryData.sales?.total_tax || 0)}
            </div>
            <div>
              <strong>Items Purchased:</strong> {summaryData.sales?.total_quantity_sold || 0}
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
              <tr key="totals-row" className="totals-summary-row" style={{ background: 'var(--corp-primary)', color: 'white', borderTop: '3px solid var(--corp-border)', fontWeight: 'bold' }}>
                <td colSpan={columns.length} style={{ padding: '1.25rem', fontSize: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
                    <strong style={{ fontSize: '1.1rem' }}>TOTAL SUMMARY</strong>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                      {totals.total_quantity !== undefined && totals.total_quantity !== 0 && (
                        <span><strong>Total Quantity:</strong> {totals.total_quantity}</span>
                      )}
                      {(totals.total_revenue !== undefined || totals.total_sales_amount !== undefined) && (
                        <span><strong>Total Revenue:</strong> {formatCurrency(totals.total_revenue || totals.total_sales_amount || 0)}</span>
                      )}
                      {totals.total_commission_paid !== undefined && (
                        <span><strong>Total Commission:</strong> {formatCurrency(totals.total_commission_paid)}</span>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // Render time period display component
  const renderTimePeriod = () => {
    return (
      <div style={{ 
        marginBottom: '1.5rem', 
        padding: '0.75rem 1rem', 
        background: 'var(--corp-bg-tertiary)', 
        borderRadius: 'var(--corp-radius-sm)',
        borderLeft: '4px solid var(--corp-primary)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <span style={{ fontSize: '1rem', color: 'var(--corp-text-secondary)' }}>📅</span>
        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--corp-text-primary)' }}>
          {getTimePeriodDisplay()}
        </span>
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
        return (
          <div>
            {renderTimePeriod()}
            {renderSummary()}
          </div>
        );
      
      case 'category':
        return (
          <div>
            {renderTimePeriod()}
            {renderTable([
              { header: 'Category', field: 'category' },
              { header: 'Total Purchases (Invoices)', field: 'total_sales', render: (row) => `${row.total_sales} invoice${row.total_sales !== 1 ? 's' : ''}` },
              { header: 'Total Quantity (Items)', field: 'total_quantity', render: (row) => `${row.total_quantity} item${row.total_quantity !== 1 ? 's' : ''}` },
              { header: 'Total Spent', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
              { header: 'Total MRP', field: 'total_mrp', render: (row) => formatCurrency(row.total_mrp) },
              { header: 'Total Discount', field: 'total_discount', render: (row) => formatCurrency(row.total_discount) },
              { header: 'Avg Purchase Amount', field: 'avg_sale_amount', render: (row) => formatCurrency(row.avg_sale_amount) }
            ], categoryReport, (item, index) => `category-${item.category}-${index}`, categoryTotals)}
          </div>
        );
      
      case 'product':
        return (
          <div>
            {renderTimePeriod()}
            {renderTable([
              { header: 'Product Name', field: 'name' },
              { header: 'SKU', field: 'sku' },
              { header: 'Category', field: 'category' },
              { header: 'Series', field: 'series' },
              { header: 'Total Purchases (Invoices)', field: 'total_sales', render: (row) => `${row.total_sales} invoice${row.total_sales !== 1 ? 's' : ''}` },
              { header: 'Total Quantity (Items)', field: 'total_quantity', render: (row) => `${row.total_quantity} item${row.total_quantity !== 1 ? 's' : ''}` },
              { header: 'Total Spent', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
              { header: 'Avg Purchase Amount', field: 'avg_sale_amount', render: (row) => formatCurrency(row.avg_sale_amount) }
            ], productReport, (item) => `${item.name}-${item.sku}`, productTotals)}
          </div>
        );
      
      case 'series':
        return (
          <div>
            {renderTimePeriod()}
            {renderTable([
              { header: 'Series', field: 'series' },
              { header: 'Category', field: 'category' },
              { header: 'Total Purchases (Invoices)', field: 'total_sales', render: (row) => `${row.total_sales} invoice${row.total_sales !== 1 ? 's' : ''}` },
              { header: 'Unique Products', field: 'unique_products' },
              { header: 'Total Quantity (Items)', field: 'total_quantity', render: (row) => `${row.total_quantity} item${row.total_quantity !== 1 ? 's' : ''}` },
              { header: 'Total Spent', field: 'total_revenue', render: (row) => formatCurrency(row.total_revenue) },
              { header: 'Avg Purchase Amount', field: 'avg_sale_amount', render: (row) => formatCurrency(row.avg_sale_amount) }
            ], seriesReport, (item, index) => `series-${item.series}-${item.category}-${index}`, seriesTotals)}
          </div>
        );
      
      case 'charging':
        if (!chargingServicesReport) return <div>No data available</div>;
        
        return (
          <div>
            {renderTimePeriod()}
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
                  <strong>Total Spent:</strong> {formatCurrency(chargingServicesReport.total_revenue || 0)}
                </div>
                <div>
                  <strong>Avg Service Price:</strong> {formatCurrency(chargingServicesReport.avg_service_price || 0)}
                </div>
                {chargingServicesReport.first_service_date && (
                  <div>
                    <strong>First Service:</strong> {formatDate(chargingServicesReport.first_service_date)}
                  </div>
                )}
                {chargingServicesReport.last_service_date && (
                  <div>
                    <strong>Last Service:</strong> {formatDate(chargingServicesReport.last_service_date)}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      
      case 'services':
        if (!serviceRequestsReport) return <div>No data available</div>;
        
        return (
          <div>
            {renderTimePeriod()}
            {/* Summary by Service Type */}
            {serviceRequestsReport.summary && serviceRequestsReport.summary.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Service Summary by Type</h3>
                {renderTable([
                  { header: 'Service Type', field: 'service_type', render: (row) => getServiceTypeName(row.service_type) },
                  { header: 'Total Requests', field: 'total_requests' },
                  { header: 'Completed', field: 'completed_requests' },
                  { header: 'Pending', field: 'pending_requests' },
                  { header: 'In Progress', field: 'in_progress_requests' },
                  { header: 'Cancelled', field: 'cancelled_requests' },
                  { header: 'First Request', field: 'first_request_date', render: (row) => formatDate(row.first_request_date) },
                  { header: 'Last Request', field: 'last_request_date', render: (row) => formatDate(row.last_request_date) }
                ], serviceRequestsReport.summary, (item) => item.service_type)}
              </div>
            )}

            {/* Detailed Service Requests */}
            {serviceRequestsReport.details && serviceRequestsReport.details.length > 0 && (
              <div>
                <h3 style={{ marginBottom: '1rem' }}>Service Request Details</h3>
                {renderTable([
                  { header: 'Service Type', field: 'service_type', render: (row) => getServiceTypeName(row.service_type) },
                  { header: 'Status', field: 'status', render: (row) => getStatusBadge(row.status) },
                  { header: 'Vehicle Name', field: 'vehicle_name', render: (row) => row.vehicle_name || '-' },
                  { header: 'Fuel Type', field: 'fuel_type', render: (row) => row.fuel_type ? row.fuel_type.charAt(0).toUpperCase() + row.fuel_type.slice(1) : '-' },
                  { header: 'Vehicle Number', field: 'vehicle_number', render: (row) => row.vehicle_number || '-' },
                  { header: 'Inverter VA', field: 'inverter_va', render: (row) => row.inverter_va || '-' },
                  { header: 'Inverter Voltage', field: 'inverter_voltage', render: (row) => row.inverter_voltage || '-' },
                  { header: 'Battery Ampere', field: 'battery_ampere_rating', render: (row) => row.battery_ampere_rating || '-' },
                  { header: 'Notes', field: 'notes', render: (row) => row.notes || '-' },
                  { header: 'Request Date', field: 'created_at', render: (row) => formatDate(row.created_at) },
                  { header: 'Last Updated', field: 'updated_at', render: (row) => formatDate(row.updated_at) }
                ], serviceRequestsReport.details, (item) => item.id)}
              </div>
            )}

            {(!serviceRequestsReport.summary || serviceRequestsReport.summary.length === 0) && 
             (!serviceRequestsReport.details || serviceRequestsReport.details.length === 0) && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--corp-text-muted)' }}>
                No service requests found for the selected period
              </div>
            )}
          </div>
        );
      
      default:
        return <div>Select a report type</div>;
    }
  };

  return (
    <div className="dashboard-content">
      <div className="dashboard-header">
        <h2>My Reports</h2>
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

          <div className="reports-date-fields-container">
            <div className="reports-date-field-wrapper">
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--corp-text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>Date From</label>
              <div className="reports-date-input-container">
                <svg className="reports-date-calendar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="reports-date-input"
                  style={{ width: '100%', padding: '0.5rem', paddingLeft: '2.5rem', border: '1px solid var(--corp-border)', borderRadius: 'var(--corp-radius-sm)', background: 'var(--corp-bg-primary)', color: 'var(--corp-text-primary)' }}
                />
              </div>
            </div>

            <div className="reports-date-field-wrapper">
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--corp-text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>Date To</label>
              <div className="reports-date-input-container">
                <svg className="reports-date-calendar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="reports-date-input"
                  style={{ width: '100%', padding: '0.5rem', paddingLeft: '2.5rem', border: '1px solid var(--corp-border)', borderRadius: 'var(--corp-radius-sm)', background: 'var(--corp-bg-primary)', color: 'var(--corp-text-primary)' }}
                />
              </div>
            </div>
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

          {(activeTab === 'services') && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--corp-text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>Service Type</label>
              <select
                value={serviceTypeFilter}
                onChange={(e) => setServiceTypeFilter(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--corp-border)', borderRadius: 'var(--corp-radius-sm)', background: 'var(--corp-bg-primary)', color: 'var(--corp-text-primary)' }}
              >
                {serviceTypes.map(service => (
                  <option key={service.id} value={service.id}>{service.name}</option>
                ))}
              </select>
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
            setServiceTypeFilter('all');
          }}
          style={{ padding: '0.5rem 1rem', background: 'var(--corp-bg-tertiary)', border: '1px solid var(--corp-border)', borderRadius: 'var(--corp-radius-sm)', color: 'var(--corp-text-primary)', cursor: 'pointer' }}
        >
          Clear Filters
        </button>
      </div>

      {/* Report Type Selector - Searchable Dropdown */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--corp-text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>
          Select Report Type
        </label>
        <div style={{ maxWidth: '400px' }}>
          <SearchableSelect
            value={activeTab}
            onChange={(value) => setActiveTab(value)}
            options={reportOptions}
            placeholder="Select a report type..."
            displayKey="label"
            valueKey="value"
            searchKeys={['label']}
            style={{ position: 'relative' }}
          />
        </div>
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

export default CustomerReports;


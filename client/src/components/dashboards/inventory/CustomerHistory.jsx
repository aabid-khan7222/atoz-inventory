import React, { useState, useEffect, useRef } from 'react';
import api from '../../../api';
import SearchableDropdown from '../../common/SearchableDropdown';
import { generateCustomerHistoryPDF } from '../../../utils/reportPdf';
import './InventorySection.css';
import '../InventoryManagement.css';

const CustomerHistory = ({ onBack }) => {
  // Load saved state from sessionStorage
  const getSavedState = () => {
    try {
      const saved = sessionStorage.getItem('customerHistoryState');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load saved CustomerHistory state:', e);
    }
    return null;
  };
  
  const savedState = getSavedState();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(() => savedState?.selectedCustomerId ? { id: savedState.selectedCustomerId } : null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');
  const printRef = useRef(null);
  
  // Filter states
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(() => savedState?.selectedProductId ? { id: savedState.selectedProductId } : null);
  const [selectedSeries, setSelectedSeries] = useState(() => savedState?.selectedSeries || null);
  const [fromDate, setFromDate] = useState(() => savedState?.fromDate || '');
  const [toDate, setToDate] = useState(() => savedState?.toDate || '');
  
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Save state to sessionStorage
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    
    const stateToSave = {
      selectedCustomerId: selectedCustomer?.id || null,
      selectedProductId: selectedProduct?.id || null,
      selectedSeries,
      fromDate,
      toDate
    };
    sessionStorage.setItem('customerHistoryState', JSON.stringify(stateToSave));
  }, [selectedCustomer, selectedProduct, selectedSeries, fromDate, toDate, isInitialMount]);

  // Restore selected customer and product when data loads
  useEffect(() => {
    if (savedState?.selectedCustomerId && customers.length > 0 && !selectedCustomer) {
      const restoredCustomer = customers.find(c => c.id === savedState.selectedCustomerId);
      if (restoredCustomer) {
        setSelectedCustomer(restoredCustomer);
      }
    }
  }, [customers, savedState, selectedCustomer]);
  
  useEffect(() => {
    if (savedState?.selectedProductId && products.length > 0 && !selectedProduct) {
      const restoredProduct = products.find(p => p.id === savedState.selectedProductId);
      if (restoredProduct) {
        setSelectedProduct(restoredProduct);
      }
    }
  }, [products, savedState, selectedProduct]);

  useEffect(() => {
    fetchCustomers();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerHistory(selectedCustomer.value);
    } else {
      setHistory(null);
    }
  }, [selectedCustomer]);

  const fetchCustomers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getCustomers({ limit: 1000 });
      const customerOptions = response.items.map(customer => ({
        value: customer.id,
        label: customer.name || 'Unknown Customer',
        subLabel: `${customer.phone || 'No phone'}${customer.email && !customer.email.includes('@customer.local') ? ` • ${customer.email}` : ''}`
      }));
      setCustomers(customerOptions);
    } catch (err) {
      setError(err.message || 'Failed to load customers');
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const productsList = await api.fetchProducts();
      if (productsList && Array.isArray(productsList)) {
        const productOptions = productsList.map(product => ({
          value: product.id,
          label: product.name || product.sku || 'Unknown Product',
          subLabel: product.series ? `Series: ${product.series}` : ''
        }));
        setProducts(productOptions);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  };

  const fetchCustomerHistory = async (customerId) => {
    setLoadingHistory(true);
    setError('');
    try {
      const data = await api.getCustomerHistory(customerId);
      setHistory(data);
    } catch (err) {
      setError(err.message || 'Failed to load customer history');
      console.error('Failed to fetch customer history:', err);
      setHistory(null);
    } finally {
      setLoadingHistory(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'N/A';
    return `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Get unique series from history
  const getUniqueSeries = () => {
    if (!history) return [];
    const seriesSet = new Set();
    
    // From sales
    history.sales.forEach(sale => {
      if (sale.series_list && Array.isArray(sale.series_list)) {
        sale.series_list.forEach(series => {
          if (series) seriesSet.add(series);
        });
      }
    });
    
    // From replacements (product_name might contain series info)
    history.replacements.forEach(replacement => {
      if (replacement.product_name) {
        // Try to extract series from product name if available
        const match = replacement.product_name.match(/([A-Z0-9]+)/);
        if (match) seriesSet.add(match[1]);
      }
    });
    
    return Array.from(seriesSet).sort().map(series => ({
      value: series,
      label: series
    }));
  };

  // Filter functions
  const matchesDateFilter = (dateString) => {
    if (!fromDate && !toDate) return true;
    if (!dateString) return false;
    
    const date = new Date(dateString);
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate + 'T23:59:59') : null;
    
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  };

  const matchesProductFilter = (sale) => {
    if (!selectedProduct) return true;
    if (!sale.product_ids || !Array.isArray(sale.product_ids) || sale.product_ids.length === 0) return false;
    return sale.product_ids.includes(selectedProduct.value);
  };

  const matchesSeriesFilter = (sale) => {
    if (!selectedSeries) return true;
    if (!sale.series_list || !Array.isArray(sale.series_list) || sale.series_list.length === 0) return false;
    return sale.series_list.includes(selectedSeries.value);
  };

  const matchesReplacementProductFilter = (replacement) => {
    if (!selectedProduct) return true;
    // For replacements, we'd need product_id in the replacement data
    // For now, check if product_name matches
    if (selectedProduct.label && replacement.product_name) {
      return replacement.product_name.toLowerCase().includes(selectedProduct.label.toLowerCase());
    }
    return true;
  };

  const matchesReplacementSeriesFilter = (replacement) => {
    if (!selectedSeries) return true;
    if (replacement.product_name) {
      return replacement.product_name.includes(selectedSeries.value);
    }
    return true;
  };

  // Get filtered data
  const getFilteredSales = () => {
    if (!history || !history.sales) return [];
    return history.sales.filter(sale => {
      if (!matchesDateFilter(sale.purchase_date)) return false;
      if (!matchesProductFilter(sale)) return false;
      if (!matchesSeriesFilter(sale)) return false;
      return true;
    });
  };

  const getFilteredReplacements = () => {
    if (!history || !history.replacements) return [];
    return history.replacements.filter(replacement => {
      if (!matchesDateFilter(replacement.replacement_date)) return false;
      if (!matchesReplacementProductFilter(replacement)) return false;
      if (!matchesReplacementSeriesFilter(replacement)) return false;
      return true;
    });
  };

  const getFilteredChargingServices = () => {
    if (!history || !history.chargingServices) return [];
    return history.chargingServices.filter(service => {
      return matchesDateFilter(service.created_at);
    });
  };

  const getFilteredServiceRequests = () => {
    if (!history || !history.serviceRequests) return [];
    return history.serviceRequests.filter(request => {
      return matchesDateFilter(request.created_at);
    });
  };

  // Reset filters
  const resetFilters = () => {
    setSelectedProduct(null);
    setSelectedSeries(null);
    setFromDate('');
    setToDate('');
  };

  // Print functionality
  const handlePrintClick = () => {
    try {
      if (!printRef.current) {
        alert('Unable to print: History content not found');
        return;
      }

      // Clone the content
      const contentClone = printRef.current.cloneNode(true);
      const printOnlyElements = contentClone.querySelectorAll('.print-only');
      printOnlyElements.forEach(el => el.remove());

      // Get the content to print
      const contentHTML = contentClone.innerHTML;

      // Create a hidden iframe for printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

      // Build the print HTML
      const printHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Customer History</title>
            <style>
              @media print {
                @page {
                  margin: 1cm;
                }
                body {
                  margin: 0;
                  padding: 0;
                }
                .no-print {
                  display: none !important;
                }
                * {
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
              }
              body {
                font-family: Arial, sans-serif;
                font-size: 12px;
                color: #000;
                background: #fff;
                margin: 0;
                padding: 20px;
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
                margin: 10px 0;
              }
              th, td {
                border: 1px solid #000;
                padding: 8px;
                text-align: left;
              }
              th {
                background-color: #f0f0f0;
                font-weight: bold;
              }
              .history-section {
                margin-bottom: 30px;
                page-break-inside: avoid;
              }
              .history-section-title {
                font-size: 16px;
                font-weight: bold;
                margin: 20px 0 10px 0;
                border-bottom: 1px solid #000;
                padding-bottom: 5px;
              }
              .no-print {
                display: none;
              }
            </style>
          </head>
          <body>
            <div class="print-header">
              <h1>Customer History Report</h1>
              <p>Generated on: ${new Date().toLocaleString('en-IN')}</p>
              ${selectedCustomer ? `<p>Customer: ${selectedCustomer.label}</p>` : ''}
            </div>
            ${contentHTML}
          </body>
        </html>
      `;

      iframeDoc.open();
      iframeDoc.write(printHTML);
      iframeDoc.close();

      // Wait for content to load, then print
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow.print();
          // Remove iframe after printing
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        }, 250);
      };
    } catch (error) {
      console.error('Error printing customer history:', error);
      alert('An error occurred while printing. Please try again.');
    }
  };

  // PDF Download functionality
  const handleDownloadPDF = () => {
    try {
      if (!history) {
        alert('No customer history data available to generate PDF. Please select a customer first.');
        return;
      }

      const filters = {
        fromDate: fromDate || null,
        toDate: toDate || null,
        product: selectedProduct ? selectedProduct.label : null,
        series: selectedSeries ? selectedSeries.label : null
      };

      const customerName = selectedCustomer ? selectedCustomer.label.replace(/[^a-zA-Z0-9]/g, '-') : 'customer';
      const filename = `customer-history-${customerName}-${new Date().toISOString().split('T')[0]}.pdf`;

      // Create filtered history for PDF
      const filteredHistory = {
        customer: history.customer,
        sales: getFilteredSales(),
        replacements: getFilteredReplacements(),
        chargingServices: getFilteredChargingServices(),
        serviceRequests: getFilteredServiceRequests()
      };

      generateCustomerHistoryPDF({
        customerHistory: filteredHistory,
        filters: filters,
        filename: filename
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('An error occurred while generating PDF. Please try again.');
    }
  };

  return (
    <div className="inventory-section-container">
      <div className="inventory-section-header">
        <h2>Customer History</h2>
        <p className="section-description">View complete history for any customer</p>
      </div>

      {error && (
        <div className="inventory-error">
          {error}
        </div>
      )}

      <div className="customer-history-controls">
        <div className="customer-selector">
          <SearchableDropdown
            label="Select Customer"
            options={customers}
            value={selectedCustomer?.value || null}
            onChange={(option) => {
              setSelectedCustomer(option);
              resetFilters();
            }}
            placeholder="Search and select a customer..."
            searchPlaceholder="Search by name, phone, or email..."
            noOptionsText="No customers found"
            disabled={loading}
          />
        </div>

        {history && !loadingHistory && (
          <div className="customer-history-filters">
            <div className="filter-row">
              <div className="filter-group">
                <label htmlFor="from-date">From Date</label>
                <input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="filter-input"
                />
              </div>
              <div className="filter-group">
                <label htmlFor="to-date">To Date</label>
                <input
                  id="to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="filter-input"
                />
              </div>
              <div className="filter-group">
                <SearchableDropdown
                  label="Product"
                  options={[{ value: null, label: 'All Products' }, ...products]}
                  value={selectedProduct?.value || null}
                  onChange={(option) => setSelectedProduct(option && option.value !== null ? option : null)}
                  placeholder="All Products"
                  searchPlaceholder="Search products..."
                  noOptionsText="No products found"
                />
              </div>
              <div className="filter-group">
                <SearchableDropdown
                  label="Series"
                  options={[{ value: null, label: 'All Series' }, ...getUniqueSeries()]}
                  value={selectedSeries?.value || null}
                  onChange={(option) => setSelectedSeries(option && option.value !== null ? option : null)}
                  placeholder="All Series"
                  searchPlaceholder="Search series..."
                  noOptionsText="No series found"
                />
              </div>
              {(fromDate || toDate || selectedProduct || selectedSeries) && (
                <div className="filter-group">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="filter-reset-btn"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {loadingHistory && (
        <div className="loading-message">Loading customer history...</div>
      )}

      {/* Print and PDF Download Buttons */}
      {history && !loadingHistory && (
        <div className="no-print" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={handlePrintClick}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--corp-primary, #3b82f6)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
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
            🖨️ Print History
          </button>
          <button
            onClick={handleDownloadPDF}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--corp-danger, #ef4444)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
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
      )}

      {history && !loadingHistory && (
        <div ref={printRef} className="customer-history-content">
          {/* Print Header */}
          <div style={{ display: 'none' }} className="print-only">
            <div style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px solid #000', paddingBottom: '1rem' }}>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>Customer History Report</h1>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '14px', color: '#666' }}>
                Generated on: {new Date().toLocaleString('en-IN')}
              </p>
              {selectedCustomer && (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '14px', fontWeight: '600' }}>
                  Customer: {selectedCustomer.label}
                </p>
              )}
              {(fromDate || toDate || selectedProduct || selectedSeries) && (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '12px', color: '#666' }}>
                  Filters: {[
                    fromDate && toDate ? `Date: ${fromDate} to ${toDate}` : fromDate ? `From: ${fromDate}` : toDate ? `To: ${toDate}` : null,
                    selectedProduct ? `Product: ${selectedProduct.label}` : null,
                    selectedSeries ? `Series: ${selectedSeries.label}` : null
                  ].filter(Boolean).join(' | ')}
                </p>
              )}
            </div>
          </div>

          {/* Customer Info */}
          <div className="history-section">
            <h3 className="history-section-title">Customer Information</h3>
            <div className="customer-info-grid">
              <div className="info-item">
                <span className="info-label">Name:</span>
                <span className="info-value">{history.customer.full_name || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Phone:</span>
                <span className="info-value">{history.customer.phone || 'N/A'}</span>
              </div>
              {history.customer.email && !history.customer.email.includes('@customer.local') && (
                <div className="info-item">
                  <span className="info-label">Email:</span>
                  <span className="info-value">{history.customer.email}</span>
                </div>
              )}
              {history.customer.company_name && (
                <div className="info-item">
                  <span className="info-label">Company:</span>
                  <span className="info-value">{history.customer.company_name}</span>
                </div>
              )}
              {history.customer.gst_number && (
                <div className="info-item">
                  <span className="info-label">GST Number:</span>
                  <span className="info-value">{history.customer.gst_number}</span>
                </div>
              )}
              {history.customer.address && (
                <div className="info-item full-width">
                  <span className="info-label">Address:</span>
                  <span className="info-value">
                    {[history.customer.address, history.customer.city, history.customer.state, history.customer.pincode]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Sales/Purchases */}
          <div className="history-section">
            <h3 className="history-section-title">
              Purchase History ({getFilteredSales().length} of {history.sales.length})
            </h3>
            {getFilteredSales().length === 0 ? (
              <p className="no-data">No purchases found{history.sales.length > 0 ? ' matching filters' : ''}</p>
            ) : (
              <div className="history-table-container">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Invoice Number</th>
                      <th>Date</th>
                      <th>Sales Type</th>
                      <th>Items</th>
                      <th>Total Amount</th>
                      <th>Vehicle Number</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredSales().map((sale, idx) => (
                      <tr key={idx}>
                        <td>
                          <a
                            href={`/invoice/${sale.invoice_number}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="invoice-link"
                          >
                            {sale.invoice_number}
                          </a>
                        </td>
                        <td>{formatDate(sale.purchase_date)}</td>
                        <td>
                          <span className={`badge ${sale.sales_type === 'wholesale' ? 'badge-wholesale' : 'badge-retail'}`}>
                            {sale.sales_type || 'retail'}
                          </span>
                        </td>
                        <td>{sale.item_count || 0} item(s)</td>
                        <td className="amount-cell">{formatCurrency(sale.total_amount)}</td>
                        <td>{sale.customer_vehicle_number || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Warranty/Guarantee Replacements */}
          <div className="history-section">
            <h3 className="history-section-title">
              Warranty & Guarantee Services ({getFilteredReplacements().length} of {history.replacements.length})
            </h3>
            {getFilteredReplacements().length === 0 ? (
              <p className="no-data">No warranty/guarantee services found{history.replacements.length > 0 ? ' matching filters' : ''}</p>
            ) : (
              <div className="history-table-container">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Original Serial</th>
                      <th>New Serial</th>
                      <th>Product</th>
                      <th>Discount</th>
                      <th>Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredReplacements().map((replacement) => (
                      <tr key={replacement.id}>
                        <td>{formatDate(replacement.replacement_date)}</td>
                        <td>
                          <span className={`badge ${replacement.replacement_type === 'guarantee' ? 'badge-guarantee' : 'badge-warranty'}`}>
                            {replacement.replacement_type || 'N/A'}
                          </span>
                        </td>
                        <td>{replacement.original_serial_number || 'N/A'}</td>
                        <td>{replacement.new_serial_number || 'N/A'}</td>
                        <td>{replacement.product_name || replacement.product_sku || 'N/A'}</td>
                        <td>
                          {replacement.discount_percentage > 0
                            ? `${replacement.discount_percentage}%`
                            : replacement.replacement_type === 'guarantee'
                            ? 'Free'
                            : 'N/A'}
                        </td>
                        <td>
                          {replacement.new_invoice_number ? (
                            <a
                              href={`/invoice/${replacement.new_invoice_number}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="invoice-link"
                            >
                              {replacement.new_invoice_number}
                            </a>
                          ) : (
                            'N/A'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Charging Services */}
          <div className="history-section">
            <h3 className="history-section-title">
              Charging Services ({getFilteredChargingServices().length} of {history.chargingServices.length})
            </h3>
            {getFilteredChargingServices().length === 0 ? (
              <p className="no-data">No charging services found{history.chargingServices.length > 0 ? ' matching filters' : ''}</p>
            ) : (
              <div className="history-table-container">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Battery Serial</th>
                      <th>Vehicle Number</th>
                      <th>Status</th>
                      <th>Price</th>
                      <th>Expected Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredChargingServices().map((service) => (
                      <tr key={service.id}>
                        <td>{formatDate(service.created_at)}</td>
                        <td>{service.battery_serial_number || 'N/A'}</td>
                        <td>{service.vehicle_number || 'N/A'}</td>
                        <td>
                          <span className={`badge badge-${service.status || 'pending'}`}>
                            {service.status || 'pending'}
                          </span>
                        </td>
                        <td className="amount-cell">{formatCurrency(service.service_price)}</td>
                        <td>{formatDate(service.expected_completion_time)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Service Requests */}
          {history.serviceRequests && history.serviceRequests.length > 0 && (
            <div className="history-section">
              <h3 className="history-section-title">
                Service Requests ({getFilteredServiceRequests().length} of {history.serviceRequests.length})
              </h3>
              {getFilteredServiceRequests().length === 0 ? (
                <p className="no-data">No service requests found matching filters</p>
              ) : (
                <div className="history-table-container">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Service Type</th>
                        <th>Vehicle/Details</th>
                        <th>Notes</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredServiceRequests().map((request) => (
                      <tr key={request.id}>
                        <td>{formatDate(request.created_at)}</td>
                        <td>{request.service_type || 'N/A'}</td>
                        <td>
                          {request.vehicle_name && request.vehicle_number
                            ? `${request.vehicle_name} (${request.vehicle_number})`
                            : request.inverter_va && request.inverter_voltage
                            ? `Inverter ${request.inverter_va}VA ${request.inverter_voltage}V`
                            : request.battery_ampere_rating
                            ? `Battery ${request.battery_ampere_rating}Ah`
                            : 'N/A'}
                        </td>
                        <td>{request.notes || 'N/A'}</td>
                        <td>
                          <span className={`badge badge-${request.status || 'pending'}`}>
                            {request.status || 'pending'}
                          </span>
                        </td>
                      </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!selectedCustomer && !loadingHistory && (
        <div className="empty-state">
          <p>Select a customer from the dropdown above to view their complete history</p>
        </div>
      )}
    </div>
  );
};

export default CustomerHistory;


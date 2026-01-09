import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_BASE } from '../../../api';
import Swal from 'sweetalert2';
import { getFormState, saveFormState } from '../../../utils/formStateManager';
import './InventorySection.css';

const STORAGE_KEY = 'soldBatteriesState';

const SoldBatteries = ({ onBack }) => {
  const navigate = useNavigate();
  
  // Load saved state using utility (automatically handles refresh detection)
  const savedState = getFormState(STORAGE_KEY);
  const [selectedCategory, setSelectedCategory] = useState(() => savedState?.selectedCategory || 'all');
  const [soldBatteries, setSoldBatteries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState(() => savedState?.searchTerm || '');
  const [dateFrom, setDateFrom] = useState(() => savedState?.dateFrom || '');
  const [dateTo, setDateTo] = useState(() => savedState?.dateTo || '');
  const [sortConfig, setSortConfig] = useState(() => savedState?.sortConfig || { field: 'date', direction: 'desc' });
  
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Save state to sessionStorage
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    
    const stateToSave = {
      selectedCategory,
      searchTerm,
      dateFrom,
      dateTo,
      sortConfig
    };
    saveFormState(STORAGE_KEY, stateToSave);
  }, [selectedCategory, searchTerm, dateFrom, dateTo, sortConfig, isInitialMount]);

  const categories = [
    { id: 'all', name: 'All Categories', icon: '📦' },
    { id: 'car-truck-tractor', name: 'Car–Truck–Tractor', icon: '🚗' },
    { id: 'bike', name: 'Bike', icon: '🏍️' },
    { id: 'ups-inverter', name: 'UPS', icon: '⚡' }
  ];

  useEffect(() => {
    fetchSoldBatteries();
  }, [selectedCategory, dateFrom, dateTo]);

  const fetchSoldBatteries = async () => {
    setLoading(true);
    setError('');
    try {
      // Use new sales_item endpoint
      const filters = {
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        search: searchTerm || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      };
      const data = await api.getSalesItems(filters);
      // Ensure we always store an array to avoid runtime errors
      setSoldBatteries(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load sold batteries');
      setSoldBatteries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      if (searchTerm !== undefined) {
        fetchSoldBatteries();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(/,/g, ', '); // Ensure proper spacing
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getFilteredBatteries = () => {
    let data = soldBatteries;

    // Text search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter((battery) => {
        return (
          (battery.NAME || battery.product_name || '').toLowerCase().includes(term) ||
          (battery.SKU || battery.sku || '').toLowerCase().includes(term) ||
          (battery.SERIAL_NUMBER || battery.serial_number || '').toLowerCase().includes(term) ||
          (battery.customer_name || '').toLowerCase().includes(term) ||
          (battery.customer_mobile_number || battery.customer_phone || '').toLowerCase().includes(term) ||
          (battery.customer_vehicle_number || battery.vehicle_number || '').toLowerCase().includes(term)
        );
      });
    }

    // Sorting
    const sorted = [...data];
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      switch (sortConfig.field) {
        case 'date':
          return (new Date(a.purchase_date || a.created_at || a.sold_date) - new Date(b.purchase_date || b.created_at || b.sold_date)) * dir;
        case 'name':
          return (a.display_name || a.NAME || a.name || a.product_name || '').localeCompare(
            b.display_name || b.NAME || b.name || b.product_name || ''
          ) * dir;
        case 'sku':
          return (a.display_sku || a.SKU || a.sku || '').localeCompare(b.display_sku || b.SKU || b.sku || '') * dir;
        case 'customer':
          return (a.customer_name || '').localeCompare(b.customer_name || '') * dir;
        case 'amount':
          return ((parseFloat(a.final_amount || a.amount) || 0) - (parseFloat(b.final_amount || b.amount) || 0)) * dir;
        default:
          return 0;
      }
    });

    return sorted;
  };

  const handleSort = (field) => {
    setSortConfig((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
  };

  const getSortIcon = (field) => {
    if (sortConfig.field !== field) return '↕️';
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };

  const handleDownloadPDF = async (invoiceNumber) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE}/invoices/${invoiceNumber}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      await Swal.fire('Error!', 'Failed to download PDF: ' + err.message, 'error');
    }
  };

  const handlePrintInvoice = (invoiceNumber) => {
    // Navigate to invoice page for printing, with return info
    navigate(`/invoice/${invoiceNumber}?returnTo=sold-batteries`);
  };

  // Group batteries by invoice_number
  const groupedByInvoice = () => {
    const groups = {};
    getFilteredBatteries().forEach(battery => {
      const invoiceNum = battery.invoice_number || 'N/A';
      if (!groups[invoiceNum]) {
        groups[invoiceNum] = [];
      }
      groups[invoiceNum].push(battery);
    });
    return groups;
  };

  return (
    <div className="inventory-section">
      <div className="section-header">
        <h2>Sold Batteries</h2>
        <p>View all sold batteries with customer details</p>
      </div>

      <div className="section-content">
        {/* Filters */}
        <div className="filters-container">
          <div className="filter-group">
            <label>Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="filter-select"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group" style={{ minWidth: '220px' }}>
            <label>Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="filter-input"
              placeholder="Search by name, SKU, serial, customer..."
            />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading sold batteries...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="error-state">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
            <button onClick={fetchSoldBatteries} className="retry-button">Retry</button>
          </div>
        )}

        {/* Sold Batteries Table */}
        {!loading && !error && (
          <div className="table-container">
            {getFilteredBatteries().length > 0 ? (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Invoice Number</th>
                    <th onClick={() => handleSort('date')} className="sortable">
                      Sold Date
                    </th>
                    <th onClick={() => handleSort('name')} className="sortable">
                      Product Name
                    </th>
                    <th onClick={() => handleSort('sku')} className="sortable">
                      SKU
                    </th>
                    <th>Serial Number</th>
                    <th onClick={() => handleSort('customer')} className="sortable">
                      Customer Name
                    </th>
                    <th>Mobile Number</th>
                    <th>Vehicle Number</th>
                    <th onClick={() => handleSort('amount')} className="sortable">
                      MRP
                    </th>
                    <th>Discount Amount</th>
                    <th>Discount %</th>
                    <th onClick={() => handleSort('amount')} className="sortable">
                      Final Amount
                    </th>
                    <th>Commission</th>
                    <th>Old Battery Trade-In</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedByInvoice()).map(([invoiceNumber, batteries]) => (
                    batteries.map((battery, index) => (
                      <tr key={battery.id}>
                        {index === 0 && (
                          <>
                            <td rowSpan={batteries.length} style={{ fontWeight: 'bold', verticalAlign: 'top', paddingTop: '1rem' }}>
                              {invoiceNumber}
                              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <button
                                  onClick={() => handlePrintInvoice(invoiceNumber)}
                                  style={{
                                    padding: '0.4rem 0.8rem',
                                    fontSize: '0.875rem',
                                    backgroundColor: '#2563eb',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.375rem',
                                    cursor: 'pointer',
                                    width: '100%'
                                  }}
                                >
                                  Print
                                </button>
                                <button
                                  onClick={() => handleDownloadPDF(invoiceNumber)}
                                  style={{
                                    padding: '0.4rem 0.8rem',
                                    fontSize: '0.875rem',
                                    backgroundColor: '#059669',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.375rem',
                                    cursor: 'pointer',
                                    width: '100%'
                                  }}
                                >
                                  Download
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                        <td>{formatDate(battery.purchase_date || battery.created_at || battery.sold_date)}</td>
                        <td className="name-cell">{battery.display_name || battery.NAME || battery.name || battery.product_name || 'N/A'}</td>
                        <td className="sku-cell">{battery.display_sku || battery.SKU || battery.sku || 'N/A'}</td>
                        <td className="serial-cell">{battery.SERIAL_NUMBER || battery.serial_number || 'N/A'}</td>
                        <td>{battery.customer_name || 'N/A'}</td>
                        <td>{battery.customer_mobile_number || battery.customer_phone || 'N/A'}</td>
                        <td>{battery.customer_vehicle_number || battery.vehicle_number || 'N/A'}</td>
                        <td className="price-cell" style={{ verticalAlign: 'middle' }}>
                          {(() => {
                            const mrp = parseFloat(battery.MRP || battery.mrp || 0);
                            return mrp > 0 ? formatCurrency(mrp) : '-';
                          })()}
                        </td>
                        <td className="price-cell" style={{ verticalAlign: 'middle' }}>
                          {(() => {
                            const mrp = parseFloat(battery.MRP || battery.mrp || 0);
                            const finalAmount = parseFloat(battery.final_amount || battery.amount || 0);
                            // Always calculate discount from MRP and final_amount (source of truth)
                            const calculatedDiscount = mrp > finalAmount ? mrp - finalAmount : 0;
                            return calculatedDiscount > 0 ? formatCurrency(calculatedDiscount) : '-';
                          })()}
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          {(() => {
                            const mrp = parseFloat(battery.MRP || battery.mrp || 0);
                            const finalAmount = parseFloat(battery.final_amount || battery.amount || 0);
                            if (mrp > 0 && finalAmount > 0) {
                              // Always calculate discount from MRP and final_amount (source of truth)
                              const calculatedDiscount = mrp > finalAmount ? mrp - finalAmount : 0;
                              const discountPercent = (calculatedDiscount / mrp) * 100;
                              return discountPercent > 0 ? `${discountPercent.toFixed(2)}%` : '-';
                            }
                            return '-';
                          })()}
                        </td>
                        <td className="price-cell" style={{ verticalAlign: 'middle' }}>
                          <div style={{ lineHeight: '1.5' }}>
                            {formatCurrency(battery.final_amount || battery.amount)}
                            {battery.old_battery_trade_in_value > 0 && (
                              <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.25rem', fontStyle: 'italic' }}>
                                Trade-in: -{formatCurrency(battery.old_battery_trade_in_value)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ verticalAlign: 'top' }}>
                          {battery.has_commission ? (
                            <div style={{ fontSize: '0.875rem' }}>
                              <div style={{ fontWeight: '600', color: '#059669' }}>
                                {formatCurrency(battery.commission_amount || 0)}
                              </div>
                              {battery.commission_agent_name && (
                                <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                  {battery.commission_agent_name}
                                  {battery.commission_agent_mobile && ` (${battery.commission_agent_mobile})`}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>—</span>
                          )}
                        </td>
                        <td style={{ verticalAlign: 'top' }}>
                          {battery.old_battery_brand || battery.old_battery_serial_number || battery.old_battery_trade_in_value > 0 ? (
                            <div style={{ fontSize: '0.875rem' }}>
                              {battery.old_battery_brand && (
                                <div style={{ fontWeight: '600', color: '#3b82f6' }}>
                                  {battery.old_battery_brand}
                                  {battery.old_battery_name && ` ${battery.old_battery_name}`}
                                </div>
                              )}
                              {battery.old_battery_serial_number && (
                                <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                  SN: {battery.old_battery_serial_number}
                                </div>
                              )}
                              {battery.old_battery_ah_va && (
                                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                  {battery.old_battery_ah_va}
                                </div>
                              )}
                              {battery.old_battery_trade_in_value > 0 && (
                                <div style={{ color: '#059669', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: '600' }}>
                                  Value: {formatCurrency(battery.old_battery_trade_in_value)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="no-data">
                <div className="no-data-icon">📭</div>
                <h3>No Sold Batteries Found</h3>
                <p>No sold batteries found for the selected filters.</p>
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        {!loading && !error && getFilteredBatteries().length > 0 && (
          <div className="summary-section" style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Total Sold: {getFilteredBatteries().length} batteries</strong>
              </div>
              <div>
                <strong>Total Amount: {formatCurrency(
                  getFilteredBatteries().reduce((sum, b) => sum + (parseFloat(b.final_amount || b.amount) || 0), 0)
                )}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SoldBatteries;


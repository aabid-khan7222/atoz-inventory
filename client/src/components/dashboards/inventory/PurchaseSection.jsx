import React, { useState, useEffect } from 'react';
import api from '../../../api';
import { getFormState, saveFormState } from '../../../utils/formStateManager';
import './InventorySection.css';

const STORAGE_KEY = 'purchaseSectionState';

const PurchaseSection = ({ onBack }) => {
  // Load saved state using utility (automatically handles refresh detection)
  const savedState = getFormState(STORAGE_KEY);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(() => savedState?.filters || {
    category: 'all',
    dateFrom: '',
    dateTo: '',
    supplier: '',
    search: ''
  });
  const [sortConfig, setSortConfig] = useState(() => savedState?.sortConfig || { field: 'purchase_date', direction: 'desc' });
  const [pagination, setPagination] = useState(() => savedState?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
  const [stats, setStats] = useState(null);
  
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Save state to sessionStorage
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    
    const stateToSave = {
      filters,
      sortConfig,
      pagination: { ...pagination, total: 0, totalPages: 0 } // Don't save computed values
    };
    saveFormState(STORAGE_KEY, stateToSave);
  }, [filters, sortConfig, pagination.page, pagination.limit, isInitialMount]);

  const categories = [
    { id: 'all', name: 'All Categories' },
    { id: 'car-truck-tractor', name: 'Car/Truck/Tractor Battery' },
    { id: 'bike', name: 'Bike Battery' },
    { id: 'ups-inverter', name: 'Inverter & Battery' },
    { id: 'water', name: 'Water Products' }
  ];

  useEffect(() => {
    fetchPurchases();
  }, [filters, sortConfig, pagination.page]);

  const fetchPurchases = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getPurchases({
        ...filters,
        sortBy: sortConfig.field,
        sortOrder: sortConfig.direction,
        page: pagination.page,
        limit: pagination.limit
      });
      
      if (response && response.purchases) {
        setPurchases(response.purchases);
        if (response.pagination) {
          setPagination(prev => ({
            ...prev,
            total: response.pagination.total,
            totalPages: response.pagination.totalPages
          }));
        }
      } else {
        // Backward compatibility
        setPurchases(Array.isArray(response) ? response : []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load purchases');
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const statsData = await api.getPurchaseStats(filters);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load purchase stats:', err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const handleSort = (field) => {
    setSortConfig((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'desc' ? 'asc' : 'desc' };
      }
      return { field, direction: 'desc' };
    });
  };

  const getSortIcon = (field) => {
    return null; // No visual indicators - sorting is handled by column highlighting
  };
  
  const getHeaderStyle = (field) => {
    const baseStyle = {
      cursor: 'pointer',
      userSelect: 'none',
      fontWeight: 600,
      transition: 'all 0.2s'
    };
    
    if (sortConfig.field === field) {
      return {
        ...baseStyle,
        // Same color as other headers; only sort state changes via CSS highlighting if needed
      };
    }
    
    return baseStyle;
  };

  const getProductTypeName = (productTypeId) => {
    const typeMap = {
      1: 'Car/Truck/Tractor Battery',
      2: 'Bike Battery',
      3: 'Inverter & Battery'
    };
    return typeMap[productTypeId] || 'Unknown';
  };

  return (
    <div className="inventory-section">
      <div className="section-header">
        <h2>Purchase Section</h2>
        <p>View all purchase records with complete details</p>
      </div>

      <div className="section-content">
        {/* Filters */}
        <div className="filters-container" style={{ marginBottom: '1.5rem' }}>
          {/* Search + From Date (stacked) */}
          <div className="filter-group" style={{ flex: '1 1 240px' }}>
            <label>Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="filter-input"
              placeholder="Search by SKU, serial number, purchase number, supplier..."
            />
            <div style={{ marginTop: '0.75rem' }}>
              <label>Date From</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="filter-input"
              />
            </div>
          </div>

          {/* Category + To Date (stacked) */}
          <div className="filter-group" style={{ flex: '1 1 240px' }}>
            <label>Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="filter-select"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <div style={{ marginTop: '0.75rem' }}>
              <label>Date To</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="filter-input"
              />
            </div>
          </div>

        </div>

        {/* Loading State */}
        {loading && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading purchases...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="error-state">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
            <button onClick={fetchPurchases} className="retry-button">Retry</button>
          </div>
        )}

        {/* Purchases Table */}
        {!loading && !error && (
          <>
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
              <table className="history-table" style={{ width: '100%', fontSize: '0.875rem' }}>
                <thead>
                  <tr>
                    <th 
                      onClick={() => handleSort('id')} 
                      className="sortable"
                      style={{ width: '60px', textAlign: 'center', ...getHeaderStyle('id') }}
                    >
                      #
                    </th>
                    <th 
                      onClick={() => handleSort('purchase_date')} 
                      className="sortable"
                      style={getHeaderStyle('purchase_date')}
                    >
                      Purchase Date
                    </th>
                    <th 
                      onClick={() => handleSort('purchase_number')} 
                      className="sortable"
                      style={getHeaderStyle('purchase_number')}
                    >
                      Purchase Number
                    </th>
                    <th 
                      onClick={() => handleSort('product_series')} 
                      className="sortable"
                      style={getHeaderStyle('product_series')}
                    >
                      Series
                    </th>
                    <th 
                      onClick={() => handleSort('product_sku')} 
                      className="sortable"
                      style={getHeaderStyle('product_sku')}
                    >
                      Product SKU
                    </th>
                    <th 
                      onClick={() => handleSort('serial_number')} 
                      className="sortable"
                      style={getHeaderStyle('serial_number')}
                    >
                      Serial Number
                    </th>
                    <th 
                      onClick={() => handleSort('supplier_name')} 
                      className="sortable"
                      style={getHeaderStyle('supplier_name')}
                    >
                      Supplier
                    </th>
                    <th 
                      onClick={() => handleSort('dp')} 
                      className="sortable"
                      style={{ textAlign: 'right', ...getHeaderStyle('dp') }}
                    >
                      DP
                    </th>
                    <th 
                      onClick={() => handleSort('purchase_value')} 
                      className="sortable"
                      style={{ textAlign: 'right', ...getHeaderStyle('purchase_value') }}
                    >
                      Purchase Value
                    </th>
                    <th 
                      onClick={() => handleSort('discount_amount')} 
                      className="sortable"
                      style={{ textAlign: 'right', ...getHeaderStyle('discount_amount') }}
                    >
                      Discount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.length > 0 ? (
                    purchases.map((purchase, index) => (
                      <tr key={purchase.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ textAlign: 'center', padding: '0.75rem', color: '#64748b' }}>
                          {(pagination.page - 1) * pagination.limit + index + 1}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          {formatDate(purchase.purchase_date)}
                        </td>
                        <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontWeight: 500 }}>
                          {purchase.purchase_number || 'N/A'}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          {purchase.product_series || 'N/A'}
                        </td>
                        <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>
                          {purchase.product_sku || 'N/A'}
                        </td>
                        <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>
                          {purchase.serial_number || 'N/A'}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          {purchase.supplier_name || 'N/A'}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: '#3b82f6' }}>
                          {formatCurrency(purchase.dp || 0)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>
                          {formatCurrency(purchase.purchase_value || 0)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#f59e0b' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end' }}>
                            <span style={{ fontWeight: 600 }}>
                              {formatCurrency(purchase.discount_amount || 0)}
                            </span>
                            {purchase.discount_percent > 0 && (
                              <small style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                ({parseFloat(purchase.discount_percent || 0).toFixed(2)}%)
                              </small>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="10" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                        <div className="no-data">
                          <div className="no-data-icon">📋</div>
                          <h3>No Purchases Found</h3>
                          <p>No purchase records found for the selected filters.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginTop: '1.5rem',
                padding: '1rem',
                background: '#f8fafc',
                borderRadius: '0.5rem'
              }}>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} purchases
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    style={{
                      padding: '0.5rem 1rem',
                      background: pagination.page === 1 ? '#e2e8f0' : '#3b82f6',
                      color: pagination.page === 1 ? '#94a3b8' : 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: pagination.page === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    Previous
                  </button>
                  <div style={{ 
                    padding: '0.5rem 1rem', 
                    background: 'white', 
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontWeight: 500
                  }}>
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                    disabled={pagination.page >= pagination.totalPages}
                    style={{
                      padding: '0.5rem 1rem',
                      background: pagination.page >= pagination.totalPages ? '#e2e8f0' : '#3b82f6',
                      color: pagination.page >= pagination.totalPages ? '#94a3b8' : 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PurchaseSection;

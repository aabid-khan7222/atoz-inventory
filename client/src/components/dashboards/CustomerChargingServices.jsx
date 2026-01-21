import { useState, useEffect } from 'react';
import { getMyChargingServices } from '../../api';
import { getFormState, saveFormState } from '../../utils/formStateManager';
import './DashboardContent.css';

const STORAGE_KEY = 'customerChargingServicesState';

const CustomerChargingServices = () => {
  // Load saved state using utility (automatically handles refresh detection)
  const savedState = getFormState(STORAGE_KEY);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState(() => savedState?.statusFilter || 'all');
  const [searchTerm, setSearchTerm] = useState(() => savedState?.searchTerm || '');
  const [searchInput, setSearchInput] = useState(() => savedState?.searchInput || '');
  const [dateFrom, setDateFrom] = useState(() => savedState?.dateFrom || '');
  const [dateTo, setDateTo] = useState(() => savedState?.dateTo || '');

  // Pagination state
  const [pagination, setPagination] = useState(() => savedState?.pagination || {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 10
  });
  
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Save state to sessionStorage
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    
    const stateToSave = {
      statusFilter,
      searchTerm,
      searchInput,
      dateFrom,
      dateTo,
      pagination: { ...pagination, totalPages: 1, totalItems: 0 }
    };
    saveFormState(STORAGE_KEY, stateToSave);
  }, [statusFilter, searchTerm, searchInput, dateFrom, dateTo, pagination.currentPage, pagination.limit, isInitialMount]);

  // Debounce search input to update searchTerm
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 400); // Wait 400ms after user stops typing
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    loadServices(1);
  }, [statusFilter, dateFrom, dateTo, searchTerm]);

  const loadServices = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const filters = {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchTerm || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy: 'created_at',
        sortOrder: 'desc',
        page: page,
        limit: pagination.limit
      };
      const response = await getMyChargingServices(filters);
      setServices(response.items || []);
      setPagination(response.pagination || {
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        limit: 10
      });
    } catch (err) {
      setError(err.message || 'Failed to load charging services');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      pending: 'status-pending',
      in_progress: 'status-in-progress',
      completed: 'status-completed',
      collected: 'status-paid',
    };
    return statusMap[status] || 'status-pending';
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      collected: 'Collected',
    };
    return statusMap[status] || status;
  };

  return (
    <div className="dashboard-content">
      <div className="content-header">
        <h2>My Charging Services</h2>
        <p>View your battery charging service history</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="charging-services-filters">
          {/* First Row: Search, Status Filter, Date Fields (Desktop) and Refresh */}
          <div className="charging-filters-row charging-filters-row-top">
            <input
              type="text"
              placeholder="Search by serial, vehicle, brand, SKU..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && loadServices()}
              className="filter-input"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="collected">Collected</option>
            </select>
            {/* Desktop Date Fields - Hidden on Mobile/Tablet */}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="filter-input date-filter-input-desktop"
              title="From Date"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="filter-input date-filter-input-desktop"
              title="To Date"
            />
            <button
              onClick={loadServices}
              className="primary-btn charging-refresh-btn"
            >
              Refresh
            </button>
          </div>
          {/* Second Row: Date Filters with Labels (Mobile/Tablet only) */}
          <div className="charging-filters-row charging-filters-row-bottom">
            <div className="date-filter-wrapper">
              <label className="date-filter-label">From Date</label>
              <div className="date-input-container">
                <svg className="date-calendar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="filter-input date-filter-input"
                />
                {!dateFrom && <span className="date-placeholder-text">Select From Date</span>}
              </div>
            </div>
            <div className="date-filter-wrapper">
              <label className="date-filter-label">To Date</label>
              <div className="date-input-container">
                <svg className="date-calendar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="filter-input date-filter-input"
                />
                {!dateTo && <span className="date-placeholder-text">Select To Date</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message" style={{ marginBottom: '1rem', padding: '10px', background: '#fee', color: '#c33', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {/* Services Table */}
      <div className="card">
        <h3>Charging Services</h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
        ) : services.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
            No charging services found
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="transaction-table" style={{ minWidth: '1200px' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Serial Number</th>
                  <th>Brand</th>
                  <th>SKU</th>
                  <th>Ampere</th>
                  <th>Condition</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th>Expected Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service.id}>
                    <td>{formatDate(service.created_at)}</td>
                    <td>{service.battery_serial_number || 'N/A'}</td>
                    <td>{service.battery_brand || 'N/A'}</td>
                    <td>{service.battery_sku || 'N/A'}</td>
                    <td>{service.battery_ampere_rating || 'N/A'}</td>
                    <td>{service.battery_condition || 'N/A'}</td>
                    <td style={{ textAlign: 'right', fontWeight: '600' }}>
                      {formatCurrency(service.service_price || 0)}
                    </td>
                    <td>{service.expected_completion_time || 'N/A'}</td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(service.status)}`}>
                        {getStatusLabel(service.status || 'pending')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginTop: '1.5rem',
                padding: '1rem',
                borderTop: '1px solid #e2e8f0'
              }}>
                <div style={{ color: '#64748b', fontSize: '0.875rem' }}>
                  Showing {((pagination.currentPage - 1) * pagination.limit) + 1} to {Math.min(pagination.currentPage * pagination.limit, pagination.totalItems)} of {pagination.totalItems} services
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    onClick={() => loadServices(pagination.currentPage - 1)}
                    disabled={pagination.currentPage === 1}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      border: 'none',
                      background: pagination.currentPage === 1 ? '#e2e8f0' : '#1e3a8a',
                      color: pagination.currentPage === 1 ? '#94a3b8' : 'white',
                      cursor: pagination.currentPage === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    Previous
                  </button>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => loadServices(pagination.currentPage + 1)}
                    disabled={pagination.currentPage >= pagination.totalPages}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      border: 'none',
                      background: pagination.currentPage >= pagination.totalPages ? '#e2e8f0' : '#1e3a8a',
                      color: pagination.currentPage >= pagination.totalPages ? '#94a3b8' : 'white',
                      cursor: pagination.currentPage >= pagination.totalPages ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerChargingServices;


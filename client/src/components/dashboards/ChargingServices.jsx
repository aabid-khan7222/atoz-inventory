import { useState, useEffect } from 'react';
import {
  getChargingServices,
  createChargingService,
  updateChargingServiceStatus,
  updateChargingService,
  deleteChargingService,
  getChargingServiceStats,
  getCustomers,
  getCustomerById,
} from '../../api';
import SearchableDropdown from '../common/SearchableDropdown';
import Swal from 'sweetalert2';
import { getFormState, saveFormState } from '../../utils/formStateManager';
import './DashboardContent.css';

const STORAGE_KEY = 'chargingServicesState';

const ChargingServices = () => {
  // Load saved state using utility (automatically handles refresh detection)
  const savedState = getFormState(STORAGE_KEY);
  
  // Initialize default date (tomorrow)
  const getDefaultDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };
  
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(() => savedState?.showForm || false);
  const [editingService, setEditingService] = useState(null);
  const [stats, setStats] = useState(null);
  
  // Pagination state
  const [pagination, setPagination] = useState(() => savedState?.pagination || {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 10
  });

  // Form state
  const [formData, setFormData] = useState(() => savedState?.formData || {
    batterySerialNumber: '',
    customerName: '',
    customerEmail: '',
    customerMobileNumber: '',
    vehicleNumber: '',
    batteryBrand: '',
    batterySku: '',
    batteryAmpereRating: '',
    batteryCondition: 'good',
    servicePrice: '',
    completionDate: getDefaultDate(),
    completionTimeOfDay: 'evening',
    notes: '',
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState(() => savedState?.statusFilter || 'all');
  const [searchTerm, setSearchTerm] = useState(() => savedState?.searchTerm || '');
  const [searchInput, setSearchInput] = useState(() => savedState?.searchInput || '');
  const [dateFrom, setDateFrom] = useState(() => savedState?.dateFrom || '');
  const [dateTo, setDateTo] = useState(() => savedState?.dateTo || '');

  // Customer selection
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => savedState?.selectedCustomerId || null);
  const [isManualEntry, setIsManualEntry] = useState(() => savedState?.isManualEntry || false);
  
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Save state to sessionStorage
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    
    const stateToSave = {
      showForm,
      formData,
      statusFilter,
      searchTerm,
      searchInput,
      dateFrom,
      dateTo,
      selectedCustomerId,
      isManualEntry,
      pagination: { ...pagination, totalPages: 1, totalItems: 0 } // Don't save computed values
    };
    saveFormState(STORAGE_KEY, stateToSave);
  }, [showForm, formData, statusFilter, searchTerm, searchInput, dateFrom, dateTo, selectedCustomerId, isManualEntry, pagination.currentPage, pagination.limit, isInitialMount]);

  // Debounce search input to update searchTerm
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 400); // Wait 400ms after user stops typing
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    loadServices(1);
    loadStats();
  }, [statusFilter, dateFrom, dateTo, searchTerm]);

  // Load customers once on component mount
  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setCustomersLoading(true);
    try {
      const response = await getCustomers({ limit: 1000, page: 1 }); // Increased limit to get more customers
      console.log('Customers response:', response); // Debug log
      const customersList = Array.isArray(response?.items) ? response.items : [];
      console.log('Loaded customers count:', customersList.length); // Debug log
      setCustomers(customersList);
    } catch (err) {
      console.error('Failed to load customers:', err);
      setError(`Failed to load customers: ${err.message}`);
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  };

  const handleCustomerSelect = async (option) => {
    if (!option) {
      clearCustomerSelection();
      return;
    }

    const customerId = option.value || null;
    if (!customerId) {
      clearCustomerSelection();
      return;
    }

    setSelectedCustomerId(customerId);
    setIsManualEntry(false);

    // First try to get customer from the already loaded list
    const customerFromList = customers.find((c) => c.id === customerId);
    let customer = customerFromList;

    // Fetch full customer details (includes GST/company info)
    try {
      const latest = await getCustomerById(customerId);
      if (latest) customer = latest;
    } catch (err) {
      console.warn('Failed to fetch customer details by id, using list data instead', err);
    }

    if (!customer) {
      setError('Customer not found');
      return;
    }

    const sanitizedPhone = (customer.phone || '').replace(/\D/g, '').slice(0, 10);
    setFormData(prev => ({
      ...prev,
      customerName: customer.name || customer.full_name || '',
      customerEmail: customer.email || (sanitizedPhone ? `${sanitizedPhone}@customer.local` : ''),
      customerMobileNumber: sanitizedPhone,
      vehicleNumber: customer.vehicle_number || prev.vehicleNumber, // Keep existing if customer doesn't have one
    }));
  };

  const clearCustomerSelection = () => {
    setSelectedCustomerId(null);
    setIsManualEntry(true);
    setFormData(prev => ({
      ...prev,
      customerName: '',
      customerEmail: '',
      customerMobileNumber: '',
      // Keep vehicle number as it might be service-specific
    }));
  };

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
      const response = await getChargingServices(filters);
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

  const loadStats = async () => {
    try {
      const filters = {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };
      const data = await getChargingServiceStats(filters);
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  // Function to parse stored completion time format "18 December 2025, evening"
  const parseCompletionTime = (completionTime) => {
    if (!completionTime) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return {
        date: tomorrow.toISOString().split('T')[0],
        timeOfDay: 'evening'
      };
    }

    // Try to parse format like "18 December 2025, evening"
    const match = completionTime.match(/^(\d{1,2})\s+(\w+)\s+(\d{4}),\s*(\w+)$/);
    if (match) {
      const [, day, monthName, year, timeOfDay] = match;
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
      const monthIndex = monthNames.findIndex(m => m.toLowerCase() === monthName.toLowerCase());
      
      if (monthIndex !== -1) {
        const date = new Date(year, monthIndex, parseInt(day));
        return {
          date: date.toISOString().split('T')[0],
          timeOfDay: timeOfDay.toLowerCase()
        };
      }
    }

    // Fallback: try to parse as date string or use defaults
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      date: tomorrow.toISOString().split('T')[0],
      timeOfDay: 'evening'
    };
  };

  // Function to format date as "18 December 2025, evening"
  const formatCompletionTime = (date, timeOfDay) => {
    if (!date) return '';
    
    const dateObj = new Date(date);
    const day = dateObj.getDate();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const month = monthNames[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    
    return `${day} ${month} ${year}, ${timeOfDay}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      // Format the completion time before submitting
      const expectedCompletionTime = formatCompletionTime(formData.completionDate, formData.completionTimeOfDay);
      
      const submitData = {
        ...formData,
        expectedCompletionTime: expectedCompletionTime,
        customerId: selectedCustomerId || null, // Pass existing customer ID if selected
      };
      // Remove the separate date and timeOfDay fields
      delete submitData.completionDate;
      delete submitData.completionTimeOfDay;

      if (editingService) {
        await updateChargingService(editingService.id, submitData);
      } else {
        await createChargingService(submitData);
      }
      
      setShowForm(false);
      setEditingService(null);
      resetForm();
      loadServices(pagination.currentPage);
      loadStats();
    } catch (err) {
      setError(err.message || 'Failed to save charging service');
    }
  };

  const handleEdit = async (service) => {
    setEditingService(service);
    const parsed = parseCompletionTime(service.expected_completion_time);
    
    setFormData({
      batterySerialNumber: service.battery_serial_number || '',
      customerName: service.customer_name || '',
      customerEmail: service.customer_email || '',
      customerMobileNumber: service.customer_mobile_number || '',
      vehicleNumber: service.vehicle_number || '',
      batteryBrand: service.battery_brand || '',
      batterySku: service.battery_sku || '',
      batteryAmpereRating: service.battery_ampere_rating || '',
      batteryCondition: service.battery_condition || 'good',
      servicePrice: service.service_price || '',
      completionDate: parsed.date,
      completionTimeOfDay: parsed.timeOfDay,
      notes: service.notes || '',
    });

    // Try to find the customer by email or phone to pre-select them
    if (service.customer_email || service.customer_mobile_number) {
      try {
        const matchingCustomer = customers.find(c => 
          (c.email && c.email.toLowerCase() === (service.customer_email || '').toLowerCase()) ||
          (c.phone && c.phone.replace(/\D/g, '') === (service.customer_mobile_number || '').replace(/\D/g, ''))
        );
        if (matchingCustomer) {
          setSelectedCustomerId(matchingCustomer.id);
          setIsManualEntry(false);
        } else {
          setSelectedCustomerId(null);
          setIsManualEntry(true);
        }
      } catch (err) {
        console.error('Error finding customer for edit:', err);
        setSelectedCustomerId(null);
        setIsManualEntry(true);
      }
    } else {
      setSelectedCustomerId(null);
      setIsManualEntry(true);
    }

    setShowForm(true);
  };

  const handleStatusChange = async (serviceId, newStatus) => {
    try {
      await updateChargingServiceStatus(serviceId, newStatus);
      loadServices(pagination.currentPage);
      loadStats();
    } catch (err) {
      setError(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (serviceId) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to delete this charging service?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      await deleteChargingService(serviceId);
      await Swal.fire('Deleted!', 'The charging service has been deleted.', 'success');
      loadServices(pagination.currentPage);
      loadStats();
    } catch (err) {
      await Swal.fire('Error!', err.message || 'Failed to delete service', 'error');
      setError(err.message || 'Failed to delete service');
    }
  };

  const resetForm = () => {
    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDate = tomorrow.toISOString().split('T')[0];

    setFormData({
      batterySerialNumber: '',
      customerName: '',
      customerEmail: '',
      customerMobileNumber: '',
      vehicleNumber: '',
      batteryBrand: '',
      batterySku: '',
      batteryAmpereRating: '',
      batteryCondition: 'good',
      servicePrice: '',
      completionDate: defaultDate,
      completionTimeOfDay: 'evening',
      notes: '',
    });
    setSelectedCustomerId(null);
    setIsManualEntry(false);
    setEditingService(null);
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

  // Remove client-side filtering since we now do it server-side
  const servicesToDisplay = services;

  return (
    <div className="dashboard-content">
      <div className="content-header">
        <h2>Battery Charging Services</h2>
        <p>Manage battery charging services for all brands</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card metric-card-services">
            <div className="stat-info">
              <h3>Total Services</h3>
              <p className="stat-value">{stats.total_services || 0}</p>
            </div>
          </div>
          <div className="stat-card metric-card-alerts">
            <div className="stat-info">
              <h3>Pending</h3>
              <p className="stat-value">{stats.pending_count || 0}</p>
            </div>
          </div>
          <div className="stat-card metric-card-products">
            <div className="stat-info">
              <h3>In Progress</h3>
              <p className="stat-value">{stats.in_progress_count || 0}</p>
            </div>
          </div>
          <div className="stat-card metric-card-revenue">
            <div className="stat-info">
              <h3>Total Revenue</h3>
              <p className="stat-value">{formatCurrency(stats.total_revenue || 0)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
          {/* Search Bar and Status Filter Row */}
          <div className="charging-search-filter-row" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'nowrap', width: '100%' }}>
            <input
              type="text"
              placeholder="Search by serial, customer, phone, vehicle..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && loadServices()}
              className="filter-input charging-search-input"
              style={{
                flex: 1,
                minWidth: '250px',
                height: '38px',
                padding: '0.6rem 0.75rem',
                boxSizing: 'border-box',
              }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select charging-status-filter"
              style={{
                width: '140px',
                flexShrink: 0,
                height: '38px',
                padding: '0.6rem 0.75rem',
                boxSizing: 'border-box',
              }}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="collected">Collected</option>
            </select>
          </div>
          {/* Desktop: Date Filters and Buttons Row */}
          <div className="charging-desktop-date-buttons-row" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="filter-input charging-date-input-desktop"
              style={{
                minWidth: '140px',
                height: '38px',
                padding: '0.6rem 0.75rem',
                boxSizing: 'border-box',
              }}
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="filter-input charging-date-input-desktop"
              style={{
                minWidth: '140px',
                height: '38px',
                padding: '0.6rem 0.75rem',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={loadServices}
              className="primary-btn charging-refresh-btn"
              style={{
                padding: '0.6rem 1.2rem',
              }}
            >
              Refresh
            </button>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingService(null);
                resetForm();
              }}
              className="primary-btn"
              style={{
                padding: '0.6rem 1.2rem',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: '#059669',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              + New Service
            </button>
          </div>
          {/* Mobile/Tablet: Second Row - Date From and Date To */}
          <div className="charging-date-filters-row" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <div className="charging-date-filter-wrapper">
              <label className="charging-date-filter-label">Date From</label>
              <div className="charging-date-input-container">
                <svg className="charging-date-calendar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="filter-input charging-date-input"
                />
              </div>
            </div>
            <div className="charging-date-filter-wrapper">
              <label className="charging-date-filter-label">Date To</label>
              <div className="charging-date-input-container">
                <svg className="charging-date-calendar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="filter-input charging-date-input"
                />
              </div>
            </div>
          </div>
          {/* Mobile/Tablet: Third Row - Refresh Button */}
          <div className="charging-refresh-button-row">
            <button
              onClick={loadServices}
              className="primary-btn charging-refresh-btn-mobile"
              style={{
                padding: '0.6rem 1.2rem',
              }}
            >
              Refresh
            </button>
          </div>
          {/* Mobile/Tablet: Fourth Row - New Service Button */}
          <div className="charging-new-service-button-row">
            <button
              onClick={() => {
                setShowForm(true);
                setEditingService(null);
                resetForm();
              }}
              className="primary-btn"
              style={{
                padding: '0.6rem 1.2rem',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: '#059669',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              + New Service
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message" style={{ marginBottom: '1rem', padding: '10px', background: '#fee', color: '#c33', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {/* Service Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3>{editingService ? 'Edit Charging Service' : 'New Charging Service'}</h3>
          <form onSubmit={handleSubmit}>
            {/* Customer Selection Section */}
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--corp-bg-hover)', borderRadius: '8px', border: '1px solid var(--corp-border)' }}>
              <h4 style={{ marginBottom: '0.75rem', color: 'var(--corp-text-primary)' }}>Select Customer</h4>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                  <SearchableDropdown
                    label="Search Existing Customer"
                    options={customers.map(customer => ({
                      value: customer.id,
                      label: `${customer.name || customer.full_name || 'N/A'} - ${customer.phone || 'N/A'}${customer.is_b2b ? ' (B2B)' : ''}`,
                      subLabel: customer.email || customer.company || '',
                    }))}
                    value={selectedCustomerId}
                    onChange={(option) => handleCustomerSelect(option)}
                    placeholder={customersLoading ? 'Loading customers...' : customers.length > 0 ? `Search or select customer (${customers.length} available)` : 'Search or select customer'}
                    searchPlaceholder="Search by name, phone, email..."
                    noOptionsText={customersLoading ? 'Loading...' : customers.length === 0 ? 'No customers found. You can enter customer details manually below.' : 'No matching customers found'}
                    disabled={customersLoading || !!editingService}
                  />
                </div>
                {selectedCustomerId && (
                  <button
                    type="button"
                    onClick={clearCustomerSelection}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      border: '1px solid var(--corp-border)',
                      background: 'var(--corp-bg-card)',
                      color: 'var(--corp-text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      marginTop: '1.5rem',
                    }}
                  >
                    Clear Selection
                  </button>
                )}
                <button
                  type="button"
                  onClick={loadCustomers}
                  disabled={customersLoading}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      border: '1px solid var(--corp-primary)',
                      background: 'var(--corp-primary)',
                      color: '#fff',
                      cursor: customersLoading ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      marginTop: '1.5rem',
                      opacity: customersLoading ? 0.6 : 1,
                    }}
                >
                  {customersLoading ? 'Loading...' : 'Refresh List'}
                </button>
              </div>
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <small style={{ color: 'var(--corp-text-muted)', fontSize: '0.75rem', display: 'block' }}>
                  {customersLoading 
                    ? 'Loading customers...' 
                    : customers.length > 0 
                      ? `Found ${customers.length} customers (B2B and B2C). ${selectedCustomerId ? 'Customer details will be auto-filled below. You can still edit if needed.' : 'Select an existing customer to auto-fill their details, or enter manually for new customers.'}`
                      : 'No customers found in database. You can enter customer details manually below.'}
                </small>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', alignItems: 'start' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                <label>Battery Serial Number <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="text"
                  value={formData.batterySerialNumber}
                  onChange={(e) => setFormData({ ...formData, batterySerialNumber: e.target.value })}
                  required
                  style={{ flex: '0 0 auto' }}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                <label>Customer Name <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  required
                  style={{ flex: '0 0 auto' }}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                <label>Customer Email <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  required
                  placeholder="customer@example.com"
                  style={{ flex: '0 0 auto' }}
                />
                <small style={{ color: 'var(--corp-text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block', flex: '0 0 auto' }}>
                  {selectedCustomerId 
                    ? 'Customer already exists in system. You can edit details if needed.' 
                    : 'Customer will be auto-created as a user with email as username and mobile as password'}
                </small>
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                <label>Customer Mobile Number <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="tel"
                  value={formData.customerMobileNumber}
                  onChange={(e) => setFormData({ ...formData, customerMobileNumber: e.target.value })}
                  required
                  style={{ flex: '0 0 auto' }}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                <label>Vehicle Number</label>
                <input
                  type="text"
                  value={formData.vehicleNumber}
                  onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                  style={{ flex: '0 0 auto' }}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                <label>Battery Brand</label>
                <input
                  type="text"
                  value={formData.batteryBrand}
                  onChange={(e) => setFormData({ ...formData, batteryBrand: e.target.value })}
                  placeholder="e.g., Exide, Amaron, Luminous, etc."
                  style={{ flex: '0 0 auto' }}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                <label>Battery SKU</label>
                <input
                  type="text"
                  value={formData.batterySku}
                  onChange={(e) => setFormData({ ...formData, batterySku: e.target.value })}
                  style={{ flex: '0 0 auto' }}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                <label>Battery Ampere Rating</label>
                <input
                  type="text"
                  value={formData.batteryAmpereRating}
                  onChange={(e) => setFormData({ ...formData, batteryAmpereRating: e.target.value })}
                  placeholder="e.g., 12V 7Ah"
                  style={{ flex: '0 0 auto' }}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                <label>Battery Condition <span style={{ color: 'red' }}>*</span></label>
                <select
                  value={formData.batteryCondition}
                  onChange={(e) => setFormData({ ...formData, batteryCondition: e.target.value })}
                  required
                  style={{ flex: '0 0 auto' }}
                >
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                <label>Service Price (₹) <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.servicePrice}
                  onChange={(e) => setFormData({ ...formData, servicePrice: e.target.value })}
                  required
                  min="0"
                  style={{ flex: '0 0 auto' }}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                <label>Expected Completion Date <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="date"
                  value={formData.completionDate}
                  onChange={(e) => setFormData({ ...formData, completionDate: e.target.value })}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  style={{ flex: '0 0 auto' }}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                <label>Time of Day <span style={{ color: 'red' }}>*</span></label>
                <select
                  value={formData.completionTimeOfDay}
                  onChange={(e) => setFormData({ ...formData, completionTimeOfDay: e.target.value })}
                  required
                  style={{ flex: '0 0 auto' }}
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                  <option value="night">Night</option>
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes about the battery or service..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" className="primary-btn" style={{ padding: '0.75rem 1.5rem' }}>
                {editingService ? 'Update Service' : 'Create Service'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingService(null);
                  resetForm();
                }}
                style={{ padding: '0.75rem 1.5rem', border: '1px solid var(--corp-border)', borderRadius: '4px', background: 'var(--corp-bg-card)', color: 'var(--corp-text-primary)', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Services Table */}
      <div className="card">
        <h3>Charging Services List</h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
        ) : servicesToDisplay.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
            No charging services found
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="transaction-table" style={{ minWidth: '1500px' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Serial Number</th>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Mobile</th>
                  <th>Vehicle</th>
                  <th>Brand</th>
                  <th>SKU</th>
                  <th>Ampere</th>
                  <th>Condition</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th>Expected Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {servicesToDisplay.map((service) => (
                  <tr key={service.id}>
                    <td>{formatDate(service.created_at)}</td>
                    <td>{service.battery_serial_number || 'N/A'}</td>
                    <td>{service.customer_name || 'N/A'}</td>
                    <td>{service.customer_email || 'N/A'}</td>
                    <td>{service.customer_mobile_number || 'N/A'}</td>
                    <td>{service.vehicle_number || 'N/A'}</td>
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
                        {service.status || 'pending'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <select
                          value={service.status || 'pending'}
                          onChange={(e) => handleStatusChange(service.id, e.target.value)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            background: '#fff',
                            cursor: 'pointer',
                            minWidth: '110px',
                          }}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="collected">Collected</option>
                        </select>
                        <button
                          onClick={() => handleEdit(service)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            background: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(service.id)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            border: 'none',
                            borderRadius: '4px',
                            background: '#ef4444',
                            color: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      </div>
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

export default ChargingServices;


import { useState, useEffect } from 'react';
import { getAllServiceRequests, updateServiceRequestStatus } from '../../api';
import Swal from 'sweetalert2';
import './DashboardContent.css';

const SERVICE_TYPES = {
  battery_testing: 'Battery Testing Service',
  jump_start: 'Jump Start Service',
  inverter_repair: 'Inverter Repairing Service',
  inverter_battery: 'Inverter Battery Service'
};

const STATUS_VALUES = ['pending', 'in_progress', 'completed', 'cancelled'];

const ServiceManagement = () => {
  // Load saved state from sessionStorage
  const getSavedState = () => {
    try {
      const saved = sessionStorage.getItem('serviceManagementState');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load saved ServiceManagement state:', e);
    }
    return null;
  };
  
  const savedState = getSavedState();
  
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState(() => savedState?.pagination || {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 50
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState(() => savedState?.statusFilter || 'all');
  const [serviceTypeFilter, setServiceTypeFilter] = useState(() => savedState?.serviceTypeFilter || 'all');
  const [searchTerm, setSearchTerm] = useState(() => savedState?.searchTerm || '');
  const [searchInput, setSearchInput] = useState(() => savedState?.searchInput || '');
  
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Save state to sessionStorage
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    
    const stateToSave = {
      statusFilter,
      serviceTypeFilter,
      searchTerm,
      searchInput,
      pagination: { ...pagination, totalPages: 1, totalItems: 0 }
    };
    sessionStorage.setItem('serviceManagementState', JSON.stringify(stateToSave));
  }, [statusFilter, serviceTypeFilter, searchTerm, searchInput, pagination.currentPage, pagination.limit, isInitialMount]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    loadServices(1);
  }, [statusFilter, serviceTypeFilter, searchTerm]);

  const loadServices = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const filters = {
        page,
        limit: pagination.limit,
        status: statusFilter,
        serviceType: serviceTypeFilter !== 'all' ? serviceTypeFilter : undefined,
      };
      
      const response = await getAllServiceRequests(filters);
      let filteredServices = response.items || [];

      // Client-side search filtering
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        filteredServices = filteredServices.filter(service => 
          (service.customer_name || '').toLowerCase().includes(term) ||
          (service.customer_phone || '').toLowerCase().includes(term) ||
          (service.customer_email || '').toLowerCase().includes(term) ||
          (service.vehicle_number || '').toLowerCase().includes(term) ||
          (service.vehicle_name || '').toLowerCase().includes(term) ||
          (SERVICE_TYPES[service.service_type] || '').toLowerCase().includes(term) ||
          (service.id?.toString() || '').includes(term)
        );
      }

      setServices(filteredServices);
      setPagination(response.pagination || {
        currentPage: page,
        totalPages: 1,
        totalItems: filteredServices.length,
        limit: pagination.limit
      });
    } catch (err) {
      console.error('Failed to load services:', err);
      setError(err.message || 'Failed to load service requests');
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (serviceId, newStatus, amount = null) => {
    try {
      // If status is 'completed', prompt for amount
      if (newStatus === 'completed') {
        const { value: amountValue } = await Swal.fire({
          title: 'Enter Service Charge',
          text: 'Enter the amount charged for this service:',
          input: 'number',
          inputLabel: 'Amount (₹)',
          inputPlaceholder: 'Enter amount',
          inputAttributes: {
            min: '0',
            step: '0.01',
            style: 'width: 100%; box-sizing: border-box; max-width: 100%;'
          },
          showCancelButton: true,
          confirmButtonText: 'Complete Service',
          cancelButtonText: 'Cancel',
          didOpen: () => {
            // Fix input field overflow issue - ensure everything stays within container
            setTimeout(() => {
              const swalContainer = document.querySelector('.swal2-container');
              if (swalContainer) {
                swalContainer.style.position = 'fixed';
                swalContainer.style.top = '0';
                swalContainer.style.left = '0';
                swalContainer.style.right = '0';
                swalContainer.style.bottom = '0';
                swalContainer.style.zIndex = '99999';
                swalContainer.style.display = 'flex';
                swalContainer.style.alignItems = 'center';
                swalContainer.style.justifyContent = 'center';
                swalContainer.style.padding = '20px';
                swalContainer.style.overflow = 'auto';
                swalContainer.style.boxSizing = 'border-box';
              }
              
              const swalPopup = document.querySelector('.swal2-popup');
              if (swalPopup) {
                // Use SweetAlert2 default width (32em = ~512px)
                swalPopup.style.maxWidth = '32em';
                swalPopup.style.width = '32em';
                swalPopup.style.margin = 'auto';
                swalPopup.style.boxSizing = 'border-box';
                swalPopup.style.overflow = 'hidden';
              }
              
              // Fix HTML container first - this is the parent of input
              const swalHtmlContainer = document.querySelector('.swal2-html-container');
              if (swalHtmlContainer) {
                swalHtmlContainer.style.width = '100%';
                swalHtmlContainer.style.maxWidth = '100%';
                swalHtmlContainer.style.boxSizing = 'border-box';
                swalHtmlContainer.style.overflow = 'hidden';
                swalHtmlContainer.style.padding = '0';
                swalHtmlContainer.style.margin = '0';
              }
              
              // Fix input label container
              const swalInputLabel = document.querySelector('.swal2-input-label');
              if (swalInputLabel) {
                swalInputLabel.style.width = '100%';
                swalInputLabel.style.maxWidth = '100%';
                swalInputLabel.style.boxSizing = 'border-box';
                swalInputLabel.style.display = 'block';
                swalInputLabel.style.marginBottom = '0.5em';
              }
              
              // Fix input field itself - most important
              const swalInput = document.querySelector('.swal2-input');
              if (swalInput) {
                swalInput.style.width = '100%';
                swalInput.style.maxWidth = '100%';
                swalInput.style.boxSizing = 'border-box';
                swalInput.style.padding = '0.625rem 0.75rem';
                swalInput.style.margin = '0';
                swalInput.style.border = '1px solid #d9d9d9';
                swalInput.style.borderRadius = '0.25rem';
              }
              
              // Fix any parent wrapper that might be causing overflow
              const inputParent = swalInput?.parentElement;
              if (inputParent) {
                inputParent.style.width = '100%';
                inputParent.style.maxWidth = '100%';
                inputParent.style.boxSizing = 'border-box';
                inputParent.style.overflow = 'hidden';
                inputParent.style.padding = '0';
                inputParent.style.margin = '0';
              }
              
              // Ensure all direct children of HTML container respect width
              if (swalHtmlContainer) {
                const children = swalHtmlContainer.children;
                for (let i = 0; i < children.length; i++) {
                  const child = children[i];
                  child.style.maxWidth = '100%';
                  child.style.boxSizing = 'border-box';
                  if (child.tagName === 'INPUT') {
                    child.style.width = '100%';
                  }
                }
              }
            }, 100);
          },
          inputValidator: (value) => {
            if (!value || parseFloat(value) <= 0) {
              return 'Please enter a valid amount greater than 0';
            }
          }
        });

        if (amountValue) {
          await updateServiceRequestStatus(serviceId, newStatus, amountValue);
          // Reload services to reflect the change
          loadServices(pagination.currentPage);
          await Swal.fire('Success!', 'Service completed successfully', 'success');
        }
      } else {
        await updateServiceRequestStatus(serviceId, newStatus);
        // Reload services to reflect the change
        loadServices(pagination.currentPage);
      }
    } catch (err) {
      console.error('Failed to update service status:', err);
      await Swal.fire('Error!', `Failed to update service status: ${err.message}`, 'error');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'completed':
        return 'status-paid';
      case 'in_progress':
        return 'status-in-progress';
      case 'cancelled':
        return 'status-error';
      default:
        return 'status-pending';
    }
  };

  const getServiceDetails = (service) => {
    const details = [];
    
    if (['battery_testing', 'jump_start'].includes(service.service_type)) {
      if (service.vehicle_name) details.push(`Vehicle: ${service.vehicle_name}`);
      if (service.fuel_type) details.push(`Fuel: ${service.fuel_type.charAt(0).toUpperCase() + service.fuel_type.slice(1)}`);
      if (service.vehicle_number) details.push(`Vehicle No: ${service.vehicle_number}`);
    } else if (service.service_type === 'inverter_repair') {
      if (service.inverter_va) details.push(`Inverter VA: ${service.inverter_va}`);
      if (service.inverter_voltage) details.push(`Voltage: ${service.inverter_voltage}V`);
    } else if (service.service_type === 'inverter_battery') {
      if (service.battery_ampere_rating) details.push(`Battery Ampere: ${service.battery_ampere_rating}Ah`);
    }
    
    return details.join(' | ');
  };

  return (
    <div className="dashboard-content">
      <div style={{ marginBottom: '1.5rem' }}>
        <h2>Service Management</h2>
        <p style={{ color: 'var(--corp-text-secondary, #64748b)', marginTop: '0.5rem' }}>
          View and manage all customer service requests
        </p>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        padding: '1rem',
        background: 'var(--corp-bg-card, #ffffff)',
        borderRadius: '8px',
        border: '1px solid var(--corp-border, #e2e8f0)'
      }}>
        {/* Search */}
        <div style={{ flex: '1 1 300px', minWidth: '250px' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--corp-text-primary, #0f172a)' }}>
            Search
          </label>
          <input
            type="text"
            placeholder="Search by customer name, phone, email, vehicle number, service type..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{
              width: '100%',
              padding: '0.625rem 0.75rem',
              border: '1px solid var(--corp-border, #cbd5e1)',
              borderRadius: '6px',
              background: 'var(--corp-bg-card, #ffffff)',
              color: 'var(--corp-text-primary, #0f172a)',
              fontSize: '0.875rem'
            }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ flex: '0 1 180px' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--corp-text-primary, #0f172a)' }}>
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '0.625rem 0.75rem',
              border: '1px solid var(--corp-border, #cbd5e1)',
              borderRadius: '6px',
              background: 'var(--corp-bg-card, #ffffff)',
              color: 'var(--corp-text-primary, #0f172a)',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Status</option>
            {STATUS_VALUES.map(status => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Service Type Filter */}
        <div style={{ flex: '0 1 220px' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--corp-text-primary, #0f172a)' }}>
            Service Type
          </label>
          <select
            value={serviceTypeFilter}
            onChange={(e) => setServiceTypeFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '0.625rem 0.75rem',
              border: '1px solid var(--corp-border, #cbd5e1)',
              borderRadius: '6px',
              background: 'var(--corp-bg-card, #ffffff)',
              color: 'var(--corp-text-primary, #0f172a)',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Types</option>
            {Object.entries(SERVICE_TYPES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: '6px',
          color: '#991b1b'
        }}>
          {error}
        </div>
      )}

      {/* Services Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>Loading services...</div>
      ) : services.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          background: 'var(--corp-bg-card, #ffffff)',
          borderRadius: '8px',
          border: '1px solid var(--corp-border, #e2e8f0)'
        }}>
          <p style={{ color: 'var(--corp-text-secondary, #64748b)', fontSize: '1.1rem' }}>
            No service requests found
          </p>
        </div>
      ) : (
        <div style={{
          background: 'var(--corp-bg-card, #ffffff)',
          borderRadius: '8px',
          border: '1px solid var(--corp-border, #e2e8f0)',
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{
                  background: 'var(--corp-bg-tertiary, #f8fafc)',
                  borderBottom: '2px solid var(--corp-border, #e2e8f0)'
                }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary, #0f172a)' }}>
                    Service ID
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary, #0f172a)' }}>
                    Customer Details
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary, #0f172a)' }}>
                    Service Type
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary, #0f172a)' }}>
                    Service Details
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary, #0f172a)' }}>
                    Vehicle Details
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary, #0f172a)' }}>
                    Request Date
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary, #0f172a)' }}>
                    Status
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary, #0f172a)' }}>
                    Amount
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: 'var(--corp-text-primary, #0f172a)' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr
                    key={service.id}
                    style={{
                      borderBottom: '1px solid var(--corp-border-light, #f1f5f9)',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--corp-bg-hover, #f8fafc)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td style={{ padding: '1rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                      <strong>#{service.id}</strong>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                      <div>
                        <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                          {service.customer_name || 'N/A'}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--corp-text-secondary, #64748b)' }}>
                          {service.customer_phone || 'N/A'}
                        </div>
                        {service.customer_email && (
                          <div style={{ fontSize: '0.875rem', color: 'var(--corp-text-secondary, #64748b)' }}>
                            {service.customer_email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                      {SERVICE_TYPES[service.service_type] || service.service_type || 'N/A'}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                      <div style={{ fontSize: '0.875rem' }}>
                        {getServiceDetails(service) || 'N/A'}
                      </div>
                      {service.notes && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', fontStyle: 'italic', color: 'var(--corp-text-secondary, #64748b)' }}>
                          Notes: {service.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                      {['battery_testing', 'jump_start'].includes(service.service_type) ? (
                        <div style={{ fontSize: '0.875rem' }}>
                          {service.vehicle_name && <div><strong>Name:</strong> {service.vehicle_name}</div>}
                          {service.vehicle_number && <div><strong>Number:</strong> {service.vehicle_number}</div>}
                          {service.fuel_type && <div><strong>Fuel:</strong> {service.fuel_type.charAt(0).toUpperCase() + service.fuel_type.slice(1)}</div>}
                          {!service.vehicle_name && !service.vehicle_number && !service.fuel_type && 'N/A'}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--corp-text-secondary, #64748b)' }}>N/A</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                      <div style={{ fontSize: '0.875rem' }}>
                        {formatDate(service.created_at)}
                      </div>
                      {service.updated_at !== service.created_at && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--corp-text-secondary, #64748b)', marginTop: '0.25rem' }}>
                          Updated: {formatDate(service.updated_at)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`status-badge ${getStatusBadgeClass(service.status)}`}>
                        {service.status ? service.status.charAt(0).toUpperCase() + service.status.slice(1).replace('_', ' ') : 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                      {service.amount ? (
                        <span style={{ fontWeight: '600', color: 'var(--corp-text-success, #059669)' }}>
                          ₹{parseFloat(service.amount).toFixed(2)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--corp-text-secondary, #64748b)' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <select
                        value={service.status || 'pending'}
                        onChange={(e) => handleStatusChange(service.id, e.target.value)}
                        style={{
                          padding: '0.5rem 0.75rem',
                          border: '1px solid var(--corp-border, #cbd5e1)',
                          borderRadius: '6px',
                          background: 'var(--corp-bg-card, #ffffff)',
                          color: 'var(--corp-text-primary, #0f172a)',
                          fontSize: '0.875rem',
                          cursor: 'pointer'
                        }}
                      >
                        {STATUS_VALUES.map(status => (
                          <option key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '1rem',
              borderTop: '1px solid var(--corp-border, #e2e8f0)'
            }}>
              <button
                onClick={() => loadServices(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid var(--corp-border, #cbd5e1)',
                  borderRadius: '6px',
                  background: pagination.currentPage === 1 ? 'var(--corp-bg-tertiary, #f8fafc)' : 'var(--corp-bg-card, #ffffff)',
                  color: 'var(--corp-text-primary, #0f172a)',
                  cursor: pagination.currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: pagination.currentPage === 1 ? 0.5 : 1
                }}
              >
                Previous
              </button>
              <span style={{ color: 'var(--corp-text-primary, #0f172a)' }}>
                Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalItems} total)
              </span>
              <button
                onClick={() => loadServices(pagination.currentPage + 1)}
                disabled={pagination.currentPage >= pagination.totalPages}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid var(--corp-border, #cbd5e1)',
                  borderRadius: '6px',
                  background: pagination.currentPage >= pagination.totalPages ? 'var(--corp-bg-tertiary, #f8fafc)' : 'var(--corp-bg-card, #ffffff)',
                  color: 'var(--corp-text-primary, #0f172a)',
                  cursor: pagination.currentPage >= pagination.totalPages ? 'not-allowed' : 'pointer',
                  opacity: pagination.currentPage >= pagination.totalPages ? 0.5 : 1
                }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ServiceManagement;


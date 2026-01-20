import { useState, useEffect } from 'react';
import { getAllServiceRequests, updateServiceRequestStatus, confirmServiceRequest, cancelPendingServiceRequestByAdmin, getCustomers, createServiceRequestByAdmin } from '../../api';
import Swal from 'sweetalert2';
import { getFormState, saveFormState } from '../../utils/formStateManager';
import './DashboardContent.css';

const SERVICE_TYPES = {
  battery_testing: 'Battery Testing Service',
  jump_start: 'Jump Start Service',
  inverter_repair: 'Inverter Repairing Service',
  inverter_battery: 'Inverter Battery Service'
};

const STATUS_VALUES = ['pending', 'in_progress', 'completed', 'cancelled'];

const STORAGE_KEY = 'serviceManagementState';

const ServiceManagement = () => {
  // Load saved state using utility (automatically handles refresh detection)
  const savedState = getFormState(STORAGE_KEY);
  
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
  
  // New Service Modal State
  const [showNewServiceModal, setShowNewServiceModal] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [newServiceForm, setNewServiceForm] = useState({
    serviceType: 'battery_testing',
    vehicleName: '',
    fuelType: 'petrol',
    vehicleNumber: '',
    inverterVa: '',
    inverterVoltage: '',
    batteryAmpereRating: '',
    notes: '',
    customerName: '',
    customerPhone: '',
    customerEmail: ''
  });
  const [submittingService, setSubmittingService] = useState(false);
  const FUEL_TYPES = ['petrol', 'diesel', 'gas', 'electric'];
  const SERVICE_TYPES_ARRAY = [
    { value: 'battery_testing', label: 'Battery Testing Service' },
    { value: 'jump_start', label: 'Jump Start Service' },
    { value: 'inverter_repair', label: 'Inverter Repairing Service' },
    { value: 'inverter_battery', label: 'Inverter Battery Service' }
  ];
  
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
    saveFormState(STORAGE_KEY, stateToSave);
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

  // Load customers for dropdown
  useEffect(() => {
    if (showNewServiceModal && !isNewCustomer && showCustomerDropdown) {
      loadCustomers();
    }
  }, [showNewServiceModal, customerSearchTerm, isNewCustomer, showCustomerDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCustomerDropdown && !event.target.closest('[data-customer-dropdown]')) {
        setShowCustomerDropdown(false);
      }
    };

    if (showCustomerDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showCustomerDropdown]);

  const loadCustomers = async () => {
    try {
      const response = await getCustomers({ search: customerSearchTerm, limit: 100 });
      setCustomers(response.items || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setShowCustomerDropdown(false);
    setCustomerSearchTerm('');
    // Don't auto-fill form fields for existing customers
  };

  const handleNewServiceSubmit = async (e) => {
    e.preventDefault();
    setSubmittingService(true);

    try {
      const payload = {
        customerId: isNewCustomer ? null : selectedCustomer?.id,
        isNewCustomer,
        customerName: newServiceForm.customerName,
        customerPhone: newServiceForm.customerPhone,
        customerEmail: newServiceForm.customerEmail,
        serviceType: newServiceForm.serviceType,
        vehicleName: ['battery_testing', 'jump_start'].includes(newServiceForm.serviceType) ? newServiceForm.vehicleName : undefined,
        fuelType: ['battery_testing', 'jump_start'].includes(newServiceForm.serviceType) ? newServiceForm.fuelType : undefined,
        vehicleNumber: ['battery_testing', 'jump_start'].includes(newServiceForm.serviceType) ? newServiceForm.vehicleNumber : undefined,
        inverterVa: newServiceForm.serviceType === 'inverter_repair' ? newServiceForm.inverterVa : undefined,
        inverterVoltage: newServiceForm.serviceType === 'inverter_repair' ? newServiceForm.inverterVoltage : undefined,
        batteryAmpereRating: newServiceForm.serviceType === 'inverter_battery' ? newServiceForm.batteryAmpereRating : undefined,
        notes: newServiceForm.notes || undefined
      };

      await createServiceRequestByAdmin(payload);
      await Swal.fire('Success!', 'Service request created successfully.', 'success');
      
      setShowNewServiceModal(false);
      setSelectedCustomer(null);
      setIsNewCustomer(false);
      setNewServiceForm({
        serviceType: 'battery_testing',
        vehicleName: '',
        fuelType: 'petrol',
        vehicleNumber: '',
        inverterVa: '',
        inverterVoltage: '',
        batteryAmpereRating: '',
        notes: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
      });
      setCustomerSearchTerm('');
      loadServices(pagination.currentPage);
    } catch (err) {
      console.error('Failed to create service:', err);
      await Swal.fire('Error!', `Failed to create service: ${err.message}`, 'error');
    } finally {
      setSubmittingService(false);
    }
  };

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

      // Filter out cancelled requests from display (they should not show in Services section)
      // Only show cancelled if explicitly filtered
      if (statusFilter !== 'cancelled') {
        filteredServices = filteredServices.filter(service => service.status !== 'cancelled');
      }

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

  const handleConfirmRequest = async (serviceId, service) => {
    try {
      const result = await Swal.fire({
        title: 'Confirm Service Request?',
        html: `
          <div style="text-align: left; padding: 1rem 0;">
            <p style="margin-bottom: 0.75rem;"><strong>Service ID:</strong> #${serviceId}</p>
            <p style="margin-bottom: 0.75rem;"><strong>Customer:</strong> ${service.customer_name || 'N/A'}</p>
            <p style="margin-bottom: 0.75rem;"><strong>Phone:</strong> ${service.customer_phone || 'N/A'}</p>
            <p style="margin-bottom: 0.75rem;"><strong>Service Type:</strong> ${SERVICE_TYPES[service.service_type] || service.service_type}</p>
            <p style="margin-bottom: 0;"><strong>Confirm this service request?</strong></p>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, Confirm',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#059669',
        cancelButtonColor: '#dc2626',
        reverseButtons: true
      });

      if (result.isConfirmed) {
        await confirmServiceRequest(serviceId);
        await Swal.fire('Confirmed!', 'Service request has been confirmed and moved to active requests.', 'success');
        loadServices(pagination.currentPage);
      }
    } catch (err) {
      console.error('Failed to confirm service request:', err);
      await Swal.fire('Error!', `Failed to confirm service request: ${err.message}`, 'error');
    }
  };

  const handleCancelPendingRequest = async (serviceId, service) => {
    try {
      const result = await Swal.fire({
        title: 'Cancel Service Request?',
        html: `
          <div style="text-align: left; padding: 1rem 0;">
            <p style="margin-bottom: 0.75rem;"><strong>Service ID:</strong> #${serviceId}</p>
            <p style="margin-bottom: 0.75rem;"><strong>Customer:</strong> ${service.customer_name || 'N/A'}</p>
            <p style="margin-bottom: 0.75rem;"><strong>Phone:</strong> ${service.customer_phone || 'N/A'}</p>
            <p style="margin-bottom: 0.75rem;"><strong>Service Type:</strong> ${SERVICE_TYPES[service.service_type] || service.service_type}</p>
            <p style="margin-bottom: 0; color: #dc2626;"><strong>Are you sure you want to cancel this request?</strong></p>
          </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Cancel',
        cancelButtonText: 'No, Keep It',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        reverseButtons: true
      });

      if (result.isConfirmed) {
        await cancelPendingServiceRequestByAdmin(serviceId);
        await Swal.fire('Cancelled!', 'Service request has been cancelled successfully.', 'success');
        // Remove from local state immediately
        setServices(prevServices => prevServices.filter(s => s.id !== serviceId));
        loadServices(pagination.currentPage);
      }
    } catch (err) {
      console.error('Failed to cancel service request:', err);
      await Swal.fire('Error!', `Failed to cancel service request: ${err.message}`, 'error');
    }
  };

  const handleStatusChange = async (serviceId, newStatus, service, amount = null) => {
    try {
      // If status is 'cancelled', show confirmation popup
      if (newStatus === 'cancelled') {
        const result = await Swal.fire({
          title: 'Cancel Service Request?',
          html: `
            <div style="text-align: left; padding: 1rem 0;">
              <p style="margin-bottom: 0.75rem;"><strong>Service ID:</strong> #${serviceId}</p>
              <p style="margin-bottom: 0.75rem;"><strong>Customer:</strong> ${service.customer_name || 'N/A'}</p>
              <p style="margin-bottom: 0.75rem;"><strong>Phone:</strong> ${service.customer_phone || 'N/A'}</p>
              <p style="margin-bottom: 0.75rem;"><strong>Service Type:</strong> ${SERVICE_TYPES[service.service_type] || service.service_type}</p>
              <p style="margin-bottom: 0; color: #dc2626;"><strong>Are you sure you want to cancel this service request?</strong></p>
            </div>
          `,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes, Cancel',
          cancelButtonText: 'No, Keep It',
          confirmButtonColor: '#dc2626',
          cancelButtonColor: '#64748b',
          reverseButtons: true
        });

        if (!result.isConfirmed) {
          // Reset dropdown to previous status
          loadServices(pagination.currentPage);
          return;
        }
      }

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
        if (newStatus === 'cancelled') {
          await Swal.fire('Cancelled!', 'Service request has been cancelled successfully.', 'success');
        }
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
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Service Management</h2>
          <p style={{ color: 'var(--corp-text-secondary, #64748b)', marginTop: '0.5rem' }}>
            View and manage all customer service requests
          </p>
        </div>
        <button
          onClick={() => setShowNewServiceModal(true)}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#059669',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <span>+</span> New Service
        </button>
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
                      <span className={`status-badge ${getStatusBadgeClass(service.status === 'requested' ? 'pending' : service.status)}`}>
                        {service.status === 'requested' 
                          ? 'Pending' 
                          : service.status 
                            ? service.status.charAt(0).toUpperCase() + service.status.slice(1).replace('_', ' ') 
                            : 'N/A'}
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
                      {service.status === 'requested' ? (
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleConfirmRequest(service.id, service)}
                            style={{
                              padding: '0.5rem 0.75rem',
                              border: 'none',
                              borderRadius: '6px',
                              background: '#059669',
                              color: '#ffffff',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              fontWeight: '500',
                              minWidth: '100px'
                            }}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => handleCancelPendingRequest(service.id, service)}
                            style={{
                              padding: '0.5rem 0.75rem',
                              border: 'none',
                              borderRadius: '6px',
                              background: '#dc2626',
                              color: '#ffffff',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              fontWeight: '500',
                              minWidth: '100px'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <select
                          value={service.status || 'pending'}
                          onChange={(e) => handleStatusChange(service.id, e.target.value, service)}
                          style={{
                            padding: '0.5rem 0.75rem',
                            border: '1px solid var(--corp-border, #cbd5e1)',
                            borderRadius: '6px',
                            background: 'var(--corp-bg-card, #ffffff)',
                            color: 'var(--corp-text-primary, #0f172a)',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            minWidth: '150px'
                          }}
                        >
                          {STATUS_VALUES.filter(s => s !== 'requested').map(status => (
                            <option key={status} value={status}>
                              {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                      )}
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

      {/* New Service Modal */}
      {showNewServiceModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '2rem',
          paddingTop: '4rem',
          overflowY: 'auto'
        }}>
          <div style={{
            background: 'var(--corp-bg-card, #ffffff)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '800px',
            maxHeight: 'calc(100vh - 8rem)',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            marginTop: '2rem',
            marginBottom: '2rem'
          }}>
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid var(--corp-border, #e2e8f0)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              background: 'var(--corp-bg-card, #ffffff)',
              zIndex: 1
            }}>
              <h3 style={{ margin: 0, color: 'var(--corp-text-primary, #0f172a)' }}>Create New Service</h3>
              <button
                onClick={() => {
                  setShowNewServiceModal(false);
                  setSelectedCustomer(null);
                  setIsNewCustomer(false);
                  setCustomerSearchTerm('');
                  setShowCustomerDropdown(false);
                  setNewServiceForm({
                    serviceType: 'battery_testing',
                    vehicleName: '',
                    fuelType: 'petrol',
                    vehicleNumber: '',
                    inverterVa: '',
                    inverterVoltage: '',
                    batteryAmpereRating: '',
                    notes: '',
                    customerName: '',
                    customerPhone: '',
                    customerEmail: '',
                  });
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--corp-text-secondary, #64748b)',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'var(--corp-bg-hover, #f8fafc)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleNewServiceSubmit} style={{ padding: '1.5rem' }}>
              {/* Customer Selection */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--corp-text-primary, #0f172a)' }}>
                  Customer
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewCustomer(false);
                      setSelectedCustomer(null);
                      setShowCustomerDropdown(false);
                      setCustomerSearchTerm('');
                      setNewServiceForm(prev => ({
                        ...prev,
                        customerName: '',
                        customerPhone: '',
                        customerEmail: ''
                      }));
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      border: `1px solid ${!isNewCustomer ? '#059669' : 'var(--corp-border, #cbd5e1)'}`,
                      borderRadius: '6px',
                      background: !isNewCustomer ? '#059669' : 'var(--corp-bg-card, #ffffff)',
                      color: !isNewCustomer ? '#ffffff' : 'var(--corp-text-secondary, #64748b)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    Existing Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewCustomer(true);
                      setSelectedCustomer(null);
                      setCustomerSearchTerm('');
                      setShowCustomerDropdown(false);
                      setNewServiceForm(prev => ({
                        ...prev,
                        customerName: '',
                        customerPhone: '',
                        customerEmail: ''
                      }));
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      border: `1px solid ${isNewCustomer ? '#059669' : 'var(--corp-border, #cbd5e1)'}`,
                      borderRadius: '6px',
                      background: isNewCustomer ? '#059669' : 'var(--corp-bg-card, #ffffff)',
                      color: isNewCustomer ? '#ffffff' : 'var(--corp-text-secondary, #64748b)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    New Customer
                  </button>
                </div>

                {!isNewCustomer ? (
                  <div style={{ position: 'relative' }} data-customer-dropdown>
                    <div
                      onClick={() => {
                        setShowCustomerDropdown(!showCustomerDropdown);
                        if (!showCustomerDropdown) {
                          loadCustomers();
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.75rem',
                        border: '1px solid var(--corp-border, #cbd5e1)',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        background: 'var(--corp-bg-card, #ffffff)',
                        color: selectedCustomer ? 'var(--corp-text-primary, #0f172a)' : 'var(--corp-text-muted, #94a3b8)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        minHeight: '38px'
                      }}
                    >
                      <span>
                        {selectedCustomer 
                          ? `${selectedCustomer.name} (${selectedCustomer.phone}${selectedCustomer.email ? ` • ${selectedCustomer.email}` : ''})`
                          : 'Select a customer...'}
                      </span>
                      <span style={{ fontSize: '0.75rem' }}>▼</span>
                    </div>
                    
                    {showCustomerDropdown && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '0.25rem',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        border: '1px solid var(--corp-border, #e2e8f0)',
                        borderRadius: '6px',
                        background: 'var(--corp-bg-card, #ffffff)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        zIndex: 1000
                      }}>
                        <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--corp-border-light, #f1f5f9)' }}>
                          <input
                            type="text"
                            placeholder="Search customer by name, phone, or email..."
                            value={customerSearchTerm}
                            onChange={(e) => {
                              setCustomerSearchTerm(e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onFocus={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              padding: '0.5rem 0.75rem',
                              border: '1px solid var(--corp-border, #cbd5e1)',
                              borderRadius: '4px',
                              fontSize: '0.875rem',
                              background: 'var(--corp-bg-card, #ffffff)',
                              color: 'var(--corp-text-primary, #0f172a)'
                            }}
                          />
                        </div>
                        {customers.length > 0 ? (
                          <div>
                            {customers.map((customer) => (
                              <div
                                key={customer.id}
                                onClick={() => handleCustomerSelect(customer)}
                                style={{
                                  padding: '0.75rem',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid var(--corp-border-light, #f1f5f9)',
                                  background: selectedCustomer?.id === customer.id ? 'var(--corp-accent, #10b981)' : 'var(--corp-bg-card, #ffffff)',
                                  transition: 'background 0.2s',
                                  color: selectedCustomer?.id === customer.id ? '#ffffff' : 'var(--corp-text-primary, #0f172a)'
                                }}
                                onMouseEnter={(e) => {
                                  if (selectedCustomer?.id !== customer.id) {
                                    e.currentTarget.style.background = 'var(--corp-bg-hover, #f8fafc)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (selectedCustomer?.id !== customer.id) {
                                    e.currentTarget.style.background = 'var(--corp-bg-card, #ffffff)';
                                  }
                                }}
                              >
                                <div style={{ fontWeight: '600' }}>{customer.name}</div>
                                <div style={{ fontSize: '0.875rem', color: selectedCustomer?.id === customer.id ? 'rgba(255,255,255,0.9)' : 'var(--corp-text-secondary, #64748b)' }}>
                                  {customer.phone} {customer.email ? `• ${customer.email}` : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--corp-text-muted, #64748b)' }}>
                            {customerSearchTerm ? 'No customers found' : 'Start typing to search...'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                        Customer Name *
                      </label>
                      <input
                        type="text"
                        value={newServiceForm.customerName}
                        onChange={(e) => setNewServiceForm(prev => ({ ...prev, customerName: e.target.value }))}
                        required
                        style={{
                          width: '100%',
                          padding: '0.625rem 0.75rem',
                          border: '1px solid var(--corp-border, #cbd5e1)',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          background: 'var(--corp-bg-card, #ffffff)',
                          color: 'var(--corp-text-primary, #0f172a)'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                        Mobile Number *
                      </label>
                      <input
                        type="text"
                        value={newServiceForm.customerPhone}
                        onChange={(e) => setNewServiceForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                        required
                        style={{
                          width: '100%',
                          padding: '0.625rem 0.75rem',
                          border: '1px solid var(--corp-border, #cbd5e1)',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          background: 'var(--corp-bg-card, #ffffff)',
                          color: 'var(--corp-text-primary, #0f172a)'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                        Email ID *
                      </label>
                      <input
                        type="email"
                        value={newServiceForm.customerEmail}
                        onChange={(e) => setNewServiceForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                        required
                        style={{
                          width: '100%',
                          padding: '0.625rem 0.75rem',
                          border: '1px solid var(--corp-border, #cbd5e1)',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          background: 'var(--corp-bg-card, #ffffff)',
                          color: 'var(--corp-text-primary, #0f172a)'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Service Details */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem', color: 'var(--corp-text-primary, #0f172a)' }}>Service Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                      Service Type *
                    </label>
                    <select
                      value={newServiceForm.serviceType}
                      onChange={(e) => setNewServiceForm(prev => ({ ...prev, serviceType: e.target.value }))}
                      required
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.75rem',
                        border: '1px solid var(--corp-border, #cbd5e1)',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        background: 'var(--corp-bg-card, #ffffff)',
                        color: 'var(--corp-text-primary, #0f172a)'
                      }}
                    >
                      {SERVICE_TYPES_ARRAY.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {['battery_testing', 'jump_start'].includes(newServiceForm.serviceType) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                        Vehicle Name *
                      </label>
                      <input
                        type="text"
                        value={newServiceForm.vehicleName}
                        onChange={(e) => setNewServiceForm(prev => ({ ...prev, vehicleName: e.target.value }))}
                        required
                        placeholder="e.g., Maruti Baleno"
                        style={{
                          width: '100%',
                          padding: '0.625rem 0.75rem',
                          border: '1px solid var(--corp-border, #cbd5e1)',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          background: 'var(--corp-bg-card, #ffffff)',
                          color: 'var(--corp-text-primary, #0f172a)'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                        Fuel Type *
                      </label>
                      <select
                        value={newServiceForm.fuelType}
                        onChange={(e) => setNewServiceForm(prev => ({ ...prev, fuelType: e.target.value }))}
                        required
                        style={{
                          width: '100%',
                          padding: '0.625rem 0.75rem',
                          border: '1px solid var(--corp-border, #cbd5e1)',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          background: 'var(--corp-bg-card, #ffffff)',
                          color: 'var(--corp-text-primary, #0f172a)'
                        }}
                      >
                        {FUEL_TYPES.map(f => (
                          <option key={f} value={f}>{f.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                        Vehicle Number *
                      </label>
                      <input
                        type="text"
                        value={newServiceForm.vehicleNumber}
                        onChange={(e) => setNewServiceForm(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                        required
                        placeholder="e.g., MH12AB1234"
                        style={{
                          width: '100%',
                          padding: '0.625rem 0.75rem',
                          border: '1px solid var(--corp-border, #cbd5e1)',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          background: 'var(--corp-bg-card, #ffffff)',
                          color: 'var(--corp-text-primary, #0f172a)'
                        }}
                      />
                    </div>
                  </div>
                )}

                {newServiceForm.serviceType === 'inverter_repair' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                        Inverter VA *
                      </label>
                      <input
                        type="text"
                        value={newServiceForm.inverterVa}
                        onChange={(e) => setNewServiceForm(prev => ({ ...prev, inverterVa: e.target.value }))}
                        required
                        placeholder="e.g., 900VA"
                        style={{
                          width: '100%',
                          padding: '0.625rem 0.75rem',
                          border: '1px solid var(--corp-border, #cbd5e1)',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          background: 'var(--corp-bg-card, #ffffff)',
                          color: 'var(--corp-text-primary, #0f172a)'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                        Inverter Voltage *
                      </label>
                      <input
                        type="text"
                        value={newServiceForm.inverterVoltage}
                        onChange={(e) => setNewServiceForm(prev => ({ ...prev, inverterVoltage: e.target.value }))}
                        required
                        placeholder="e.g., 12V / 24V"
                        style={{
                          width: '100%',
                          padding: '0.625rem 0.75rem',
                          border: '1px solid var(--corp-border, #cbd5e1)',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          background: 'var(--corp-bg-card, #ffffff)',
                          color: 'var(--corp-text-primary, #0f172a)'
                        }}
                      />
                    </div>
                  </div>
                )}

                {newServiceForm.serviceType === 'inverter_battery' && (
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                      Battery Ampere Rating *
                    </label>
                    <input
                      type="text"
                      value={newServiceForm.batteryAmpereRating}
                      onChange={(e) => setNewServiceForm(prev => ({ ...prev, batteryAmpereRating: e.target.value }))}
                      required
                      placeholder="e.g., 150Ah"
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.75rem',
                        border: '1px solid var(--corp-border, #cbd5e1)',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        background: 'var(--corp-bg-card, #ffffff)',
                        color: 'var(--corp-text-primary, #0f172a)'
                      }}
                    />
                  </div>
                )}

                <div style={{ marginTop: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={newServiceForm.notes}
                    onChange={(e) => setNewServiceForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    placeholder="Any extra information..."
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.75rem',
                      border: '1px solid var(--corp-border, #cbd5e1)',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      resize: 'vertical',
                      background: 'var(--corp-bg-card, #ffffff)',
                      color: 'var(--corp-text-primary, #0f172a)'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewServiceModal(false);
                    setSelectedCustomer(null);
                    setIsNewCustomer(false);
                    setCustomerSearchTerm('');
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: '1px solid var(--corp-border, #cbd5e1)',
                    borderRadius: '6px',
                    background: 'var(--corp-bg-card, #ffffff)',
                    color: 'var(--corp-text-secondary, #64748b)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'var(--corp-bg-hover, #f8fafc)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'var(--corp-bg-card, #ffffff)';
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingService || (!isNewCustomer && !selectedCustomer) || (isNewCustomer && (!newServiceForm.customerName || !newServiceForm.customerPhone || !newServiceForm.customerEmail))}
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: 'none',
                    borderRadius: '6px',
                    background: submittingService ? 'var(--corp-text-muted, #94a3b8)' : '#059669',
                    color: '#ffffff',
                    cursor: submittingService ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!submittingService && !e.target.disabled) {
                      e.target.style.background = '#047857';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!submittingService && !e.target.disabled) {
                      e.target.style.background = '#059669';
                    }
                  }}
                >
                  {submittingService ? 'Creating...' : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceManagement;

